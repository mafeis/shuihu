#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const distDir = path.join(root, "dist");
const packageName = `XingmingShuihu-local-${version}`;
const packageDir = path.join(root, "release", "local-share", packageName);
const siteDir = path.join(packageDir, "site");
const archivePath = path.join(packageDir, `${packageName}.zip`);

async function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath, base)));
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(absolutePath);
    files.push({
      absolutePath,
      file: path.relative(base, absolutePath).split(path.sep).join("/"),
      bytes: info.size,
    });
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

async function sha256File(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "THIRD_PARTY_NOTICES.txt",
  "legal/privacy.html",
  "legal/eula.html",
  "legal/support.html",
  "legal/refund.html",
];
for (const requiredFile of requiredFiles) {
  const info = await stat(path.join(distDir, requiredFile)).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(`Production build is missing ${requiredFile}`);
  }
}

await rm(packageDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(distDir, siteDir, { recursive: true });

// The publishable dist/ remains root-hosted. This copy is served at "/" by the
// bundled local server, so relative paths also let the files open from a folder.
for (const file of await walkFiles(siteDir)) {
  if (!/\.(?:html|js|css|webmanifest)$/i.test(file.file)) continue;
  const source = await readFile(file.absolutePath, "utf8");
  const output = source
    .replace(/((?:src|href|poster|content)=")\/(?!\/)/g, "$1./")
    .replace(/(["'(])\/(assets|legal|app-icon-192\.png|app-icon-512\.png)/g, "$1./$2")
    .replace(/(["'])\.\/manifest\.webmanifest/g, "$1./manifest.webmanifest")
    .replace(
      'navigator.serviceWorker.register("/sw.js"',
      'navigator.serviceWorker.register("./sw.js"',
    );
  if (output !== source) await writeFile(file.absolutePath, output);
}

const launcher = `#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const siteRoot = path.join(__dirname, "site");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};
const headers = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), fullscreen=(self)",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function resolveAsset(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\\0") || decoded.includes("\\\\")) return null;
  const file = path.resolve(siteRoot, "." + path.posix.normalize("/" + decoded));
  return file === siteRoot || file.startsWith(siteRoot + path.sep) ? file : null;
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD", ...headers });
    response.end();
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  } catch {
    response.writeHead(400, headers);
    response.end();
    return;
  }
  let file = resolveAsset(pathname);
  if (!file) {
    response.writeHead(400, headers);
    response.end();
    return;
  }
  fs.stat(file, (error, info) => {
    if (!error && info.isDirectory()) {
      file = path.join(file, "index.html");
      fs.stat(file, (nextError, nextInfo) => send(nextError, nextInfo));
    } else {
      send(error, info);
    }
  });

  function send(error, info) {
    if (error || !info.isFile()) {
      response.writeHead(404, headers);
      response.end("Not found");
      return;
    }
    const contentType = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    const cacheControl = path.basename(file) === "index.html"
      ? "no-cache"
      : "public, max-age=3600";
    response.writeHead(200, {
      ...headers,
      "Content-Length": info.size,
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Service-Worker-Allowed": "/",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(file).on("error", () => response.destroy()).pipe(response);
  }
});

function showError(error) {
  console.error("启动失败：" + error.message);
  console.error("请在解压后的完整文件夹中运行，不要单独移动本文件。");
}

server.on("error", showError);
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  const url = "http://127.0.0.1:" + address.port + "/";
  console.log("");
  console.log("星命水浒正在运行： " + url);
  console.log("关闭此窗口即可停止游戏服务。");
  const command = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["cmd", ["/d", "/c", "start", "", url]]
      : ["xdg-open", [url]];
  execFile(command[0], command[1], { windowsHide: true }, (error) => {
    if (error) {
      console.log("无法自动打开浏览器，请手动访问上面的网址。");
    }
  });
});
`;

const readme = `# 星命水浒：风雪山神庙

版本：${version}

## 开始游玩

1. 先把 ZIP 完整解压，不要直接在压缩包预览中运行。
2. macOS 首次启动时，右键 \`启动游戏.command\` 并选择“打开”。
3. Windows 双击 \`启动游戏.bat\`；已有 Node.js 的 Linux 运行 \`node 启动游戏.js\`。
4. 游戏会在默认浏览器中打开。请保留启动窗口，关闭它即可停止本地游戏服务。

游戏首次启动不需要联网。存档保存在浏览器本地，清理浏览器站点数据前请从游戏设置中导出存档。

此分享包需要 Node.js 20 或更高版本。若要免安装、免 Node.js 直接游玩，请使用同一发行版中的桌面安装包。
Windows x64 版：\`XingmingShuihu-${version}-win-x64.exe\`
macOS Apple 芯片版：\`XingmingShuihu-${version}-mac-arm64.dmg\`
`;

const windowsLauncher = `@echo off
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。
  echo 请先安装 Node.js 20 或更高版本，或改用桌面安装包。
  pause
  exit /b 1
)
node "%~dp0启动游戏.js"
if errorlevel 1 pause
`;

const macLauncher = `#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  printf '%s\\n' "未找到 Node.js。" "请先安装 Node.js 20 或更高版本，或改用桌面安装包。" ""
  read -r -p "按回车键关闭..." _
  exit 1
fi
exec node "启动游戏.js"
`;

await writeFile(path.join(packageDir, "启动游戏.js"), launcher);
await writeFile(path.join(packageDir, "启动游戏.bat"), windowsLauncher);
await writeFile(path.join(packageDir, "启动游戏.command"), macLauncher);
await writeFile(path.join(packageDir, "README.txt"), readme);
await chmod(path.join(packageDir, "启动游戏.command"), 0o755);

const result = await new Promise((resolve, reject) => {
  const child = spawn("python3", ["-m", "zipfile", "-c", archivePath, "."], {
    cwd: packageDir,
    stdio: "ignore",
  });
  child.on("error", reject);
  child.on("close", resolve);
});
if (result !== 0) throw new Error("Unable to create local share archive");

const archiveHash = await sha256File(archivePath);
const archiveBytes = (await stat(archivePath)).size;
const checksumPath = path.join(packageDir, "SHA256SUMS.txt");
await writeFile(checksumPath, `${archiveHash}  ${packageName}.zip\n`);

console.log(
  JSON.stringify(
    {
      status: "packaged",
      archive: path.relative(root, archivePath),
      bytes: archiveBytes,
      sha256: archiveHash,
    },
    null,
    2,
  ),
);
