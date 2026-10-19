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
  new URL("../artifacts/qa/issue33", import.meta.url),
);

function fixture() {
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
  return state;
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  await mkdir(outputDir, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('.topbar button[data-action="nav-quests"]');
  await page.waitForSelector(".screen-quests");
  await page.waitForTimeout(180);

  const layout = await page.evaluate(() => {
    const track = document.querySelector(".quest-hero-track");
    const buttons = [...(track?.querySelectorAll(".quest-hero-button") || [])];
    const trackStyle = track ? getComputedStyle(track) : null;
    const trackRect = track?.getBoundingClientRect();
    const buttonRects = buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    });
    return {
      count: buttons.length,
      display: trackStyle?.display,
      gridAutoFlow: trackStyle?.gridAutoFlow,
      overflowX: trackStyle?.overflowX,
      scrollWidth: track?.scrollWidth || 0,
      clientWidth: track?.clientWidth || 0,
      scrollHeight: track?.scrollHeight || 0,
      clientHeight: track?.clientHeight || 0,
      insideViewport: Boolean(
        trackRect &&
          trackRect.left >= 0 &&
          trackRect.right <= innerWidth,
      ),
      visibleInFirstViewport: Boolean(
        trackRect &&
          trackRect.top >= 0 &&
          trackRect.bottom <= innerHeight,
      ),
      sameRow: buttonRects.every(
        (rect) => Math.abs(rect.top - buttonRects[0].top) <= 1,
      ),
    };
  });

  assert.equal(layout.count, HERO_ORDER.length);
  assert.equal(layout.display, "grid");
  assert.equal(layout.gridAutoFlow, "column");
  assert.equal(layout.overflowX, "auto");
  assert.ok(
    layout.scrollWidth > layout.clientWidth,
    "quest roster should scroll horizontally",
  );
  assert.ok(
    layout.scrollHeight <= layout.clientHeight + 1,
    "quest roster should keep every hero on one horizontal row",
  );
  assert.equal(
    layout.insideViewport,
    true,
    "quest roster should stay inside the viewport",
  );
  assert.equal(
    layout.visibleInFirstViewport,
    true,
    "quest roster should be visible before scrolling into the journal",
  );
  assert.equal(
    layout.sameRow,
    true,
    "all recruit cards should align on the same row",
  );

  const lastHero = HERO_ORDER.at(-1);
  const lastName = await page
    .locator(
      `.quest-hero-button[data-action="quest-hero"][data-hero="${lastHero}"] .quest-hero-copy b`,
    )
    .textContent();
  const lastButton = page.locator(
    `.quest-hero-button[data-action="quest-hero"][data-hero="${lastHero}"]`,
  );
  await lastButton.scrollIntoViewIfNeeded();
  await lastButton.click();
  await page.waitForTimeout(160);
  assert.match(
    await page.locator(".quest-board-copy h2").textContent(),
    new RegExp(lastName.trim()),
  );
  await page.screenshot({
    path: `${outputDir}/quests-horizontal-roster-1440x900.png`,
    fullPage: false,
  });

  assert.deepEqual(errors, [], "quest roster should not throw");
  console.log(
    JSON.stringify({
      status: "passed",
      heroes: layout.count,
      scrollWidth: layout.scrollWidth,
      clientWidth: layout.clientWidth,
      selected: lastHero,
    }),
  );
} finally {
  await browser.close();
}
