#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const [, , command = "text", ...args] = process.argv;
const cdpPort = process.env.CDP_PORT || "9222";
const targetUrl = process.env.CDP_URL || "http://localhost:4173";
const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then(
  (response) => response.json(),
);
const target = targets.find(
  (entry) => entry.type === "page" && entry.url.startsWith(targetUrl),
);
if (!target) {
  throw new Error(
    `No Shuihu page found matching ${targetUrl} on Chrome DevTools port ${cdpPort}.`,
  );
}

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

if (command === "eval") {
  const value = await evaluate(args.join(" "));
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
} else if (command === "text") {
  const selector = args[0] || "body";
  console.log(await evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText || ""`));
} else if (command === "click") {
  const selector = args[0];
  const clicked = await evaluate(
    `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.click(); return true; })()`,
  );
  if (!clicked) throw new Error(`Selector not found: ${selector}`);
  console.log("clicked");
} else if (command === "screenshot") {
  const path = args[0] || "/tmp/shuihu-cdp.png";
  const width = Number(args[1]) || 0;
  const height = Number(args[2]) || 0;
  const params = {
    format: "png",
    fromSurface: true,
  };
  if (width > 0 && height > 0) {
    params.captureBeyondViewport = true;
    params.clip = { x: 0, y: 0, width, height, scale: 1 };
  }
  const result = await send("Page.captureScreenshot", params);
  await writeFile(path, Buffer.from(result.data, "base64"));
  console.log(path);
} else if (command === "responsive-screenshot") {
  const path = args[0] || "/tmp/shuihu-responsive.png";
  const width = Number(args[1]) || 390;
  const height = Number(args[2]) || 844;
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: true,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const metrics = await evaluate(
    "({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth })",
  );
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(result.data, "base64"));
  console.log(JSON.stringify({ path, ...metrics }));
} else if (command === "wait") {
  await new Promise((resolve) => setTimeout(resolve, Number(args[0]) || 500));
  console.log("waited");
} else if (command === "reload") {
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 900));
  console.log("reloaded");
} else if (command === "viewport") {
  const width = Number(args[0]) || 1440;
  const height = Number(args[1]) || 900;
  const mobile = args[2] === "mobile";
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    scale: 1,
    mobile,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.log(`${width}x${height}${mobile ? " mobile" : ""}`);
} else if (command === "savefile") {
  const path = args[0];
  const raw = await evaluate(
    'localStorage.getItem("xingming-shuihu-save-v1")',
  );
  if (!raw) throw new Error("No current save is available.");
  await writeFile(path, raw);
  console.log(path);
} else if (command === "setsave") {
  const path = args[0];
  const raw = await readFile(path, "utf8");
  JSON.parse(raw);
  await evaluate(
    `localStorage.setItem("xingming-shuihu-save-v1", ${JSON.stringify(raw)})`,
  );
  console.log(path);
} else if (command === "assets") {
  const manifestPath = args[0] || "assets/manifest.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const files = manifest.assets.map((asset) => asset.file);
  const results = await evaluate(
    `Promise.all(${JSON.stringify(files)}.map(async (file) => {
      try {
        const response = await fetch("/" + file);
        const bytes = response.ok ? (await response.arrayBuffer()).byteLength : 0;
        return { file, ok: response.ok, status: response.status, bytes };
      } catch (error) {
        return { file, ok: false, status: 0, error: String(error) };
      }
    }))`,
  );
  const failed = results.filter((entry) => !entry.ok || entry.bytes <= 0);
  console.log(
    JSON.stringify(
      {
        checked: results.length,
        bytes: results.reduce((total, entry) => total + entry.bytes, 0),
        failed,
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exitCode = 1;
} else if (command === "images") {
  const result = await evaluate(`(() => {
    const images = [...document.images];
    const visible = images.filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden";
    });
    const broken = visible
      .filter((image) => !image.complete || image.naturalWidth <= 0)
      .map((image) => image.currentSrc || image.src);
    const stretched = visible
      .filter((image) => {
        if (getComputedStyle(image).objectFit !== "fill") return false;
        const rect = image.getBoundingClientRect();
        const naturalRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
        const renderedRatio = rect.width / Math.max(1, rect.height);
        return Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.025;
      })
      .map((image) => ({
        src: image.currentSrc || image.src,
        natural: [image.naturalWidth, image.naturalHeight],
        rendered: [
          Math.round(image.getBoundingClientRect().width),
          Math.round(image.getBoundingClientRect().height),
        ],
        objectFit: getComputedStyle(image).objectFit,
      }));
    return { visible: visible.length, broken, stretched };
  })()`);
  console.log(JSON.stringify(result, null, 2));
  if (result.broken.length || result.stretched.length) process.exitCode = 1;
} else {
  throw new Error(`Unknown command: ${command}`);
}

socket.close();
