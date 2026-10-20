import assert from "node:assert/strict";

import { HERO_ORDER } from "../src/data.js";
import { createInitialState, SAVE_KEY } from "../src/state.js";
import { chromium } from "playwright";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

const viewports = [
  ["1440x900", 1440, 900, false],
  ["1080p", 1920, 1080, false],
  ["1440p", 2560, 1440, false],
  ["4K", 3840, 2160, false],
  ["16:10", 1680, 1050, false],
  ["steamDeck", 1280, 800, false],
  ["mobile", 390, 844, true],
];

const screens = [
  ["map", "nav-map", null],
  ["camp", "nav-camp", null],
  ["arena", "nav-arena", null],
  ["roster", "nav-roster", null],
  ["formation", "nav-formation", null],
  ["equipment", "equipment-check", null],
  ["quests", "nav-quests", null],
  ["codex", "nav-codex", null],
  ["settings", "nav-settings", null],
];

const contentScrollerSelectors = {
  camp: ".camp-layout",
  arena: ".arena-layout",
  roster: ".roster-layout",
  formation: ".formation-layout",
  equipment: ".equipment-layout",
  quests: ".quests-layout",
  codex: ".codex-layout",
  settings: ".settings-layout",
};

async function setUpCampaign(page) {
  const state = createInitialState();
  state.flags.tutorialSeen = true;
  state.recruited = [...HERO_ORDER];
  state.settings.uiScale = "largest";
  state.settings.highContrast = true;
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(state)],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
}

async function verifyArenaRewardScrolling(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.settings.autoArena = false;
    save.arena.activeRun = {
      mode: "endless",
      wave: 7,
      boons: ["vanguard", "vanguard", "vanguard", "rally", "rally"],
      pendingBoons: ["breaker", "swift", "remedy"],
      rerollUsed: false,
      eventOffer: [],
      healthRatios: { linchong: 0.42, luzhishen: 1, wusong: 0.8 },
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
        survivors: 3,
        heroCount: 3,
        mvpHeroId: "linchong",
        mvpDamage: 920,
        mvpKills: 2,
        mvpUltimates: 1,
        objectives: [
          { id: "unbroken", label: "全阵而归", met: true },
          { id: "swift", label: "6 回合破阵", met: true },
          { id: "bounty", label: "悬赏达成", met: true },
          { id: "chain", label: "星命合击", met: true },
        ],
      },
      lastUnlocks: [],
      lastDiscoveries: { masteries: [], synergies: [], encounters: [] },
      lastWeeklyMarks: [],
      trialIds: [],
      defeated: false,
    };
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="toggle-more-nav"]');
  await page.click('button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  await page.click('button[data-action="resume-arena"]');
  await page.waitForSelector(".screen-arena-reward");

  const panel = page.locator(".arena-reward-layout");
  const start = await panel.evaluate((node) => ({
    overflowY: getComputedStyle(node).overflowY,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    scrollTop: node.scrollTop,
  }));
  assert.equal(start.overflowY, "auto");
  assert.ok(
    start.scrollHeight > start.clientHeight + 1,
    "1280x720 arena reward: fixture must overflow",
  );
  await panel.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
  await page.waitForTimeout(80);
  const end = await page.evaluate(() => {
    const node = document.querySelector(".arena-reward-layout");
    const footer = document.querySelector(".arena-reward-footer");
    return {
      scrollTop: node.scrollTop,
      footerBottom: footer.getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
    };
  });
  assert.ok(
    end.scrollTop > start.scrollTop,
    "1280x720 arena reward: panel cannot scroll",
  );
  assert.ok(
    end.footerBottom <= end.viewportHeight + 1,
    "1280x720 arena reward: reward controls remain cut off",
  );
}

async function pageIsAtTop(page) {
  return page.evaluate(() => window.scrollX === 0 && window.scrollY === 0);
}

function measurePage(page, name) {
  return page.evaluate((screenName) => {
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    return {
      screen: screenName,
      width: innerWidth,
      height: innerHeight,
      pageOverflowX: root.scrollWidth - root.clientWidth,
      pageOverflowY: root.scrollHeight - root.clientHeight,
      rootOverflow: `${rootStyle.overflowX}/${rootStyle.overflowY}`,
    };
  }, name);
}

