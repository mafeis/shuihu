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
  new URL("../artifacts/qa/story-hub", import.meta.url),
);

function fixture(storyArchive = []) {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.currentChapter = 3;
  state.recruited = [...HERO_ORDER];
  state.roster = Object.fromEntries(
    HERO_ORDER.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = 20;
      return [heroId, entry];
    }),
  );
  state.team = ["linchong", "wusong", "huarong"];
  state.storyArchive = storyArchive;
  return state;
}

async function openStoryHub(page, save) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(save)],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="toggle-more-nav"]');
  await page.click('button[data-action="nav-story-hub"]');
  await page.waitForSelector(".screen-story-hub");
  await page.waitForTimeout(180);
}

async function measure(page) {
  return page.evaluate(() => {
    const nav = document.querySelector(".topbar-nav");
    const cards = [...document.querySelectorAll(".story-hub-card")];
    const texts = [...document.querySelectorAll(
      ".story-hub-copy small, .story-hub-copy b, .story-hub-status",
    )].filter((node) => {
      const style = getComputedStyle(node);
      return (
        node.scrollWidth > node.clientWidth + 1 ||
        node.scrollHeight > node.clientHeight + 1 ||
        style.webkitLineClamp !== "none"
      );
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      cards: cards.length,
      read: cards.filter((card) => card.classList.contains("is-read")).length,
      navButtons: nav?.querySelectorAll(".nav-button").length || 0,
      navRect: nav && {
        left: Math.round(nav.getBoundingClientRect().left),
        right: Math.round(nav.getBoundingClientRect().right),
        top: Math.round(nav.getBoundingClientRect().top),
        bottom: Math.round(nav.getBoundingClientRect().bottom),
      },
      navOverflow: nav
        ? Math.max(0, nav.scrollWidth - nav.clientWidth)
        : 0,
      pageOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      cardOverflow: cards.filter(
        (card) => card.scrollWidth > card.clientWidth + 1,
      ).length,
      clippedText: texts.map((node) => ({
        text: node.textContent.trim().slice(0, 80),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      })),
      summaryLines: [...document.querySelectorAll(".story-hub-copy em")].map(
        (node) => {
          const style = getComputedStyle(node);
          return {
            lineHeight: Number.parseFloat(style.lineHeight) || 18,
            height: node.getBoundingClientRect().height,
            clamp: style.webkitLineClamp,
            overflow: style.overflow,
          };
        },
      ),
    };
  });
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  await mkdir(outputDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openStoryHub(
    page,
    fixture([STORY_ARCHIVE_CHAPTERS[0].id]),
  );
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 920, 720],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(160);
    const metrics = await measure(page);
    assert.equal(metrics.cards, STORY_ARCHIVE_CHAPTERS.length);
    assert.equal(metrics.read, 1);
    assert.equal(metrics.navButtons, 5);
    assert.ok(metrics.navOverflow <= 1, `${name}: nav content overflows`);
    assert.ok(metrics.pageOverflowX <= 1, `${name}: page overflows horizontally`);
    assert.equal(metrics.cardOverflow, 0, `${name}: story cards overflow`);
    assert.deepEqual(metrics.clippedText, [], `${name}: text is clipped`);
    assert.ok(
      metrics.summaryLines.every(
        ({ lineHeight, height, clamp, overflow }) =>
          height >= lineHeight * 0.9 &&
          clamp === "none" &&
          overflow === "visible",
      ),
      `${name}: every summary should be fully readable`,
    );
    assert.ok(metrics.navRect.right <= width + 1);
    assert.ok(metrics.navRect.bottom <= height + 1);
    await page.screenshot({
      path: `${outputDir}/${name}.png`,
      fullPage: false,
    });
    console.log(JSON.stringify({ name, ...metrics }));
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
