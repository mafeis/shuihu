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
  new URL("../artifacts/qa/issue28", import.meta.url),
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
  state.inventory.copper = 5600;
  return state;
}

async function openRoster(page) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('.topbar button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  await page.waitForTimeout(250);
}

async function measureRoster(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        left: Math.round(box.left),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        overflowY: style.overflowY,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      };
    };
    const cards = [...document.querySelectorAll(".hero-card")].map((card) => {
      const box = card.getBoundingClientRect();
      const hit = card.querySelector(".hero-card-hit");
      const footer = card.querySelector("footer");
      const hitStyle = hit ? getComputedStyle(hit) : null;
      const footerStyle = footer ? getComputedStyle(footer) : null;
      const footerBackground = footerStyle?.backgroundColor || "";
      const backgroundAlpha = Number(
        footerBackground.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([^)]+))?\)/)?.[1] ??
          1,
      );
      return {
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        left: Math.round(box.left),
        scrollWidth: card.scrollWidth,
        clientWidth: card.clientWidth,
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
        hitZIndex: Number(hitStyle?.zIndex || 0),
        footerZIndex: Number(footerStyle?.zIndex || 0),
        footerBackground,
        footerBackgroundOpaque: backgroundAlpha === 1,
      };
    });
    const actionButtons = [
      ...document.querySelectorAll(".roster-screen .dossier-actions .button"),
    ].map((button) => {
      const box = button.getBoundingClientRect();
      return {
        top: Math.round(box.top),
        right: Math.round(box.right),
        bottom: Math.round(box.bottom),
        left: Math.round(box.left),
        scrollWidth: button.scrollWidth,
        clientWidth: button.clientWidth,
      };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      pageOverflowY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      layout: rect(".roster-layout"),
      heading: rect(".roster-heading"),
      list: rect(".roster-list-panel"),
      filters: rect(".roster-filters"),
      gallery: rect(".hero-gallery"),
      dossier: rect(".hero-dossier"),
      dossierCopy: rect(".hero-dossier .dossier-copy"),
      actionBar: rect(".dossier-actions"),
      actionButtons,
      cardCount: cards.length,
      cards,
      cardImageFit: [
        ...document.querySelectorAll(".hero-card-art img"),
      ].every((image) => getComputedStyle(image).objectFit === "contain"),
      columns: getComputedStyle(document.querySelector(".hero-gallery"))
        .gridTemplateColumns.split(" ").length,
    };
  });
}

