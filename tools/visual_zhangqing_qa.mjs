#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CHAPTERS,
  HEROES,
  HERO_ORDER,
  HERO_RECRUITMENTS,
} from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const targetHeroId = process.env.VISUAL_QA_HERO || "zhangqing";
const targetHero = HEROES[targetHeroId];
const chromePath =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9464);
const outputDir = path.resolve(
  process.env.VISUAL_QA_DIR || `artifacts/qa/${targetHeroId}`,
);
const profileDir = await mkdtemp(path.join(tmpdir(), "shuihu-visual-qa-"));

let devServer = null;
let chrome = null;
let socket = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(targetHero, `Unknown visual QA hero: ${targetHeroId}`);
assert(
  HERO_RECRUITMENTS[targetHeroId],
  `Visual QA hero has no recruitment scroll: ${targetHeroId}`,
);

async function waitForHttp(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Vite may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureDevServer() {
  try {
    await waitForHttp(origin, 3);
    return;
  } catch {
    devServer = spawn("npm", ["run", "dev", "--", "--port", "4173"], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    await waitForHttp(origin);
  }
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const target = targets.find(
        (entry) => entry.type === "page" && entry.url.startsWith(origin),
      );
      if (target) return target;
    } catch {
      // Chrome may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Chrome DevTools target did not become available.");
}

function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(payload.error.message));
    else resolve(payload.result);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return {
    ws,
    ready,
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) =>
        pending.set(id, { resolve, reject }),
      );
    },
  };
}

async function evaluate(expression) {
  const result = await socket.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Page evaluation failed.");
  }
  return result.result?.value;
}

async function waitFor(expression, timeoutMs = 7000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function setViewport(width, height, mobile = false) {
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 260));
  await evaluate(
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
}

async function capture(name) {
  await mkdir(outputDir, { recursive: true });
  const screenshot = await socket.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = path.join(outputDir, name);
  await writeFile(file, Buffer.from(screenshot.data, "base64"));
  return file;
}

async function click(selector) {
  const clicked = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Selector not found: ${selector}`);
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function clickText(text) {
  const clicked = await evaluate(`(() => {
    const node = [...document.querySelectorAll("button")]
      .find((button) => button.innerText.includes(${JSON.stringify(text)}));
    if (!node) return false;
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button not found: ${text}`);
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function scrollIntoView(selector) {
  const scrolled = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    const scrollers = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        parent.scrollHeight > parent.clientHeight + 1
      ) {
        scrollers.push(parent);
      }
    }
    for (const scroller of scrollers.reverse()) {
      const nodeRect = node.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      if (nodeRect.top < scrollerRect.top) {
        scroller.scrollTop -= scrollerRect.top - nodeRect.top;
      }
    }
    return true;
  })()`);
  if (!scrolled) throw new Error(`Selector not found for scroll: ${selector}`);
  await new Promise((resolve) => setTimeout(resolve, 260));
}

async function setSave(state) {
  await evaluate(
    `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(
      JSON.stringify(state),
    )})`,
  );
  await socket.send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 850));
}

function rosterFor(heroIds, level = 24) {
  return Object.fromEntries(
    heroIds.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = level;
      return [heroId, entry];
    }),
  );
}

function baseFixture(heroIds, currentChapter) {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.currentChapter = currentChapter;
  state.completedChapters = CHAPTERS.slice(0, currentChapter).map(
    (chapter) => chapter.id,
  );
  state.recruited = [...heroIds];
  state.roster = rosterFor(heroIds);
  state.team = [
    targetHeroId,
    ...["huarong", "linchong", "guansheng"].filter(
      (heroId) => heroId !== targetHeroId,
    ),
  ].slice(0, 3);
  state.stats.heroesRecruited = heroIds.length;
  state.stats.battlesWon = 40;
  state.inventory.copper = 24000;
  state.settings.autoBattle = false;
  state.settings.battleSpeed = 2;
  return state;
}

function recruitmentFixture() {
  const completed = HERO_ORDER.filter((heroId) => heroId !== targetHeroId);
  const prereq = [
    ...completed,
    HERO_RECRUITMENTS[targetHeroId].prerequisite,
  ].filter(Boolean);
  const state = baseFixture(prereq, CHAPTERS.length);
  state.heroRecruitments.completed = completed;
  return state;
}

