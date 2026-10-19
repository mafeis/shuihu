#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

import { extractFile, listPackage } from "@electron/asar";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const failures = [];
const checked = [];

function relativePath(value) {
  return path.relative(root, value).split(path.sep).join("/");
}

function assertRelease(condition, message) {
  if (!condition) failures.push(message);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

const requiredArtifacts = [
  `release/XingmingShuihu-${version}-mac-arm64.dmg`,
  `release/XingmingShuihu-${version}-mac-arm64.zip`,
  `release/XingmingShuihu-${version}-win-x64.exe`,
  `release/XingmingShuihu-${version}-win-x64.zip`,
  `release/XingmingShuihu-${version}-win-arm64.exe`,
  `release/XingmingShuihu-${version}-win-arm64.zip`,
  "release/mac-arm64/星命水浒.app/Contents/Resources/app.asar",
  "release/mac-arm64/星命水浒.app/Contents/Resources/app.asar.unpacked/node_modules/steamworks.js/dist/osx/steamworksjs.darwin-arm64.node",
  "release/mac-arm64/星命水浒.app/Contents/Resources/app.asar.unpacked/node_modules/steamworks.js/dist/osx/libsteam_api.dylib",
  "release/win-unpacked/resources/app.asar",
  "release/win-unpacked/resources/app.asar.unpacked/node_modules/steamworks.js/dist/win64/steamworksjs.win32-x64-msvc.node",
  "release/win-unpacked/resources/app.asar.unpacked/node_modules/steamworks.js/dist/win64/steam_api64.dll",
  "release/win-arm64-unpacked/resources/app.asar",
  "release/SHA256SUMS-macOS.txt",
  "release/SHA256SUMS-Windows.txt",
];

for (const artifact of requiredArtifacts) {
  const absolute = path.join(root, artifact);
  assertRelease(existsSync(absolute), `missing release artifact: ${artifact}`);
  if (!existsSync(absolute)) continue;
  const info = statSync(absolute);
  checked.push({ file: artifact, bytes: info.size });
  if (artifact.endsWith(".dmg") || artifact.endsWith(".zip") || artifact.endsWith(".exe")) {
    assertRelease(info.size > 100 * 1024 * 1024, `release artifact is unexpectedly small: ${artifact}`);
  }
}

const checksumFiles = [
  "release/SHA256SUMS-macOS.txt",
  "release/SHA256SUMS-Windows.txt",
];
let checksumEntries = 0;
for (const checksumFile of checksumFiles) {
  const absoluteChecksumFile = path.join(root, checksumFile);
  if (!existsSync(absoluteChecksumFile)) continue;
  const lines = readFileSync(absoluteChecksumFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
    if (!match) {
      failures.push(`invalid checksum entry in ${checksumFile}: ${line}`);
      continue;
    }
    const [, expectedHash, declaredFile] = match;
    const artifact = path.join(root, declaredFile);
    if (!existsSync(artifact)) {
      failures.push(`checksum references missing file: ${declaredFile}`);
      continue;
    }
    const actualHash = sha256(readFileSync(artifact));
    assertRelease(
      actualHash === expectedHash.toLowerCase(),
      `checksum mismatch: ${declaredFile}`,
    );
    checksumEntries += 1;
  }
}

const distFiles = walkFiles(path.join(root, "dist"));
const asarArtifacts = [
  "release/mac-arm64/星命水浒.app/Contents/Resources/app.asar",
  "release/win-unpacked/resources/app.asar",
  "release/win-arm64-unpacked/resources/app.asar",
];

for (const asarArtifact of asarArtifacts) {
  const asarPath = path.join(root, asarArtifact);
  if (!existsSync(asarPath)) continue;
  const entries = new Set(
    listPackage(asarPath).map((entry) => entry.replace(/^\/+/, "")),
  );
  for (const requiredEntry of [
    "package.json",
    "electron/main.cjs",
    "electron/preload.cjs",
    "steam/steamworks.json",
    "dist/THIRD_PARTY_NOTICES.txt",
    "build/icon.png",
  ]) {
    assertRelease(entries.has(requiredEntry), `${asarArtifact} is missing ${requiredEntry}`);
  }

  const bundledPackage = JSON.parse(extractFile(asarPath, "package.json").toString("utf8"));
  assertRelease(
    bundledPackage.version === version,
    `${asarArtifact} package version does not match ${version}`,
  );

  for (const distFile of distFiles) {
    const archivePath = relativePath(distFile);
    if (!entries.has(archivePath)) {
      failures.push(`${asarArtifact} is missing ${archivePath}`);
      continue;
    }
    const sourceHash = sha256(readFileSync(distFile));
    const bundledHash = sha256(extractFile(asarPath, archivePath));
    assertRelease(
      sourceHash === bundledHash,
      `${asarArtifact} contains a stale copy of ${archivePath}`,
    );
  }
}

const result = {
  status: failures.length ? "failed" : "passed",
  version,
  artifacts: checked.length,
  checksumEntries,
  distFiles: distFiles.length,
  asarPackages: asarArtifacts.filter((artifact) =>
    existsSync(path.join(root, artifact)),
  ).length,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