function assertInside(rect, viewport, name, inset = 0) {
  assert.ok(rect, `${name}: missing`);
  assert.ok(
    rect.top >= inset - 1 &&
      rect.left >= inset - 1 &&
      rect.right <= viewport.width - inset + 1 &&
      rect.bottom <= viewport.height - inset + 1,
    `${name}: escapes viewport ${JSON.stringify({ rect, viewport })}`,
  );
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openRoster(page);

  const reports = [];
  for (const [name, width, height] of [
    ["roster-1440x900", 1440, 900],
    ["roster-1280x720", 1280, 720],
    ["roster-390x844", 390, 844],
    ["roster-360x640", 360, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const report = await measureRoster(page);
    assert.equal(report.pageOverflowX, 0, `${name}: horizontal page overflow`);
    assert.equal(report.pageOverflowY, 0, `${name}: vertical page overflow`);
    assert.ok(report.cardCount > 0, `${name}: roster cards are missing`);
    assert.equal(report.cardImageFit, true, `${name}: card art is stretched`);
    assert.ok(report.gallery, `${name}: gallery is missing`);
    assert.equal(
      report.gallery.overflowY,
      "auto",
      `${name}: gallery is not independently scrollable`,
    );
    assert.ok(
      report.gallery.scrollHeight > report.gallery.clientHeight,
      `${name}: gallery should scroll to the remaining roster`,
    );
    assert.ok(
      report.heading.bottom <= report.list.top + 1,
      `${name}: heading overlaps roster list`,
    );
    assert.ok(
      report.filters.bottom <= report.gallery.top + 1,
      `${name}: filters overlap gallery`,
    );
    for (const card of report.cards) {
      assert.ok(
        card.scrollWidth <= card.clientWidth + 1 &&
          card.scrollHeight <= card.clientHeight + 1,
        `${name}: hero card content is clipped ${JSON.stringify(card)}`,
      );
      assert.ok(
        card.left >= report.gallery.left - 1 &&
          card.right <= report.gallery.right + 1,
        `${name}: hero card escapes gallery`,
      );
      if (width > 920) {
        assert.equal(
          card.footerBackgroundOpaque,
          true,
          `${name}: hero stats need an opaque background ${JSON.stringify(card)}`,
        );
        assert.ok(
          card.footerZIndex > card.hitZIndex,
          `${name}: hero stats are not layered above the portrait ${JSON.stringify(card)}`,
        );
      }
    }

    if (width > 920) {
      assertInside(report.dossier, report.viewport, `${name} dossier`);
      assertInside(report.actionBar, report.viewport, `${name} action bar`);
      assert.equal(
        report.dossier.display,
        "grid",
        `${name}: desktop dossier should stay visible`,
      );
      assert.ok(
        report.dossier.left >= report.list.right,
        `${name}: dossier overlaps roster gallery`,
      );
      assert.equal(
        report.columns,
        3,
        `${name}: desktop gallery should use three columns`,
      );
      assert.equal(
        report.actionButtons.length,
        3,
        `${name}: dossier should expose three primary actions`,
      );
      for (const button of report.actionButtons) {
        assertInside(button, report.viewport, `${name} action`);
        assert.ok(
          button.scrollWidth <= button.clientWidth + 1,
          `${name}: dossier action label is clipped`,
        );
      }
    } else {
      assert.equal(
        report.dossier.display,
        "none",
        `${name}: mobile dossier should open on demand`,
      );
      assert.equal(
        report.columns,
        2,
        `${name}: mobile gallery should use two columns`,
      );
    }
    reports.push({ name, report });
    await page.screenshot({
      path: `${outputDir}/${name}.png`,
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.locator(".hero-card-hit").first().click();
  await page.waitForSelector(".hero-dossier.is-open");
  const drawer = await measureRoster(page);
  assertInside(drawer.dossier, drawer.viewport, "mobile hero drawer");
  assertInside(drawer.actionBar, drawer.viewport, "mobile drawer actions");
  assert.equal(drawer.actionButtons.length, 3, "mobile drawer actions missing");
  assert.ok(
    drawer.dossier.bottom <= drawer.viewport.height - 64,
    "mobile drawer should stay above bottom navigation",
  );
  for (const button of drawer.actionButtons) {
    assertInside(button, drawer.viewport, "mobile drawer action");
    assert.ok(
      button.scrollWidth <= button.clientWidth + 1,
      "mobile drawer action label is clipped",
    );
  }
  await page.screenshot({
    path: `${outputDir}/roster-390x844-detail.png`,
    fullPage: false,
  });
  await page.click('.roster-detail-close');
  assert.equal(
    await page.locator(".hero-dossier.is-open").count(),
    0,
    "mobile drawer did not close",
  );
  const gallery = page.locator(".hero-gallery");
  await gallery.evaluate((node) => {
    node.scrollTop = 260;
  });
  const scrollBefore = await gallery.evaluate((node) => node.scrollTop);
  await page
    .locator(".hero-card-hit")
    .nth(6)
    .evaluate((button) => button.click());
  await page.waitForSelector(".hero-dossier.is-open");
  await page.click(".roster-detail-close");
  const scrollAfter = await page
    .locator(".hero-gallery")
    .evaluate((node) => node.scrollTop);
  assert.ok(
    Math.abs(scrollAfter - scrollBefore) <= 2,
    `roster scroll position was not preserved ${JSON.stringify({
      scrollBefore,
      scrollAfter,
    })}`,
  );

  console.log(
    JSON.stringify(
      reports.map(({ name, report }) => ({
        name,
        viewport: report.viewport,
        layout: report.layout,
        gallery: report.gallery,
        dossier: report.dossier,
        actionBar: report.actionBar,
        columns: report.columns,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