function measureScroller(page, name) {
  return page.evaluate((screenName) => {
    const scrollableSelector = {
      camp: ".camp-layout",
      arena: ".arena-layout",
      roster: ".roster-layout",
      formation: ".formation-layout",
      equipment: ".equipment-layout",
      quests: ".quests-layout",
      codex: ".codex-layout",
      settings: ".settings-layout",
    }[screenName];
    const scroller = scrollableSelector
      ? document.querySelector(scrollableSelector)
      : null;
    const controls = scroller
      ? [...scroller.querySelectorAll("button, input, select")].filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return (
            rect.width > 1 &&
            rect.height > 1 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        })
      : [];
    const lastControl = controls.at(-1);
    const lastRect = lastControl?.getBoundingClientRect();
    return {
      screen: screenName,
      hasScroller: Boolean(scroller),
      scrollHeight: scroller?.scrollHeight || 0,
      clientHeight: scroller?.clientHeight || 0,
      scrollTop: scroller?.scrollTop || 0,
      overflowY: scroller ? getComputedStyle(scroller).overflowY : "",
      controlCount: controls.length,
      lastControlBottom: lastRect?.bottom || 0,
    };
  }, name);
}

try {
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "networkidle" });
  await setUpCampaign(page);
  let terminalScreen = 0;
  for (const [name, width, height, mobile] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      const frame = document.querySelector(".game-frame");
      if (!frame?.classList.contains("screen-map")) {
        document.querySelector('button[data-action="nav-map"]')?.click();
      }
    });
    await page.waitForSelector(".screen-map");
    for (const [screen, action] of screens) {
      if (action === "equipment-check") {
        await page.evaluate(() => document.querySelector('button[data-action="nav-map"]')?.click());
        await page.click('button[data-action="nav-roster"]');
        await page.locator(".hero-card-hit").first().click();
        await page
          .locator(".hero-dossier button[data-action='equipment-hero']")
          .click();
        await page.waitForSelector(".screen-equipment");
      } else if (action) {
        await page.evaluate((name) => {
          if (["nav-arena", "nav-codex", "nav-settings"].includes(name)) {
            document.querySelector('button[data-action="toggle-more-nav"]')?.click();
          }
          document.querySelector(`button[data-action="${name}"]`)?.click();
        }, action);
      }
      await page.waitForTimeout(80);
      const pageMetrics = await measurePage(page, screen);
      assert.equal(pageMetrics.width, width, `${name} ${screen}: wrong viewport width`);
      assert.equal(pageMetrics.height, height, `${name} ${screen}: wrong viewport height`);
      assert.ok(
        pageMetrics.pageOverflowX <= 0,
        `${name} ${screen}: page has horizontal overflow`,
      );
      if (!mobile) {
        assert.ok(
          pageMetrics.pageOverflowY <= 0,
          `${name} ${screen}: desktop page has vertical overflow`,
        );
      }
      if (!mobile && contentScrollerSelectors[screen]) {
        const start = await measureScroller(page, screen);
        assert.ok(start.hasScroller, `${name} ${screen}: missing content scroller`);
        assert.ok(start.controlCount > 0, `${name} ${screen}: missing visible controls`);
        if (start.scrollHeight > start.clientHeight + 1) {
          await page
            .locator(contentScrollerSelectors[screen])
            .evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
          await page.waitForTimeout(80);
          const end = await measureScroller(page, screen);
          assert.ok(
            end.scrollTop > start.scrollTop,
            `${name} ${screen}: content scroller cannot reach its end`,
          );
          if (screen !== "codex") {
            assert.ok(
              end.lastControlBottom <= height + 1,
              `${name} ${screen}: last control is cut off after scrolling`,
            );
          }
        }
      }
    }
    if (name === "1080p") {
      await page.evaluate(() => {
        document.querySelector('button[data-action="toggle-more-nav"]')?.click();
        document.querySelector('.more-nav button[data-action="nav-codex"]')?.click();
      });
      await page.waitForSelector(".screen-codex");
      const collapsed = await page.evaluate(() => ({
        bonds: document.querySelector('[data-archive="bonds"]')?.getAttribute("aria-expanded"),
        chains: document.querySelector('[data-archive="chains"]')?.getAttribute("aria-expanded"),
      }));
      assert.deepEqual(collapsed, { bonds: "false", chains: "false" });
      await page.click('[data-archive="bonds"]');
      await page.click('[data-archive="chains"]');
      assert.deepEqual(
        await page.evaluate(() => ({
          bonds: document.querySelector('[data-archive="bonds"]')?.getAttribute("aria-expanded"),
          chains: document.querySelector('[data-archive="chains"]')?.getAttribute("aria-expanded"),
          bondBodies: document.querySelectorAll('[data-archive-body="bonds"]:not([hidden])').length,
          chainBodies: document.querySelectorAll('[data-archive-body="chains"]:not([hidden])').length,
        })),
        { bonds: "true", chains: "true", bondBodies: 1, chainBodies: 1 },
      );
      await page.locator(".star-map-panel").evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
      await page.waitForTimeout(80);
      const codexEnd = await page.evaluate(() => {
        const scroller = document.querySelector(".star-map-panel");
        const lastControl = [...scroller.querySelectorAll("button")]
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 1 && rect.height > 1;
          })
          .at(-1);
        return {
          scrollTop: scroller.scrollTop,
          lastControlBottom: lastControl.getBoundingClientRect().bottom,
        };
      });
      assert.ok(codexEnd.scrollTop > 0, "1080p codex: archive panel cannot scroll");
      assert.ok(
        codexEnd.lastControlBottom <= height + 1,
        "1080p codex: expanded archives hide the hero controls",
      );
      await page.click('button[data-action="nav-quests"]');
      await page.waitForSelector(".screen-quests");
      const recruitment = await page.evaluate(() => {
        const panel = document.querySelector(".recruitment-scroll");
        return panel && {
          overflowX: getComputedStyle(panel).overflowX,
          scrollWidth: panel.scrollWidth,
          clientWidth: panel.clientWidth,
        };
      });
      assert.ok(recruitment, "1080p quests: missing recruitment board");
      assert.ok(recruitment.scrollWidth <= recruitment.clientWidth + 1);
    }
    await page.evaluate(() => document.querySelector('button[data-action="nav-map"]')?.click());
    await page.click('button[data-action="enter-chapter"]');
    await page.waitForSelector(".screen-story");
    assert.ok(await pageIsAtTop(page), `${name} story: failed to enter at the top`);
    await page.click('button[data-action="story-skip"]');
    if (await page.locator('button[data-action="story-choice"]').count()) {
      await page.locator('button[data-action="story-choice"]').first().click();
    }
    await page.waitForTimeout(100);
    const choice = await measurePage(page, "story-choice");
    assert.ok(choice.pageOverflowX <= 0, `${name} story-choice: horizontal overflow`);
    if (!mobile) {
      assert.ok(choice.pageOverflowY <= 0, `${name} story-choice: vertical overflow`);
    }
    terminalScreen = await page.locator(".screen-battle").count() ? 1 : 0;
    if (await page.locator('button[data-action="story-to-battle"]').count()) {
      await page.click('button[data-action="story-to-battle"]');
      await page.waitForSelector(".screen-battle");
      const battleScreen = await measurePage(page, "battle");
      assert.ok(battleScreen.pageOverflowX <= 0, `${name} battle: horizontal overflow`);
      if (!mobile) {
        assert.ok(battleScreen.pageOverflowY <= 0, `${name} battle: vertical overflow`);
      }
      terminalScreen = 1;
    }
    await page.evaluate(() => {
      localStorage.removeItem("xingming-shuihu-save-v1");
    });
    await page.reload({ waitUntil: "networkidle" });
    await setUpCampaign(page);
  }
  await verifyArenaRewardScrolling(page);
  assert.equal(terminalScreen, 1, "failed to verify a battle screen");
  console.log(
    `Scrollbar checks passed for ${viewports.length} viewports across page, content, story, battle, and arena reward screens.`,
  );
} finally {
  await browser.close().catch(() => {});
}
