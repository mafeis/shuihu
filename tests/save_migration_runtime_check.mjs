#!/usr/bin/env node

import assert from "node:assert/strict";

import { chromium } from "playwright";

import {
  HERO_DOCTRINES,
  HERO_ORDER,
  STORY_ARCHIVE_CHAPTERS,
} from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

function legacySave() {
  const state = createInitialState({ difficulty: "story" });
  state.version = 27;
  state.flags.tutorialSeen = true;
  state.currentChapter = 3;
  state.recruited = HERO_ORDER.slice(0, 28).map((heroId) =>
    heroId === "yuehe" ? "lehe" : heroId === "leiheng" ? "leihang" : heroId,
  );
  state.roster = Object.fromEntries(
    state.recruited.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = 7;
      return [heroId, entry];
    }),
  );
  state.team = ["linchong", "lehe", "leihang"];
  state.heroMastery = Object.fromEntries(
    HERO_ORDER.map((heroId, index) => [
      heroId,
      { ...state.heroMastery[heroId], wins: index + 1 },
    ]),
  );
  delete state.heroMastery.yuehe;
  delete state.heroMastery.leiheng;
  state.heroMastery.lehe = { ...state.heroMastery.luzhishen, wins: 9 };
  state.heroMastery.leihang = { ...state.heroMastery["leiheng"] || {}, wins: 12 };
  state.doctrines = {
    lehe: Object.keys(HERO_DOCTRINES.yuehe.paths)[0],
    linchong: Object.keys(HERO_DOCTRINES.linchong.paths)[0],
  };
  state.storyArchive = STORY_ARCHIVE_CHAPTERS.slice(0, 3).map(
    (chapter) => chapter.id,
  );
  return state;
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(legacySave())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="toggle-more-nav"]');
  await page.click('button[data-action="nav-story-hub"]');
  await page.waitForSelector(".screen-story-hub");
  const migrated = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    return {
      version: save.version,
      recruited: save.recruited,
      team: save.team,
      mastery: save.heroMastery,
      doctrines: save.doctrines,
      storyArchive: save.storyArchive,
      readCards: document.querySelectorAll(".story-hub-card.is-read").length,
      cards: document.querySelectorAll(".story-hub-card").length,
    };
  }, SAVE_KEY);
  assert.equal(migrated.version, 28);
  assert.ok(Array.isArray(migrated.recruited));
  assert.equal(migrated.team.length, 3);
  assert.equal(migrated.storyArchive.length, 3);
  assert.equal(migrated.readCards, 3);
  assert.equal(migrated.cards, 28);
  await page.click('.topbar button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  const persisted = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    return { version: save.version, storyArchive: save.storyArchive };
  }, SAVE_KEY);
  assert.equal(persisted.version, 28);
  assert.equal(persisted.storyArchive.length, 3);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  console.log(JSON.stringify({ status: "passed", version: migrated.version }));
} finally {
  await browser.close();
}
