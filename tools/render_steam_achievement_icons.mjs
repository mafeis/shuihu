#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ACHIEVEMENTS } from "../src/data.js";

const require = createRequire(import.meta.url);
const lucide = require("lucide");

const chromePath =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CHROME_DEBUG_PORT || 9455);
const profileDir = "/tmp/shuihu-steam-achievement-profile";
const htmlPath = "/tmp/shuihu-steam-achievement-icons.html";
const outputDir = path.resolve("store/steam_achievements");
const metadataPath = path.resolve("steam/achievement_metadata.json");
const config = JSON.parse(
  await readFile(path.resolve("steam/steamworks.json"), "utf8"),
);

const translations = {
  first_blood: {
    englishName: "First Dawn",
    englishDescription: "Win your first battle.",
  },
  ten_stands: {
    englishName: "Ten Lines Unbroken",
    englishDescription: "Win 10 battles.",
  },
  hundred_stands: {
    englishName: "Survivor of a Hundred",
    englishDescription: "Win 100 battles.",
  },
  all_sworn: {
    englishName: "Stars of the Marsh",
    englishDescription: "Recruit all twenty-two heroes.",
  },
  full_chronicle: {
    englishName: "Nine Chapters of Snow",
    englishDescription: "Complete all nine campaign chapters.",
  },
  three_endings: {
    englishName: "Three Fates of Liangshan",
    englishDescription:
      "Unlock the Brotherhood, Allegiance, and Renunciation endings.",
  },
  camp_complete: {
    englishName: "Foundations of the Marsh",
    englishDescription:
      "Raise the Assembly Hall, Training Ground, and Star Terrace to maximum level.",
  },
  arena_ten: {
    englishName: "A Name Across Ten Waves",
    englishDescription: "Reach wave 10 in the Liangshan Arena.",
  },
  arena_twenty: {
    englishName: "Embers Unbroken",
    englishDescription: "Reach wave 20 in the Liangshan Arena.",
  },
  arena_thirty: {
    englishName: "Unrivaled at Thirty",
    englishDescription: "Reach wave 30 in the Liangshan Arena.",
  },
  mastery_path: {
    englishName: "Starlight in Accord",
    englishDescription: "Complete all three mastery trials for any hero.",
  },
  doctrine_path: {
    englishName: "The First Path",
    englishDescription:
      "Choose a destiny doctrine for a hero who has completed every mastery trial.",
  },
  doctrine_all: {
    englishName: "Twenty-One Stars, Twenty-One Paths",
    englishDescription: "Choose a destiny doctrine for all twenty-two heroes.",
  },
  new_cycle: {
    englishName: "Chart the Stars Again",
    englishDescription: "Begin a New Game+ cycle.",
  },
  medal_three: {
    englishName: "First Seal",
    englishDescription: "Earn 3 chapter medals.",
  },
  medal_all: {
    englishName: "Nine Scrolls Complete",
    englishDescription: "Collect all 27 chapter medals.",
  },
  arena_masteries: {
    englishName: "Twelve Formations Illuminated",
    englishDescription: "Discover all twelve arena masteries.",
  },
  arena_synergies: {
    englishName: "Eight Arts Return",
    englishDescription: "Trigger all eight arena formation synergies.",
  },
  arena_encounters: {
    englishName: "Eight Armies Observed",
    englishDescription: "Record all eight imperial army encounters.",
  },
};

const tonePalette = {
  gold: { accent: "#d9ad62", glow: "205, 157, 77" },
  teal: { accent: "#85c2ae", glow: "84, 157, 139" },
  blue: { accent: "#8db6ca", glow: "86, 142, 166" },
  cinnabar: { accent: "#d86d50", glow: "188, 76, 49" },
};

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function iconNodeMarkup(node) {
  if (!Array.isArray(node)) return "";
  const [tag, attributes, children] = node;
  const renderedAttributes = Object.entries(attributes || {})
    .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
    .join(" ");
  if (!children?.length) return `<${tag} ${renderedAttributes}/>`;
  return `<${tag} ${renderedAttributes}>${children.map(iconNodeMarkup).join("")}</${tag}>`;
}

function iconMarkup(name, size = 34) {
  const pascalName = name
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
  const icon = lucide[pascalName];
  if (!Array.isArray(icon)) {
    throw new Error(`Unknown Lucide icon: ${name} (${pascalName})`);
  }
  const [, attributes, children] = icon;
  return iconNodeMarkup([
    "svg",
    {
      ...attributes,
      width: size,
      height: size,
      class: "achievement-glyph",
      "stroke-width": 1.55,
      "aria-hidden": "true",
    },
    children,
  ]);
}

function lockMarkup() {
  return iconMarkup("lock-keyhole", 11).replace(
    'class="achievement-glyph"',
    'class="lock-glyph"',
  );
}

