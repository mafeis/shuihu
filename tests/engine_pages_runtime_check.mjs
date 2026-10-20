import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import { CHAPTERS } from "../src/data.js";
import { createInitialState, SAVE_KEY } from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:5173";
const screenshotDir = process.env.CAPTURE_ENGINE_SCREENSHOTS
  ? resolve(process.env.CAPTURE_ENGINE_SCREENSHOTS)
  : null;
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

const viewports = [
  ["desktop", 1440, 900],
  ["laptop", 1280, 720],
  ["tablet", 800, 600],
  ["mobile", 390, 844],
  ["narrow", 320, 568],
];

function campaignState() {
  const state = createInitialState();
  state.flags.tutorialSeen = true;
  return state;
}

function strongCampaignState() {
  const state = campaignState();
  state.roster.linchong.level = 100;
  state.settings.autoBattle = true;
  state.settings.battleSpeed = 4;
  state.settings.reducedMotion = true;
  return state;
}

function finalChoiceState() {
  const state = campaignState();
  state.currentChapter = CHAPTERS.length;
  state.flags.finalBattleWon = true;
  return state;
}

function endingState() {
  const state = finalChoiceState();
  state.ending = "brotherhood";
  state.endingsUnlocked = ["brotherhood"];
  return state;
}

function arenaRewardState() {
  const state = campaignState();
  state.arena.activeRun = {
    mode: "endless",
    wave: 7,
    boons: ["vanguard", "rally"],
    pendingBoons: ["breaker", "swift", "remedy"],
    rerollUsed: false,
    eventOffer: [],
    healthRatios: { linchong: 0.42 },
    completedWave: 6,
    lastReward: { copper: 188, xp: 162, score: 740 },
    score: 3380,
    bountiesCleared: 3,
    currentBounty: "chain",
    lastBounty: {
      id: "breaker",
      cleared: true,
      copper: 40,
      score: 170,
    },
    lastPerformance: {
      grade: "S",
      bonusScore: 100,
      rounds: 5,
      survivors: 1,
      heroCount: 1,
      mvpHeroId: "linchong",
      mvpDamage: 920,
      mvpKills: 2,
      mvpUltimates: 1,
      objectives: [],
    },
    lastUnlocks: [],
    lastDiscoveries: { masteries: [], synergies: [], encounters: [] },
    lastWeeklyMarks: [],
    trialIds: [],
    defeated: false,
  };
  return state;
}

async function waitForEngine(page) {
  await page.waitForFunction(
    () => globalThis.__shuihuPageEngine === "phaser",
  );
  await page.waitForTimeout(180);
}

async function setSavedState(page, state) {
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(state)],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForEngine(page);
}

async function clickAction(page, actionName) {
  const point = await page.evaluate((action) => {
    const ui = globalThis.__shuihuPageStage.getUiSnapshot();
    const entry = Object.entries(ui.hitAreas).find(
      ([, item]) => item.action === action,
    );
    if (!entry) return null;
    const rect = entry[1];
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }, actionName);
  assert.ok(
    point,
    `${await page.evaluate(() => globalThis.__shuihuPageStage.model.screen)}: missing engine action ${actionName}`,
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(35);
  await page.mouse.up();
  await page.waitForTimeout(240);
}

async function waitForScreen(page, screenName) {
  await page.waitForFunction(
    (screen) =>
      globalThis.__shuihuPageStage?.model?.screen === screen &&
      globalThis.__shuihuPageEngine === "phaser",
    screenName,
    { timeout: 12000 },
  );
  await page.waitForTimeout(180);
}

async function verifyEngineSurface(page, label) {
  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({
      path: resolve(screenshotDir, `${label.replaceAll("/", "-")}.png`),
    });
  }
  const report = await page.evaluate(() => {
    const stage = globalThis.__shuihuPageStage;
    const ui = stage.getUiSnapshot();
    const root = document.documentElement;
    const hostRect = document
      .querySelector("#game-stage-host")
      ?.getBoundingClientRect();
    const scrollable = [...document.querySelectorAll("*")].filter((node) => {
      const style = getComputedStyle(node);
      return (
        ["auto", "scroll"].includes(style.overflowY) &&
        node.scrollHeight > node.clientHeight + 1
      );
    });
    return {
      screen: ui.screen,
      mode: ui.mode,
      docWidth: root.scrollWidth,
      docHeight: root.scrollHeight,
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      host: hostRect
        ? {
            width: Math.round(hostRect.width),
            height: Math.round(hostRect.height),
          }
        : null,
      audit: ui.audit,
      pendingImages: ui.images.filter((image) => image.pending).length,
      visibleDomActions: [...document.querySelectorAll("#app [data-action]")]
        .filter((node) => {
          if (node.closest("#engine-accessibility")) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1;
        }).length,
      scrollable: scrollable.map((node) => node.id || node.className),
    };
  });

  assert.equal(report.mode, "phaser", `${label}: page engine is not ready`);
  assert.equal(
    report.docWidth,
    report.clientWidth,
    `${label}: document has horizontal overflow`,
  );
  assert.equal(
    report.docHeight,
    report.clientHeight,
    `${label}: document has vertical overflow`,
  );
  assert.equal(
    report.bodyWidth,
    report.clientWidth,
    `${label}: body has horizontal overflow`,
  );
  assert.equal(
    report.bodyHeight,
    report.clientHeight,
    `${label}: body has vertical overflow`,
  );
  assert.deepEqual(report.host, {
    width: report.clientWidth,
    height: report.clientHeight,
  }, `${label}: engine host does not fill the viewport`);
  assert.deepEqual(
    report.audit.textOverlaps,
    [],
    `${label}: text overlaps`,
  );
  assert.deepEqual(
    report.audit.glyphTextOverlaps,
    [],
    `${label}: glyphs overlap text`,
  );
  assert.deepEqual(
    report.audit.glyphOverlaps,
    [],
    `${label}: glyphs overlap each other`,
  );
  assert.deepEqual(
    report.audit.imageTextOverlaps,
    [],
    `${label}: images overlap text`,
  );
  assert.deepEqual(
    report.audit.hitOverlaps,
    [],
    `${label}: hit targets overlap`,
  );
  assert.deepEqual(report.audit.outside, [], `${label}: UI leaves viewport`);
  assert.equal(report.pendingImages, 0, `${label}: image is still loading`);
  assert.equal(
    report.visibleDomActions,
    0,
    `${label}: visible HTML game controls remain`,
  );
  assert.deepEqual(report.scrollable, [], `${label}: scroll container found`);
  return report.screen;
}

