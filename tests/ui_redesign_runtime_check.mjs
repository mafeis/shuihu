import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
  createInitialState,
  createRosterEntry,
  SAVE_KEY,
} from "../src/state.js";
import { HEROES, STORY_ARCHIVE_CHAPTERS } from "../src/data.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const outputDir = fileURLToPath(
  new URL("../artifacts/qa/ui-redesign", import.meta.url),
);

function fixture() {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.currentChapter = 1;
  state.recruited = ["linchong"];
  state.roster = { linchong: createRosterEntry("linchong") };
  state.team = ["linchong", null, null];
  state.storyArchive = [STORY_ARCHIVE_CHAPTERS[0].id];
  return state;
}

async function noHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - innerWidth,
    outside: [...document.querySelectorAll("button, .more-nav, .modal-panel")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return (
          style.display !== "none" &&
          rect.width > 1 &&
          (rect.left < -1 || rect.right > innerWidth + 1)
        );
      })
      .map((node) => node.getAttribute("aria-label") || node.textContent.trim().slice(0, 30)),
  }));
  assert.equal(result.document, 0, `${label}: document should not overflow horizontally`);
  assert.deepEqual(result.outside, [], `${label}: controls should stay in the viewport`);
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(fixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(850);

  const title = await page.evaluate(() => ({
    copy: document.querySelector(".title-copy")?.textContent || "",
    actions: [...document.querySelectorAll(".title-actions [data-action]")].map(
      (node) => node.dataset.action,
    ),
    resume: document.querySelector(".title-resume")?.textContent || "",
    dialog: document.querySelector(".title-difficulty small")?.textContent || "",
  }));
  assert.ok(title.copy.length <= 24, "title should keep a short introduction");
  assert.ok(title.actions.includes("continue-game"), "title should keep a visible continue action");
  assert.ok(title.resume.trim(), "title should expose the next goal");
  assert.equal(title.dialog, "", "title difficulty choices should omit secondary descriptions");
  await page.screenshot({ path: path.join(outputDir, "title-simplified.png") });

  await page.click("button[data-action='continue-game']");
  await page.waitForSelector(".screen-map");
  assert.equal(await page.locator(".topbar-nav .nav-button").count(), 5, "primary navigation should stay focused");
  await page.click("button[data-action='toggle-more-nav']");
  assert.equal(await page.locator(".more-nav button").count(), 4, "more navigation should expose secondary tools");
  await page.click("button[data-action='toggle-more-nav']");
  await page.click("button[data-action='toggle-more-nav']");
  await page.click(".more-nav button[data-action='nav-story-hub']");
  await page.waitForSelector(".screen-story-hub");
  assert.equal(await page.locator(".story-hub-card").count(), STORY_ARCHIVE_CHAPTERS.length, "complete saga should remain available");
  assert.equal(await page.getAttribute(".story-hub-intro .button", "data-chapter"), STORY_ARCHIVE_CHAPTERS[1].id, "story resume should open the next unread chapter");
  await page.screenshot({ path: path.join(outputDir, "story-simplified.png") });

  await page.click("button[data-action='nav-quests']");
  await page.waitForSelector(".screen-quests");
  assert.ok(await page.locator(".recruitment-board.is-primary .recruitment-ready-card").count() > 0, "available recruitments should lead the quest page");
  assert.equal(await page.locator(".quest-hero-track:not([hidden]) .quest-hero-button").count(), 0, "the 108-hero roster should start collapsed");
  await page.click("button[data-action='toggle-quest-roster']");
  assert.ok(await page.locator(".quest-hero-track:not([hidden]) .quest-hero-button").count() > 0, "the bonded roster should open on demand");
  await page.click("button[data-action='toggle-quest-roster']");
  assert.equal(await page.locator(".quest-hero-track:not([hidden]) .quest-hero-button").count(), 0, "the bonded roster should collapse on demand");
  await page.click("button[data-action='toggle-more-nav']");
  assert.equal(
    await page.locator(".more-nav button[aria-current='page']").count(),
    0,
    "the more menu should not mark an unrelated screen as current",
  );
  await page.screenshot({ path: path.join(outputDir, "quests-focused.png") });
  await page.click("button[data-action='toggle-more-nav']");

  await page.click(".recruitment-board.is-primary button[data-action='start-hero-recruitment']");
  await page.waitForSelector(".screen-story");
  await page.evaluate(() => {
    localStorage.setItem(
      "xingming-shuihu-save-v1",
      JSON.stringify({
        ...JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")),
        flags: {
          ...JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).flags,
          tutorialSeen: false,
        },
      }),
    );
  });

  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.currentChapter = 1;
    save.flags.tutorialSeen = false;
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /续上旧卷/ }).click();
  await page.waitForSelector(".screen-map");
  await page.click("button[data-action='enter-chapter']");
  await page.waitForSelector(".screen-story");
  for (let index = 0; index < 20 && !(await page.locator(".screen-battle").count()); index += 1) {
    const advance = page.locator("button[data-action='story-next'], button[data-action='story-skip']").first();
    if (await advance.count()) await advance.click();
    if (await page.locator("button[data-action='story-choice']").count()) {
      await page.locator("button[data-action='story-choice']").first().click();
    }
    if (await page.locator("button[data-action='story-to-battle']").count()) {
      await page.click("button[data-action='story-to-battle']");
      break;
    }
    await page.waitForTimeout(140);
  }
  await page.waitForSelector(".screen-battle");
  await page.waitForSelector(".battle-tutorial", { timeout: 10000 });
  const tutorial = await page.evaluate(() => ({
    rows: document.querySelectorAll(".battle-tutorial-lessons > div").length,
    text: document.querySelector(".battle-tutorial")?.textContent || "",
    start: document.querySelector(".battle-tutorial-start")?.textContent.trim() || "",
    logHidden: document.querySelector(".battle-log")?.hidden,
    logToggleVisible:
      document.querySelector("button[data-action='toggle-battle-log']")
        ?.getBoundingClientRect().height > 1,
    screenText: document.querySelector(".battle-command")?.textContent.trim().slice(0, 200),
    saveFlags: JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).flags,
  }));
  if (tutorial.rows === 0) console.log(JSON.stringify(tutorial));
  assert.equal(tutorial.rows, 3, "first battle should preserve the three core actions");
  assert.ok(tutorial.text.includes("点招式"), "first battle should state the primary action");
  assert.ok(tutorial.start.includes("开战"), "tutorial should have a short start action");
  assert.equal(tutorial.logHidden ?? true, true, "battle log should start collapsed");
  assert.equal(tutorial.logToggleVisible, false, "the tutorial should hide secondary battle controls");
  await page.click("button[data-action='dismiss-battle-tutorial']");
  assert.equal(await page.locator(".battle-log").getAttribute("hidden"), "", "battle log should stay collapsed after the tutorial");
  await page.click("button[data-action='toggle-battle-log']");
  assert.equal(await page.locator(".battle-log").getAttribute("hidden"), null, "battle status should expand on demand");
  assert.equal(
    await page.locator(".battle-command i[data-lucide]").count(),
    0,
    "the battle panel should not retain deferred icon placeholders",
  );
  await page.screenshot({ path: path.join(outputDir, "battle-tutorial-simplified.png") });

  const audio = await page.evaluate(async () => {
    const status = window.__shuihuCombatSfxStatus();
    window.__shuihuSound.click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      loaded: status.loaded,
      failures: status.failures,
      generated: window.__shuihuCombatSfxStatus().generatedPlays,
    };
  });
  assert.ok(audio.loaded.includes("click"), "open-source UI sound should preload");
  assert.deepEqual(audio.failures, [], "open-source UI sounds should load cleanly");
  assert.ok(audio.generated > 0, "UI sound should play after unlock");

  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    await noHorizontalOverflow(page, name);
    const oversizedCards = await page.evaluate(() =>
      [...document.querySelectorAll(".settings-card, .story-hub-card, .recruitment-card, .recruitment-ready-card, .more-nav")]
        .filter((node) => {
          const radius = Number.parseFloat(getComputedStyle(node).borderTopLeftRadius);
          return radius > 4.1;
        })
        .map((node) => node.className),
    );
    assert.deepEqual(oversizedCards, [], `${name}: new cards should use restrained corner radii`);
  }

  assert.deepEqual(errors, [], "UI flow should have no page errors");
  console.log(JSON.stringify({ status: "passed", screens: ["title", "map", "more", "story", "quests", "battle"], heroes: Object.keys(HEROES).length }));
} finally {
  await browser.close();
}
