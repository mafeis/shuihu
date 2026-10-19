import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { CHAPTERS, HERO_ORDER } from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = fileURLToPath(
  new URL("../artifacts/qa/1440-layout", import.meta.url),
);

function progressedFixture() {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.currentChapter = 4;
  state.completedChapters = CHAPTERS.slice(0, 4).map((chapter) => chapter.id);
  state.recruited = [...HERO_ORDER];
  state.roster = Object.fromEntries(
    HERO_ORDER.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = 12;
      return [heroId, entry];
    }),
  );
  state.team = ["likui", "linchong", "huarong"];
  state.stats.heroesRecruited = HERO_ORDER.length;
  state.stats.battlesWon = 36;
  state.inventory.copper = 5600;
  state.settings.autoBattle = false;
  state.settings.autoArena = false;
  return state;
}

function starterFixture() {
  const state = createInitialState();
  state.flags.tutorialSeen = true;
  state.settings.autoArena = false;
  return state;
}

function arenaRewardFixture() {
  const state = progressedFixture();
  state.arena.activeRun = {
    mode: "endless",
    wave: 7,
    boons: ["vanguard", "vanguard", "vanguard", "rally", "rally"],
    pendingBoons: ["breaker", "swift", "remedy"],
    rerollUsed: false,
    eventOffer: ["feast", "raid", "drill"],
    selectedEvent: null,
    healthRatios: { likui: 0.72, linchong: 0.42, huarong: 1 },
    completedWave: 6,
    lastReward: { copper: 188, xp: 162, score: 740 },
    score: 3380,
    lastUnlocks: [{ relicId: "ember", wave: 3 }],
    lastDiscoveries: { masteries: [], synergies: [], encounters: [] },
    lastWeeklyMarks: [],
    trialIds: [],
    defeated: false,
  };
  return state;
}

async function measureScreen(page, name) {
  return page.evaluate((screenName) => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 1 &&
        rect.height > 1
      );
    };
    const controls = [...document.querySelectorAll("button, input, select, a")]
      .filter(visible)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        let ancestor = node.parentElement;
        let insideHorizontalScroller = false;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          if (
            ["auto", "scroll"].includes(style.overflowX) &&
            ancestor.scrollWidth > ancestor.clientWidth + 1
          ) {
            insideHorizontalScroller = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return {
          text:
            node.getAttribute("aria-label") ||
            node.innerText?.trim().slice(0, 60) ||
            node.tagName,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          insideHorizontalScroller,
        };
      });
    const images = [...document.querySelectorAll("img")]
      .filter(visible)
      .map((image) => {
        const rect = image.getBoundingClientRect();
        return {
          src: image.getAttribute("src"),
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
          width: rect.width,
          height: rect.height,
        };
      });
    const headings = [
      ...document.querySelectorAll(
        "h1, h2, .story-chapter-mark b, .battle-title b",
      ),
    ]
      .filter(visible)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          text: node.innerText.trim().slice(0, 80),
          top: rect.top,
          bottom: rect.bottom,
        };
      });
    const screen = document.querySelector(
      ".app-screen, .story-screen, .battle-screen",
    );
    const screenRect = screen?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      screen: screenName,
      pageOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      pageOverflowY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      screenRect: screenRect
        ? {
            top: screenRect.top,
            right: screenRect.right,
            bottom: screenRect.bottom,
            left: screenRect.left,
          }
        : null,
      controls,
      images,
      headings,
      arenaLockedHeading: (() => {
        const node = document.querySelector(".arena-locked h2");
        if (!visible(node)) return null;
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, text: node.innerText };
      })(),
    };
  }, name);
}

