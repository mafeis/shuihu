import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { createInitialState, SAVE_KEY } from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = fileURLToPath(
  new URL("../artifacts/qa/issue30", import.meta.url),
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function measureActiveNav(page) {
  return page.evaluate(() => {
    const active = [...document.querySelectorAll(".nav-button.is-active")];
    const button = active[0];
    if (!button) return null;
    const style = getComputedStyle(button);
    const background = getComputedStyle(button, "::before");
    const rect = button.getBoundingClientRect();
    return {
      count: active.length,
      action: button.dataset.action,
      width: rect.width,
      height: rect.height,
      outlineStyle: style.outlineStyle,
      backgroundTop: Number.parseFloat(background.top),
      backgroundBottom: Number.parseFloat(background.bottom),
      backgroundColor: background.backgroundColor,
    };
  });
}

function assertInsetBackground(report, label) {
  assert.ok(report, `${label}: missing active nav item`);
  assert.equal(report.count, 1, `${label}: exactly one nav item should be active`);
  assert.equal(report.outlineStyle, "none", `${label}: active nav has a box outline`);
  assert.ok(
    report.backgroundTop >= 8 && report.backgroundBottom >= 8,
    `${label}: active background fills the full button height`,
  );
  assert.notEqual(
    report.backgroundColor,
    "rgba(0, 0, 0, 0)",
    `${label}: active background color is missing`,
  );
}

try {
  await mkdir(outputDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const state = createInitialState();
  state.flags.tutorialSeen = true;
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(state)],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");

  const mapSelection = await measureActiveNav(page);
  assertInsetBackground(mapSelection, "map");
  assert.equal(mapSelection.action, "nav-map");

  await page.click('.topbar button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  const arenaSelection = await measureActiveNav(page);
  assertInsetBackground(arenaSelection, "arena");
  assert.equal(arenaSelection.action, "nav-arena");

  await page.click('.topbar button[data-action="nav-story-hub"]');
  await page.waitForSelector(".screen-story-hub");
  const storySelection = await measureActiveNav(page);
  assertInsetBackground(storySelection, "story-hub");
  assert.equal(storySelection.action, "nav-story-hub");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const mobileStorySelection = await measureActiveNav(page);
  assertInsetBackground(mobileStorySelection, "mobile-story-hub");
  assert.equal(mobileStorySelection.action, "nav-story-hub");
  const mobileNav = await page.evaluate(() => {
    const nav = document.querySelector(".topbar-nav");
    const rect = nav.getBoundingClientRect();
    return {
      buttons: nav.querySelectorAll(".nav-button").length,
      columns: getComputedStyle(nav).gridTemplateColumns.split(" ").length,
      overflow: Math.max(0, nav.scrollWidth - nav.clientWidth),
      contained:
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.bottom <= innerHeight,
    };
  });
  assert.equal(mobileNav.buttons, 8);
  assert.equal(mobileNav.columns, 8);
  assert.equal(mobileNav.overflow, 0);
  assert.equal(mobileNav.contained, true);
  assert.deepEqual(runtimeErrors, [], "nav interaction should not throw");

  await page.screenshot({
    path: `${outputDir}/nav-selection-1440x900.png`,
    fullPage: false,
  });
  console.log("Navigation selection styling passed at 1440x900.");
} finally {
  await browser.close();
}
