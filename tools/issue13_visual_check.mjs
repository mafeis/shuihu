import { mkdir } from "node:fs/promises";

import { chromium } from "playwright";

import { CHAPTERS, HERO_ORDER } from "../src/data.js";
import { createInitialState, SAVE_KEY } from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir =
  "/Users/mac/.codex/visualizations/2026/10/19/shuihu-issue-13";

function fixture(wins, copper = 3000) {
  const state = createInitialState();
  state.flags.tutorialSeen = true;
  state.currentChapter = 4;
  state.completedChapters = CHAPTERS.slice(0, 4).map((chapter) => chapter.id);
  state.recruited = [...HERO_ORDER];
  state.team = ["linchong", "luzhishen", "wusong"];
  state.stats.heroesRecruited = HERO_ORDER.length;
  state.stats.battlesWon = wins;
  state.inventory.copper = copper;
  return state;
}

function expandedFixture() {
  const state = fixture(10);
  state.camp.areaUnlocked = ["medium"];
  state.inventory.copper = 2000;
  state.camp.stock.timber = 8;
  state.camp.stock.iron_ore = 4;
  return state;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setSave(page, state) {
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(state)],
  );
  await page.reload();
  await page.getByText("续上旧卷", { exact: true }).click();
  await page.locator(".screen-map").waitFor();
  await page.locator('.topbar button[data-action="nav-camp"]').click();
  await page.locator(".screen-camp").waitFor();
}

async function closeCampModal(page) {
  await page
    .locator('[data-modal-panel] button[data-action="close-modal"]')
    .filter({ hasText: "返回营图" })
    .click();
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(origin);
  await setSave(page, fixture(2, 160));

  const smallCamp = await page.evaluate(() => ({
    size: document.querySelector(".camp-main-heading h2")?.textContent.trim(),
    cells: document.querySelectorAll(".camp-grid-cell").length,
    buildings: document.querySelectorAll(".camp-building").length,
    built: document.querySelectorAll(".camp-building.is-built").length,
    available: document.querySelectorAll(".camp-building.is-available").length,
    locked: document.querySelectorAll(".camp-building.is-locked").length,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));
  assert(
    smallCamp.size === "5 × 4 营区",
    `二胜时营区应为 5 × 4 营区，实际为 ${smallCamp.size}`,
  );
  assert(smallCamp.cells === 20, "营图应实际画出二十个格子");
  assert(smallCamp.buildings === 9, "营图应显示九种建筑");
  assert(smallCamp.built === 1, "聚义厅是初始已建建筑");
  assert(smallCamp.available === 3, "二胜应解锁演武场、农田和星台");
  assert(smallCamp.overflow === 0, "桌面营寨不应横向溢出");
  await page.screenshot({
    path: `${outputDir}/camp-victories-2.png`,
    fullPage: true,
  });

  await page
    .locator('button[data-action="select-camp-building"][data-building="farmland"]')
    .click();
  await page.locator('[data-modal-panel][data-camp-building="farmland"]').waitFor();
  await page
    .locator('[data-modal-panel] button[data-action="build-camp-building"]')
    .click();
  await page
    .locator('[data-modal-panel] button[data-action="collect-camp-resource"]')
    .click();
  await closeCampModal(page);
  assert(
    (await page.locator(".camp-building.is-built").count()) === 2,
    "建造后营图应更新为两处已建",
  );
  assert(
    (await page.locator(".camp-stock").innerText()).includes("小麦"),
    "收获后库存应显示小麦",
  );

  await setSave(page, expandedFixture());
  await page.locator('button[data-action="expand-camp-area"]').click();
  await page.getByText("8 × 5 营区", { exact: true }).waitFor();
  for (const [buildingId, buttonAction] of [
    ["mill", "build-camp-building"],
    ["kitchen", "build-camp-building"],
  ]) {
    await page
      .locator(`button[data-action="select-camp-building"][data-building="${buildingId}"]`)
      .click();
    await page
      .locator(`[data-modal-panel] button[data-action="${buttonAction}"]`)
      .click();
    await closeCampModal(page);
  }
  const largeCamp = await page.evaluate(() => ({
    size: document.querySelector(".camp-main-heading h2")?.textContent.trim(),
    cells: document.querySelectorAll(".camp-grid-cell").length,
    area: JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).camp
      .areaUnlocked,
    buildingsInside: [...document.querySelectorAll(".camp-building")].every(
      (building) => {
        const map = document.querySelector(".camp-map").getBoundingClientRect();
        const rect = building.getBoundingClientRect();
        return (
          rect.left >= map.left - 1 &&
          rect.right <= map.right + 1 &&
          rect.top >= map.top - 1 &&
          rect.bottom <= map.bottom + 1
        );
      },
    ),
  }));
  assert(
    largeCamp.size === "8 × 5 营区",
    `十胜时营区应扩展为 8 × 5，实际为 ${JSON.stringify(largeCamp)}`,
  );
  assert(largeCamp.cells === 40, "八乘五营图应有四十个格子");
  assert(largeCamp.buildingsInside, "扩展后的建筑不能越出营图");
  await page.screenshot({
    path: `${outputDir}/camp-victories-10.png`,
    fullPage: true,
  });

  const layouts = [];
  for (const [name, width, height] of [
    ["wide", 1920, 1080],
    ["desktop", 1440, 900],
    ["laptop", 1280, 800],
    ["compact", 1024, 768],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const map = document.querySelector(".camp-map");
      const buildings = [...document.querySelectorAll(".camp-building")];
      return {
        width: innerWidth,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        mapOverflow: map.scrollWidth - map.clientWidth,
        buildingOverflow: buildings.filter(
          (building) => building.scrollWidth > building.clientWidth + 1,
        ).length,
        buildingsOutside: buildings.filter((building) => {
          const mapRect = map.getBoundingClientRect();
          const rect = building.getBoundingClientRect();
          return (
            rect.left < mapRect.left - 1 ||
            rect.right > mapRect.right + 1 ||
            rect.top < mapRect.top - 1 ||
            rect.bottom > mapRect.bottom + 1
          );
        }).length,
      };
    });
    assert(layout.overflow === 0, `${name} 营寨不应横向溢出`);
    assert(layout.mapOverflow === 0, `${name} 营图不应横向溢出`);
    if (layout.buildingOverflow) {
      layout.buildingNames = await page.evaluate(() =>
        [...document.querySelectorAll(".camp-building")]
          .filter((building) => building.scrollWidth > building.clientWidth + 1)
          .map((building) => building.dataset.building),
      );
      await page.screenshot({
        path: `${outputDir}/camp-${name}-overflow.png`,
        fullPage: true,
      });
    }
    assert(
      layout.buildingOverflow === 0,
      `${name} 建筑文字不能裁切 ${JSON.stringify(layout)}`,
    );
    assert(layout.buildingsOutside === 0, `${name} 建筑不能越出营图`);
    layouts.push({ name, ...layout });
    await page.screenshot({
      path: `${outputDir}/camp-${name}.png`,
      fullPage: true,
    });
  }

  const images = await page.evaluate(() =>
    [...document.querySelectorAll("img")].filter((image) => !image.complete || !image.naturalWidth).length,
  );
  assert(images === 0, "营寨页面不应存在加载失败的图片");
  console.log(JSON.stringify({ outputDir, smallCamp, largeCamp, layouts }, null, 2));
} finally {
  await browser.close();
}