function fullRosterFixture() {
  const state = baseFixture(HERO_ORDER, 4);
  state.completedChapters = CHAPTERS.slice(0, 4).map((chapter) => chapter.id);
  state.heroRecruitments.completed = Object.keys(HERO_RECRUITMENTS);
  return state;
}

async function inspectAspect(selector) {
  return evaluate(`(() => {
    const image = document.querySelector(${JSON.stringify(selector)});
    if (!(image instanceof HTMLImageElement)) return null;
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    return {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: Math.round(rect.width * 10) / 10,
      renderedHeight: Math.round(rect.height * 10) / 10,
      rect: {
        left: Math.round(rect.left * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        bottom: Math.round(rect.bottom * 10) / 10,
      },
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      outside:
        rect.left < -0.5 ||
        rect.top < -0.5 ||
        rect.right > innerWidth + 0.5 ||
        rect.bottom > innerHeight + 0.5,
      overflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  })()`);
}

function assertContained(image, label) {
  assert(image, `${label} image was not rendered`);
  assert(image.complete, `${label} image did not finish loading`);
  assert(image.naturalWidth > 0 && image.naturalHeight > 0, `${label} image is empty`);
  assert(image.objectFit === "contain", `${label} should use object-fit: contain`);
  assert(image.renderedWidth > 1 && image.renderedHeight > 1, `${label} image has no visible area`);
  assert(image.overflowX === 0, `${label} caused horizontal overflow`);
}

async function openMap() {
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-title")',
  );
  await clickText("续上旧卷");
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-map")',
  );
}

async function captureRecruitment() {
  await setViewport(1920, 1080, false);
  await setSave(recruitmentFixture());
  await openMap();
  await click('button[data-action="nav-quests"]');
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-quests")',
  );

  const desktopCard = await inspectAspect(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"]) .recruitment-card-art img`,
  );
  assertContained(desktopCard, `${targetHero.name} recruitment card`);
  await scrollIntoView(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"])`,
  );
  await scrollIntoView(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"])`,
  );
  const desktopCardFile = await capture("01-recruitment-desktop.png");

  await setViewport(390, 844, true);
  const mobileCard = await inspectAspect(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"]) .recruitment-card-art img`,
  );
  assertContained(mobileCard, `mobile ${targetHero.name} recruitment card`);
  await scrollIntoView(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"])`,
  );
  const mobileCardAfterScroll = await inspectAspect(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"]) .recruitment-card-art img`,
  );
  await scrollIntoView(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"])`,
  );
  const mobileCardFile = await capture("02-recruitment-mobile.png");

  await setViewport(1920, 1080, false);
  await scrollIntoView(
    `.recruitment-card:has(button[data-hero="${targetHeroId}"])`,
  );
  await click(
    `button[data-action="start-hero-recruitment"][data-hero="${targetHeroId}"]`,
  );
  if (
    await evaluate(
      'Boolean(document.querySelector(\'button[data-action="recruitment-battle"]\'))',
    )
  ) {
    await evaluate(
      'document.querySelector(\'button[data-action="recruitment-battle"]\').click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-story")',
  );
  for (let step = 0; step < 8; step += 1) {
    const hasPortrait = await evaluate(
      'Boolean(document.querySelector(".story-speaker-portrait img"))',
    );
    if (hasPortrait) break;
    await click("[data-action=story-next]");
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  const storyPortrait = await inspectAspect(
    ".story-speaker-portrait img",
  );
  assertContained(storyPortrait, `${targetHero.name} story portrait`);
  const storyFile = await capture("03-recruitment-story.png");

  await click("button[data-action=story-skip]");
  await click('button[data-action="story-choice"][data-option="1"]');
  await click("button[data-action=story-to-battle]");
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-battle")',
  );
  const battlePortrait = await inspectAspect(".actor-portrait img");
  assertContained(battlePortrait, "recruitment battle portrait");
  const battleFile = await capture("04-recruitment-battle.png");

  return {
    desktopCard,
    mobileCard,
    storyPortrait,
    battlePortrait,
    screenshots: {
      desktopCardFile,
      mobileCardFile,
      storyFile,
      battleFile,
    },
  };
}

