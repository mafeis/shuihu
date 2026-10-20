import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { HERO_ORDER } from "../src/data.js";
import { createInitialState, SAVE_KEY } from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = fileURLToPath(
  new URL("../artifacts/qa/issue29", import.meta.url),
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

function fixture() {
  const state = createInitialState();
  state.flags.tutorialSeen = true;
  state.recruited = [...HERO_ORDER];
  state.settings.autoArena = false;
  state.arena.activeRun = {
    mode: "endless",
    wave: 7,
    boons: ["vanguard", "vanguard", "vanguard", "rally", "rally"],
    pendingBoons: ["breaker", "swift", "remedy"],
    rerollUsed: false,
    eventOffer: ["feast", "raid", "drill"],
    selectedEvent: null,
    healthRatios: { linchong: 0.42, luzhishen: 1, wusong: 0.8 },
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

try {
  await mkdir(outputDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="toggle-more-nav"]');
  await page.click('button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  await page.click('button[data-action="resume-arena"]');
  await page.waitForSelector(".screen-arena-reward");

  assert.deepEqual(runtimeErrors, [], "opening rewards should not throw");
  assert.equal(
    await page.locator(".arena-current-booms .is-relic").count(),
    1,
    "the unlocked relic should be rendered",
  );
  assert.match(
    await page.locator(".arena-current-booms .is-relic").innerText(),
    /聚义火种/,
  );
  assert.equal(
    await page.getByText("页面未能完成绘卷").count(),
    0,
    "opening rewards should not show the fatal error screen",
  );

  const event = page
    .locator('button[data-action="choose-arena-event"]:not([disabled])')
    .first();
  assert.ok((await event.count()) > 0, "event choices should be available");
  await event.click();
  await page.waitForSelector(".arena-event-card.is-selected");
  assert.deepEqual(runtimeErrors, [], "choosing an event should not throw");
  assert.equal(
    await page.getByText("页面未能完成绘卷").count(),
    0,
    "choosing an event should keep the reward screen healthy",
  );
  assert.equal(
    await page.locator(".arena-event-card.is-selected").count(),
    1,
    "the chosen event should remain visibly selected",
  );
  await page.screenshot({
    path: `${outputDir}/arena-event-1440x900.png`,
    fullPage: false,
  });

  console.log("Arena reward and event selection passed at 1440x900.");
} finally {
  await browser.close();
}
