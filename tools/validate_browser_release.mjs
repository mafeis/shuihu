#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const packageName = `XingmingShuihu-web-${version}`;
const packageDir = path.join(root, "release", "browser", packageName);
const manifestPath = path.join(packageDir, "release-manifest.json");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(`unable to read ${path.relative(root, file)}: ${error.message}`);
    return null;
  }
}

async function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath, base)));
    } else if (entry.isFile()) {
      files.push({
        absolutePath,
        file: path.relative(base, absolutePath).split(path.sep).join("/"),
      });
    }
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

const manifest = await readJson(manifestPath);
if (!manifest) {
  console.log(
    JSON.stringify(
      {
        status: "failed",
        version,
        failures,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  const siteDir = path.join(packageDir, "site");
  const actualFiles = await walkFiles(siteDir);
  const declaredFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const actualMap = new Map(
    actualFiles.map((entry) => [entry.file, entry.absolutePath]),
  );
  const declaredMap = new Map(
    declaredFiles.map((entry) => [entry.file, entry]),
  );
  let actualTotalBytes = 0;
  const buildHashEntries = [];

  if (manifest.schemaVersion !== 1) fail("release manifest schemaVersion must be 1");
  if (manifest.version !== version) fail("release manifest version is stale");
  if (manifest.packageName !== packageName) fail("release package name is stale");
  if (manifest.scope !== "/") fail("browser release scope must be /");
  if (manifest.requiredProtocol !== "https") fail("browser release must require HTTPS");
  if (manifest.fileCount !== actualFiles.length) {
    fail(
      `manifest fileCount ${manifest.fileCount} does not match ${actualFiles.length}`,
    );
  }

  for (const [file, absolutePath] of actualMap) {
    if (!declaredMap.has(file)) {
      fail(`site file is not declared in manifest: ${file}`);
      continue;
    }
    const declared = declaredMap.get(file);
    const info = await stat(absolutePath);
    const digest = await sha256(absolutePath);
    actualTotalBytes += info.size;
    buildHashEntries.push(`${file}\0${digest}`);
    if (declared.bytes !== info.size) {
      fail(`byte size mismatch: ${file}`);
    }
    if (declared.sha256 !== digest) {
      fail(`checksum mismatch: ${file}`);
    }
  }
  for (const file of declaredMap.keys()) {
    if (!actualMap.has(file)) fail(`manifest references missing file: ${file}`);
  }

  if (manifest.totalBytes !== actualTotalBytes) {
    fail(
      `manifest totalBytes ${manifest.totalBytes} does not match ${actualTotalBytes}`,
    );
  }
  const actualBuildHash = createHash("sha256")
    .update(buildHashEntries.join("\n"))
    .digest("hex");
  if (manifest.buildHash !== actualBuildHash) {
    fail("release buildHash does not match the site files");
  }

  for (const requiredFile of [
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "THIRD_PARTY_NOTICES.txt",
    "legal/privacy.html",
    "legal/eula.html",
    "legal/support.html",
    "legal/refund.html",
  ]) {
    if (!actualMap.has(requiredFile)) fail(`missing runtime file: ${requiredFile}`);
  }

  const turnaroundFiles = actualFiles.filter((entry) =>
    entry.file.endsWith("/turnaround.png"),
  );
  if (turnaroundFiles.length) {
    fail(`browser release contains ${turnaroundFiles.length} production turnaround images`);
  }
  const sourceMaps = actualFiles.filter((entry) => entry.file.endsWith(".map"));
  if (sourceMaps.length) fail(`browser release contains ${sourceMaps.length} source maps`);
  const rawFiles = actualFiles.filter((entry) => entry.file.startsWith("raw/"));
  if (rawFiles.length) fail(`browser release contains source raw assets`);
  if (actualMap.has("assets/manifest.json")) {
    fail("browser release contains the internal production asset manifest");
  }

  const heroDirs = new Set();
  const heroAssets = new Map();
  for (const entry of actualFiles) {
    const match = entry.file.match(
      /^assets\/characters\/([^/]+)\/(cutout|keyart|thumb)\.(png|webp)$/,
    );
    if (!match) continue;
    heroDirs.add(match[1]);
    const key = `${match[1]}:${match[2]}`;
    heroAssets.set(key, entry.file);
  }
  if (heroDirs.size !== 40) {
    fail(`browser release should contain 40 runtime hero folders, found ${heroDirs.size}`);
  }
  for (const heroId of heroDirs) {
    for (const asset of ["cutout", "keyart", "thumb"]) {
      if (!heroAssets.has(`${heroId}:${asset}`)) {
        fail(`hero ${heroId} is missing runtime ${asset} asset`);
      }
    }
  }

  const runtimeScripts = actualFiles.filter((entry) =>
    /^assets\/(?:index|game-data|lucide)-[^/]+\.js$/.test(entry.file),
  );
  if (runtimeScripts.length < 3) {
    fail("browser release should contain separate app, game-data and icon chunks");
  }
  for (const script of runtimeScripts) {
    const info = await stat(script.absolutePath);
    if (info.size > 550_000) {
      fail(`runtime JavaScript chunk exceeds 550 KB: ${script.file}`);
    }
  }

  const archivePath = path.join(packageDir, manifest.archive?.file || "");
  const archiveInfo = await stat(archivePath).catch(() => null);
  if (!archiveInfo?.isFile()) {
    fail("browser release archive is missing");
  } else {
    if (archiveInfo.size !== manifest.archive.bytes) {
      fail("browser release archive size does not match manifest");
    }
    if ((await sha256(archivePath)) !== manifest.archive.sha256) {
      fail("browser release archive checksum does not match manifest");
    }
  }

  for (const requiredPackageFile of [
    "DEPLOYMENT.md",
    "SHA256SUMS.txt",
    "deploy/_headers",
    "deploy/nginx.conf.sample",
  ]) {
    const info = await stat(path.join(packageDir, requiredPackageFile)).catch(
      () => null,
    );
    if (!info?.isFile()) fail(`missing package file: ${requiredPackageFile}`);
  }
  const headers = await readFile(
    path.join(packageDir, "deploy", "_headers"),
    "utf8",
  ).catch(() => "");
  if (
    !headers.includes("/assets/*.js") ||
    !headers.includes("/assets/*.css")
  ) {
    fail("deployment headers do not apply immutable caching to all hashed JS/CSS");
  }

  const index = await readFile(path.join(siteDir, "index.html"), "utf8").catch(
    () => "",
  );
  if (!index.includes('rel="manifest"')) fail("index.html does not link the manifest");
  if (/localhost|127\.0\.0\.1|100\.122\.17\.21|:8188/i.test(index)) {
    fail("index.html contains a development or generation endpoint");
  }

  const worker = await readFile(path.join(siteDir, "sw.js"), "utf8").catch(
    () => "",
  );
  if (!/xingming-shuihu-web-v\d+/.test(worker)) {
    fail("service worker cache version is missing");
  }

  console.log(
    JSON.stringify(
      {
        status: failures.length ? "failed" : "passed",
        package: path.relative(root, packageDir),
        version,
        files: actualFiles.length,
        heroes: heroDirs.size,
        archiveBytes: archiveInfo?.size || 0,
        buildHash: manifest.buildHash,
        failures,
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
}
