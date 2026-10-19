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
  new URL("../artifacts/qa/issue26", import.meta.url),
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
  state.settings.autoBattle = false;
  state.settings.battleSpeed = 1;
  return state;
}

function roundedRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    right: Math.round(rect.x + rect.width),
    bottom: Math.round(rect.y + rect.height),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

async function enterBattle(page) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="enter-chapter"]');
  await page.waitForSelector(".screen-story");
  await page.click('button[data-action="story-skip"]');
  const choice = page.locator('button[data-action="story-choice"]').first();
  if (await choice.count()) await choice.click();
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  await page.waitForTimeout(250);
}

async function measureBattle(page, name) {
  const report = await page.evaluate(() => {
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
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
        overflowY: style.overflowY,
      };
    };
    const stage = document.querySelector(".battle-stage");
    const stageRect = stage?.getBoundingClientRect();
    const slotsOutside = stageRect
      ? [...document.querySelectorAll(".formation-slot")]
          .map((slot) => {
            const box = slot.getBoundingClientRect();
            return {
              side: slot.closest(".hero-line") ? "hero" : "enemy",
              row: slot.dataset.row,
              left: Math.round(box.left),
              right: Math.round(box.right),
              top: Math.round(box.top),
              bottom: Math.round(box.bottom),
            };
          })
          .filter(
            (box) =>
              box.left < Math.round(stageRect.left) - 2 ||
              box.right > Math.round(stageRect.right) + 2 ||
              box.top < Math.round(stageRect.top) - 2 ||
              box.bottom > Math.round(stageRect.bottom) + 2,
          )
      : [];
    const command = document.querySelector(".battle-command");
    const heroHuds = [...document.querySelectorAll(".hero-unit .unit-hud")];
    const commandRect = command?.getBoundingClientRect();
    const commandOverlapsHeroHud = commandRect
      ? heroHuds.some((hud) => {
          const box = hud.getBoundingClientRect();
          return (
            box.left < commandRect.right - 2 &&
            box.right > commandRect.left + 2 &&
            box.top < commandRect.bottom - 2 &&
            box.bottom > commandRect.top + 2
          );
        })
      : false;
    const characterImages = [
      ...document.querySelectorAll(".hero-figure img, .enemy-figure img"),
    ].map((image) => {
      const box = image.getBoundingClientRect();
      return {
        objectFit: getComputedStyle(image).objectFit,
        width: Math.round(box.width),
        height: Math.round(box.height),
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
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
      field: rect(".battle-field"),
      stage: rect(".battle-stage"),
      command: rect(".battle-command"),
      heroHudBottom: Math.max(
        0,
        ...heroHuds.map((hud) => hud.getBoundingClientRect().bottom),
      ),
      commandOverlapsHeroHud,
      slotsOutside,
      characterImages,
    };
  });

  await page.screenshot({
    path: `${outputDir}/${name}.png`,
    fullPage: false,
  });
  assert.equal(report.pageOverflowX, 0, `${name}: page has horizontal overflow`);
  assert.ok(report.field, `${name}: battle field is missing`);
  assert.ok(report.stage, `${name}: battle stage is missing`);
  assert.ok(report.command, `${name}: battle command panel is missing`);
  assert.ok(
    report.command.left >= -1 &&
      report.command.right <= report.viewport.width + 1 &&
      report.command.top >= -1 &&
      report.command.bottom <= report.viewport.height + 1,
    `${name}: battle command escapes viewport ${JSON.stringify(report.command)}`,
  );
  assert.ok(
    report.stage.left >= report.field.left - 1 &&
      report.stage.right <= report.field.right + 1 &&
      report.stage.top >= report.field.top - 1 &&
      report.stage.bottom <= report.field.bottom + 1,
    `${name}: battle stage escapes field ${JSON.stringify({
      field: report.field,
      stage: report.stage,
    })}`,
  );
  assert.equal(
    report.commandOverlapsHeroHud,
    false,
    `${name}: command panel overlaps hero HUD ${JSON.stringify(report)}`,
  );
  assert.equal(
    report.slotsOutside.length,
    0,
    `${name}: formation slots escape the battle stage ${JSON.stringify(
      report.slotsOutside,
    )}`,
  );
  assert.ok(
    report.field.scrollHeight <= report.field.clientHeight + 1,
    `${name}: battle field needs hidden vertical scrolling ${JSON.stringify(report)}`,
  );
  assert.ok(
    report.characterImages.length >= 6,
    `${name}: battle characters did not render`,
  );
  for (const image of report.characterImages) {
    assert.ok(image.complete && image.naturalWidth > 0, `${name}: broken figure`);
    assert.equal(
      image.objectFit,
      "contain",
      `${name}: character figure is stretched with ${image.objectFit}`,
    );
    assert.ok(
      image.width > 20 && image.height > 20,
      `${name}: character figure collapsed`,
    );
  }
  return report;
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
  await enterBattle(page);

  const reports = [];
  for (const [name, width, height] of [
    ["battle-1440x900", 1440, 900],
    ["battle-1280x720", 1280, 720],
    ["battle-390x844", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    reports.push(await measureBattle(page, name));
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  const actorFigure = page.locator(".hero-unit.is-current .hero-figure");
  const before = roundedRect(await actorFigure.boundingBox());
  const skill = page.locator('.skill-button:not([disabled])').first();
  assert.ok((await skill.count()) > 0, "manual battle has no usable skill");
  await skill.click();
  await page.waitForTimeout(80);
  const target = page
    .locator('button[data-action="battle-target"]:not([disabled])')
    .first();
  if (await target.count()) await target.click();
  await page.waitForFunction(
    (start) => {
      const figure = document.querySelector(
        ".hero-unit.is-striking .hero-figure",
      );
      if (!figure) return false;
      const rect = figure.getBoundingClientRect();
      return (
        Math.abs(rect.y - start.y) >= 70 ||
        Math.abs(rect.bottom - start.bottom) >= 70
      );
    },
    before,
    { timeout: 1200 },
  );

  const striking = page.locator(".battle-unit.is-striking");
  assert.equal(
    await striking.count(),
    1,
    "attacking unit should have collision state",
  );
  const strikeStyle = await striking.getAttribute("style");
  assert.match(strikeStyle || "", /--strike-x:/, "strike direction is missing");
  assert.match(
    strikeStyle || "",
    /--rush-(up|down):/,
    "strike vertical travel is missing",
  );
  const after = roundedRect(
    await page.locator(".hero-unit.is-striking .hero-figure").boundingBox(),
  );
  assert.ok(
    Math.abs(after.y - before.y) >= 70 ||
      Math.abs(after.bottom - before.bottom) >= 70,
    `attacker did not cross toward the opposing line ${JSON.stringify({
      before,
      after,
    })}`,
  );
  for (const selector of [
    ".collision-burst",
    ".impact-core",
    ".impact-shockwave",
  ]) {
    assert.ok(
      (await page.locator(selector).count()) > 0,
      `${selector} should render during a collision`,
    );
  }
  await page.screenshot({
    path: `${outputDir}/battle-collision-1440x900.png`,
    fullPage: false,
  });

  console.log(
    JSON.stringify(
      {
        reports: reports.map((report) => ({
          viewport: report.viewport,
          stage: report.stage,
          command: report.command,
          heroHudBottom: report.heroHudBottom,
        })),
        strike: { before, after, style: strikeStyle },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