const tiles = ACHIEVEMENTS.flatMap((achievement) => {
  const translation = translations[achievement.id];
  if (!translation) {
    throw new Error(`Missing English achievement copy: ${achievement.id}`);
  }
  const palette = tonePalette[achievement.tone];
  if (!palette) {
    throw new Error(`Unknown achievement tone: ${achievement.tone}`);
  }
  return ["unlocked", "locked"].map(
    (state) => `
      <div
        class="tile tile-${state}"
        data-key="${achievement.id}-${state}"
        style="--accent:${palette.accent};--glow:${palette.glow}"
        title="${achievement.name} / ${translation.englishName}"
      >
        <span class="seal"></span>
        <span class="icon-shell">${iconMarkup(achievement.icon)}</span>
        ${state === "locked" ? `<span class="lock">${lockMarkup()}</span>` : ""}
      </div>
    `,
  );
});

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>星命水浒 Steam Achievement Icons</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        width: 312px;
        padding: 10px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% -10%, rgba(179, 133, 72, .12), transparent 44%),
          #0b1011;
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(4, 64px);
        gap: 12px;
      }
      .tile {
        position: relative;
        width: 64px;
        height: 64px;
        overflow: hidden;
        border-radius: 8px;
        background:
          radial-gradient(circle at 50% 39%, rgba(var(--glow), .26), transparent 47%),
          linear-gradient(145deg, #302719 0%, #151918 56%, #090d0e 100%);
        box-shadow:
          inset 0 0 0 1px rgba(var(--glow), .82),
          inset 0 0 0 4px rgba(8, 12, 12, .78),
          0 0 0 1px rgba(0, 0, 0, .8);
      }
      .tile::before {
        content: "";
        position: absolute;
        inset: 6px;
        border: 1px solid rgba(var(--glow), .34);
        border-radius: 50%;
        box-shadow:
          0 0 12px rgba(var(--glow), .2),
          inset 0 0 9px rgba(var(--glow), .11);
      }
      .tile::after {
        content: "";
        position: absolute;
        inset: -30%;
        opacity: .18;
        background-image:
          repeating-radial-gradient(
            circle at 20% 30%,
            rgba(255, 255, 255, .18) 0 0.5px,
            transparent .8px 4px
          );
        transform: rotate(12deg);
        pointer-events: none;
      }
      .seal {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 6px;
        height: 6px;
        border: 1px solid rgba(224, 116, 83, .9);
        background: rgba(122, 40, 25, .45);
        z-index: 3;
      }
      .icon-shell {
        position: absolute;
        inset: 12px;
        z-index: 2;
        display: grid;
        place-items: center;
        color: var(--accent);
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, .82));
      }
      .achievement-glyph {
        overflow: visible;
        filter: drop-shadow(0 0 3px rgba(var(--glow), .36));
      }
      .lock {
        position: absolute;
        right: 6px;
        bottom: 5px;
        z-index: 4;
        display: grid;
        width: 16px;
        height: 16px;
        place-items: center;
        border: 1px solid rgba(143, 151, 149, .58);
        border-radius: 50%;
        color: #aab2af;
        background: rgba(9, 13, 14, .92);
      }
      .lock-glyph {
        width: 9px;
        height: 9px;
      }
      .tile-locked {
        background:
          radial-gradient(circle at 50% 39%, rgba(118, 128, 125, .16), transparent 47%),
          linear-gradient(145deg, #252a29 0%, #121716 56%, #090c0d 100%);
        box-shadow:
          inset 0 0 0 1px rgba(126, 137, 134, .55),
          inset 0 0 0 4px rgba(8, 12, 12, .78),
          0 0 0 1px rgba(0, 0, 0, .8);
      }
      .tile-locked::before {
        border-color: rgba(143, 151, 149, .3);
        box-shadow: inset 0 0 9px rgba(106, 118, 114, .1);
      }
      .tile-locked .seal {
        border-color: rgba(110, 121, 118, .38);
        background: rgba(54, 62, 60, .3);
      }
      .tile-locked .icon-shell {
        color: #77827f;
        opacity: .48;
        filter: grayscale(1) drop-shadow(0 2px 4px rgba(0, 0, 0, .72));
      }
    </style>
  </head>
  <body>
    <main class="tiles">
      ${tiles.join("")}
    </main>
  </body>
</html>`;

await rm(profileDir, { recursive: true, force: true });
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await writeFile(htmlPath, html, "utf8");

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    `file://${htmlPath}`,
  ],
  { stdio: "ignore" },
);

async function waitForTargets() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find(
        (entry) => entry.type === "page" && entry.url.startsWith("file://"),
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

try {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 312,
    height: 760,
    screenWidth: 312,
    screenHeight: 760,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      `document.readyState === "complete" &&
       document.querySelectorAll(".tile").length === ${ACHIEVEMENTS.length * 2}`,
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const metadata = {
    schemaVersion: 1,
    iconSize: 64,
    iconDirectory: "store/steam_achievements",
    steamLocales: ["schinese", "english"],
    achievements: [],
  };

  for (const achievement of ACHIEVEMENTS) {
    const translation = translations[achievement.id];
    for (const state of ["unlocked", "locked"]) {
      const selector = `[data-key="${achievement.id}-${state}"]`;
      const rect = await evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        const bounds = node.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      })()`);
      const screenshot = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
        clip: { ...rect, scale: 1 },
      });
      await writeFile(
        path.join(outputDir, `${achievement.id}_${state}.png`),
        Buffer.from(screenshot.data, "base64"),
      );
    }
    metadata.achievements.push({
      id: achievement.id,
      apiName: config.achievements[achievement.id],
      tone: achievement.tone,
      hidden: false,
      icon: `${achievement.id}_unlocked.png`,
      iconGray: `${achievement.id}_locked.png`,
      locales: {
        schinese: {
          name: achievement.name,
          description: achievement.desc,
        },
        english: {
          name: translation.englishName,
          description: translation.englishDescription,
        },
      },
    });
  }

  const pageHeight = await evaluate("document.body.scrollHeight");
  const contactSheet = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: 312,
      height: pageHeight,
      scale: 1,
    },
  });
  await writeFile(
    path.join(outputDir, "contact_sheet.png"),
    Buffer.from(contactSheet.data, "base64"),
  );
  await writeFile(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        status: "generated",
        achievements: ACHIEVEMENTS.length,
        icons: ACHIEVEMENTS.length * 2,
        iconSize: 64,
        output: "store/steam_achievements",
        metadata: "steam/achievement_metadata.json",
      },
      null,
      2,
    ),
  );
} finally {
  socket.close();
  chrome.kill("SIGTERM");
}
