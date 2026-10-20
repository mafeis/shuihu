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
const screenshotDir = fileURLToPath(
  new URL("../artifacts/qa/issue26", import.meta.url),
);

const OPEN_SOURCE_VFX = [
  "blade_arc",
  "blade_cut",
  "impact_spark",
  "hit_spark",
  "heavy_dust",
  "volley_trace",
  "ultimate_star",
  "restore_glow",
];

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

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await enterBattle(page);

  const assets = await page.evaluate(async (names) => {
    return Promise.all(
      names.map(async (name) => {
        const response = await fetch(`/assets/vfx/kenney/${name}.webp`);
        return {
          name,
          ok: response.ok,
          bytes: (await response.arrayBuffer()).byteLength,
        };
      }),
    );
  }, OPEN_SOURCE_VFX);
  assert.equal(
    assets.every((asset) => asset.ok && asset.bytes > 1000),
    true,
    "every Kenney VFX asset should be available",
  );

  const canvas = await page.locator("#battle-stage-canvas").boundingBox();
  const initialUi = await page.evaluate(() =>
    globalThis.__shuihuBattleStage.getUiSnapshot(),
  );
  const skill = Object.entries(initialUi.hitAreas).find(([id]) =>
    id.startsWith("skill:"),
  )?.[1];
  assert.ok(skill, "manual battle has no usable engine skill");
  await page.mouse.click(
    canvas.x + skill.x + skill.width / 2,
    canvas.y + skill.y + skill.height / 2,
  );
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().ui.step === 2,
  );
  const targetingUi = await page.evaluate(() =>
    globalThis.__shuihuBattleStage.getUiSnapshot(),
  );
  const target = Object.entries(targetingUi.actors).find(
    ([, actor]) => actor.targetable,
  );
  assert.ok(target, "target selection did not expose a valid engine target");
  await page.mouse.click(
    canvas.x + target[1].x,
    canvas.y + target[1].y - target[1].height * 0.5,
  );
  await page.waitForFunction(
    () => globalThis.__shuihuBattleStage?.getSnapshot?.().attacking === true,
    null,
    { timeout: 1200 },
  );
  await page.waitForTimeout(180);

  const runtime = await page.evaluate(() => {
    const stage = globalThis.__shuihuBattleStage;
    return {
      engine: globalThis.__shuihuBattleEngine,
      sameCanvas: stage?.canvas === document.querySelector("#battle-stage-canvas"),
      canvas: {
        width: stage?.canvas?.width || 0,
        height: stage?.canvas?.height || 0,
      },
      snapshot: stage?.getSnapshot?.() || null,
      textureKeys: stage?.scene
        ? Object.keys(stage.scene.textures?.list || {}).filter((key) =>
            key.startsWith("battle-open-vfx-"),
          )
        : [],
    };
  });

  assert.equal(runtime.engine, "phaser");
  assert.equal(runtime.sameCanvas, true, "Phaser canvas was replaced mid-action");
  assert.ok(runtime.canvas.width >= 900 && runtime.canvas.height >= 700);
  assert.equal(runtime.snapshot?.actors, 6);
  assert.equal(runtime.snapshot?.openSourceVfx?.loaded, 8);
  assert.ok(runtime.snapshot?.openSourceVfx?.active > 0);
  assert.ok(runtime.snapshot?.openSourceVfx?.plays > 0);
  assert.equal(runtime.textureKeys.length, 8);

  await page.screenshot({
    path: `${screenshotDir}/battle-vfx-1440x960.png`,
    fullPage: false,
  });

  console.log(
    JSON.stringify(
      {
        assets,
        runtime,
        screenshot: `${screenshotDir}/battle-vfx-1440x960.png`,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