async function captureFullRoster() {
  await setViewport(1920, 1080, false);
  await setSave(fullRosterFixture());
  await openMap();
  await click('button[data-action="nav-codex"]');
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-codex")',
  );
  const desktopCodex = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll(".star-node")];
    const rects = nodes.map((node) => node.getBoundingClientRect());
    let overlaps = 0;
    for (let index = 0; index < rects.length; index += 1) {
      for (let other = index + 1; other < rects.length; other += 1) {
        if (
          Math.min(rects[index].right, rects[other].right) -
            Math.max(rects[index].left, rects[other].left) >
            0.5 &&
          Math.min(rects[index].bottom, rects[other].bottom) -
            Math.max(rects[index].top, rects[other].top) >
            0.5
        ) overlaps += 1;
      }
    }
    return {
      nodes: nodes.length,
      overlaps,
      overflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  })()`);
  assert(desktopCodex.nodes === HERO_ORDER.length, "desktop codex should show every hero");
  assert(desktopCodex.overlaps === 0, "desktop codex nodes should not overlap");
  assert(desktopCodex.overflowX === 0, "desktop codex should not overflow");
  const desktopCodexFile = await capture("05-codex-desktop.png");

  await setViewport(390, 844, true);
  const mobileCodex = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll(".star-node")];
    const rects = nodes.map((node) => node.getBoundingClientRect());
    let overlaps = 0;
    for (let index = 0; index < rects.length; index += 1) {
      for (let other = index + 1; other < rects.length; other += 1) {
        if (
          Math.min(rects[index].right, rects[other].right) -
            Math.max(rects[index].left, rects[other].left) >
            0.5 &&
          Math.min(rects[index].bottom, rects[other].bottom) -
            Math.max(rects[index].top, rects[other].top) >
            0.5
        ) overlaps += 1;
      }
    }
    return {
      nodes: nodes.length,
      overlaps,
      overflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  })()`);
  assert(mobileCodex.nodes === HERO_ORDER.length, "mobile codex should show every hero");
  assert(mobileCodex.overlaps === 0, "mobile codex nodes should not overlap");
  assert(mobileCodex.overflowX === 0, "mobile codex should not overflow");
  const mobileCodexFile = await capture("06-codex-mobile.png");

  return {
    desktopCodex,
    mobileCodex,
    screenshots: { desktopCodexFile, mobileCodexFile },
  };
}

async function captureHeroBattle() {
  await setViewport(1920, 1080, false);
  await setSave(fullRosterFixture());
  await openMap();
  await click('button[data-action="enter-chapter"]');
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-story")',
  );
  await click("button[data-action=story-skip]");
  await waitFor(
    'document.querySelector("button[data-action=story-choice]") !== null',
  );
  await click('button[data-action="story-choice"][data-option="0"]');
  await waitFor(
    'document.querySelector("button[data-action=story-to-battle]") !== null',
  );
  await click("button[data-action=story-to-battle]");
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-battle")',
  );
  const portrait = await inspectAspect(
    `button.hero-unit:has(img[src*="/characters/${targetHeroId}/"]) .hero-figure img`,
  );
  assertContained(portrait, `${targetHero.name} battle portrait`);
  const screenshot = await capture("07-hero-battle.png");
  return { portrait, screenshot };
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => child.kill("SIGKILL"), 1500);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

try {
  await ensureDevServer();
  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,900",
      origin,
    ],
    { stdio: "ignore" },
  );

  const target = await waitForTarget();
  socket = connect(target);
  await socket.ready;
  await socket.send("Page.enable");
  await socket.send("Runtime.enable");
  await setViewport(1440, 900, false);

  const recruitment = await captureRecruitment();
  const roster = await captureFullRoster();
  const heroBattle = await captureHeroBattle();
  console.log(
    JSON.stringify(
      {
        status: "passed",
        heroId: targetHeroId,
        outputDir,
        recruitment,
        roster,
        heroBattle,
      },
      null,
      2,
    ),
  );
} finally {
  socket?.ws?.close();
  await stopProcess(chrome);
  await stopProcess(devServer);
  await rm(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 150,
  });
}
