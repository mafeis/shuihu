#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const distDir = path.join(root, "dist");
const releaseRoot = path.join(root, "release", "browser");
const packageName = `XingmingShuihu-web-${version}`;
const packageDir = path.join(releaseRoot, packageName);
const siteDir = path.join(packageDir, "site");
const deployDir = path.join(packageDir, "deploy");
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

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "THIRD_PARTY_NOTICES.txt",
  "app-icon-192.png",
  "app-icon-512.png",
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
await mkdir(packageDir, { recursive: true });
await cp(distDir, siteDir, { recursive: true });
await mkdir(deployDir, { recursive: true });

const headers = `/*
  Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), fullscreen=(self)
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff

/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /

/manifest.webmanifest
  Cache-Control: no-cache
  Content-Type: application/manifest+json

/assets/*.js
  Cache-Control: public, max-age=31536000, immutable

/assets/*.css
  Cache-Control: public, max-age=31536000, immutable
`;

const nginxConfig = `server {
  listen 443 ssl http2;
  server_name game.example.com;
  root /var/www/xingming-shuihu;
  index index.html;

  add_header Content-Security-Policy "default-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'" always;
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Cross-Origin-Resource-Policy "same-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), fullscreen=(self)" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header X-Content-Type-Options "nosniff" always;

  location = /index.html {
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
  }

  location = /sw.js {
    add_header Cache-Control "no-cache" always;
    add_header Service-Worker-Allowed "/" always;
    types { } default_type text/javascript;
  }

  location = /manifest.webmanifest {
    add_header Cache-Control "no-cache" always;
    types { } default_type application/manifest+json;
  }

  location ~ ^/assets/.*\\.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
`;

const deploymentGuide = `# 星命水浒浏览器发行包

版本：${version}

## 目录

- \`site/\`：可直接上传到 HTTPS 静态站点的完整游戏。
- \`${packageName}.zip\`：\`site/\` 的压缩发行包。
- \`deploy/_headers\`：Netlify、Cloudflare Pages 等平台的响应头配置。
- \`deploy/nginx.conf.sample\`：Nginx 配置样例，部署前必须替换域名、证书路径与站点根目录。
- \`release-manifest.json\`：逐文件大小、SHA-256、构建哈希与运行要求。
- \`SHA256SUMS.txt\`：ZIP 校验和。

## 必需条件

- 正式站点必须使用 HTTPS，并以站点根路径 \`/\` 运行。
- \`/sw.js\` 必须以 \`text/javascript\` 返回，且不缓存。
- \`/manifest.webmanifest\` 必须以 \`application/manifest+json\` 返回，且不缓存。
- 带内容哈希的 \`/assets/*.js\` 和 \`/assets/*.css\` 可长期缓存。
- 不要把角色制作设定图、工作流、模型文件、源工程或部署密钥上传到公开站点。

## 发布后检查

1. 使用正式 HTTPS 域名打开游戏并完成一次九回存档读取。
2. 验证 Manifest 可安装、Service Worker 已激活。
3. 断网刷新后仍进入标题页，已有存档可继续读取。
4. 在真实 Safari、Firefox、iOS 与 Android 设备完成回执。
5. 替换占位域名并完成隐私、EULA、退款、支持与发行主体法律审阅。
`;

await writeFile(path.join(deployDir, "_headers"), headers);
await writeFile(path.join(deployDir, "nginx.conf.sample"), nginxConfig);
await writeFile(path.join(packageDir, "DEPLOYMENT.md"), deploymentGuide);

const siteFiles = await walkFiles(siteDir);
const files = [];
for (const entry of siteFiles) {
  files.push({
    file: entry.file,
    bytes: entry.bytes,
    sha256: await sha256File(entry.absolutePath),
  });
}
const totalBytes = files.reduce((total, entry) => total + entry.bytes, 0);
const buildHash = sha256Text(
  files.map((entry) => `${entry.file}\0${entry.sha256}`).join("\n"),
);

const zip = spawnSync(
  "python3",
  ["-m", "zipfile", "-c", archivePath, "."],
  {
    cwd: siteDir,
    encoding: "utf8",
  },
);
if (zip.status !== 0) {
  throw new Error(
    `Unable to create browser archive: ${zip.stderr || zip.stdout || "unknown error"}`,
  );
}
const archiveHash = await sha256File(archivePath);
const archiveBytes = (await stat(archivePath)).size;

const manifest = {
  schemaVersion: 1,
  product: "星命水浒：风雪山神庙",
  packageName,
  version,
  generatedAt: new Date().toISOString(),
  entrypoint: "site/index.html",
  scope: "/",
  requiredProtocol: "https",
  fileCount: files.length,
  totalBytes,
  buildHash,
  archive: {
    file: `${packageName}.zip`,
    bytes: archiveBytes,
    sha256: archiveHash,
  },
  files,
};

await writeFile(
  path.join(packageDir, "release-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  path.join(packageDir, "SHA256SUMS.txt"),
  `${archiveHash}  ${packageName}.zip\n`,
);

console.log(
  JSON.stringify(
    {
      status: "packaged",
      package: path.relative(root, packageDir),
      archive: path.relative(root, archivePath),
      version,
      fileCount: files.length,
      totalBytes,
      archiveBytes,
      buildHash,
      archiveSha256: archiveHash,
    },
    null,
    2,
  ),
);
