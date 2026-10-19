#!/usr/bin/env node

import assert from "node:assert/strict";

import { chromium } from "playwright";

import { CHAPTERS, HERO_ORDER } from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const heroId = "xuning";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

function fixture() {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.currentChapter = CHAPTERS.length;
  state.completedChapters = CHAPTERS.map((chapter) => chapter.id);
  state.recruited = HERO_ORDER.filter((id) => id !== heroId);
  state.roster = Object.fromEntries(
    state.recruited.map((id) => [id, createRosterEntry(id)]),
  );
  state.heroRecruitments.completed = HERO_ORDER.filter((id) => id !== heroId);
  state.team = ["linchong", "wusong", "huarong"];
  return state;
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, saved]) => localStorage.setItem(key, saved),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="nav-quests"]');
  await page.waitForSelector(".screen-quests");

  const card = page.locator(
    `.recruitment-card:has(button[data-hero="${heroId}"])`,
  );
  await card.scrollIntoViewIfNeeded();
  await card
    .locator(
      `button[data-action="start-hero-recruitment"][data-hero="${heroId}"]`,
    )
    .click();
  await page.waitForSelector(
    '[data-modal-panel] button[data-action="recruitment-battle"]',
  );
  await page
    .locator('[data-modal-panel] button[data-action="recruitment-battle"]')
    .click();
  await page.waitForSelector(".screen-story");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "passed",
      modalAction: "recruitment-battle",
      screen: await page
        .locator(".game-frame")
        .evaluate((node) => node.className),
    }),
  );
} finally {
  await browser.close();
}