async function verifyCampaignPages(page, prefix) {
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await waitForEngine(page);
  await verifyEngineSurface(page, `${prefix}/title`);
  await clickAction(page, "new-game");
  await waitForScreen(page, "map");
  await verifyEngineSurface(page, `${prefix}/map`);

  for (const [screen, action] of [
    ["camp", "nav-camp"],
    ["arena", "nav-arena"],
    ["roster", "nav-roster"],
  ]) {
    await clickAction(page, action);
    await waitForScreen(page, screen);
    await verifyEngineSurface(page, `${prefix}/${screen}`);
  }

  await clickAction(page, "nav-formation");
  await waitForScreen(page, "formation");
  await verifyEngineSurface(page, `${prefix}/formation`);

  await clickAction(page, "nav-roster");
  await waitForScreen(page, "roster");
  await clickAction(page, "equipment-hero");
  await waitForScreen(page, "equipment");
  await verifyEngineSurface(page, `${prefix}/equipment`);

  for (const [screen, action] of [
    ["quests", "nav-quests"],
    ["codex", "nav-codex"],
    ["settings", "nav-settings"],
  ]) {
    await clickAction(page, action);
    await waitForScreen(page, screen);
    await verifyEngineSurface(page, `${prefix}/${screen}`);
  }
}

async function verifyStorySurfaces(page, prefix) {
  await setSavedState(page, campaignState());
  await clickAction(page, "continue-game");
  await waitForScreen(page, "map");
  await clickAction(page, "enter-chapter");
  await waitForScreen(page, "story");
  await verifyEngineSurface(page, `${prefix}/story-intro`);

  for (let index = 0; index < 8; index += 1) {
    const layout = await page.evaluate(
      () => globalThis.__shuihuPageStage.model.layout,
    );
    if (layout === "choice") break;
    await clickAction(page, "story-next");
  }
  await page.waitForFunction(
    () => globalThis.__shuihuPageStage.model.layout === "choice",
  );
  await verifyEngineSurface(page, `${prefix}/story-choice`);
  await clickAction(page, "story-choice");
  await verifyEngineSurface(page, `${prefix}/story-response`);
}

async function verifyRewardSurface(page, prefix) {
  await setSavedState(page, strongCampaignState());
  await clickAction(page, "continue-game");
  await waitForScreen(page, "map");
  await clickAction(page, "enter-chapter");
  await waitForScreen(page, "story");
  for (let index = 0; index < 8; index += 1) {
    const layout = await page.evaluate(
      () => globalThis.__shuihuPageStage.model.layout,
    );
    if (layout === "choice") break;
    await clickAction(page, "story-next");
  }
  await clickAction(page, "story-choice");
  await clickAction(page, "story-to-battle");
  await page.waitForFunction(
    () => globalThis.__shuihuBattleEngine === "phaser",
    { timeout: 15000 },
  );
  const battleSurface = await page.evaluate(() => {
    const pageHost = document.querySelector("#game-stage-host");
    const battleCanvas = document.querySelector("#battle-stage-canvas");
    const rect = battleCanvas?.getBoundingClientRect();
    return {
      pageHost: pageHost ? getComputedStyle(pageHost).display : null,
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0),
    };
  });
  assert.equal(
    battleSurface.pageHost,
    "none",
    `${prefix}/battle: page canvas still covers battle`,
  );
  assert.deepEqual(
    [battleSurface.width, battleSurface.height],
    [page.viewportSize().width, page.viewportSize().height],
    `${prefix}/battle: battle canvas does not fill viewport`,
  );
  await waitForScreen(page, "reward");
  await verifyEngineSurface(page, `${prefix}/reward`);
}

async function verifyLateSurfaces(page, prefix) {
  await setSavedState(page, finalChoiceState());
  await clickAction(page, "continue-game");
  await waitForScreen(page, "final-choice");
  await verifyEngineSurface(page, `${prefix}/final-choice`);

  await setSavedState(page, endingState());
  await clickAction(page, "continue-game");
  await waitForScreen(page, "ending");
  await verifyEngineSurface(page, `${prefix}/ending`);

  await setSavedState(page, arenaRewardState());
  await clickAction(page, "continue-game");
  await waitForScreen(page, "map");
  await clickAction(page, "nav-arena");
  await waitForScreen(page, "arena");
  await clickAction(page, "resume-arena");
  await waitForScreen(page, "arena-reward");
  await verifyEngineSurface(page, `${prefix}/arena-reward`);
}

try {
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
    });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) =>
      failures.push(error.stack || error.message),
    );
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(message.text());
    });

    await verifyCampaignPages(page, name);
    await verifyStorySurfaces(page, name);
    await verifyRewardSurface(page, name);
    await verifyLateSurfaces(page, name);
    assert.deepEqual(failures, [], `${name}: browser runtime errors`);
    await context.close();
    console.log(`${name}: engine pages, fixed layout and transitions passed`);
  }
} finally {
  await browser.close();
}
