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
import {
  clickPageAction,
  waitForPageEngine,
  waitForPageScreen,
} from "./helpers/engine-ui.mjs";

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

async function enterBattle(page) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitForPageEngine(page);
  await clickPageAction(page, "continue-game");
  await waitForPageScreen(page, "map");
  await clickPageAction(page, "enter-chapter");
  await waitForPageScreen(page, "story");
  await clickPageAction(page, "story-skip");
  await page.waitForFunction(
    () => globalThis.__shuihuPageStage?.model?.layout === "choice",
  );
  await clickPageAction(page, "story-choice");
  await clickPageAction(page, "story-to-battle");
  await page.waitForSelector(".screen-battle");
  await page.waitForFunction(() => globalThis.__shuihuBattleEngine === "phaser");
  await page.waitForTimeout(350);
}

async function clickEngineControl(page, id) {
  await page.waitForTimeout(80);
  const target = await page.evaluate((controlId) => {
    const stage = globalThis.__shuihuBattleStage;
    const area = stage?.getUiSnapshot?.().hitAreas?.[controlId];
    const rect = stage?.canvas?.getBoundingClientRect?.();
    if (!area || !rect) return null;
    return {
      x: rect.left + area.x + area.width / 2,
      y: rect.top + area.y + area.height / 2,
    };
  }, id);
  assert.ok(target, `engine control ${id} is missing`);
  const topElement = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        id: element?.id || "",
        className:
          typeof element?.className === "string" ? element.className : "",
        tagName: element?.tagName || "",
      };
    },
    target,
  );
  assert.equal(
    topElement.id,
    "battle-stage-canvas",
    `engine control ${id} is covered by ${JSON.stringify(topElement)}`,
  );
  await page.mouse.click(target.x, target.y);
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
    const battleStage = globalThis.__shuihuBattleStage;
    const canvas = document.querySelector("#battle-stage-canvas");
    const stageRect = stage?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const ui = battleStage?.getUiSnapshot?.() || null;
    const snapshot = battleStage?.getSnapshot?.() || null;
    const mobile = snapshot?.mobile || false;
    const commandNode = document.querySelector(".battle-command");
    const combatantsNode = document.querySelector(".battle-combatants");
    const actors = Object.entries(ui?.actors || {}).map(([uid, actor]) => {
      const hudWidth = Math.max(
        mobile ? 94 : 146,
        Math.round(actor.width * (mobile ? 1.05 : 1)),
      );
      const hudHeight = mobile ? 62 : 68;
      return {
        uid,
        x: actor.x,
        y: actor.y,
        width: actor.width,
        height: actor.height,
        hud: {
          left: actor.x - hudWidth / 2,
          right: actor.x + hudWidth / 2,
          top: actor.y + 38,
          bottom: actor.y + 38 + hudHeight,
        },
      };
    });
    const hudCollisions = [];
    for (let leftIndex = 0; leftIndex < actors.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < actors.length;
        rightIndex += 1
      ) {
        const left = actors[leftIndex].hud;
        const right = actors[rightIndex].hud;
        const overlapWidth =
          Math.min(left.right, right.right) - Math.max(left.left, right.left);
        const overlapHeight =
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
        if (overlapWidth > 3 && overlapHeight > 3) {
          hudCollisions.push([
            actors[leftIndex].uid,
            actors[rightIndex].uid,
            Math.round(overlapWidth),
            Math.round(overlapHeight),
          ]);
        }
      }
    }
    const actorsOutside = actors.filter(
      (actor) =>
        actor.x - actor.width / 2 < -2 ||
        actor.x + actor.width / 2 > canvasRect.width + 2 ||
        actor.y - actor.height < -2 ||
        actor.y + 106 > canvasRect.height + 2,
    );
    const hitAreas = Object.entries(ui?.hitAreas || {}).map(([id, area]) => ({
      id,
      ...area,
    }));
    const hitAreasOutside = hitAreas.filter(
      (area) =>
        area.x < -1 ||
        area.y < -1 ||
        area.x + area.width > canvasRect.width + 1 ||
        area.y + area.height > canvasRect.height + 1,
    );
    return {
      viewport: { width: innerWidth, height: innerHeight },
      engine: globalThis.__shuihuBattleEngine,
      stageSnapshot: snapshot,
      uiSnapshot: ui,
      canvas: canvas
        ? {
            width: canvas.width,
            height: canvas.height,
            cssWidth: Math.round(canvasRect.width),
            cssHeight: Math.round(canvasRect.height),
            renderer: canvas.dataset.renderer,
          }
        : null,
      openSourceTextures: battleStage?.scene
        ? Object.keys(battleStage.scene.textures?.list || {}).filter((key) =>
            key.startsWith("battle-open-vfx-"),
          )
        : [],
      pageOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      pageOverflowY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      field: rect(".battle-field"),
      stage: rect(".battle-stage"),
      stageMatchesCanvas:
        Boolean(stageRect && canvasRect) &&
        Math.abs(stageRect.left - canvasRect.left) <= 1 &&
        Math.abs(stageRect.top - canvasRect.top) <= 1 &&
        Math.abs(stageRect.width - canvasRect.width) <= 1 &&
        Math.abs(stageRect.height - canvasRect.height) <= 1,
      commandFallbackAbsent: !commandNode,
      combatantsAbsent: !combatantsNode,
      hudCollisions,
      actorsOutside,
      hitAreasOutside,
      skillHitId:
        hitAreas.find((area) => area.id.startsWith("skill:"))?.id || null,
    };
  });

  await page.screenshot({
    path: `${outputDir}/${name}.png`,
    fullPage: false,
  });
  assert.equal(report.pageOverflowX, 0, `${name}: page has horizontal overflow`);
  assert.equal(report.engine, "phaser", `${name}: Phaser did not own the stage`);
  assert.equal(
    report.stageSnapshot?.engine,
    "phaser",
    `${name}: Phaser snapshot is unavailable`,
  );
  assert.equal(
    report.stageSnapshot?.actors,
    6,
    `${name}: Phaser did not render all combatants`,
  );
  assert.equal(report.stageSnapshot?.ui.active, true, `${name}: engine UI inactive`);
  assert.ok(
    report.stageSnapshot?.ui.hitAreas >= 3,
    `${name}: engine controls are missing`,
  );
  assert.equal(
    report.openSourceTextures.length,
    8,
    `${name}: Kenney battle VFX textures did not load`,
  );
  assert.ok(report.canvas, `${name}: Phaser canvas is missing`);
  assert.equal(report.canvas.cssWidth, report.stage.width, `${name}: canvas width mismatch`);
  assert.equal(report.canvas.cssHeight, report.stage.height, `${name}: canvas height mismatch`);
  assert.equal(report.stageMatchesCanvas, true, `${name}: canvas escaped the stage`);
  assert.ok(report.field, `${name}: battle field is missing`);
  assert.ok(report.stage, `${name}: battle stage is missing`);
  assert.equal(report.commandFallbackAbsent, true, `${name}: DOM command rail is mounted`);
  assert.equal(report.combatantsAbsent, true, `${name}: DOM combatants are mounted`);
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
  assert.deepEqual(report.hudCollisions, [], `${name}: engine HUDs overlap`);
  assert.deepEqual(report.actorsOutside, [], `${name}: actors escape the canvas`);
  assert.deepEqual(
    report.hitAreasOutside,
    [],
    `${name}: engine hit areas escape the canvas`,
  );
  assert.ok(
    report.field.scrollHeight <= report.field.clientHeight + 1,
    `${name}: battle field needs hidden vertical scrolling ${JSON.stringify(report)}`,
  );
  assert.ok(report.skillHitId, `${name}: no engine skill control is available`);
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await enterBattle(page);

  const report = await measureBattle(page, "battle-1440x960");
  await page.evaluate(() => {
    globalThis.__battleCanvasBaseline = document.querySelector(
      "#battle-stage-canvas",
    );
  });
  const initialUi = await page.evaluate(() =>
    globalThis.__shuihuBattleStage.getUiSnapshot(),
  );
  assert.ok(
    initialUi.hitAreas["header:speed:2"],
    "engine header speed control is missing",
  );
  await clickEngineControl(page, "header:speed:2");
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().ui.speed === 2,
  );
  await clickEngineControl(page, "header:speed:1");
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().ui.speed === 1,
  );
  await clickEngineControl(page, "header:menu");
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().ui.menuOpen === true,
  );
  const pauseReport = await page.evaluate(() => {
    const ui = globalThis.__shuihuBattleStage.getUiSnapshot();
    return {
      modalMounted: Boolean(document.querySelector("[data-modal-panel]")),
      resume: ui.hitAreas["menu:resume"] || null,
      retreat: ui.hitAreas["menu:retreat"] || null,
      backdropAreas: Object.keys(ui.hitAreas).filter((id) =>
        id.startsWith("menu:dismiss:"),
      ),
      skillAreas: Object.keys(ui.hitAreas).filter((id) =>
        id.startsWith("skill:"),
      ),
    };
  });
  assert.equal(pauseReport.modalMounted, false, "battle pause used a DOM modal");
  assert.ok(pauseReport.resume, "engine pause menu has no resume control");
  assert.ok(pauseReport.retreat, "engine pause menu has no retreat control");
  assert.equal(
    pauseReport.backdropAreas.length,
    4,
    "engine pause menu has no blocking backdrop",
  );
  assert.deepEqual(
    pauseReport.skillAreas,
    [],
    "battle controls remain interactive behind the engine pause menu",
  );
  await clickEngineControl(page, "menu:resume");
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().ui.menuOpen === false,
  );
  await page.evaluate(() => {
    const overlay = document.createElement("div");
    overlay.className = "battle-end-overlay defeat-overlay";
    overlay.id = "retry-regression-overlay";
    overlay.innerHTML =
      '<button type="button" data-action="retry-battle">重整再战</button>';
    document.querySelector(".game-frame")?.append(overlay);
  });
  await page.click("#retry-regression-overlay [data-action=retry-battle]");
  await page.waitForFunction(
    () =>
      !document.querySelector("#retry-regression-overlay") &&
      globalThis.__shuihuBattleStage?.getSnapshot?.().ui.step === 1,
  );
  const retry = await page.evaluate(() => ({
    sameCanvas:
      globalThis.__shuihuBattleStage?.canvas ===
      document.querySelector("#battle-stage-canvas"),
    baselineCanvasPreserved:
      globalThis.__shuihuBattleStage?.canvas ===
      globalThis.__battleCanvasBaseline,
    overlayMounted: Boolean(document.querySelector(".defeat-overlay")),
  }));
  assert.equal(retry.sameCanvas, true, "battle retry replaced the active canvas");
  assert.equal(
    retry.baselineCanvasPreserved,
    true,
    "battle retry should preserve the established canvas",
  );
  assert.equal(
    retry.overlayMounted,
    false,
    "battle retry should remove the defeat recovery overlay",
  );
  const skill = initialUi.hitAreas[report.skillHitId];
  assert.ok(skill, "manual battle has no usable engine skill");
  await clickEngineControl(page, report.skillHitId);
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().ui.step === 2,
  );
  const targetingUi = await page.evaluate(() =>
    globalThis.__shuihuBattleStage.getUiSnapshot(),
  );
  const target = Object.entries(targetingUi.actors).find(
    ([, actor]) => actor.targetable,
  );
  assert.ok(target, "target selection did not expose a valid combatant");
  const targetPoint = await page.evaluate((uid) => {
    const stage = globalThis.__shuihuBattleStage;
    const actor = stage?.getUiSnapshot?.().actors?.[uid];
    const rect = stage?.canvas?.getBoundingClientRect?.();
    if (!actor || !rect) return null;
    return {
      x: rect.left + actor.x,
      y: rect.top + actor.y - actor.height * 0.5,
    };
  }, target[0]);
  assert.ok(targetPoint, "target combatant disappeared before selection");
  await page.mouse.click(targetPoint.x, targetPoint.y);
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().attacking === true,
    null,
    { timeout: 1200 },
  );
  await page.waitForTimeout(220);
  const action = await page.evaluate(() => {
    const stage = globalThis.__shuihuBattleStage;
    const snapshot = stage?.getSnapshot?.();
    const canvasRect = stage?.canvas?.getBoundingClientRect?.();
    return {
      sameCanvas: stage?.canvas === document.querySelector("#battle-stage-canvas"),
      baselineCanvasPreserved:
        stage?.canvas === globalThis.__battleCanvasBaseline,
      snapshot,
      textures: stage?.scene
        ? Object.keys(stage.scene.textures?.list || {}).filter((key) =>
            key.startsWith("battle-open-vfx-"),
          )
        : [],
      canvas: {
        width: stage?.canvas?.width || 0,
        height: stage?.canvas?.height || 0,
        cssWidth: Math.round(canvasRect?.width || 0),
        cssHeight: Math.round(canvasRect?.height || 0),
      },
    };
  });
  assert.equal(action.sameCanvas, true, "Phaser lost the active battle canvas");
  assert.equal(
    action.baselineCanvasPreserved,
    true,
    "battle rendering replaced the Phaser canvas and caused a visual flash",
  );
  assert.equal(action.snapshot?.attacking, true, "Phaser performance is not active");
  assert.ok(action.snapshot?.template, "skill did not map to a VFX template");
  assert.equal(action.canvas.cssWidth, report.stage.width, "canvas width changed mid-action");
  assert.equal(action.canvas.cssHeight, report.stage.height, "canvas height changed mid-action");
  assert.equal(
    action.textures.length,
    8,
    "Kenney VFX textures are incomplete",
  );
  assert.ok(
    action.snapshot?.openSourceVfx?.loaded === 8,
    "Kenney VFX textures were not ready at action time",
  );
  assert.ok(
    action.snapshot?.openSourceVfx?.active > 0,
    "no Kenney VFX sprite is active during the hit",
  );
  assert.ok(
    action.snapshot?.openSourceVfx?.plays > 0,
    "Kenney VFX was never played",
  );
  await page.screenshot({
    path: `${outputDir}/battle-collision-1440x960.png`,
    fullPage: false,
  });

  console.log(
    JSON.stringify(
      {
        report: {
          viewport: report.viewport,
          stage: report.stage,
          engine: report.engine,
          canvas: report.canvas,
          openSourceTextures: report.openSourceTextures,
          pause: pauseReport,
          retry,
        },
        action,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
