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
  new URL("../artifacts/qa/issue31", import.meta.url),
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
  state.stats.heroesRecruited = HERO_ORDER.length;
  state.stats.battlesWon = 36;
  return state;
}

async function measureRecruitment(page, viewportName) {
  const metrics = await page.evaluate(() => {
    const scroller = document.querySelector(".recruitment-scroll");
    const grid = document.querySelector(".recruitment-grid");
    const board = document.querySelector(".recruitment-board");
    const cards = [...document.querySelectorAll(".recruitment-card")];
    const scrollerRect = scroller?.getBoundingClientRect();
    const cardRects = cards.map((card) => card.getBoundingClientRect());
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      scroller: scroller
        ? {
            clientWidth: scroller.clientWidth,
            scrollWidth: scroller.scrollWidth,
            overflowX: getComputedStyle(scroller).overflowX,
            left: scrollerRect.left,
            right: scrollerRect.right,
          }
        : null,
      grid: grid
        ? {
            width: grid.getBoundingClientRect().width,
            columns: getComputedStyle(grid).gridTemplateColumns,
          }
        : null,
      board: board
        ? {
            left: board.getBoundingClientRect().left,
            right: board.getBoundingClientRect().right,
          }
        : null,
      cardCount: cards.length,
      cardsOutsideBoard: cardRects
        .map((rect, index) => ({
          index,
          left: rect.left,
          right: rect.right,
        }))
        .filter(
          (card) =>
            !board ||
            card.left < board.getBoundingClientRect().left - 1 ||
            card.right > board.getBoundingClientRect().right + 1,
        ),
    };
  });

  assert.ok(metrics.scroller, `${viewportName}: recruitment scroller missing`);
  assert.ok(metrics.grid, `${viewportName}: recruitment grid missing`);
  assert.equal(
    metrics.pageOverflowX,
    0,
    `${viewportName}: page has horizontal overflow`,
  );
  assert.ok(
    metrics.scroller.scrollWidth <= metrics.scroller.clientWidth + 1,
    `${viewportName}: recruitment area still scrolls horizontally ${JSON.stringify(
      metrics.scroller,
    )}`,
  );
  assert.notEqual(
    metrics.scroller.overflowX,
    "auto",
    `${viewportName}: recruitment area uses horizontal auto-scroll`,
  );
  assert.equal(
    metrics.cardsOutsideBoard.length,
    0,
    `${viewportName}: recruitment cards escape the board ${JSON.stringify(
      metrics.cardsOutsideBoard,
    )}`,
  );
  assert.equal(
    metrics.cardCount,
    28,
    `${viewportName}: expected every recruitment card to render`,
  );
  await page.screenshot({
    path: `${outputDir}/${viewportName}.png`,
    fullPage: false,
  });
  return metrics;
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const reports = [];
  for (const [name, width, height] of [
    ["wide-3742x2100", 3742, 2100],
    ["desktop-1440x900", 1440, 900],
    ["mobile-390x844", 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
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
    await page.waitForTimeout(160);
    reports.push({ name, ...(await measureRecruitment(page, name)) });
    assert.deepEqual(errors, [], `${name}: quests screen should not throw`);
    await page.close();
  }
  console.log(JSON.stringify({ status: "passed", reports }, null, 2));
} finally {
  await browser.close();
}
