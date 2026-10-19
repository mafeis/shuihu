import { mkdir } from "node:fs/promises";

import { chromium } from "playwright";

import {
  CHAPTERS,
  EQUIPMENT,
  HERO_ORDER,
  HEROES,
} from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = "/Users/mac/.codex/visualizations/2026/10/19/shuihu-issue-9";

function fixture() {
  const state = createInitialState();
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
  state.team = ["linchong", "luzhishen", "wusong"];
  state.stats.heroesRecruited = HERO_ORDER.length;
  state.inventory.copper = 5000;
  Object.assign(
    state.inventory,
    Object.fromEntries(Object.keys(EQUIPMENT).map((itemId) => [itemId, 2])),
  );
  return state;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function itemCount(page) {
  return page
    .locator(".inventory-panel > .section-heading > span")
    .innerText()
    .then((text) => Number(text.match(/\d+/)?.[0] || 0));
}

function categoriesFromLabels(labels) {
  return [
    ...new Set(labels.map((label) => label.split("·")[0].trim())),
  ];
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
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload();
  await page.getByText("续上旧卷", { exact: true }).click();
  await page.locator(".screen-map").waitFor();
  await page.locator('.topbar button[data-action="nav-roster"]').click();
  await page.locator(".screen-roster").waitFor();

  const roster = page.locator(".roster-list-panel");
  assert((await roster.locator(".hero-card").count()) === 16, "名册第一页应显示 16 人");
  assert((await roster.locator(".roster-filters button").count()) === 5, "名册应有五个路数筛选项");
  await page.locator('button[data-action="filter-roster-path"][data-path="ling"]').click();
  const rosterPaths = await roster
    .locator(".hero-card .path-badge > span")
    .allTextContents();
  assert(rosterPaths.length > 0 && rosterPaths.every((path) => path.trim() === "灵巧"), "名册筛选应只保留灵巧好汉");
  await page.screenshot({ path: `${outputDir}/roster-desktop.png`, fullPage: true });

  await page.locator('button[data-action="filter-roster-path"][data-path="all"]').click();
  await page.locator('button[data-action="roster-page"][data-direction="1"]').click();
  assert(
    (await roster.locator(".list-pagination").innerText()).includes("第 2 /"),
    "名册应能翻到第二页",
  );
  await page.screenshot({ path: `${outputDir}/roster-page-2.png`, fullPage: true });

  await page
    .locator('button[data-action="equipment-hero"][data-hero="linchong"]')
    .click();
  await page.locator(".screen-equipment").waitFor();
  assert((await itemCount(page)) > 5, "测试存档应覆盖装备分页");
  assert((await page.locator(".inventory-item").count()) <= 5, "装备列表每页最多五件");
  assert((await page.locator(".equipment-filter-group button").count()) === 9, "装备应支持四类物品和五个武将筛选");
  await page.screenshot({ path: `${outputDir}/equipment-desktop.png`, fullPage: true });

  await page.locator('button[data-action="filter-equipment-item"][data-slot="weapon"]').click();
  const itemTypes = await page.locator(".inventory-item .item-copy small").allTextContents();
  assert(itemTypes.every((text) => text.trim().startsWith("兵刃")), "兵刃筛选不应混入护甲或随身物");
  assert(
    (await page.locator(".inventory-item").count()) === 5,
    "分类后装备列表应仍按每页五件分页",
  );
  await page.locator('button[data-action="filter-equipment-path"][data-path="shou"]').click();
  const equipmentHeroes = await page
    .locator('.equipment-hero-tabs button[data-action="select-equipment-hero"]')
    .evaluateAll((buttons) => buttons.map((button) => button.dataset.hero));
  assert(
    equipmentHeroes.length > 0 &&
      equipmentHeroes.every((heroId) => HEROES[heroId].path === "shou"),
    "武将路数筛选应只展示守御好汉",
  );
  await page.locator('button[data-action="filter-equipment-item"][data-slot="all"]').click();
  const firstPageCategories = categoriesFromLabels(
    await page.locator(".inventory-item .item-copy small").allTextContents(),
  );
  for (const [category, slot] of [
    ["兵刃", "weapon"],
    ["护甲", "armor"],
    ["随身物", "token"],
  ]) {
    await page.locator(`button[data-action="filter-equipment-item"][data-slot="${slot}"]`).click();
    assert(
      categoriesFromLabels(
        await page.locator(".inventory-item .item-copy small").allTextContents(),
      ).every((label) => label === category),
      `武备分类 ${category} 应只显示同类物品`,
    );
  }
  await page.screenshot({ path: `${outputDir}/equipment-filtered.png`, fullPage: true });
  await page.locator('.topbar button.nav-button[data-action="nav-roster"]').click();
  await page.locator(".screen-roster").waitFor();
  await page.waitForTimeout(250);

  const rosterDesktop = await page.evaluate(() => {
    const layout = document.querySelector(".roster-layout").getBoundingClientRect();
    const gallery = [...document.querySelectorAll(".roster-list-panel .hero-card")];
    return {
      columns: getComputedStyle(document.querySelector(".hero-gallery")).gridTemplateColumns.split(" ").length,
      actualColumns: new Set(gallery.map((card) => Math.round(card.getBoundingClientRect().left))).size,
      galleryStyle: document.querySelector(".hero-gallery").getAttribute("style"),
      galleryClass: document.querySelector(".hero-gallery").className,
      galleryParentClass: document.querySelector(".hero-gallery").parentElement.className,
      rosterPanelStyle: getComputedStyle(document.querySelector(".roster-list-panel")).gridTemplateColumns,
      geometry: gallery.slice(0, 8).map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      }),
      layoutColumns: getComputedStyle(document.querySelector(".roster-layout")).gridTemplateColumns,
      rows: new Set(gallery.map((card) => Math.round(card.getBoundingClientRect().top))).size,
      extraHeight: layout.scrollHeight - layout.clientHeight,
    };
  });
  console.log(rosterDesktop);
  assert(rosterDesktop.columns === 4, "桌面名册应四列展示");
  assert(rosterDesktop.rows === 4, "桌面名册每页应四行展示");
  assert(rosterDesktop.extraHeight === 0, "桌面名册首屏不应出现纵向滚动");

  const viewports = [
    ["wide", 1920, 1080],
    ["desktop", 1440, 900],
    ["laptop", 1280, 800],
    ["compact", 1024, 768],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ];
  const layout = [];
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.locator('.topbar button.nav-button[data-action="nav-roster"]').click();
    await page.locator(".screen-roster").waitFor();
    const rosterOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    layout.push({ name, screen: "roster", rosterOverflow });
    await page.screenshot({ path: `${outputDir}/roster-${name}.png`, fullPage: true });
    await page.locator(".roster-layout").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.locator('button[data-action="filter-roster-path"][data-path="all"]').click();
    await page.locator('.roster-list-panel button[data-action="equipment-hero"][data-hero="linchong"]').click();
    await page.locator(".screen-equipment").waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".equipment-layout").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.locator(".equipment-screen").evaluate((element) => {
      element.scrollTop = 0;
    });
    const equipmentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    layout.push({ name, screen: "equipment", equipmentOverflow });
    const equipmentClipped = await page.evaluate(() =>
      [...document.querySelectorAll(".equipment-screen *[data-action]")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > innerHeight + 1;
        })
        .map((element) => element.dataset.action),
    );
    layout.at(-1).clippedActions = equipmentClipped;
    await page.screenshot({ path: `${outputDir}/equipment-${name}.png`, fullPage: true });
    assert(
      (await page.locator('button[data-action="filter-equipment-path"][data-path="all"]').getAttribute("aria-pressed")) === "true",
      "重新进入装备页时应重置武将分类",
    );
    assert(
      (await page.locator('button[data-action="filter-equipment-item"][data-slot="all"]').getAttribute("aria-pressed")) === "true",
      "重新进入装备页时应重置物品分类",
    );
    assert(
      (await itemCount(page)) > 5,
      "重新进入装备页时不应保留旧分页",
    );
    await page
      .locator('.topbar button.nav-button[data-action="nav-roster"]')
      .click();
    await page.locator(".screen-roster").waitFor();
  }
  assert(
    layout.every(
      (entry) => !entry.rosterOverflow && !entry.equipmentOverflow,
    ),
    `出现横向溢出: ${JSON.stringify(layout)}`,
  );
  assert(
    await page.evaluate(() =>
      [...document.querySelectorAll("img")].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    ),
    "页面存在未正常加载的图片",
  );
  console.log(
    JSON.stringify(
      { outputDir, layout, firstPageCategories, screenshots: 14 },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
