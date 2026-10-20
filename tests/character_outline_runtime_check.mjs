import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outline = "rgba(250, 242, 220";
const outlinedFilter = (filter, contourCount) => {
  const dropShadows = Array.from(
    filter.matchAll(/drop-shadow\(/g),
    (match) => match[0],
  );
  return filter.includes(outline) && dropShadows.length >= contourCount;
};
const pageFilters = (page, selector) =>
  page.evaluate(
    (imageSelector) =>
      [...document.querySelectorAll(imageSelector)].map(
        (image) => getComputedStyle(image).filter,
      ),
    selector,
  );
const storyPortraitFilter = (page) =>
  page.evaluate(() => {
    const image = document.querySelector(".story-speaker-portrait img");
    return image ? getComputedStyle(image).filter : "";
  });
const assertOutlined = (filters, selector, strength = 4) => {
  assert.ok(filters.length > 0, `${selector} should be visible`);
  assert.equal(
    filters.every((filter) => outlinedFilter(filter, strength)),
    true,
    `${selector} should use a sharp light contour and depth shadow`,
  );
};

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
  await page.waitForSelector(".screen-story");
  let outlinedLineFound = false;
  for (let line = 0; line < 12; line += 1) {
    const storyFilter = await storyPortraitFilter(page);
    if (outlinedFilter(storyFilter, 5)) {
      outlinedLineFound = true;
      break;
    }
    if (!(await page.locator(".dialogue-panel").isVisible())) break;
    await page.click(".dialogue-panel");
  }
  assert.equal(outlinedLineFound, true, "story should include an outlined portrait");
  if (await page.locator('button[data-action="story-skip"]').isVisible()) {
    await page.click('button[data-action="story-skip"]');
  }
  await page.click('button[data-action="story-choice"][data-option="0"]');
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");

  const battleFilters = {};
  for (const selector of [".enemy-figure img", ".hero-figure img"]) {
    battleFilters[selector] = await pageFilters(page, selector);
    assertOutlined(battleFilters[selector], selector, 5);
  }

  await page.click('button[data-action="battle-menu"]');
  await page.click('button[data-action="battle-retreat"]');
  await page.waitForSelector(".screen-camp");
  const campFilters = await pageFilters(page, ".camp-team img");
  assertOutlined(campFilters, "camp portraits");
  await page.click('button[data-action="nav-map"]');
  await page.waitForSelector(".screen-map");
  const rosterFilters = {
    chapter: await pageFilters(page, ".chapter-party-figures img"),
  };
  await page.click('button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  rosterFilters.roster = await pageFilters(page, ".hero-card-art img");
  await page.click('button[data-action="nav-formation"]');
  await page.waitForSelector(".screen-formation");
  rosterFilters.formation = await pageFilters(page, ".formation-figure img");
  for (const [scope, filters] of Object.entries(rosterFilters)) {
    assertOutlined(filters, `${scope} portraits`);
  }

  await page.click('button[data-action="toggle-more-nav"]');
  await page.click('button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  const arenaFilters = await pageFilters(page, ".arena-team img");
  rosterFilters.arena = arenaFilters;
  assertOutlined(arenaFilters, "arena portraits");
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
    JSON.stringify(
      {
        storyPortrait: "outlined",
        battleFilters,
        campFilters,
        rosterFilters,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await rm(profileDir, { recursive: true, force: true });
}
