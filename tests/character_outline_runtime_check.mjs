import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const profileDir = await mkdtemp(path.join(tmpdir(), "shuihu-outline-"));
const browser = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = browser.pages()[0] || (await browser.newPage());
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.click('button[data-action="new-game"]');
  await page.click('button[data-action="enter-chapter"]');
  await page.click('button[data-action="story-skip"]');
  await page.click('button[data-action="story-choice"][data-option="0"]');
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");

  const battleFilters = await page.evaluate(() => {
    const outlines = {};
    for (const selector of [
      ".enemy-figure img",
      ".hero-figure img",
    ]) {
      outlines[selector] = [...document.querySelectorAll(selector)].map(
        (image) => getComputedStyle(image).filter,
      );
    }
    return outlines;
  });
  for (const selector of [".enemy-figure img", ".hero-figure img"]) {
    assert.ok(battleFilters[selector].length > 0, `${selector} should be visible`);
    assert.equal(
      battleFilters[selector].every(
        (filter) =>
          filter.includes("rgba(235, 228, 211") &&
          (filter.match(/drop-shadow/g) || []).length === 2,
      ),
      true,
      `${selector} should use a fine contour plus depth shadow`,
    );
  }

  await page.click('button[data-action="battle-menu"]');
  await page.click('button[data-action="battle-retreat"]');
  await page.waitForSelector(".screen-camp");
  const campFilters = await page.evaluate(() =>
    [...document.querySelectorAll(".camp-team img")].map(
      (image) => getComputedStyle(image).filter,
    ),
  );
  assert.ok(campFilters.length > 0, "camp should show team portraits");
  assert.equal(
    campFilters.every((filter) => filter.includes("rgba(235, 228, 211")),
    true,
    "camp portraits should use the shared contour",
  );
  await page.click('button[data-action="nav-map"]');
  await page.waitForSelector(".screen-map");
  const rosterFilters = await page.evaluate(() => ({
    chapter: [...document.querySelectorAll(".chapter-party-figures img")].map(
      (image) => getComputedStyle(image).filter,
    ),
  }));
  await page.click('button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  rosterFilters.roster = await page.evaluate(() =>
    [...document.querySelectorAll(".hero-card-art img")].map(
      (image) => getComputedStyle(image).filter,
    ),
  );
  await page.click('button[data-action="nav-formation"]');
  await page.waitForSelector(".screen-formation");
  rosterFilters.formation = await page.evaluate(() =>
    [...document.querySelectorAll(".formation-figure img")].map(
      (image) => getComputedStyle(image).filter,
    ),
  );
  for (const [scope, filters] of Object.entries(rosterFilters)) {
    assert.ok(filters.length > 0, `${scope} should show hero portraits`);
    assert.equal(
      filters.every((filter) => filter.includes("rgba(235, 228, 211")),
      true,
      `${scope} portraits should use the shared contour`,
    );
  }

  await page.click('button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  const arenaFilters = await page.evaluate(() =>
    [...document.querySelectorAll(".arena-team img")].map(
      (image) => getComputedStyle(image).filter,
    ),
  );
  rosterFilters.arena = arenaFilters;
  assert.ok(arenaFilters.length > 0, "arena should show team portraits");
  assert.equal(
    arenaFilters.every((filter) => filter.includes("rgba(235, 228, 211")),
    true,
    "arena portraits should use the shared contour",
  );
  await page.click('button[data-action="nav-map"]');
  await page.click('button[data-action="enter-chapter"]');
  await page.click('button[data-action="story-skip"]');
  await page.click('button[data-action="story-choice"][data-option="0"]');
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");

  const figureRect = await page.locator(".enemy-figure img").first().boundingBox();
  const clip = {
    x: Math.max(0, Math.floor(figureRect.x - 3)),
    y: Math.max(0, Math.floor(figureRect.y - 3)),
    width: Math.ceil(figureRect.width + 6),
    height: Math.ceil(figureRect.height + 6),
  };
  clip.width = Math.min(
    clip.width,
    (await page.evaluate(() => innerWidth)) - clip.x,
  );
  const before = await page.screenshot({ clip });
  await page.addStyleTag({
    content: `.enemy-figure img { filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.62)) !important; }`,
  });
  const after = await page.screenshot({ clip });
  assert.notDeepEqual(before, after, "the contour should be visible in the battle");
  console.log(
    JSON.stringify({ battleFilters, campFilters, rosterFilters }, null, 2),
  );
} finally {
  await browser.close();
  await rm(profileDir, { recursive: true, force: true });
}