async function captureScreen(page, name, metrics) {
  assert.equal(
    metrics.pageOverflowX,
    0,
    `${name}: page has horizontal overflow`,
  );
  assert.equal(
    metrics.pageOverflowY,
    0,
    `${name}: page has vertical overflow`,
  );
  assert.ok(metrics.screenRect, `${name}: app screen is missing`);
  assert.ok(metrics.headings.length > 0, `${name}: no visible page heading`);
  const minimumHeadingTop = ["story", "battle"].includes(name) ? -1 : 70;
  assert.ok(
    metrics.headings.some(
      (heading) =>
        heading.bottom > minimumHeadingTop &&
        heading.top < metrics.viewport.height &&
        heading.bottom > heading.top,
    ),
    `${name}: page heading is outside the first viewport ${JSON.stringify(
      metrics.headings,
    )}`,
  );
  for (const control of metrics.controls) {
    if (control.insideHorizontalScroller) continue;
    assert.ok(
      control.left >= -1 && control.right <= metrics.viewport.width + 1,
      `${name}: control escapes horizontally ${JSON.stringify(control)}`,
    );
  }
  for (const image of metrics.images) {
    assert.ok(
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      `${name}: broken image ${image.src}`,
    );
    assert.notEqual(
      image.objectFit,
      "fill",
      `${name}: stretched image ${image.src}`,
    );
  }
  await page.screenshot({
    path: `${outputDir}/${name}-1440x900.png`,
    fullPage: false,
  });
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  await mkdir(outputDir, { recursive: true });
  const reports = [];

  const starterPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const starterErrors = [];
  starterPage.on("pageerror", (error) => starterErrors.push(error.message));
  await starterPage.goto(origin, { waitUntil: "networkidle" });
  await starterPage.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(starterFixture())],
  );
  await starterPage.reload({ waitUntil: "networkidle" });
  await starterPage.click('button[data-action="continue-game"]');
  await starterPage.waitForSelector(".screen-map");
  await starterPage.click('.topbar button[data-action="nav-arena"]');
  await starterPage.waitForSelector(".screen-arena");
  await starterPage.waitForTimeout(200);
  const arenaLocked = await measureScreen(starterPage, "arena-locked");
  assert.ok(arenaLocked.arenaLockedHeading, "arena locked: guide heading missing");
  assert.ok(
    arenaLocked.arenaLockedHeading.top >= 70 &&
      arenaLocked.arenaLockedHeading.bottom <= 900,
    `arena locked: guide is outside the initial viewport ${JSON.stringify(
      arenaLocked.arenaLockedHeading,
    )}`,
  );
  await starterPage.screenshot({
    path: `${outputDir}/arena-locked-1440x900.png`,
    fullPage: false,
  });
  reports.push({ name: "arena-locked", controls: arenaLocked.controls.length });
  assert.deepEqual(starterErrors, [], "starter-state screens should not throw");
  await starterPage.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const fixture = progressedFixture();
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture)],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({
    path: `${outputDir}/title-1440x900.png`,
    fullPage: false,
  });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");

  const screens = [
    ["map", 'button[data-action="nav-map"]', ".screen-map"],
    ["camp", 'button[data-action="nav-camp"]', ".screen-camp"],
    ["arena", 'button[data-action="nav-arena"]', ".screen-arena"],
    ["roster", 'button[data-action="nav-roster"]', ".screen-roster"],
    ["quests", 'button[data-action="nav-quests"]', ".screen-quests"],
    ["codex", 'button[data-action="nav-codex"]', ".screen-codex"],
    ["settings", 'button[data-action="nav-settings"]', ".screen-settings"],
  ];
  for (const [name, selector, screenSelector] of screens) {
    await page.click(`.topbar ${selector}`);
    await page.waitForSelector(screenSelector);
    await page.waitForTimeout(160);
    const metrics = await measureScreen(page, name);
    await captureScreen(page, name, metrics);
    reports.push({ name, controls: metrics.controls.length });
  }

  await page.click('.topbar button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  await page.click('button[data-action="nav-formation"]');
  await page.waitForSelector(".screen-formation");
  await page.waitForTimeout(160);
  let metrics = await measureScreen(page, "formation");
  await captureScreen(page, "formation", metrics);
  reports.push({ name: "formation", controls: metrics.controls.length });

  await page.click('.topbar button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  await page.locator(".hero-card-hit").first().click();
  await page.waitForSelector(".hero-dossier.is-open");
  await page.click(
    '.hero-dossier button[data-action="equipment-hero"]',
  );
  await page.waitForSelector(".screen-equipment");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "equipment");
  await captureScreen(page, "equipment", metrics);
  reports.push({ name: "equipment", controls: metrics.controls.length });

  await page.click('.topbar button[data-action="nav-map"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="enter-chapter"]');
  await page.waitForSelector(".screen-story");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "story");
  await captureScreen(page, "story", metrics);
  reports.push({ name: "story", controls: metrics.controls.length });

  await page.click('button[data-action="story-skip"]');
  const choice = page.locator('button[data-action="story-choice"]').first();
  if (await choice.count()) await choice.click();
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  await page.waitForTimeout(260);
  metrics = await measureScreen(page, "battle");
  await captureScreen(page, "battle", metrics);
  reports.push({ name: "battle", controls: metrics.controls.length });

  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(arenaRewardFixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('.topbar button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  await page.click('button[data-action="resume-arena"]');
  await page.waitForSelector(".screen-arena-reward");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "arena-reward");
  await captureScreen(page, "arena-reward", metrics);
  reports.push({ name: "arena-reward", controls: metrics.controls.length });

  assert.deepEqual(runtimeErrors, [], "1440x900 screens should not throw");
  console.log(JSON.stringify({ status: "passed", reports }, null, 2));
} finally {
  await browser.close();
}
