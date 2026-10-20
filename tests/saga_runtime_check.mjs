#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { HERO_ORDER, STORY_ARCHIVE_CHAPTERS } from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = fileURLToPath(
  new URL("../artifacts/qa/saga", import.meta.url),
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

function fixture() {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.recruited = [...HERO_ORDER];
  state.roster = Object.fromEntries(
    HERO_ORDER.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = 20;
      return [heroId, entry];
    }),
  );
  state.team = ["linchong", "wusong", "huarong"];
  return state;
}

try {
  await mkdir(outputDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image") {
      failedRequests.push(request.url());
    }
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="toggle-more-nav"]');
  await page.click('button[data-action="nav-story-hub"]');
  await page.waitForSelector(".screen-story-hub");

  for (const chapter of STORY_ARCHIVE_CHAPTERS) {
    await page.click(
      `button[data-action="enter-story-memory"][data-chapter="${chapter.id}"]`,
    );
    await page.waitForSelector(".screen-story");
    const story = await page.evaluate(() => ({
      title: document.querySelector(".story-chapter-mark b")?.textContent.trim(),
      chapterId: document.querySelector(".story-screen")
        ?.dataset.storyChapter,
      background: getComputedStyle(
        document.querySelector(".story-screen"),
      ).getPropertyValue("--story-bg").trim(),
      portraitsBroken: [...document.querySelectorAll("img")].filter(
        (image) => image.complete && image.naturalWidth === 0,
      ).length,
      skip: document.querySelector('button[data-action="story-skip"]')?.textContent.includes("跳过开卷") || false,
    }));
    assert.equal(story.title, chapter.title, `${chapter.id}: wrong title`);
    assert.equal(
      story.chapterId,
      chapter.id,
      `${chapter.id}: opened the wrong saga backdrop`,
    );
    assert.equal(
      story.background.replace(/^url\(['"]?|['"]?\)$/g, ""),
      chapter.bg,
      `${chapter.id}: wrong saga backdrop`,
    );
    assert.equal(story.skip, true, `${chapter.id}: missing archive mode`);
    assert.equal(story.portraitsBroken, 0, `${chapter.id}: broken portrait`);
    await page.click('button[data-action="story-skip"]');
    await page.waitForSelector('button[data-action="story-choice"]');
    await page.click('button[data-action="story-choice"]');
    await page.waitForSelector('button[data-action="story-to-battle"]');
    await page.click('button[data-action="story-to-battle"]');
    await page.waitForSelector(".screen-battle");
    const battle = await page.evaluate(() => ({
      title: document.querySelector(".battle-title b")?.textContent.trim(),
      heroes: document.querySelectorAll(".battle-screen img").length,
      enemies: document.querySelectorAll(".battle-screen .battle-unit").length,
    }));
    assert.ok(battle.enemies >= chapter.battle.enemies.length, `${chapter.id}: missing enemies`);
    assert.ok(battle.heroes >= 1, `${chapter.id}: missing portraits`);
    await page.click('button[data-action="battle-menu"]');
    await page.waitForSelector("[data-modal-panel]");
    await page.click('button[data-action="battle-retreat"]');
    await page.waitForSelector(".screen-camp");
    await page.click('button[data-action="toggle-more-nav"]');
    await page.click('button[data-action="nav-story-hub"]');
    await page.waitForSelector(".screen-story-hub");
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  await page.evaluate(() => {
    document.querySelector(
      'button[data-action="enter-story-memory"][data-chapter="stone_tablet"]',
    )?.click();
  });
  await page.waitForSelector(".screen-story");
  await page.click('button[data-action="story-skip"]');
  await page.waitForSelector('button[data-action="story-choice"]');
  await page.click('button[data-action="story-choice"]');
  await page.waitForSelector('button[data-action="story-to-battle"]');
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  await page.click('button[data-action="battle-menu"]');
  await page.waitForSelector("[data-modal-panel]");
  await page.click('button[data-action="battle-retreat"]');
  await page.waitForSelector(".screen-camp");
  await page.click('button[data-action="nav-map"]');
  await page.waitForSelector(".screen-map");
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  console.log(JSON.stringify({ status: "passed", chapters: STORY_ARCHIVE_CHAPTERS.length }, null, 2));
} finally {
  await browser.close();
}
