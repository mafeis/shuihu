#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const chromePath =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CHROME_DEBUG_PORT || 9454);
const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = path.resolve("store/steam_assets");
const profileDir = "/tmp/shuihu-steam-assets-profile";

const chineseAssets = [
  { id: "header_capsule", width: 920, height: 430 },
  {
    id: "small_capsule",
    width: 924,
    height: 348,
    outputWidth: 462,
    outputHeight: 174,
  },
  { id: "main_capsule", width: 1232, height: 706 },
  { id: "vertical_capsule", width: 748, height: 896 },
  { id: "library_capsule", width: 600, height: 900 },
  { id: "library_hero", width: 3840, height: 1240 },
  { id: "library_logo", width: 1280, height: 720, transparent: true },
  { id: "page_background", width: 1438, height: 810 },
];
const assets = [
  ...chineseAssets.map((asset) => ({
    ...asset,
    layout: asset.id,
    language: "zh-CN",
  })),
  ...chineseAssets.map((asset) => ({
    ...asset,
    id: `${asset.id}_en`,
    layout: asset.id,
    language: "en-US",
  })),
];

await rm(profileDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1920,1080",
    origin,
  ],
  { stdio: "ignore" },
);

async function waitForTargets() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find(
        (entry) => entry.type === "page" && entry.url.startsWith(origin),
      );
      if (target) return target;
    } catch {
      // Chrome may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Chrome DevTools target did not become available.");
}

const target = await waitForTargets();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (!payload.id || !pending.has(payload.id)) return;
  const { resolve, reject } = pending.get(payload.id);
  pending.delete(payload.id);
  if (payload.error) reject(new Error(payload.error.message));
  else resolve(payload.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Page evaluation failed.");
  }
  return result.result?.value;
}

async function render(asset) {
  await send("Emulation.setDefaultBackgroundColorOverride", {
    color: asset.transparent
      ? { r: 0, g: 0, b: 0, a: 0 }
      : { r: 8, g: 13, b: 14, a: 1 },
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: asset.width,
    height: asset.height,
    screenWidth: asset.width,
    screenHeight: asset.height,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
  });
  const url = `${origin}/store/steam_assets.html?asset=${asset.layout}&lang=${asset.language}`;
  await send("Page.navigate", { url });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      `document.readyState === "complete" &&
       [...document.images].every((image) => image.complete && image.naturalWidth > 0) &&
       document.fonts.status === "loaded"`,
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await new Promise((resolve) => setTimeout(resolve, 350));
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    omitBackground: Boolean(asset.transparent),
    clip: {
      x: 0,
      y: 0,
      width: asset.width,
      height: asset.height,
      scale: 1,
    },
  });
  const targetPath = path.join(outputDir, `${asset.id}.png`);
  await writeFile(targetPath, Buffer.from(screenshot.data, "base64"));

  if (asset.outputWidth && asset.outputHeight) {
    const scaledPath = path.join(outputDir, `${asset.id}.scaled.png`);
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-y",
          "-i",
          targetPath,
          "-vf",
          `scale=${asset.outputWidth}:${asset.outputHeight}:flags=lanczos`,
          "-frames:v",
          "1",
          scaledPath,
        ],
        { stdio: "ignore" },
      );
      ffmpeg.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)),
      );
      ffmpeg.on("error", reject);
    });
    await rm(targetPath);
    await writeFile(targetPath, await readFile(scaledPath));
    await rm(scaledPath);
  }

  console.log(
    `${asset.id}: ${asset.outputWidth || asset.width}x${asset.outputHeight || asset.height}`,
  );
}

try {
  for (const asset of assets) await render(asset);
} finally {
  socket.close();
  chrome.kill("SIGTERM");
}
