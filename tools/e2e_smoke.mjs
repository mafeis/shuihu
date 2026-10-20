#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ACHIEVEMENTS,
  ARENA_ENCOUNTERS,
  CHAPTERS,
  CHAIN_FORMATIONS,
  EQUIPMENT,
  HERO_BONDS,
  HERO_LEGENDS,
  HERO_ORDER,
  HERO_RECRUITMENTS,
  HERO_TRIALS,
  HEROES,
  STORY_ARCHIVE_CHAPTERS,
} from "../src/data.js";
import {
  createInitialState,
  createRosterEntry,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
} from "../src/state.js";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const chromePath =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9462);
const profileDir = await mkdtemp(path.join(tmpdir(), "shuihu-e2e-"));
const steamScreenshotDir = path.resolve("store/steam_assets/screenshots");
const visualQaDir = path.resolve("artifacts/qa/browser");
const captureSteamScreenshots =
  process.env.CAPTURE_STEAM_SCREENSHOTS === "1";
const captureVisualQa = process.env.CAPTURE_VISUAL_QA === "1";
const expectWebApp = process.env.EXPECT_WEB_APP === "1";
const equipmentFocus = process.env.E2E_EQUIPMENT_FOCUS === "1";
const postCampaignFocus = process.env.E2E_POST_CAMPAIGN_FOCUS === "1";
class EquipmentFocusComplete extends Error {}
let devServer = null;
let chrome = null;
let socket = null;
let inputStateCleanup = null;

async function waitForHttp(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureDevServer() {
  try {
    await waitForHttp(origin, 3);
    return;
  } catch {
    devServer = spawn("npm", ["run", "dev", "--", "--port", "4173"], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    await waitForHttp(origin);
  }
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const target = targets.find(
        (entry) => entry.type === "page" && entry.url.startsWith(origin),
      );
      if (target) return target;
    } catch {
      // Chrome may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Chrome DevTools target did not become available.");
}

function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(payload.error.message));
    else resolve(payload.result);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return {
    ws,
    ready,
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

async function evaluate(expression) {
  const result = await socket.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Page evaluation failed.");
  }
  return result.result?.value;
}

async function waitFor(expression, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function waitForReward(context, timeoutMs = 60000) {
  try {
    await waitFor(
      'document.querySelector(".game-frame")?.classList.contains("screen-reward")',
      timeoutMs,
    );
  } catch (error) {
    const snapshot = await evaluate(`(() => {
      const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}) || "null");
      return {
        screen: [...(document.querySelector(".game-frame")?.classList || [])]
          .find((name) => name.startsWith("screen-")),
        currentChapter: save?.currentChapter,
        recruited: save?.recruited,
        autoBattle: save?.settings?.autoBattle,
        autoTactic: save?.settings?.autoTactic,
        battleSpeed: save?.settings?.battleSpeed,
        defeat: Boolean(document.querySelector(".defeat-overlay")),
        command: document.querySelector(".battle-command")?.innerText.slice(0, 320),
        log: document.querySelector(".battle-log")?.innerText.slice(0, 520),
      };
    })()`);
    throw new Error(
      `${context} did not reach the reward screen: ${JSON.stringify(snapshot)}`,
      { cause: error },
    );
  }
}

async function verifyTextInputDoesNotTriggerGameShortcuts() {
  const inputState = await evaluate(`(() => {
    const frame = document.querySelector(".game-frame");
    if (!frame) return null;
    const saveKey = "xingming-shuihu-save-v1";
    const originalSave = localStorage.getItem(saveKey);
    inputStateCleanup = () => {
      document.querySelector("#text-input-regression")?.closest(".text-input-regression")?.remove();
      if (originalSave === null) localStorage.removeItem(saveKey);
      else localStorage.setItem(saveKey, originalSave);
    };
    const wrapper = document.createElement("div");
    wrapper.className = "text-input-regression";
    wrapper.style.cssText = "position:fixed;left:24px;top:24px;z-index:2147483647;padding:10px;background:#111;border:2px solid #fff";
    const input = document.createElement("input");
    input.id = "text-input-regression";
    input.type = "text";
    input.maxLength = 64;
    input.placeholder = "text input regression";
    input.style.cssText = "width:320px;height:36px;color:#000;background:#fff";
    wrapper.append(input);
    frame.append(wrapper);
    input.focus();
    return {
      focused: document.activeElement === input,
      screen: [...frame.classList].find((name) => name.startsWith("screen-")),
    };
  })()`);
  if (!inputState?.focused) {
    throw new Error("Could not focus the text input regression probe.");
  }
  const typeKey = async (key, code, text) => {
    await socket.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      text,
    });
    await socket.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
    });
  };
  await socket.send("Input.insertText", { text: "北" });
  await typeKey("a", "KeyA", "a");
  await typeKey("t", "KeyT", "t");
  await typeKey("c", "KeyC", "c");
  await typeKey("1", "Digit1", "1");
  await typeKey("2", "Digit2", "2");
  await typeKey("4", "Digit4", "4");
  await typeKey("Enter", "Enter", "\r");
  await new Promise((resolve) => setTimeout(resolve, 180));
  const result = await evaluate(`(() => {
    const input = document.querySelector("#text-input-regression");
    const saved = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    const output = {
      value: input?.value || "",
      focused: document.activeElement === input,
      autoBattle: saved.settings.autoBattle,
      autoTactic: saved.settings.autoTactic,
      battleSpeed: saved.settings.battleSpeed,
      screen: [...document.querySelector(".game-frame").classList]
        .find((name) => name.startsWith("screen-")),
    };
    inputStateCleanup();
    return output;
  })()`);
  assertEqual(result.value, "北atc124", "typing should preserve every character in a text input");
  assertEqual(result.focused, true, "text input should retain focus");
  assertEqual(result.autoBattle, false, "A typed in a text input must not toggle auto-battle");
  assertEqual(result.autoTactic, "balanced", "T typed in a text input must not change the tactic");
  assertEqual(result.battleSpeed, 1, "speed digits typed in a text input must not change battle speed");
  assertEqual(result.screen, inputState.screen, "Enter typed in a text input must not advance the game");
}

async function setViewport(width, height, mobile = false) {
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 220));
}

async function captureSteamScreenshot(name) {
  if (!captureSteamScreenshots) return;
  await mkdir(steamScreenshotDir, { recursive: true });
  await setViewport(1920, 1080, false);
  const screenshot = await socket.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(
    path.join(steamScreenshotDir, name),
    Buffer.from(screenshot.data, "base64"),
  );
  await setViewport(1440, 900, false);
}

async function captureVisualQaScreenshot(name) {
  if (!captureVisualQa) return;
  await mkdir(visualQaDir, { recursive: true });
  const screenshot = await socket.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(
    path.join(visualQaDir, name),
    Buffer.from(screenshot.data, "base64"),
  );
}

async function click(selector) {
  const clicked = await evaluate(
    `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return false;
      node.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`Selector not found: ${selector}`);
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function clickText(text) {
  const clicked = await evaluate(
    `(() => {
      const node = [...document.querySelectorAll("button")]
        .find((button) => button.innerText.includes(${JSON.stringify(text)}));
      if (!node) return false;
      node.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`Button not found: ${text}`);
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function clickMoreAction(action) {
  if (
    await evaluate(
      `Boolean(document.querySelector('button[data-action="${action}"]'))`,
    )
  ) {
    await click(`button[data-action="${action}"]`);
    return;
  }
  const hasMenu = await evaluate(
    'Boolean(document.querySelector(".more-nav"))',
  );
  if (hasMenu) {
    await click(`.more-nav button[data-action="${action}"]`);
    return;
  }
  await click('button[data-action="toggle-more-nav"]');
  await waitFor(
    `Boolean(document.querySelector('.more-nav button[data-action="${action}"]'))`,
  );
  await click(`.more-nav button[data-action="${action}"]`);
}

async function openNavScreen(action) {
  await clickMoreAction(action);
  await waitFor(
    `document.querySelector(".game-frame")?.classList.contains("screen-${action.slice(4)}")`,
  );
}

async function useFirstAvailableBattleSkill() {
  await waitFor(
    `document.querySelector(".battle-command .skill-list .skill-button:not(:disabled)") !== null ||
      document.querySelector(".chain-attack-action:not(:disabled)") !== null ||
      document.querySelector(".defeat-overlay") !== null ||
      document.querySelector(".game-frame")?.classList.contains("screen-reward")`,
    15000,
  );
  if (await evaluate('document.querySelector(".defeat-overlay") !== null')) {
    throw new Error("Chain battle ended in defeat before the manual action.");
  }
  if (
    await evaluate(
      'document.querySelector(".game-frame")?.classList.contains("screen-reward")',
    )
  ) {
    throw new Error("Chain battle ended before three manual actions.");
  }
  if (
    await evaluate(
      'document.querySelector(".chain-attack-action:not(:disabled)") !== null',
    )
  ) {
    return false;
  }
  await click(".battle-command .skill-list .skill-button:not(:disabled)");
  await new Promise((resolve) => setTimeout(resolve, 120));
  const targetable = await evaluate(
    'document.querySelector(".enemy-unit.is-targetable") !== null',
  );
  if (targetable) {
    await click(".enemy-unit.is-targetable");
  }
  await waitFor(
    `document.querySelector(".game-frame")?.classList.contains("screen-reward") ||
      document.querySelector(".defeat-overlay") !== null ||
      document.querySelector(".battle-command .skill-list .skill-button:not(:disabled)") !== null ||
      document.querySelector(".chain-attack-action:not(:disabled)") !== null`,
    20000,
  );
  if (await evaluate('document.querySelector(".defeat-overlay") !== null')) {
    throw new Error("Chain battle ended in defeat after a manual action.");
  }
  return true;
}

async function completeRecruitmentScroll(heroId) {
  const recruitment = HERO_RECRUITMENTS[heroId];
  if (!recruitment) throw new Error(`Unknown recruitment scroll: ${heroId}`);
  await click('button[data-action="nav-quests"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
  try {
    await waitFor(
      `document.querySelector('button[data-action="start-hero-recruitment"][data-hero="${heroId}"]') !== null`,
    );
  } catch (error) {
    const snapshot = await evaluate(`(() => {
      const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
      const card = document.querySelector(
        '.recruitment-card[data-hero="${heroId}"]',
      );
      return {
        hero: ${JSON.stringify(heroId)},
        currentChapter: save.currentChapter,
        recruited: save.recruited,
        team: save.team,
        completedRecruitments: save.heroRecruitments?.completed,
        cardStatus: card?.querySelector(".recruitment-card-top")?.textContent.trim(),
        cardFooter: card?.querySelector("footer")?.textContent.trim(),
        availableRecruitments: document.querySelector(".recruitment-grid-caption")?.textContent.trim(),
      };
    })()`);
    throw new Error(
      `Recruitment target was not available: ${JSON.stringify(snapshot)}`,
      { cause: error },
    );
  }
  await click(
    `button[data-action="start-hero-recruitment"][data-hero="${heroId}"]`,
  );
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-story") || Boolean(document.querySelector("[data-modal-panel]"))',
  );
  if (await evaluate('Boolean(document.querySelector("[data-modal-panel]"))')) {
    await click('[data-modal-panel] button[data-action="recommend-recruitment-team"]');
    await waitFor(
      'document.querySelector(".game-frame")?.classList.contains("screen-story") || Boolean(document.querySelector("[data-modal-panel]"))',
    );
    if (await evaluate('Boolean(document.querySelector("[data-modal-panel]"))')) {
      await click('[data-modal-panel] button[data-action="recruitment-battle"]');
    }
  }
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  assertEqual(
    await evaluate("document.documentElement.dataset.music || ''"),
    "recruitment_theme",
    `${recruitment.title} story should use the recruitment theme`,
  );
  await click("button[data-action=story-skip]");
  await click('button[data-action="story-choice"][data-option="0"]');
  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  assertEqual(
    await evaluate("document.documentElement.dataset.music || ''"),
    "recruitment_theme",
    `${recruitment.title} battle should use the recruitment theme`,
  );
  await waitForReward(recruitment.title);
  await waitFor(
    `(() => {
      const image = document.querySelector(".recruitment-reward-art img");
      return image?.complete && image.naturalWidth > 0;
    })()`,
  );
  assertEqual(
    await evaluate("document.documentElement.dataset.music || ''"),
    "recruitment_theme",
    `${recruitment.title} reward should use the recruitment theme`,
  );
  const recruitmentReward = await evaluate(`(() => {
    const panel = document.querySelector(".recruitment-reward-panel");
    const image = panel?.querySelector(".recruitment-reward-art img");
    const copy = panel?.querySelector(".recruitment-reward-copy");
    if (!panel || !image || !copy) return null;
    const panelRect = panel.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      imageComplete: image.complete,
      imageInside:
        imageRect.top >= panelRect.top - 1 &&
        imageRect.bottom <= panelRect.bottom + 1 &&
        imageRect.left >= panelRect.left - 1 &&
        imageRect.right <= panelRect.right + 1,
      copySeparated: copyRect.left >= imageRect.right - 1,
      objectFit: getComputedStyle(image).objectFit,
      duplicateCard: Boolean(document.querySelector(".recruit-cards")),
    };
  })()`);
  assertEqual(
    Boolean(recruitmentReward?.imageComplete),
    true,
    `${recruitment.title} reward should load the new hero portrait`,
  );
  assertEqual(
    recruitmentReward?.imageInside,
    true,
    `${recruitment.title} reward should show the complete new hero portrait`,
  );
  assertEqual(
    recruitmentReward?.copySeparated,
    true,
    `${recruitment.title} reward should keep recruit copy clear of the portrait`,
  );
  assertEqual(
    recruitmentReward?.objectFit,
    "contain",
    `${recruitment.title} reward should preserve the recruit portrait silhouette`,
  );
  assertEqual(
    recruitmentReward?.duplicateCard,
    false,
    `${recruitment.title} reward should not duplicate the new hero card`,
  );
  const completedState = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
  );
  assertEqual(
    completedState.recruited.includes(heroId),
    true,
    `${recruitment.title} should recruit ${heroId}`,
  );
  assertEqual(
    completedState.heroRecruitments.completed.includes(heroId),
    true,
    `${recruitment.title} should persist its recruitment record`,
  );
  await click("button[data-action=story-outro]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  for (let step = 0; step < 6; step += 1) {
    if (
      await evaluate(
        'document.querySelector(".game-frame")?.classList.contains("screen-quests")',
      )
    ) {
      break;
    }
    await click("[data-action=story-next]");
  }
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
  await click("button[data-action=nav-map]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
}

async function installMockGamepad() {
  const installed = await evaluate(`(() => {
    const buttons = Array.from({ length: 18 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    window.__shuihuMockGamepad = {
      id: "Xingming Shuihu E2E Standard Gamepad",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: performance.now(),
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [window.__shuihuMockGamepad],
    });
    return true;
  })()`);
  if (!installed) throw new Error("Could not install mock gamepad");
  await new Promise((resolve) => setTimeout(resolve, 180));
}

async function pressGamepadButton(index) {
  const exists = await evaluate(`(() => {
    const pad = window.__shuihuMockGamepad;
    if (!pad?.buttons?.[${index}]) return false;
    pad.buttons[${index}].pressed = true;
    pad.buttons[${index}].value = 1;
    pad.timestamp = performance.now();
    return true;
  })()`);
  if (!exists) throw new Error(`Gamepad button ${index} is unavailable`);
  await new Promise((resolve) => setTimeout(resolve, 120));
  await evaluate(`(() => {
    const pad = window.__shuihuMockGamepad;
    pad.buttons[${index}].pressed = false;
    pad.buttons[${index}].value = 0;
    pad.timestamp = performance.now();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 160));
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 1500);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function setSave(state) {
  await evaluate(
    `localStorage.setItem("xingming-shuihu-save-v1", ${JSON.stringify(
      JSON.stringify(state),
    )})`,
  );
  await socket.send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await evaluate(
    'window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))',
  );
}

function campaignFixture() {
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
  state.team = ["likui", "linchong", "huarong"];
  state.stats.heroesRecruited = HERO_ORDER.length;
  state.inventory.copper = 5000;
  Object.assign(
    state.inventory,
    Object.fromEntries(Object.keys(EQUIPMENT).map((itemId) => [itemId, 1])),
  );
  state.settings.autoBattle = true;
  state.settings.battleSpeed = 4;
  return state;
}

function bondFixture() {
  const state = campaignFixture();
  state.team = ["linchong", "luzhishen", "wusong"];
  state.bondArchive = [];
  return state;
}

function doctrineFixture() {
  const state = bondFixture();
  state.heroMastery.linchong.trials = HERO_TRIALS.map((trial) => trial.id);
  state.doctrines = { linchong: "garrison" };
  return state;
}

function chainFixture() {
  const state = campaignFixture();
  state.team = ["linchong", "wusong", "wuyong"];
  state.settings.autoBattle = false;
  state.settings.battleSpeed = 4;
  state.chainArchive = [];
  for (const entry of Object.values(state.roster)) {
    entry.level = 24;
  }
  return state;
}

function heroQuestFixture() {
  const state = campaignFixture();
  state.currentChapter = 5;
  state.achievements = ACHIEVEMENTS.map((achievement) => achievement.id);
  for (const entry of Object.values(state.roster)) {
    entry.level = 18;
  }
  state.heroMastery.linchong.wins = 2;
  state.heroMastery.linchong.ultimates = 2;
  state.heroMastery.linchong.damage = 2500;
  return state;
}

function fullCampaignFixture() {
  const state = createInitialState({ difficulty: "story" });
  state.flags.tutorialSeen = true;
  state.currentChapter = 0;
  state.completedChapters = [];
  state.recruited = ["linchong"];
  state.roster = { linchong: createRosterEntry("linchong") };
  state.team = ["linchong", null, null];
  state.stats.heroesRecruited = 1;
  state.facilities = { hall: 1, arena: 1, tower: 1 };
  state.inventory.copper = 160;
  state.settings.autoBattle = true;
  state.settings.battleSpeed = 4;
  return state;
}

function onboardingFixture() {
  const state = createInitialState();
  state.settings.autoBattle = false;
  state.settings.battleSpeed = 1;
  return state;
}

function finalChoiceFixture() {
  const state = newGamePlusFixture();
  state.ending = null;
  state.endingsUnlocked = ["brotherhood"];
  state.flags.finalBattleWon = true;
  return state;
}

function newGamePlusFixture() {
  const state = createInitialState();
  state.currentChapter = CHAPTERS.length;
  state.completedChapters = CHAPTERS.map((chapter) => chapter.id);
  state.ending = "brotherhood";
  state.endingsUnlocked = ["brotherhood"];
  state.achievements = ["first_blood", "ten_stands"];
  state.bondArchive = ["wind_snow", "three_mountains"];
  state.chapterMedals = {
    ferry: ["unbroken", "swift"],
  };
  state.arena.bestWave = 20;
  state.arena.relics = ["ember", "frost_cloak"];
  state.heroMastery.linchong.trials = HERO_TRIALS.map((trial) => trial.id);
  state.doctrines = { linchong: "snowblade" };
  state.heroQuests.claimed = ["linchong_old_tassel"];
  state.heroLegends.completed = [HERO_LEGENDS.linchong.id];
  state.settings.autoBattle = true;
  state.settings.autoTactic = "hunter";
  state.settings.battleSpeed = 4;
  state.settings.musicVolume = 42;
  return state;
}

function arenaEventFixture() {
  const state = campaignFixture();
  state.settings.uiScale = "largest";
  state.settings.highContrast = true;
  state.arena.totalRuns = 1;
  state.arena.activeRun = {
    mode: "endless",
    weekKey: null,
    seed: null,
    wave: 4,
    boons: ["vanguard", "ironwall"],
    pendingBoons: ["rally", "breaker", "swift"],
    eventOffer: ["feast", "raid", "drill"],
    selectedEvent: null,
    lastEvent: null,
    healthRatios: {
      likui: 0.32,
      linchong: 0,
      huarong: 0.55,
    },
    completedWave: 3,
    lastReward: { copper: 96, xp: 54, score: 780 },
    score: 2180,
    bountiesCleared: 1,
    currentBounty: null,
    lastBounty: { id: "swift", cleared: true, copper: 42, score: 180 },
    defeated: false,
    lastUnlocks: [],
    lastDiscoveries: { masteries: [], synergies: [] },
    lastWeeklyMarks: [],
  };
  return state;
}

function arenaAutoFixture() {
  const state = campaignFixture();
  state.settings.autoArena = true;
  state.settings.autoBattle = true;
  state.settings.battleSpeed = 4;
  state.arena.totalRuns = 1;
  state.arena.activeRun = {
    mode: "endless",
    weekKey: null,
    seed: null,
    wave: 2,
    boons: ["vanguard"],
    pendingBoons: ["rally", "vanguard", "swift"],
    eventOffer: [],
    selectedEvent: null,
    lastEvent: null,
    healthRatios: {
      likui: 0.48,
      linchong: 0.42,
      huarong: 0.63,
    },
    completedWave: 1,
    lastReward: { copper: 58, xp: 32, score: 420 },
    score: 420,
    bountiesCleared: 0,
    currentBounty: "chain",
    lastBounty: null,
    defeated: false,
    lastUnlocks: [],
    lastDiscoveries: { masteries: [], synergies: [] },
    lastWeeklyMarks: [],
    lastPerformance: {
      grade: "A",
      bonusScore: 55,
      rounds: 4,
      survivors: 3,
      heroCount: 3,
      mvpHeroId: "likui",
      mvpDamage: 860,
      mvpKills: 2,
      mvpUltimates: 1,
      objectives: [
        { id: "unbroken", label: "全阵而归", met: true },
        { id: "swift", label: "6 回合破阵", met: true },
        { id: "bounty", label: "悬赏达成", met: false },
        { id: "chain", label: "星命合击", met: true },
      ],
    },
  };
  return state;
}

try {
  await ensureDevServer();
  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,900",
      origin,
    ],
    { stdio: "ignore" },
  );

  const target = await waitForTarget();
  const connection = connect(target);
  socket = connection;
  await connection.ready;
  await socket.send("Page.enable");
  await socket.send("Runtime.enable");
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    screenWidth: 1440,
    screenHeight: 900,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
    dontSetVisibleSize: true,
  });

  if (equipmentFocus) {
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await setSave(bondFixture());
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await clickText("续上旧卷");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
    await click("button[data-action=nav-roster]");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-roster")');
    await click('button[data-action="equipment-hero"][data-hero="linchong"]');
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-equipment")');
    const focusedEquipment = await evaluate(`(() => ({
      items: document.querySelectorAll(".inventory-item").length,
      total: Number(document.querySelector(".inventory-panel > .section-heading > span")?.textContent.match(/\\d+/)?.[0] || 0),
      hasNextPage: Boolean(document.querySelector('button[data-action="equipment-page"][data-direction="1"]')),
    }))()`);
    assertEqual(focusedEquipment.total > 5, true, "equipment fixture should cover multiple inventory pages");
    assertEqual(focusedEquipment.items <= 5, true, "equipment inventory should paginate short lists");
    assertEqual(focusedEquipment.hasNextPage, true, "equipment inventory pagination should be available");
    await click('button[data-action="equipment-page"][data-direction="1"]');
    assertEqual(
      await evaluate('document.querySelector(".inventory-panel .list-pagination")?.innerText.includes("第 2 /")'),
      true,
      "equipment inventory should advance to its second page",
    );
    console.log(JSON.stringify({ equipmentFocus: focusedEquipment }));
    throw new EquipmentFocusComplete();
  }

  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await waitFor(
    `([...document.querySelectorAll(".title-figure img")].length === 8) &&
      [...document.querySelectorAll(".title-figure img")].every(
        (image) => image.complete && image.naturalWidth > 0
      )`,
  );
  const titleRoster = await evaluate(`(() => {
    const figures = [...document.querySelectorAll(".title-figure")];
    const images = [...document.querySelectorAll(".title-figure img")];
    const roster = document.querySelector(".title-roster");
    const rosterRect = roster?.getBoundingClientRect();
    const resources = performance.getEntriesByType("resource");
    return {
      figures: figures.length,
      uniqueSources: new Set(images.map((image) => image.currentSrc)).size,
      thumbnails: images.every((image) => image.currentSrc.endsWith("/thumb.webp")),
      contain: images.every((image) => getComputedStyle(image).objectFit === "contain"),
      loaded: images.every((image) => image.naturalWidth >= 300),
      uniformThumbnailSize:
        new Set(images.map((image) => image.naturalWidth + "x" + image.naturalHeight)).size === 1,
      thumbnailSize: images.length
        ? images[0].naturalWidth + "x" + images[0].naturalHeight
        : "",
      clipped: figures.filter((figure) => {
        const rect = figure.getBoundingClientRect();
        return (
          rect.left < (rosterRect?.left || 0) - 1 ||
          rect.right > (rosterRect?.right || innerWidth) + 1
        );
      }).length,
      thumbnailRequests: resources.filter((resource) => resource.name.includes("/thumb.webp")).length,
      cutoutRequests: resources.filter((resource) => resource.name.includes("/cutout.webp")).length,
      posterRequests: new Set(
        resources
          .filter((resource) => resource.name.includes("bianjing_snow_night_poster"))
          .map((resource) => {
            const url = new URL(resource.name, location.href);
            return \`\${url.origin}\${url.pathname}\`;
          }),
      ).size,
      posterCanonicalUrls: new Set(
        resources
          .filter((resource) => resource.name.includes("bianjing_snow_night_poster"))
          .map((resource) => {
            const url = new URL(resource.name, location.href);
            return \`\${url.origin}\${url.pathname}\`;
          }),
      ).size,
      titleImageBytes: resources
        .filter((resource) => resource.initiatorType === "img")
        .reduce((total, resource) => total + Number(resource.encodedBodySize || 0), 0),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(titleRoster.figures, 8, "title screen should show a curated eight-hero ensemble");
  assertEqual(titleRoster.uniqueSources, 8, "title ensemble should not repeat portraits");
  assertEqual(titleRoster.thumbnails, true, "title ensemble should use lightweight thumbnails");
  assertEqual(titleRoster.contain, true, "title portraits should preserve aspect ratio");
  assertEqual(titleRoster.loaded, true, "title portraits should load at thumbnail resolution");
  assertEqual(
    titleRoster.uniformThumbnailSize,
    true,
    "title portraits should use one normalized thumbnail canvas",
  );
  assertEqual(titleRoster.thumbnailSize, "320x366", "title thumbnail dimensions should stay canonical");
  assertEqual(titleRoster.clipped, 0, "title portraits should stay inside the ensemble frame");
  assertEqual(titleRoster.thumbnailRequests, 8, "title should request exactly eight hero thumbnails");
  assertEqual(titleRoster.cutoutRequests, 0, "title should not request full-resolution hero cutouts");
  assertEqual(
    titleRoster.posterCanonicalUrls,
    1,
    "title poster should resolve to one asset across preload, CSS and video",
  );
  if (expectWebApp) {
    assertEqual(
    titleRoster.posterCanonicalUrls,
      1,
      "production title poster should issue exactly one network request",
    );
  }
  assertEqual(
    titleRoster.titleImageBytes <= 500_000,
    true,
    "title hero thumbnails should stay below the initial image budget",
  );
  assertEqual(titleRoster.overflow, 0, "title screen should not overflow horizontally");
  let webApp = null;
  if (expectWebApp) {
    await waitFor(
      `navigator.serviceWorker?.ready.then((registration) => Boolean(registration.active))`,
      15000,
    );
    webApp = await evaluate(`(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      const response = await fetch(link?.href || "/manifest.webmanifest");
      const manifest = response.ok ? await response.json() : null;
      const registration = await navigator.serviceWorker.ready;
      return {
        manifestLinked: Boolean(link),
        manifestName: manifest?.short_name || "",
        standalone: manifest?.display === "standalone",
        startUrl: manifest?.start_url || "",
        icons: manifest?.icons?.length || 0,
        workerState: registration.active?.state || "",
      };
    })()`);
    assertEqual(webApp.manifestLinked, true, "browser should link the install manifest");
    assertEqual(webApp.manifestName, "星命水浒", "manifest should expose the product short name");
    assertEqual(webApp.standalone, true, "manifest should allow standalone installation");
    assertEqual(webApp.startUrl, "/", "installed game should launch from the root URL");
    assertEqual(webApp.icons, 3, "manifest should provide install and maskable icons");
    assertEqual(webApp.workerState, "activated", "offline worker should activate");
  }
  assertEqual(
    await evaluate('document.querySelectorAll("i[data-lucide]").length'),
    0,
    "title screen should resolve every selected Lucide icon",
  );
  assertEqual(
    await evaluate(`(async () => {
      const backdrop = document.querySelector(".title-backdrop");
      const video = document.querySelector(".title-video");
      if (!backdrop || !video) return false;
      video.pause();
      await new Promise((resolve) => setTimeout(resolve, 650));
      const backdropImage = document.querySelector(".title-backdrop img");
      return backdropImage?.currentSrc.includes("bianjing_snow_night_poster") &&
        backdropImage.complete &&
        !video.classList.contains("is-playing") &&
        getComputedStyle(video).opacity === "0";
    })()`),
    true,
    "title scene should retain a still-image fallback when video playback pauses",
  );
  await captureSteamScreenshot("01_title.png");
  await evaluate("localStorage.clear()");
  await setSave(onboardingFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  const openingRouteGuide = await evaluate(`(() => {
    const guide = document.querySelector(".route-guide");
    const goals = [...document.querySelectorAll(".route-goal")];
    return {
      visible: Boolean(guide),
      goals: goals.length,
      primary: goals[0]?.dataset.routeGoal || null,
      hasProgress: Boolean(goals[0]?.querySelector(".route-goal-progress")),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(openingRouteGuide.visible, true, "the map should expose a next-step route guide");
  assertEqual(openingRouteGuide.goals, 2, "the route guide should keep the map focused on two immediate goals");
  assertEqual(
    openingRouteGuide.primary?.startsWith("story-"),
    true,
    "the opening route guide should lead with the active chapter",
  );
  assertEqual(openingRouteGuide.hasProgress, true, "the lead route goal should show concrete progress");
  assertEqual(openingRouteGuide.overflow, 0, "the route guide should not overflow horizontally");
  await click("button[data-action=enter-chapter]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  await click("button[data-action=story-skip]");
  const openingTactics = await evaluate(`(() => {
    const choices = [...document.querySelectorAll(".choice-list button")];
    const tactics = [...document.querySelectorAll(".choice-tactic")];
    return {
      choices: choices.length,
      tactics: tactics.length,
      firstName: tactics[0]?.querySelector("b")?.textContent.trim() || "",
      outside: tactics.some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      }),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(openingTactics.choices, 2, "the opening choice should offer two branches");
  assertEqual(openingTactics.tactics, 2, "every opening branch should preview its battle tactic");
  assertEqual(openingTactics.firstName, "临阵战意 · 回身护民", "the first branch should preview its named tactic");
  assertEqual(openingTactics.outside, false, "tactic previews should stay inside the choice panel");
  assertEqual(openingTactics.overflow, 0, "tactic previews should not overflow horizontally");
  await captureVisualQaScreenshot("shuihu-chapter-tactic-choice.png");
  await setViewport(390, 844, true);
  const mobileOpeningTactics = await evaluate(`(() => {
    const choice = document.querySelector(".story-choice");
    const choices = [...document.querySelectorAll(".choice-list button")];
    const tactics = [...document.querySelectorAll(".choice-tactic")];
    const choiceRect = choice?.getBoundingClientRect();
    return {
      width: innerWidth,
      choiceOutside: choiceRect
        ? choiceRect.left < -0.5 || choiceRect.right > innerWidth + 0.5
        : true,
      tactics: tactics.length,
      tacticOutside: tactics.some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      }),
      shortChoices: choices.filter((node) => node.getBoundingClientRect().height < 80).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(mobileOpeningTactics.width, 390, "tactic choice should render at mobile width");
  assertEqual(mobileOpeningTactics.choiceOutside, false, "mobile tactic choice should stay inside the viewport");
  assertEqual(mobileOpeningTactics.tactics, 2, "mobile tactic choice should keep both battle-rule previews");
  assertEqual(mobileOpeningTactics.tacticOutside, false, "mobile tactic previews should stay inside each choice");
  assertEqual(mobileOpeningTactics.shortChoices, 0, "mobile tactic choices should keep a comfortable tap target");
  assertEqual(mobileOpeningTactics.overflow, 0, "mobile tactic choice should not overflow horizontally");
  await captureVisualQaScreenshot("shuihu-chapter-tactic-choice-mobile.png");
  await setViewport(1440, 900, false);
  await click('button[data-action=story-choice][data-option="0"]');
  assertEqual(
    await evaluate('document.querySelector(".tactic-reveal b")?.textContent.trim()'),
    "回身护民",
    "the chosen tactic should be confirmed before battle",
  );
  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  const openingBattleTactic = await evaluate(`(() => {
    const hud = document.querySelector(".battle-legend-hud.is-tactic");
    return {
      visible: Boolean(hud),
      name: hud?.querySelector("b")?.textContent.trim() || "",
      desc: hud?.querySelector("p")?.textContent.trim() || "",
    };
  })()`);
  assertEqual(openingBattleTactic.visible, true, "the chosen tactic should appear in the battle HUD");
  assertEqual(openingBattleTactic.name, "回身护民", "the battle HUD should preserve the chosen tactic");
  assertEqual(
    openingBattleTactic.desc.includes("护御"),
    true,
    "the battle HUD should explain the rule that is actually active",
  );
  await captureVisualQaScreenshot("shuihu-chapter-tactic-battle.png");
  const tutorialState = await evaluate(`(() => {
    const tutorial = document.querySelector(".battle-tutorial");
    return {
      visible: Boolean(tutorial),
      lessons: tutorial?.querySelectorAll(".battle-tutorial-lessons > div").length || 0,
      skillsHidden: document.querySelectorAll(".skill-list .skill-button").length === 0,
      title: tutorial?.querySelector("h3")?.textContent.trim() || "",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(tutorialState.visible, true, "first campaign battle should show the tutorial");
  assertEqual(tutorialState.lessons, 3, "battle tutorial should explain path, targeting, and pacing");
  assertEqual(tutorialState.skillsHidden, true, "battle skills should wait until the tutorial is acknowledged");
  assertEqual(tutorialState.title, "先看路数，再定招式", "battle tutorial should lead with the tactical lesson");
  assertEqual(tutorialState.overflow, 0, "battle tutorial should not overflow horizontally");
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 1,
    mobile: true,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const mobileTutorial = await evaluate(`(() => {
    const tutorial = document.querySelector(".battle-tutorial");
    const rect = tutorial?.getBoundingClientRect();
    const startButton = tutorial?.querySelector(".battle-tutorial-start");
    const startRect = startButton?.getBoundingClientRect();
    return {
      width: document.documentElement.clientWidth,
      cards: tutorial?.querySelectorAll(".battle-tutorial-lessons > div").length || 0,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      startVisible: Boolean(
        startRect &&
        startRect.top >= 0 &&
        startRect.bottom <= innerHeight + 0.5
      ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(mobileTutorial.width, 390, "battle tutorial should render at mobile width");
  assertEqual(mobileTutorial.cards, 3, "mobile battle tutorial should keep every lesson");
  assertEqual(mobileTutorial.outside, false, "mobile battle tutorial should stay inside the viewport");
  assertEqual(mobileTutorial.startVisible, true, "mobile battle tutorial should expose its start button");
  assertEqual(mobileTutorial.overflow, 0, "mobile battle tutorial should not overflow horizontally");
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    screenWidth: 1280,
    screenHeight: 800,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const steamDeckBattle = await evaluate(`(() => {
    const tutorial = document.querySelector(".battle-tutorial");
    const rect = tutorial?.getBoundingClientRect();
    const startButton = tutorial?.querySelector(".battle-tutorial-start");
    const startRect = startButton?.getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      startVisible: Boolean(
        startRect &&
        startRect.top >= 0 &&
        startRect.bottom <= innerHeight + 0.5
      ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(steamDeckBattle.width, 1280, "Steam Deck battle should render at 1280px");
  assertEqual(steamDeckBattle.height, 800, "Steam Deck battle should render at 800px");
  assertEqual(steamDeckBattle.outside, false, "Steam Deck battle tutorial should stay inside the viewport");
  assertEqual(steamDeckBattle.startVisible, true, "Steam Deck battle tutorial should expose its start button");
  assertEqual(steamDeckBattle.overflow, 0, "Steam Deck battle should not overflow horizontally");
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    screenWidth: 1440,
    screenHeight: 900,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  await click("button[data-action='dismiss-battle-tutorial']");
  const tutorialDismissed = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      seen: save.flags.tutorialSeen,
      visible: Boolean(document.querySelector(".battle-tutorial")),
      skills: document.querySelectorAll(".skill-list .skill-button").length,
    };
  })()`);
  assertEqual(tutorialDismissed.seen, true, "tutorial completion should persist");
  assertEqual(tutorialDismissed.visible, false, "tutorial should hide after acknowledgement");
  assertEqual(tutorialDismissed.skills > 0, true, "battle skills should unlock after the tutorial");
  await verifyTextInputDoesNotTriggerGameShortcuts();
  await setViewport(390, 844, true);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const mobileBattleControls = await evaluate(`(() => {
    const controls = document.querySelector(".battle-controls");
    const tactic = document.querySelector(".auto-tactic-toggle");
    const tacticShort = tactic?.querySelector("span");
    const speed = document.querySelector(".battle-speed-control");
    const command = document.querySelector(".battle-command");
    const heroHud = document.querySelector(".hero-unit .unit-hud");
    const skillButtons = [...document.querySelectorAll(".skill-list .skill-button")];
    const controlsRect = controls?.getBoundingClientRect();
    const tacticRect = tactic?.getBoundingClientRect();
    const tacticShortRect = tacticShort?.getBoundingClientRect();
    const speedRect = speed?.getBoundingClientRect();
    const commandRect = command?.getBoundingClientRect();
    const heroHudRect = heroHud?.getBoundingClientRect();
    const lastSkillRect = skillButtons.at(-1)?.getBoundingClientRect();
    const statusOverlap = commandRect && heroHudRect
      ? Math.max(
          0,
          Math.min(commandRect.bottom, heroHudRect.bottom) -
            Math.max(commandRect.top, heroHudRect.top),
        )
      : 999;
    const commandContentOverflow = commandRect && lastSkillRect
      ? Math.max(0, lastSkillRect.bottom - commandRect.bottom + 1)
      : 999;
    return {
      width: innerWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controlsOutside: controlsRect
        ? controlsRect.left < -0.5 || controlsRect.right > innerWidth + 0.5
        : true,
      tacticVisible: Boolean(tacticRect && tacticRect.width > 1 && tacticRect.height > 1),
      tacticShortVisible: Boolean(
        tacticShortRect && tacticShortRect.width > 1 && tacticShortRect.height > 1
      ),
      tacticText: tactic?.textContent.trim() || "",
      tacticLabel: tactic?.getAttribute("aria-label") || "",
      speedButtons: speed?.querySelectorAll("button").length || 0,
      speedOutside: speedRect
        ? speedRect.left < -0.5 || speedRect.right > innerWidth + 0.5
        : true,
      statusOverlap,
      commandContentOverflow,
    };
  })()`);
  assertEqual(mobileBattleControls.width, 390, "mobile battle controls should use the requested width");
  assertEqual(mobileBattleControls.overflow, 0, "mobile battle controls should not overflow horizontally");
  assertEqual(mobileBattleControls.controlsOutside, false, "mobile battle controls should stay inside the viewport");
  assertEqual(mobileBattleControls.tacticVisible, true, "mobile battle should expose the auto-tactic control");
  assertEqual(mobileBattleControls.tacticShortVisible, true, "mobile battle should show the selected tactic short label");
  assertEqual(mobileBattleControls.tacticText, "衡", "mobile battle should show the balanced tactic");
  assertEqual(
    mobileBattleControls.tacticLabel.includes("均衡"),
    true,
    "mobile battle should keep an accessible label for the selected tactic",
  );
  assertEqual(mobileBattleControls.speedButtons, 3, "mobile battle should expose all three speed controls");
  assertEqual(mobileBattleControls.speedOutside, false, "mobile battle speed controls should stay inside the viewport");
  assertEqual(mobileBattleControls.statusOverlap, 0, "mobile battle command should not cover the hero status card");
  assertEqual(mobileBattleControls.commandContentOverflow, 0, "mobile battle command should expose every skill without clipping");
  await captureVisualQaScreenshot("shuihu-battle-controls-mobile.png");
  await setViewport(1440, 900, false);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))`,
  );
  await new Promise((resolve) => setTimeout(resolve, 120));
  assertEqual(
    await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoBattle`,
    ),
    true,
    "A should toggle auto-battle from the keyboard",
  );
  for (const speed of [2, 4]) {
    await evaluate(
      `window.dispatchEvent(new KeyboardEvent("keydown", { key: "${speed}", bubbles: true }))`,
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    assertEqual(
      await evaluate(
        `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.battleSpeed`,
      ),
      speed,
      `${speed} should set battle speed from the keyboard`,
    );
  }
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", bubbles: true }))`,
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  assertEqual(
    await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoTactic`,
    ),
    "breaker",
    "T should cycle the auto-battle tactic from the keyboard",
  );
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`,
  );
  await waitFor('Boolean(document.querySelector("[data-modal-panel]"))');
  await click(
    '[data-modal-panel] .modal-actions button[data-action="close-modal"]',
  );
  await waitFor('!document.querySelector("[data-modal-panel]")');
  assertEqual(
    await evaluate('Boolean(document.querySelector("[data-modal-panel]"))'),
    false,
    "pause menu primary action should close the modal",
  );
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`,
  );
  await waitFor('Boolean(document.querySelector("[data-modal-panel]"))');
  await installMockGamepad();
  await pressGamepadButton(1);
  assertEqual(
    await evaluate('Boolean(document.querySelector("[data-modal-panel]"))'),
    false,
    "gamepad B should close the pause menu",
  );
  const autoBeforeGamepad = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoBattle`,
  );
  await pressGamepadButton(2);
  assertEqual(
    await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoBattle`,
    ),
    !autoBeforeGamepad,
    "gamepad X should toggle auto-battle",
  );
  const speedBeforeGamepad = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.battleSpeed`,
  );
  await pressGamepadButton(3);
  assertEqual(
    await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.battleSpeed`,
    ),
    speedBeforeGamepad === 1 ? 2 : speedBeforeGamepad === 2 ? 4 : 1,
    "gamepad Y should cycle battle speed",
  );
  const tacticBeforeGamepad = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoTactic`,
  );
  await pressGamepadButton(4);
  const tacticAfterGamepad = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoTactic`,
  );
  const tacticOrder = ["balanced", "breaker", "guardian", "hunter"];
  assertEqual(
    tacticAfterGamepad,
    tacticOrder[(tacticOrder.indexOf(tacticBeforeGamepad) + 1) % tacticOrder.length],
    "gamepad LB should cycle the auto-battle tactic",
  );
  await pressGamepadButton(9);
  assertEqual(
    await evaluate('Boolean(document.querySelector("[data-modal-panel]"))'),
    true,
    "gamepad Start should open the battle pause menu",
  );
  await pressGamepadButton(1);
  await waitFor('!document.querySelector("[data-modal-panel]")');
  const gamepadRegression = {
    standardMapping: true,
    autoBattle: true,
    battleSpeed: true,
    autoTactic: true,
    pauseResume: true,
    dpadFocus: true,
    confirmNavigation: true,
    journalShortcut: true,
    backNavigation: true,
  };

  await setSave(campaignFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await captureSteamScreenshot("02_campaign_map.png");

  assertEqual(
    await evaluate('document.querySelectorAll("button[data-action=select-chapter]").length'),
    CHAPTERS.length,
    "campaign should expose every chapter node",
  );
  await installMockGamepad();
  assertEqual(
    await evaluate(`(() => {
      const target = document.querySelector("button[data-action='nav-roster']");
      target?.focus();
      return document.activeElement === target;
    })()`),
    true,
    "gamepad navigation should start from a focusable control",
  );
  await pressGamepadButton(15);
  assertEqual(
    await evaluate(
      `document.activeElement?.dataset?.action === "nav-quests" && document.documentElement.dataset.input === "gamepad"`,
    ),
    true,
    "gamepad D-pad right should move focus between top navigation controls",
  );
  await pressGamepadButton(0);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
  await pressGamepadButton(1);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await pressGamepadButton(7);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-codex")');
  assertEqual(
    await evaluate(
      `document.querySelector(".game-frame")?.classList.contains("screen-codex")`,
    ),
    true,
    "gamepad journal button should open the achievement and star-map screen",
  );
  await pressGamepadButton(1);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');

  await evaluate(
    `(() => {
      const button = [...document.querySelectorAll("button[data-action=select-chapter]")]
        .find((node) => node.innerText.includes("清风寨月箭"));
      button?.click();
      return Boolean(button);
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 180));
  await click("button[data-action=enter-chapter]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  assertEqual(
    await evaluate("document.documentElement.dataset.music"),
    "qingfeng_theme",
    "Qingfeng story music should load",
  );
  await captureSteamScreenshot("03_qingfeng_story.png");

  await click("button[data-action=story-skip]");
  await click('button[data-action=story-choice][data-option="0"]');
  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  await captureSteamScreenshot("04_qingfeng_battle.png");
  assertEqual(
    (await evaluate('document.querySelector(".auto-battle-toggle")?.innerText')) || "",
    "自动中",
    "auto battle should be enabled",
  );
  assertEqual(
    (await evaluate('document.querySelector(".auto-tactic-toggle")?.innerText.trim()')) || "",
    "衡",
    "the battle header should expose the balanced auto tactic",
  );
  await click('button[data-action="cycle-auto-tactic"]');
  assertEqual(
    await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).settings.autoTactic`,
    ),
    "breaker",
    "the battle header should cycle and persist auto tactics",
  );
  assertEqual(
    (await evaluate('document.querySelector(".auto-tactic-toggle")?.innerText.trim()')) || "",
    "破",
    "the battle header should show the selected auto tactic",
  );
  assertEqual(
    await evaluate('document.querySelector(".battle-speed-control .is-selected")?.innerText'),
    "4x",
    "battle speed should persist at 4x",
  );

  await waitFor(
    `[...document.images]
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      })
      .every((image) => image.complete && image.naturalWidth > 0)`,
    5000,
  );
  const imageState = await evaluate(`(() => {
    const visible = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
    return {
      broken: visible.filter((image) => !image.complete || image.naturalWidth <= 0).length,
      stretched: visible.filter((image) => {
        if (getComputedStyle(image).objectFit !== "fill") return false;
        const rect = image.getBoundingClientRect();
        const natural = image.naturalWidth / image.naturalHeight;
        const rendered = rect.width / rect.height;
        return Math.abs(natural - rendered) / natural > 0.025;
      }).length,
    };
  })()`);
  assertEqual(imageState.broken, 0, "battle images should not be broken");
  assertEqual(imageState.stretched, 0, "battle images should not be stretched");

  await waitForReward("Qingfeng doctrine regression battle", 35000);
  const rewardLayout = await evaluate(`(() => {
    const panel = document.querySelector(".medal-reward-panel");
    const items = panel ? [...panel.querySelectorAll(".medal-reward-list > span")] : [];
    const viewportWidth = document.documentElement.clientWidth;
    const clipped = items.filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left < -0.5 || rect.right > viewportWidth + 0.5;
    }).length;
    return {
      visible: Boolean(panel && panel.getBoundingClientRect().height > 0),
      items: items.length,
      clipped,
      overflow: document.documentElement.scrollWidth - viewportWidth,
    };
  })()`);
  assertEqual(rewardLayout.visible, true, "earned medals should appear on the reward screen");
  assertEqual(rewardLayout.items > 0, true, "reward screen should list newly earned medals");
  assertEqual(rewardLayout.clipped, 0, "medal reward cards should stay within the viewport");
  assertEqual(rewardLayout.overflow, 0, "reward screen should not overflow horizontally");
  const afterBattle = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"))',
  );
  assertEqual(afterBattle.completedChapters.includes("qingfeng"), true, "chapter should complete");
  assertEqual(afterBattle.recruited.includes("huarong"), true, "Hua Rong should be recruited");
  assertEqual(afterBattle.achievements.includes("first_blood"), true, "first win should unlock");
  assertEqual(
    Array.isArray(afterBattle.chapterMedals.qingfeng),
    true,
    "chapter medals should be recorded",
  );

  const fullCampaign = [];
  const expectedStoryMusic = {
    ferry: "jianghu_theme",
    bianjing: "jianghu_theme",
    boar_forest: "jianghu_theme",
    cangzhou: "jianghu_theme",
    qingfeng: "qingfeng_theme",
    jiangzhou: "jiangzhou_theme",
    zhujiazhuang: "zhujiazhuang_theme",
    damingfu: "damingfu_theme",
    liangshan: "ending_theme",
  };
  await setSave(fullCampaignFixture());
  if (postCampaignFocus) {
    const save = await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
    );
    save.currentChapter = CHAPTERS.length - 1;
    save.completedChapters = CHAPTERS.slice(0, -1).map((chapter) => chapter.id);
    save.recruited = [...HERO_ORDER];
    save.roster = Object.fromEntries(
      HERO_ORDER.map((heroId) => [heroId, createRosterEntry(heroId)]),
    );
    save.team = ["linchong", "luzhishen", "wusong"];
    save.stats.heroesRecruited = HERO_ORDER.length;
    save.heroRecruitments.completed = [...HERO_ORDER];
    save.heroRecruitments.joined = [...HERO_ORDER];
    await setSave(save);
  }
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  if (!postCampaignFocus) {
  for (const [index, chapter] of CHAPTERS.entries()) {
    console.log(`E2E campaign: chapter ${index + 1}/${CHAPTERS.length} ${chapter.id}`);
    await waitFor(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).currentChapter === ${index}`,
    );
    for (const recruitment of Object.values(HERO_RECRUITMENTS).filter(
      (entry) => entry.requiredChapter === index,
    )) {
      await completeRecruitmentScroll(recruitment.heroId);
    }
    const campaignSaveBeforeBattle = await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
    );
    if (!campaignSaveBeforeBattle.team.every(Boolean)) {
      const recruits = (chapter.battle.recruit || []).filter(
        (heroId) =>
          campaignSaveBeforeBattle.recruited.includes(heroId) &&
          !campaignSaveBeforeBattle.team.includes(heroId),
      );
      for (
        let teamIndex = 0;
        teamIndex < campaignSaveBeforeBattle.team.length && recruits.length;
        teamIndex += 1
      ) {
        if (campaignSaveBeforeBattle.team[teamIndex]) continue;
        campaignSaveBeforeBattle.team[teamIndex] = recruits.shift();
      }
      await setSave(campaignSaveBeforeBattle);
      await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
      await clickText("续上旧卷");
      await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
    }
    await click("button[data-action=enter-chapter]");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
    const music = await evaluate("document.documentElement.dataset.music || ''");
    assertEqual(
      music,
      expectedStoryMusic[chapter.id],
      `${chapter.id} story should use its authored music route`,
    );
    await click("button[data-action=story-skip]");
    await click('button[data-action=story-choice][data-option="0"]');
    await click("button[data-action=story-to-battle]");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
    const battleMusic = await evaluate(
      "document.documentElement.dataset.music || ''",
    );
    const expectedBattleMusic =
      chapter.battle.boss || chapter.id === "jiangzhou"
        ? "boss_theme"
        : chapter.id === "zhujiazhuang"
          ? "zhujiazhuang_theme"
          : chapter.id === "damingfu"
            ? "damingfu_theme"
            : "battle_theme";
    assertEqual(
      battleMusic,
      expectedBattleMusic,
      `${chapter.id} battle should use its authored combat music`,
    );
    await waitForReward(`${chapter.id} campaign battle`);
    assertEqual(
      await evaluate("document.documentElement.dataset.music || ''"),
      "ending_theme",
      `${chapter.id} reward should use the victory music`,
    );
    const chapterSave = await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
    );
    assertEqual(
      chapterSave.completedChapters.includes(chapter.id),
      true,
      `${chapter.id} should complete in the continuous campaign`,
    );
    assertEqual(
      chapterSave.currentChapter,
      index + 1,
      `${chapter.id} should advance the continuous campaign`,
    );
    fullCampaign.push({
      id: chapter.id,
      title: chapter.title,
      music,
      battleMusic,
      currentChapter: chapterSave.currentChapter,
    });
    await click("button[data-action=story-outro]");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
    const terminalScreen =
      index === CHAPTERS.length - 1 ? "screen-final-choice" : "screen-map";
    for (let step = 0; step < 12; step += 1) {
      const reachedTerminal = await evaluate(
        `document.querySelector(".game-frame")?.classList.contains(${JSON.stringify(
          terminalScreen,
        )})`,
      );
      if (reachedTerminal) break;
      const advanced = await evaluate(`(() => {
        const next = document.querySelector("[data-action=story-next]");
        if (!next) return false;
        next.click();
        return true;
      })()`);
      assertEqual(advanced, true, `${chapter.id} outro should expose the next line`);
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    await waitFor(
      `document.querySelector(".game-frame")?.classList.contains(${JSON.stringify(
        terminalScreen,
      )})`,
    );
  }
  }
  if (postCampaignFocus) {
    await setSave({ ...finalChoiceFixture(), ending: "brotherhood" });
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await clickText("续上旧卷");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-ending")');
  } else {
    await click(
      'button[data-action="choose-ending"][data-ending="brotherhood"]',
    );
  }
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-ending")');
  const completedCampaign = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
  );
  assertEqual(completedCampaign.currentChapter, CHAPTERS.length, "campaign should reach the final choice");
  assertEqual(
    completedCampaign.completedChapters.length,
    CHAPTERS.length,
    "continuous campaign should record every chapter",
  );
  assertEqual(completedCampaign.flags.finalBattleWon, true, "continuous campaign should record the final battle");
  assertEqual(completedCampaign.ending, "brotherhood", "continuous campaign should persist its ending");
  if (!postCampaignFocus) {
    assertEqual(
      completedCampaign.stats.battlesWon,
      CHAPTERS.length + Object.keys(HERO_RECRUITMENTS).length,
      "continuous campaign should settle every chapter and recruitment battle",
    );
  }
  if (!postCampaignFocus) {
    assertEqual(
      completedCampaign.recruited.length,
      HERO_ORDER.length,
      "continuous campaign should recruit every hero through chapter rewards and recruitment scrolls",
    );
  }
  if (!postCampaignFocus) {
    assertEqual(fullCampaign.length, CHAPTERS.length, "continuous campaign should include every chapter");
  }
  for (const endingId of ["order", "freedom"]) {
    await setSave(finalChoiceFixture());
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await clickText("续上旧卷");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-final-choice")');
    await click(
      `button[data-action="choose-ending"][data-ending="${endingId}"]`,
    );
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-ending")');
    const endingSave = await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
    );
    assertEqual(endingSave.ending, endingId, `${endingId} ending should persist`);
    assertEqual(
      endingSave.endingsUnlocked.includes(endingId),
      true,
      `${endingId} ending should enter the permanent archive`,
    );
  }

  for (const endingId of ["brotherhood", "order", "freedom"]) {
    await setSave({ ...newGamePlusFixture(), ending: endingId, endingsUnlocked: [endingId] });
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    const replayOpening = await evaluate(`(() => {
      const scenes = [...document.querySelectorAll(".title-prologue-frame")];
      return {
        variant: document.querySelector(".title-prologue")?.className || "",
        scenes: scenes.length,
        first: scenes[0]?.querySelector("small")?.textContent || "",
        last: scenes.at(-1)?.querySelector("b")?.textContent || "",
      };
    })()`);
    assertEqual(replayOpening.scenes, 7, `${endingId} replay should show the full opening`);
    assertEqual(replayOpening.first, `旧卷回响 · ${endingId === "brotherhood" ? "梁山不散" : endingId === "order" ? "风雪入长安" : "江湖归舟"}`, `${endingId} replay should echo its previous ending`);
    assertEqual(replayOpening.last, "星命开卷", `${endingId} replay should still land on the title frame`);
  }

  await setSave(bondFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await click("button[data-action=nav-roster]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-roster")');
  const rosterLayout = await evaluate(`(() => ({
    cards: document.querySelectorAll(".roster-list-panel .hero-card").length,
    filters: document.querySelectorAll(".roster-filters button").length,
    page: document.querySelector(".roster-list-panel .list-pagination")?.innerText || "",
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))()`);
  assertEqual(rosterLayout.cards, 12, "roster should paginate at twelve heroes");
  assertEqual(rosterLayout.filters, 5, "roster should filter by every hero path");
  assertEqual(rosterLayout.page.includes("第 1 /"), true, "roster should begin on the first page");
  assertEqual(rosterLayout.overflow, 0, "roster filters should not overflow horizontally");
  await click('button[data-action="filter-roster-path"][data-path="ling"]');
  const rosterLing = await evaluate(`(() => ({
    cards: document.querySelectorAll(".roster-list-panel .hero-card").length,
    paths: [...document.querySelectorAll(".roster-list-panel .hero-card .path-badge > span")].map((node) => node.textContent.trim()),
  }))()`);
  assertEqual(rosterLing.paths.every((path) => path === "灵巧"), true, "roster path filter should only show matching heroes");
  await click('button[data-action="filter-roster-path"][data-path="all"]');
  await click('button[data-action="roster-page"][data-direction="1"]');
  assertEqual(
    await evaluate('document.querySelectorAll(".roster-list-panel .hero-card").length > 0 && document.querySelector(".roster-list-panel .list-pagination")?.innerText.includes("第 2 /")'),
    true,
    "roster should advance through later pages",
  );
  await click('button[data-action="filter-roster-path"][data-path="all"]');
  await waitFor('Boolean(document.querySelector(".hero-card button[data-action=\\"open-hero\\"]"))');
  await click('.hero-card button[data-action="open-hero"]');
  await waitFor('document.querySelector(".hero-dossier")?.classList.contains("is-open")');
  await evaluate(`(() => {
    const action = [...document.querySelectorAll(
      '.hero-dossier button[data-action="equipment-hero"]',
    )].find((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    });
    if (!action) return false;
    action.click();
    return true;
  })()`);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-equipment")');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-equipment")');
  const equipmentLayout = await evaluate(`(() => ({
    items: document.querySelectorAll(".inventory-item").length,
    totalItems: Number(document.querySelector(".inventory-panel > .section-heading > span")?.textContent.match(/\\d+/)?.[0] || 0),
    filters: document.querySelectorAll(".equipment-filter-group button").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))()`);
  assertEqual(equipmentLayout.totalItems > 5, true, "equipment fixture should cover multiple inventory pages");
  assertEqual(equipmentLayout.items <= 5, true, "equipment inventory should paginate short lists");
  assertEqual(equipmentLayout.filters, 9, "equipment should expose category and hero path filters");
  assertEqual(equipmentLayout.overflow, 0, "equipment filters should not overflow horizontally");
  await click('button[data-action="equipment-page"][data-direction="1"]');
  assertEqual(
    await evaluate('document.querySelector(".inventory-panel .list-pagination")?.innerText.includes("第 2 /")'),
    true,
    "equipment inventory should advance to its second page",
  );
  await click('button[data-action="equipment-page"][data-direction="-1"]');
  await click('button[data-action="filter-equipment-item"][data-slot="weapon"]');
  assertEqual(
    await evaluate('[...document.querySelectorAll(".inventory-item .item-copy small")].every((node) => node.textContent.startsWith("兵刃"))'),
    true,
    "weapon category should hide armor and tokens",
  );
  await click('button[data-action="filter-equipment-path"][data-path="shou"]');
  assertEqual(
    await evaluate(`(() => {
      const shouHeroes = new Set(${JSON.stringify(HERO_ORDER.filter((heroId) => HEROES[heroId].path === "shou"))});
      const tabs = [...document.querySelectorAll(".equipment-hero-tabs button[data-action='select-equipment-hero']")];
      return tabs.length > 0 && tabs.every((node) => shouHeroes.has(node.dataset.hero));
    })()`),
    true,
    "equipment hero tabs should remain selectable after filtering",
  );
  await click('button[data-action="filter-equipment-path"][data-path="all"]');
  await click('button[data-action="nav-roster"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-roster")');
  await click('button[data-action="nav-formation"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-formation")');
  const bondFormation = await evaluate(`(() => {
    const active = [...document.querySelectorAll(".bond-panel .bond-card.is-active")];
    return {
      cards: document.querySelectorAll(".bond-panel .bond-card").length,
      active: active.length,
      activeNames: active.map((card) => card.querySelector(".bond-copy b")?.textContent.trim()),
      archived: JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).bondArchive.length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(
    bondFormation.cards,
    Object.keys(HERO_BONDS).length,
    "formation should expose every hero bond",
  );
  assertEqual(bondFormation.active, 2, "the Lin Chong, Lu Zhishen, and Wu Song trio should activate two bonds");
  assertEqual(bondFormation.activeNames.includes("风雪同袍"), true, "defensive pair bond should be active");
  assertEqual(bondFormation.activeNames.includes("三山聚义"), true, "trio bond should be active");
  assertEqual(bondFormation.archived, 0, "seeing a formation should not pre-unlock its bond archive entry");
  assertEqual(bondFormation.overflow, 0, "formation bonds should not overflow horizontally");

  await click('button[data-action="auto-team"]');
  const advisedFormation = await evaluate(`(() => {
    const active = [...document.querySelectorAll(".bond-panel .bond-card.is-active")];
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    return {
      team: save.team,
      activeNames: active.map((card) => card.querySelector(".bond-copy b")?.textContent.trim()),
      chainName: document.querySelector(".chain-team-panel h2")?.textContent.trim() || "",
      chainHelp: document.querySelector(".chain-team-help")?.textContent.trim() || "",
      toast: document.querySelector(".toast")?.innerText || "",
      recommendations: [...document.querySelectorAll(".advisor-option")].map(
        (option) => ({
          current: option.classList.contains("is-current"),
          head: option.querySelector(".advisor-option-head")?.innerText || "",
          body: option.querySelector(".advisor-option-copy, p")?.innerText || "",
          foot: option.querySelector(".advisor-option-foot")?.innerText || "",
          bonds: option.querySelectorAll(".advisor-option-head em").length,
        }),
      ),
    };
  })()`);
  assertEqual(advisedFormation.team.length, 3, "advisor formation should fill all three rows");
  assertEqual(advisedFormation.activeNames.length >= 2, true, "advisor formation should stack multiple bonds");
  assertEqual(
    new Set(
      advisedFormation.team.map((heroId) => HEROES[heroId]?.path),
    ).size,
    3,
    "advisor formation should expose three different paths",
  );
  assertEqual(
    Object.values(CHAIN_FORMATIONS).some(
      (formation) => formation.name === advisedFormation.chainName,
    ),
    true,
    "advisor formation should preview a valid star-chain formation",
  );
  assertEqual(
    advisedFormation.chainHelp.includes("即可发动"),
    true,
    "advisor preview should explain how the formation becomes playable",
  );
  assertEqual(
    advisedFormation.recommendations.some(
      (option) =>
        option.current &&
        option.head.includes("3/3") &&
        option.foot.includes("当前采用"),
    ),
    true,
    "advisor panel should mark three-path coverage and the active recommendation",
  );

  await setViewport(390, 844, true);
  const mobileBonds = await evaluate(`(() => {
    const cards = [...document.querySelectorAll(".bond-panel .bond-card")];
    const width = document.documentElement.clientWidth;
    const visibleImages = [...document.querySelectorAll(".bond-panel img")].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
    return {
      cards: cards.length,
      outside: cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > width + 0.5;
      }).length,
      clipped: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      nonContained: visibleImages.filter(
        (image) => getComputedStyle(image).objectFit !== "contain",
      ).length,
      stretched: visibleImages.filter((image) => {
        if (getComputedStyle(image).objectFit !== "fill") return false;
        const rect = image.getBoundingClientRect();
        const natural = image.naturalWidth / Math.max(1, image.naturalHeight);
        const rendered = rect.width / Math.max(1, rect.height);
        return Math.abs(natural - rendered) / Math.max(natural, rendered) > 0.025;
      }).length,
      overflow: document.documentElement.scrollWidth - width,
    };
  })()`);
  assertEqual(
    mobileBonds.cards,
    Object.keys(HERO_BONDS).length,
    "mobile formation should keep every bond card",
  );
  assertEqual(mobileBonds.outside, 0, "mobile bond cards should stay inside the viewport");
  assertEqual(mobileBonds.clipped, 0, "mobile bond cards should not clip their content");
  assertEqual(mobileBonds.nonContained, 0, "bond portraits should use contained scaling");
  assertEqual(mobileBonds.stretched, 0, "bond portraits should preserve their aspect ratio");
  assertEqual(mobileBonds.overflow, 0, "mobile bond panel should not overflow horizontally");
  await setViewport(1440, 900, false);

  if (postCampaignFocus) {
    const advisorSave = chainFixture();
    advisorSave.currentChapter = CHAPTERS.length - 1;
    await setSave(advisorSave);
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await clickText("续上旧卷");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  }
  await click("button[data-action=nav-map]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await click("button[data-action=enter-chapter]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  await click("button[data-action=story-skip]");
  await click('button[data-action=story-choice][data-option="0"]');
  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  assertEqual(
    await evaluate(`(() => {
      const saveText = localStorage.getItem(${JSON.stringify(SAVE_KEY)});
      if (!saveText) {
        return {
          error: "missing save",
          screen: [...document.querySelector(".game-frame")?.classList || []],
        };
      }
      const team = new Set(JSON.parse(saveText).team);
      const expected = ${JSON.stringify(
        Object.values(HERO_BONDS).map((bond) => bond.heroIds),
      )}.filter(
        (heroIds) => heroIds.every((heroId) => team.has(heroId)),
      ).length;
      const actual = document.querySelectorAll(".battle-bond-hud b").length;
      if (actual !== expected) {
        return {
          error: "bond mismatch",
          save: JSON.parse(saveText),
          expected,
          actual,
          hud: document.querySelector(".battle-bond-hud")?.innerText || "",
        };
      }
      return true;
    })()`),
    true,
    "battle HUD should surface every bond selected by the advisor",
  );
  assertEqual(
    await evaluate(`(() => {
      const team = new Set(JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).team);
      const expected = ${JSON.stringify(
        Object.values(HERO_BONDS).map((bond) => bond.heroIds),
      )}.filter(
        (heroIds) => heroIds.every((heroId) => team.has(heroId)),
      ).length;
      return document.querySelectorAll(".battle-bond-hud b").length >= expected &&
        document.querySelectorAll(".battle-chain .chain-path-mark").length === 3;
    })()`),
    true,
    "battle HUD should preserve the advisor bonds and expose the three-slot chain track",
  );

  await setSave(chainFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await click('button[data-action="nav-roster"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-roster")');
  await click('button[data-action="nav-formation"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-formation")');
  const chainTeamPreview = await evaluate(`(() => {
    const panel = document.querySelector(".chain-team-panel");
    const heroes = [...document.querySelectorAll(".chain-team-hero:not(.is-empty)")];
    const rect = panel?.getBoundingClientRect();
    return {
      visible: Boolean(panel && rect.height > 1),
      name: panel?.querySelector("h2")?.textContent.trim() || "",
      paths: document.querySelectorAll(".chain-team-hero > i").length,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      clipped: panel ? panel.scrollWidth > panel.clientWidth + 1 : true,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(chainTeamPreview.visible, true, "formation should preview the star-chain plan");
  assertEqual(chainTeamPreview.name, "天罡破军", "the selected three paths should preview their exact formation");
  assertEqual(chainTeamPreview.paths, 3, "formation preview should expose all three active paths");
  assertEqual(chainTeamPreview.outside, false, "desktop chain preview should stay inside the viewport");
  assertEqual(chainTeamPreview.clipped, false, "desktop chain preview should not clip its copy");
  assertEqual(chainTeamPreview.overflow, 0, "desktop chain preview should not overflow horizontally");
  await captureVisualQaScreenshot("shuihu-chain-formation.png");

  await setViewport(390, 844, true);
  const mobileChainTeam = await evaluate(`(() => {
    const panel = document.querySelector(".chain-team-panel");
    const cards = [...document.querySelectorAll(".chain-team-hero")];
    const rect = panel?.getBoundingClientRect();
    return {
      width: innerWidth,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      cards: cards.length,
      clipped: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      outsideCards: cards.filter((card) => {
        const cardRect = card.getBoundingClientRect();
        return cardRect.left < -0.5 || cardRect.right > innerWidth + 0.5;
      }).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(mobileChainTeam.width, 390, "chain preview should render at mobile width");
  assertEqual(mobileChainTeam.outside, false, "mobile chain preview should stay inside the viewport");
  assertEqual(mobileChainTeam.cards, 3, "mobile chain preview should keep all three team slots");
  assertEqual(mobileChainTeam.clipped, 0, "mobile chain preview cards should not clip");
  assertEqual(mobileChainTeam.outsideCards, 0, "mobile chain preview cards should stay inside the viewport");
  assertEqual(mobileChainTeam.overflow, 0, "mobile chain preview should not overflow horizontally");
  await evaluate(
    `document.querySelector(".chain-team-panel")?.scrollIntoView({ block: "center", behavior: "instant" })`,
  );
  await new Promise((resolve) => setTimeout(resolve, 220));
  await captureVisualQaScreenshot("shuihu-chain-formation-mobile.png");
  await setViewport(1440, 900, false);

  await click('button[data-action="nav-map"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await clickMoreAction("nav-codex");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-codex")');
  const chainArchiveLayout = await evaluate(`(() => {
    const archive = document.querySelector(".chain-archive");
    const cards = [...document.querySelectorAll(".chain-formation")];
    const rect = archive?.getBoundingClientRect();
    return {
      visible: Boolean(archive && rect.height > 1),
      cards: cards.length,
      discovered: document.querySelectorAll(".chain-formation.is-discovered").length,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      clipped: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(chainArchiveLayout.visible, true, "codex should expose the four-symbol chain archive");
  assertEqual(chainArchiveLayout.cards, Object.keys(CHAIN_FORMATIONS).length, "chain archive should list every formation");
  assertEqual(chainArchiveLayout.discovered, 0, "new saves should begin with an empty chain archive");
  assertEqual(chainArchiveLayout.outside, false, "desktop chain archive should stay inside the viewport");
  assertEqual(chainArchiveLayout.clipped, 0, "desktop chain archive cards should not clip");
  assertEqual(chainArchiveLayout.overflow, 0, "desktop chain archive should not overflow horizontally");
  await captureVisualQaScreenshot("shuihu-chain-archive.png");
  await setViewport(390, 844, true);
  const mobileChainArchive = await evaluate(`(() => {
    const archive = document.querySelector(".chain-archive");
    const cards = [...document.querySelectorAll(".chain-formation")];
    const rect = archive?.getBoundingClientRect();
    return {
      width: innerWidth,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      cards: cards.length,
      clipped: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(mobileChainArchive.width, 390, "chain archive should render at mobile width");
  assertEqual(mobileChainArchive.outside, false, "mobile chain archive should stay inside the viewport");
  assertEqual(mobileChainArchive.cards, Object.keys(CHAIN_FORMATIONS).length, "mobile archive should keep every formation");
  assertEqual(mobileChainArchive.clipped, 0, "mobile chain archive cards should not clip");
  assertEqual(mobileChainArchive.overflow, 0, "mobile chain archive should not overflow horizontally");
  await evaluate(
    `document.querySelector(".chain-archive")?.scrollIntoView({ block: "center", behavior: "instant" })`,
  );
  await new Promise((resolve) => setTimeout(resolve, 220));
  await captureVisualQaScreenshot("shuihu-chain-archive-mobile.png");
  await setViewport(1440, 900, false);

  await click('button[data-action="nav-map"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  if (postCampaignFocus) {
    await setSave({ ...chainFixture(), currentChapter: CHAPTERS.length - 1 });
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await clickText("续上旧卷");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  }
  await click("button[data-action=enter-chapter]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  await click("button[data-action=story-skip]");
  await click('button[data-action="story-choice"][data-option="0"]');
  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  const chainBattleBefore = await evaluate(`(() => {
    const chain = document.querySelector(".battle-chain");
    const marks = [...document.querySelectorAll(".chain-path-mark")];
    const rect = chain?.getBoundingClientRect();
    return {
      hint: chain?.querySelector("b")?.textContent.trim() || "",
      marks: marks.length,
      filled: marks.filter((mark) => !mark.classList.contains("is-empty")).length,
      outside: rect ? rect.left < -0.5 || rect.right > innerWidth + 0.5 : true,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(chainBattleBefore.hint, "待取三路", "manual battle should explain the empty chain track");
  assertEqual(chainBattleBefore.marks, 3, "battle HUD should keep three chain path slots");
  assertEqual(chainBattleBefore.filled, 0, "battle should begin with no recorded paths");
  assertEqual(chainBattleBefore.outside, false, "battle chain HUD should stay inside the viewport");
  assertEqual(chainBattleBefore.overflow, 0, "battle chain HUD should not overflow horizontally");
  await captureVisualQaScreenshot("shuihu-chain-battle-empty.png");

  for (let step = 1; step <= 3; step += 1) {
    const acted = await useFirstAvailableBattleSkill();
    assertEqual(acted, true, `chain battle should allow manual action ${step}`);
    const filled = await evaluate(
      '[...document.querySelectorAll(".chain-path-mark")].filter((mark) => !mark.classList.contains("is-empty")).length',
    );
    assertEqual(filled, step, `manual action ${step} should light one distinct path slot`);
  }
  await waitFor(
    'document.querySelector(".chain-attack-action:not(:disabled)") !== null',
    20000,
  );
  const chainBattleReady = await evaluate(`(() => {
    const chain = document.querySelector(".battle-chain");
    const action = document.querySelector(".chain-attack-action");
    const marks = [...document.querySelectorAll(".chain-path-mark")];
    return {
      ready: chain?.classList.contains("is-ready") || false,
      name: chain?.querySelector(":scope > b")?.textContent.trim() || "",
      actionName: action?.querySelector("b")?.textContent.trim() || "",
      filled: marks.filter((mark) => !mark.classList.contains("is-empty")).length,
    };
  })()`);
  assertEqual(chainBattleReady.ready, true, "three distinct paths should make the formation ready");
  assertEqual(chainBattleReady.name, "天罡破军", "chain HUD should name the ready formation");
  assertEqual(chainBattleReady.actionName, "天罡破军", "chain command should expose the ready formation");
  assertEqual(chainBattleReady.filled, 3, "ready formation should show all three recorded paths");
  await captureVisualQaScreenshot("shuihu-chain-battle-ready.png");
  await evaluate(`(() => {
    window.__SHUIHU_DISABLE_BATTLE_TIMERS__ = true;
    document.querySelector(".chain-attack-action")?.click();
    return true;
  })()`);
  await waitFor('document.querySelector(".battle-result.combo") !== null');
  const chainResolved = await evaluate(`(() => ({
    result: document.querySelector(".battle-result.combo")?.innerText || "",
    saved: JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).chainArchive,
    screen: [...document.querySelector(".game-frame")?.classList || []],
  }))()`);
  assertEqual(chainResolved.result.includes("天罡破军"), true, "chain action should resolve the named formation");
  assertEqual(chainResolved.saved.length, 0, "chain archive should persist only after victory");
  assertEqual(chainResolved.screen.includes("screen-battle"), true, "combo result should remain visible for inspection");

  await evaluate(`(() => {
    window.__SHUIHU_DISABLE_BATTLE_TIMERS__ = false;
    document.querySelector("button[data-action=toggle-auto-battle]")?.click();
    return true;
  })()`);
  await waitForReward("star-chain manual formation");
  const chainReward = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    const strip = document.querySelector(".chain-unlock-strip");
    return {
      archive: save.chainArchive,
      strip: strip?.innerText || "",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(chainReward.archive.includes("sky_break"), true, "winning after the chain should archive the formation");
  assertEqual(chainReward.strip.includes("天罡破军"), true, "reward should call out the newly archived formation");
  assertEqual(chainReward.overflow, 0, "chain discovery reward should not overflow horizontally");

  await setSave(doctrineFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await clickMoreAction("nav-codex");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-codex")');
  await captureSteamScreenshot("05_star_codex.png");
  await click('button[data-action="codex-hero"][data-hero="linchong"]');
  const doctrinePanel = await evaluate(`(() => ({
    cards: document.querySelectorAll(".codex-doctrine").length,
    selected: document.querySelector(".codex-doctrine.is-selected b")?.textContent.trim() || null,
    heading: document.querySelector(".codex-doctrine-heading b")?.textContent.trim() || null,
  }))()`);
  assertEqual(doctrinePanel.cards, 2, "a completed hero should expose two doctrine paths");
  assertEqual(doctrinePanel.selected, "禁军铁壁", "the saved doctrine should be selected");
  assertEqual(doctrinePanel.heading, "可随时切换", "completed heroes should allow free doctrine switching");
  const achievementDashboard = await evaluate(`(() => {
    const rows = [...document.querySelectorAll(".achievement-row")];
    return {
      rows: rows.length,
      lockedProgress: rows.filter(
        (row) =>
          !row.classList.contains("is-unlocked") &&
          row.querySelector(".achievement-progress small")?.textContent.trim(),
      ).length,
      clipped: rows.filter((row) => row.scrollWidth > row.clientWidth + 1).length,
    };
  })()`);
  assertEqual(achievementDashboard.rows, ACHIEVEMENTS.length, "the codex should keep every achievement visible");
  assertEqual(
    achievementDashboard.lockedProgress > 0,
    true,
    "locked achievements should reveal their live counters",
  );
  assertEqual(achievementDashboard.clipped, 0, "achievement rows should not clip their progress content");
  await click(
    'button[data-action="choose-doctrine"][data-hero="linchong"][data-doctrine="snowblade"]',
  );
  const switchedDoctrine = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    return {
      saved: save.doctrines.linchong,
      selected: document.querySelector(".codex-doctrine.is-selected b")?.textContent.trim() || null,
      achievement: save.achievements.includes("doctrine_path"),
    };
  })()`);
  assertEqual(switchedDoctrine.saved, "snowblade", "doctrine switching should persist");
  assertEqual(switchedDoctrine.selected, "雪夜孤枪", "the selected doctrine should update immediately");
  assertEqual(switchedDoctrine.achievement, true, "choosing a doctrine should unlock its campaign record");

  await setViewport(390, 844, true);
  const mobileDoctrine = await evaluate(`(() => {
    const cards = [...document.querySelectorAll(".codex-doctrine")];
    const width = document.documentElement.clientWidth;
    return {
      cards: cards.length,
      outside: cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > width + 0.5;
      }).length,
      clipped: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      overflow: document.documentElement.scrollWidth - width,
    };
  })()`);
  assertEqual(mobileDoctrine.cards, 2, "mobile codex should keep both doctrine paths");
  assertEqual(mobileDoctrine.outside, 0, "mobile doctrine cards should stay inside the viewport");
  assertEqual(mobileDoctrine.clipped, 0, "mobile doctrine cards should not clip their text");
  assertEqual(mobileDoctrine.overflow, 0, "mobile doctrine cards should not overflow horizontally");
  await setViewport(1440, 900, false);

  await click("button[data-action=nav-map]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await click("button[data-action=enter-chapter]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  await click("button[data-action=story-skip]");
  await click('button[data-action="story-choice"][data-option="0"]');
  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  assertEqual(
    await evaluate('document.querySelector(".battle-doctrine-hud b")?.textContent.includes("林冲·雪夜孤枪")'),
    true,
    "battle HUD should surface the selected hero doctrine",
  );

  await setSave(heroQuestFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await click('button[data-action="nav-quests"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
  await click('button[data-action="quest-hero"][data-hero="linchong"]');
  const questBoardBefore = await evaluate(`(() => {
    const board = document.querySelector(".quest-board");
    const boardImage = document.querySelector(".quest-board-art img");
    const thumbs = [...document.querySelectorAll(".quest-hero-thumb img")];
    const cards = [...document.querySelectorAll(".quest-card")];
    const recruitmentCards = [...document.querySelectorAll(".recruitment-card")];
    const recruitmentArts = [...document.querySelectorAll(".recruitment-card-art img")];
    const legend = document.querySelector(".hero-legend-mission");
    const legendArt = document.querySelector(".hero-legend-mission-art");
    return {
      navItems: document.querySelectorAll(".topbar-nav .nav-button").length,
      moreActions: [...document.querySelectorAll(".more-nav button")]
        .map((button) => button.dataset.action),
      moreExpanded: document.querySelector('button[data-action="toggle-more-nav"]')
        ?.getAttribute("aria-expanded") || "false",
      heroButtons: document.querySelectorAll("button[data-action=quest-hero], button[data-action=locked-hero]").length,
      cards: cards.length,
      recruitmentCards: recruitmentCards.length,
      recruitmentCardsVisible: recruitmentCards.every(
        (card) => card.getBoundingClientRect().height > 1,
      ),
      recruitmentCardsContained: recruitmentArts.every(
        (image) =>
          getComputedStyle(image).objectFit === "contain" &&
          image.complete &&
          image.naturalWidth > 0,
      ),
      clippedRecruitments: recruitmentCards.filter(
        (card) => card.scrollWidth > card.clientWidth + 1,
      ).length,
      legendTitle: legend?.querySelector("h3")?.textContent.trim() || "",
      legendVisible: Boolean(legend && legend.getBoundingClientRect().height > 1),
      legendClipped: legend ? legend.scrollWidth > legend.clientWidth + 1 : true,
      legendArtCover: legendArt
        ? getComputedStyle(legendArt)
            .backgroundSize.split(",")
            .every((size) => size.trim() === "cover")
        : false,
      selectedHero: document.querySelector(".quest-board-copy h2")?.textContent.trim(),
      claimable: document.querySelectorAll("button[data-action=claim-hero-quest]").length,
      clippedCards: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      boardImageContained: boardImage ? getComputedStyle(boardImage).objectFit === "contain" : false,
      thumbContained: thumbs.every((image) => getComputedStyle(image).objectFit === "contain"),
      outside: board
        ? board.getBoundingClientRect().left < -0.5 ||
          board.getBoundingClientRect().right > innerWidth + 0.5
        : true,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(questBoardBefore.navItems, 5, "main navigation should keep five primary actions");
  await click('button[data-action="toggle-more-nav"]');
  await waitFor('document.querySelector(".more-nav")');
  const moreNavigation = await evaluate(`(() => ({
    actions: [...document.querySelectorAll(".more-nav button")]
      .map((button) => button.dataset.action),
    expanded: document.querySelector('button[data-action="toggle-more-nav"]')
      ?.getAttribute("aria-expanded"),
  }))()`);
  assertEqual(
    moreNavigation.actions.join(","),
    "nav-story-hub,nav-arena,nav-codex,nav-settings",
    "more menu should expose the full saga, arena, codex, and settings",
  );
  assertEqual(moreNavigation.expanded, "true", "more menu should expose its expanded state");
  await click('button[data-action="toggle-more-nav"]');
  await waitFor('!document.querySelector(".more-nav")');
  assertEqual(questBoardBefore.heroButtons, HERO_ORDER.length, "quest journal should list every hero");
  assertEqual(questBoardBefore.cards, 3, "each hero should show a three-stage quest chain");
  assertEqual(
    questBoardBefore.recruitmentCards > 0,
    true,
    "quest journal should expose available recruitment scrolls",
  );
  assertEqual(
    questBoardBefore.recruitmentCards <= Object.keys(HERO_RECRUITMENTS).length,
    true,
    "quest journal should not exceed the complete recruitment roster",
  );
  assertEqual(
    questBoardBefore.recruitmentCardsVisible,
    true,
    "recruitment scrolls should have a visible layout",
  );
  assertEqual(
    questBoardBefore.recruitmentCardsContained,
    true,
    "recruitment key art should preserve its aspect ratio",
  );
  assertEqual(
    questBoardBefore.clippedRecruitments,
    0,
    "recruitment cards should not clip horizontally",
  );
  assertEqual(
    questBoardBefore.legendVisible,
    true,
    "quest journal should expose the selected hero's legend battle",
  );
  assertEqual(
    questBoardBefore.legendTitle,
    HERO_LEGENDS.linchong.title,
    "Lin Chong's legend battle should open from the quest journal",
  );
  assertEqual(
    questBoardBefore.legendClipped,
    false,
    "the legend mission should not clip its objective or rewards",
  );
  assertEqual(
    questBoardBefore.legendArtCover,
    true,
    "legend environment art should crop proportionally instead of stretching",
  );
  assertEqual(questBoardBefore.selectedHero, "林冲", "quest journal should open on a recruited hero");
  assertEqual(questBoardBefore.claimable, 1, "completed unlocked quests should expose a claim button");
  assertEqual(questBoardBefore.clippedCards, 0, "quest cards should not clip their copy");
  assertEqual(questBoardBefore.boardImageContained, true, "quest key art should preserve its aspect ratio");
  assertEqual(questBoardBefore.thumbContained, true, "quest portraits should preserve their aspect ratio");
  assertEqual(questBoardBefore.outside, false, "quest board should stay inside the viewport");
  assertEqual(questBoardBefore.overflow, 0, "quest board should not overflow horizontally");

  await click('button[data-action="quest-hero"][data-hero="luzhishen"]');
  assertEqual(
    await evaluate('document.querySelector(".quest-board-copy h2")?.textContent.trim()'),
    "鲁智深",
    "quest journal should switch between hero stories",
  );
  await click('button[data-action="quest-hero"][data-hero="linchong"]');
  const questCopperBefore = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).inventory.copper`,
  );
  await click(
    'button[data-action="claim-hero-quest"][data-quest="linchong_old_tassel"]',
  );
  const firstQuestClaim = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    return {
      claimed: save.heroQuests.claimed,
      copper: save.inventory.copper,
      claimedCards: document.querySelectorAll(".quest-card.is-claimed").length,
      claimAllLabel: document.querySelector("button[data-action=claim-all-hero-quests]")?.innerText || "",
    };
  })()`);
  assertEqual(
    firstQuestClaim.claimed.includes("linchong_old_tassel"),
    true,
    "single quest claim should persist",
  );
  assertEqual(firstQuestClaim.copper, questCopperBefore + 180, "quest claim should pay its copper reward");
  assertEqual(firstQuestClaim.claimedCards, 1, "claimed quest cards should update immediately");
  assertEqual(firstQuestClaim.claimAllLabel.includes("一键领取 1"), true, "claim-all should count newly unlocked quests");

  await click('button[data-action="claim-all-hero-quests"]');
  await click('button[data-action="claim-all-hero-quests"]');
  const questBoardAfter = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    const cards = [...document.querySelectorAll(".quest-card")];
    return {
      claimed: save.heroQuests.claimed,
      copper: save.inventory.copper,
      claimedCards: document.querySelectorAll(".quest-card.is-claimed").length,
      boost: document.querySelector(".quest-board-meta")?.innerText.includes("+1.5%") || false,
      clippedCards: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(questBoardAfter.claimed.length, 3, "the full Lin Chong quest chain should be claimable");
  assertEqual(questBoardAfter.copper, questCopperBefore + 860, "the full quest chain should settle every reward");
  assertEqual(questBoardAfter.claimedCards, 3, "all completed quests should show their archive state");
  assertEqual(questBoardAfter.boost, true, "each quest should add a permanent 0.5% stat bonus");
  assertEqual(questBoardAfter.clippedCards, 0, "claimed quest cards should still avoid clipping");
  assertEqual(questBoardAfter.overflow, 0, "claimed quest board should remain inside the viewport");
  const heroQuestRegression = {
    heroes: questBoardBefore.heroButtons,
    quests: questBoardAfter.claimed.length,
    rewardCopper: questBoardAfter.copper - questCopperBefore,
    statBoost: "1.5%",
  };

  const linchongLegend = HERO_LEGENDS.linchong;
  if (postCampaignFocus) {
    const legendSave = await evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`,
    );
    legendSave.inventory[linchongLegend.reward.item] = 0;
    await setSave(legendSave);
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await clickText("续上旧卷");
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
    await click('button[data-action="nav-quests"]');
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
    await click('button[data-action="quest-hero"][data-hero="linchong"]');
  }
  await click(
    'button[data-action="start-hero-legend"][data-hero="linchong"]',
  );
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  assertEqual(
    await evaluate('document.querySelector(".story-chapter-mark b")?.textContent.trim()'),
    linchongLegend.title,
    "legend battle should open its dedicated story chapter",
  );
  await click("button[data-action=story-skip]");
  await waitFor('document.querySelector(".legend-ready")');
  const desktopLegendReady = await evaluate(`(() => {
    const panel = document.querySelector(".legend-ready");
    const rect = panel.getBoundingClientRect();
    return {
      title: panel.querySelector("h2")?.textContent.trim() || "",
      inside: rect.left >= -0.5 && rect.right <= innerWidth + 0.5,
      clipped: panel.scrollWidth > panel.clientWidth + 1,
      deployed: panel.querySelector(".legend-ready-meta")?.innerText.includes("林冲已入三阵") || false,
      reward: panel.querySelector(".legend-ready-meta")?.innerText.includes("禁军旧印") || false,
      rule: panel.querySelector(".legend-ready-rule")?.innerText || "",
    };
  })()`);
  assertEqual(desktopLegendReady.title, linchongLegend.title, "legend ready panel should name the battle");
  assertEqual(desktopLegendReady.inside, true, "legend ready panel should stay inside the desktop viewport");
  assertEqual(desktopLegendReady.clipped, false, "legend ready copy should not clip");
  assertEqual(desktopLegendReady.deployed, true, "starting a hero legend should deploy its protagonist");
  assertEqual(desktopLegendReady.reward, true, "legend ready panel should preview the unique reward");
  assertEqual(
    desktopLegendReady.rule.includes(linchongLegend.rule.name),
    true,
    "legend ready panel should explain its dedicated battle rule",
  );
  assertEqual(
    desktopLegendReady.rule.includes("半血"),
    true,
    "legend battle rule should expose its practical trigger",
  );

  await setViewport(390, 844, true);
  const mobileLegendReady = await evaluate(`(() => {
    const panel = document.querySelector(".legend-ready");
    const button = panel?.querySelector("button[data-action=story-to-battle]");
    const rect = panel?.getBoundingClientRect();
    const buttonRect = button?.getBoundingClientRect();
    return {
      width: innerWidth,
      outside: !rect || rect.left < -0.5 || rect.right > innerWidth + 0.5,
      clipped: !panel || panel.scrollWidth > panel.clientWidth + 1,
      buttonInside: Boolean(
        buttonRect &&
          buttonRect.left >= rect.left - 0.5 &&
          buttonRect.right <= rect.right + 0.5,
      ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(mobileLegendReady.width, 390, "mobile legend ready screen should use requested width");
  assertEqual(mobileLegendReady.outside, false, "mobile legend ready panel should stay inside the viewport");
  assertEqual(mobileLegendReady.clipped, false, "mobile legend ready copy should not clip");
  assertEqual(mobileLegendReady.buttonInside, true, "mobile legend launch button should remain fully visible");
  assertEqual(mobileLegendReady.overflow, 0, "mobile legend ready screen should not overflow horizontally");
  await setViewport(1440, 900, false);

  await click("button[data-action=story-to-battle]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  const legendBattleHud = await evaluate(`(() => {
    const hud = document.querySelector(".battle-legend-hud");
    const rect = hud?.getBoundingClientRect();
    return {
      text: hud?.innerText || "",
      visible: Boolean(rect && rect.height > 1),
      clipped: hud ? hud.scrollWidth > hud.clientWidth + 1 : true,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(
    legendBattleHud.visible,
    true,
    "legend battle should expose its dedicated rule in the combat HUD",
  );
  assertEqual(
    legendBattleHud.text.includes(linchongLegend.rule.name),
    true,
    "legend combat HUD should name the active battle rule",
  );
  assertEqual(
    legendBattleHud.clipped,
    false,
    "legend combat HUD should not clip its explicit rule",
  );
  assertEqual(
    legendBattleHud.overflow,
    0,
    "legend battle HUD should not overflow horizontally",
  );
  assertEqual(
    (await evaluate('document.querySelector(".auto-battle-toggle")?.innerText')) || "",
    "自动中",
    "legend battle should honor the persisted auto-battle setting",
  );
  assertEqual(
    await evaluate('document.querySelector(".battle-speed-control .is-selected")?.innerText'),
    "4x",
    "legend battle should honor the persisted 4x speed",
  );
  await setViewport(1280, 800, false);
  const legendDeckLayout = await evaluate(`(() => {
    const hud = document.querySelector(".battle-legend-hud");
    const field = document.querySelector(".battle-field");
    const hudRect = hud?.getBoundingClientRect();
    const fieldRect = field?.getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      hudInside: Boolean(
        hudRect &&
          hudRect.left >= -0.5 &&
          hudRect.right <= innerWidth + 0.5,
      ),
      fieldInside: Boolean(
        fieldRect &&
          fieldRect.left >= -0.5 &&
          fieldRect.right <= innerWidth + 0.5,
      ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(legendDeckLayout.width, 1280, "Steam Deck legend battle should use requested width");
  assertEqual(legendDeckLayout.height, 800, "Steam Deck legend battle should use requested height");
  assertEqual(legendDeckLayout.hudInside, true, "Steam Deck legend rule HUD should stay inside the viewport");
  assertEqual(legendDeckLayout.fieldInside, true, "Steam Deck legend battlefield should stay inside the viewport");
  assertEqual(legendDeckLayout.overflow, 0, "Steam Deck legend battle should not overflow horizontally");
  await setViewport(1440, 900, false);
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-reward")',
    45000,
  );
  const legendVictory = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    const panel = document.querySelector(".legend-reward-panel");
    return {
      completed: save.heroLegends.completed,
      itemCount: save.inventory[${JSON.stringify(linchongLegend.reward.item)}] || 0,
      panelVisible: Boolean(panel && panel.getBoundingClientRect().height > 0),
      panelTitle: panel?.querySelector("b")?.textContent.trim() || "",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(
    legendVictory.completed.includes(linchongLegend.id),
    true,
    "legend victory should persist the completed legend id",
  );
  assertEqual(
    legendVictory.itemCount,
    1,
    "legend victory should grant its unique equipment reward",
  );
  assertEqual(legendVictory.panelVisible, true, "legend victory should show its archive reward panel");
  assertEqual(legendVictory.panelTitle, linchongLegend.title, "legend reward should name the completed battle");
  assertEqual(legendVictory.overflow, 0, "legend reward screen should not overflow horizontally");

  await click("button[data-action=story-outro]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  await click("section.dialogue-panel[data-action=story-next]");
  await click("section.dialogue-panel[data-action=story-next]");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
  const legendArchive = await evaluate(`(() => {
    const card = document.querySelector(".hero-legend-mission.is-complete");
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
    return {
      complete: Boolean(card),
      title: card?.querySelector("h3")?.textContent.trim() || "",
      status: card?.querySelector(".hero-legend-action")?.innerText.trim() || "",
      selected: document.querySelector(".quest-board-copy h2")?.textContent.trim() || "",
      recorded: save.heroLegends.completed,
    };
  })()`);
  assertEqual(legendArchive.complete, true, "completed legend should return to the journal in archive state");
  assertEqual(legendArchive.title, linchongLegend.title, "completed legend archive should keep its title");
  assertEqual(legendArchive.status.includes("已载入群英列传"), true, "completed legend should show archive status");
  assertEqual(legendArchive.selected, "林冲", "legend completion should return to the protagonist's journal page");
  assertEqual(
    legendArchive.recorded.includes(linchongLegend.id),
    true,
    "legend completion should remain recorded after outro",
  );
  const legendRegression = {
    title: linchongLegend.title,
    auto: true,
    speed: 4,
    rewardItem: linchongLegend.reward.item,
    rule: linchongLegend.rule.id,
    deck: legendDeckLayout,
    mobileReady: mobileLegendReady,
  };

  const arenaFixture = campaignFixture();
  arenaFixture.arena.bestWave = 12;
  await setSave(arenaFixture);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await openNavScreen("nav-arena");
  assertEqual(
    await evaluate('document.querySelectorAll("button[data-action=select-arena-boon]").length'),
    3,
    "arena should offer three opening commands",
  );
  assertEqual(
    await evaluate('document.querySelectorAll("button[data-action=select-arena-boon].is-recommended").length'),
    1,
    "arena should mark one explainable advisor recommendation",
  );
  assertEqual(
    await evaluate('document.querySelectorAll("button[data-action=select-arena-mode]").length'),
    2,
    "arena should offer endless and weekly modes",
  );
  const starTrialOpening = await evaluate(`(() => ({
    cards: document.querySelectorAll("button[data-action=toggle-arena-trial]").length,
    unlocked: document.querySelectorAll("button[data-action=toggle-arena-trial]:not(:disabled)").length,
    selected: document.querySelectorAll("button[data-action=toggle-arena-trial].is-selected").length,
  }))()`);
  assertEqual(starTrialOpening.cards, 6, "arena should expose the full star trial ladder");
  assertEqual(starTrialOpening.unlocked, 4, "best wave 12 should unlock four star trials");
  await click('button[data-action="toggle-arena-trial"][data-trial="black_cloud"]');
  await click('button[data-action="toggle-arena-trial"][data-trial="iron_wall"]');
  await click('button[data-action="toggle-arena-trial"][data-trial="evil_wind"]');
  const starTrialSelected = await evaluate(`(() => ({
    selected: document.querySelectorAll("button[data-action=toggle-arena-trial].is-selected").length,
    capped: document.querySelector('button[data-action="toggle-arena-trial"][data-trial="cut_supply"]')?.disabled || false,
    start: document.querySelector("button[data-action=start-arena]")?.innerText || "",
    summary: document.querySelector(".arena-trial-record strong")?.innerText || "",
  }))()`);
  assertEqual(starTrialSelected.selected, 3, "arena should allow three star trials at once");
  assertEqual(starTrialSelected.capped, true, "a fourth star trial should be disabled at the cap");
  assertEqual(starTrialSelected.start.includes("3 道星劫"), true, "the deployment button should confirm star trial count");
  assertEqual(starTrialSelected.summary.includes("军功 +"), true, "the opening panel should explain star trial rewards");
  await click('button[data-action="select-arena-mode"][data-mode="weekly"]');
  assertEqual(
    await evaluate('Boolean(document.querySelector(".arena-week-card"))'),
    true,
    "weekly mode should explain its fixed rule and pools",
  );
  const weeklyOpeningEncounter = await evaluate(`(() => {
    const card = document.querySelector(".arena-encounter-preview");
    return {
      visible: Boolean(card),
      label: card?.querySelector("small")?.innerText || "",
      name: card?.querySelector("b")?.innerText || "",
      tactic: card?.querySelector("small")?.innerText.split("·").at(-1)?.trim() || "",
      score: card?.querySelector("em")?.innerText || "",
    };
  })()`);
  assertEqual(
    weeklyOpeningEncounter.visible,
    true,
    "arena should preview the first army encounter before deployment",
  );
  assertEqual(
    weeklyOpeningEncounter.label.includes("首阵军势"),
    true,
    "the opening encounter should state that it applies to the first wave",
  );
  assertEqual(
    weeklyOpeningEncounter.name.length > 0 &&
      weeklyOpeningEncounter.tactic.length > 0 &&
      weeklyOpeningEncounter.score.includes("军功"),
    true,
    "the opening encounter preview should expose its name, tactic, and score bonus",
  );
  const weeklyOpening = await evaluate(
    '[...document.querySelectorAll("button[data-action=select-arena-boon]")].map((button) => button.dataset.boon)',
  );
  await click('button[data-action="select-arena-mode"][data-mode="endless"]');
  await click('button[data-action="select-arena-mode"][data-mode="weekly"]');
  const weeklyOpeningRepeat = await evaluate(
    '[...document.querySelectorAll("button[data-action=select-arena-boon]")].map((button) => button.dataset.boon)',
  );
  assertEqual(
    await evaluate('document.querySelector(".arena-encounter-preview b")?.innerText || ""'),
    weeklyOpeningEncounter.name,
    "weekly mode should keep the same opening army encounter after mode switches",
  );
  assertEqual(
    weeklyOpeningRepeat.join(","),
    weeklyOpening.join(","),
    "weekly opening offer should not reroll after switching modes",
  );
  await click('button[data-action="select-arena-boon"]');
  await click('button[data-action="start-arena"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  assertEqual(
    await evaluate('Boolean(document.querySelector(".arena-bounty-hud"))'),
    true,
    "arena battle should show its military merit bounty",
  );
  const arenaBattleEncounter = await evaluate(`(() => {
    const hud = document.querySelector(".arena-encounter-hud");
    return {
      visible: Boolean(hud),
      label: hud?.querySelector("small")?.innerText || "",
      name: hud?.querySelector("b")?.innerText || "",
      text: hud?.innerText || "",
      inside: hud
        ? hud.getBoundingClientRect().left >= -0.5 &&
          hud.getBoundingClientRect().right <= innerWidth + 0.5
        : false,
      overflow: hud ? hud.scrollWidth - hud.clientWidth : 0,
      unreplacedIcons: document.querySelectorAll("i[data-lucide]").length,
    };
  })()`);
  assertEqual(
    arenaBattleEncounter.visible,
    true,
    "arena battle should show the active army encounter HUD",
  );
  assertEqual(
    arenaBattleEncounter.label.includes("演武军势") &&
      arenaBattleEncounter.text.includes("军功"),
    true,
    "the battle encounter HUD should repeat its tactic context and score bonus",
  );
  assertEqual(
    arenaBattleEncounter.inside,
    true,
    "the battle encounter HUD should stay inside the viewport",
  );
  assertEqual(
    arenaBattleEncounter.overflow,
    0,
    "the battle encounter HUD should not clip horizontally",
  );
  assertEqual(arenaBattleEncounter.unreplacedIcons, 0, "the opening arena battle should resolve every icon");
  const persistedArenaRun = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).arena.activeRun',
  );
  assertEqual(
    persistedArenaRun.mode,
    "weekly",
    "arena run should persist its weekly mode",
  );
  assertEqual(
    /^\d{4}-W\d{2}$/.test(persistedArenaRun.weekKey),
    true,
    "weekly run should persist its ISO week key",
  );
  assertEqual(persistedArenaRun.wave, 1, "arena run should persist its wave");
  assertEqual(
    Array.isArray(persistedArenaRun.boons) && persistedArenaRun.boons.length,
    1,
    "arena run should persist its opening command",
  );
  assertEqual(
    typeof persistedArenaRun.currentBounty,
    "string",
    "arena run should persist its current bounty",
  );
  assertEqual(
    Boolean(ARENA_ENCOUNTERS[persistedArenaRun.encounterId]),
    true,
    "arena run should persist a valid army encounter id",
  );
  assertEqual(
    persistedArenaRun.trialIds.join("|"),
    "black_cloud|iron_wall|evil_wind",
    "arena run should persist the selected star trials",
  );
  assertEqual(
    arenaBattleEncounter.name,
    ARENA_ENCOUNTERS[persistedArenaRun.encounterId].name,
    "the battle encounter HUD should name the persisted army encounter",
  );
  const arenaBattleTrials = await evaluate(`(() => {
    const hud = document.querySelector(".battle-trial-hud");
    return {
      visible: Boolean(hud),
      text: hud?.innerText || "",
      inside: hud
        ? hud.getBoundingClientRect().left >= -0.5 &&
          hud.getBoundingClientRect().right <= innerWidth + 0.5
        : false,
    };
  })()`);
  assertEqual(arenaBattleTrials.visible, true, "arena battle should show active star trials");
  assertEqual(
    ["黑云压城", "铁壁官阵", "夺气妖风"].every((name) =>
      arenaBattleTrials.text.includes(name),
    ),
    true,
    "star trial HUD should name every active risk rule",
  );
  assertEqual(arenaBattleTrials.inside, true, "star trial HUD should stay inside the viewport");
  await click('button[data-action="toggle-auto-battle"]');
  assertEqual(
    await evaluate(
      'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).settings.autoBattle',
    ),
    false,
    "the arena regression should be able to pause auto battle for layout inspection",
  );
  await setViewport(390, 844, true);
  await waitFor(
    'document.querySelectorAll(".arena-encounter-hud i[data-lucide]").length === 0',
  );
  const mobileArenaEncounter = await evaluate(`(() => {
    const hud = document.querySelector(".arena-encounter-hud");
    const field = document.querySelector(".battle-field");
    const rect = hud?.getBoundingClientRect();
    const visibleImages = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return box.width > 1 && box.height > 1 && style.display !== "none";
    });
    return {
      width: document.documentElement.clientWidth,
      visible: Boolean(hud && rect.height > 0),
      inside: rect
        ? rect.left >= -0.5 && rect.right <= document.documentElement.clientWidth + 0.5
        : false,
      fieldInside: field
        ? field.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5
        : false,
      unreplacedIcons: document.querySelectorAll("i[data-lucide]").length,
      brokenImages: visibleImages.filter(
        (image) => !image.complete || image.naturalWidth <= 0,
      ).length,
      stretchedImages: visibleImages.filter((image) => {
        if (getComputedStyle(image).objectFit !== "fill") return false;
        const box = image.getBoundingClientRect();
        const naturalRatio =
          image.naturalWidth / Math.max(1, image.naturalHeight);
        const renderedRatio = box.width / Math.max(1, box.height);
        return (
          Math.abs(naturalRatio - renderedRatio) /
            Math.max(naturalRatio, renderedRatio) >
          0.025
        );
      }).length,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(
    mobileArenaEncounter.width,
    390,
    "arena encounter HUD should render at mobile width",
  );
  assertEqual(
    mobileArenaEncounter.visible,
    true,
    "mobile arena battle should retain its encounter HUD",
  );
  assertEqual(
    mobileArenaEncounter.inside && mobileArenaEncounter.fieldInside,
    true,
    "mobile encounter HUD and battlefield should stay inside the viewport",
  );
  assertEqual(
    mobileArenaEncounter.unreplacedIcons,
    0,
    "mobile encounter HUD should resolve every Lucide icon",
  );
  assertEqual(
    mobileArenaEncounter.brokenImages,
    0,
    "mobile arena battle should not show broken artwork",
  );
  assertEqual(
    mobileArenaEncounter.stretchedImages,
    0,
    "mobile arena battle should preserve every artwork aspect ratio",
  );
  assertEqual(
    mobileArenaEncounter.overflow,
    0,
    "mobile arena battle should not overflow horizontally",
  );
  await setViewport(1440, 900, false);
  await click('button[data-action="toggle-auto-battle"]');
  assertEqual(
    await evaluate(
      'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).settings.autoBattle',
    ),
    true,
    "the arena regression should resume auto battle after layout inspection",
  );
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")',
    35000,
  );
  const arenaReward = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      summaryCount: document.querySelectorAll(".arena-run-summary > span").length,
      hasBountyResult: Boolean(document.querySelector(".arena-bounty-result")),
      hasBattleReport: Boolean(document.querySelector(".arena-battle-report")),
      hasTrialStrip: Boolean(document.querySelector(".arena-trial-strip")),
      trialStripText: document.querySelector(".arena-trial-strip")?.innerText || "",
      hasNextFormation: Boolean(document.querySelector(".arena-build-next")),
      nextFormation: document.querySelector(".arena-build-next")?.innerText || "",
      recommendationCount: document.querySelectorAll(".arena-boon.is-recommended").length,
      hasAdviceAction: Boolean(document.querySelector("button[data-action=follow-arena-advice]")),
      score: save.arena.activeRun?.score || 0,
      starTrials: save.arena.starTrials,
      bountySettled: Boolean(save.arena.activeRun?.lastBounty),
      lastEncounterLabel:
        document.querySelector(".arena-victory-copy .arena-encounter-preview small")
          ?.innerText || "",
      lastEncounterName:
        document.querySelector(".arena-victory-copy .arena-encounter-preview b")
          ?.innerText || "",
      nextEncounterLabel:
        document.querySelector(".arena-reward-options .arena-encounter-preview small")
          ?.innerText || "",
      nextEncounterName:
        document.querySelector(".arena-reward-options .arena-encounter-preview b")
          ?.innerText || "",
      encounterDiscovery:
        save.arena.discoveries?.encounters?.includes(
          save.arena.activeRun?.encounterId,
        ) || false,
      lastEncounterDiscovery:
        save.arena.activeRun?.lastDiscoveries?.encounters?.includes(
          save.arena.activeRun?.encounterId,
        ) || false,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(arenaReward.summaryCount, 4, "arena reward should show wave, score, commands, and best score");
  assertEqual(arenaReward.hasBountyResult, true, "arena reward should settle the wave bounty");
  assertEqual(arenaReward.hasBattleReport, true, "arena reward should show the tactical battle report");
  assertEqual(arenaReward.hasTrialStrip, true, "arena reward should keep the active star trial rules visible");
  assertEqual(
    arenaReward.trialStripText.includes("星劫 3 道"),
    true,
    "arena reward should summarize the three active star trials",
  );
  assertEqual(arenaReward.hasNextFormation, true, "arena reward should point to the nearest unfinished formation");
  assertEqual(arenaReward.nextFormation.includes("下一阵"), true, "the formation goal should name its immediate payoff");
  assertEqual(arenaReward.recommendationCount, 1, "arena reward should mark the advisor recommendation");
  assertEqual(arenaReward.hasAdviceAction, true, "arena reward should offer a one-click advisor continuation");
  assertEqual(arenaReward.score > 0, true, "a cleared arena wave should award military merit");
  assertEqual(
    arenaReward.starTrials.bestWave >= 1 &&
      arenaReward.starTrials.bestScore >= arenaReward.score &&
      arenaReward.starTrials.maxSelected === 3,
    true,
    "star trial progress should record its wave, score, and selected count",
  );
  assertEqual(arenaReward.bountySettled, true, "arena reward should persist the bounty result");
  assertEqual(
    arenaReward.lastEncounterLabel.includes("本阵军势"),
    true,
    "the arena reward should name the army encounter that was just defeated",
  );
  assertEqual(
    arenaReward.lastEncounterName,
    ARENA_ENCOUNTERS[persistedArenaRun.encounterId].name,
    "the arena reward should preserve the defeated army encounter",
  );
  assertEqual(
    arenaReward.nextEncounterLabel.includes("下一阵军势") &&
      arenaReward.nextEncounterName.length > 0,
    true,
    "the arena reward should preview the next army encounter",
  );
  assertEqual(
    arenaReward.nextEncounterName !== arenaReward.lastEncounterName,
    true,
    "the next arena encounter should avoid immediately repeating the current one",
  );
  assertEqual(
    arenaReward.encounterDiscovery && arenaReward.lastEncounterDiscovery,
    true,
    "cleared army encounters should persist in both the archive and last-wave record",
  );
  assertEqual(arenaReward.overflow, 0, "arena reward should not overflow horizontally");
  const offerBeforeReroll = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).arena.activeRun.pendingBoons',
  );
  await click('button[data-action="reroll-arena-boons"]');
  const rerolledOffer = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      pending: save.arena.activeRun.pendingBoons,
      rerollUsed: save.arena.activeRun.rerollUsed,
      disabled: document.querySelector("button[data-action=reroll-arena-boons]")?.disabled,
      cards: [...document.querySelectorAll("button[data-action=choose-arena-reward]")].map(
        (button) => button.dataset.boon,
      ),
      toast: document.querySelector(".toast")?.innerText || "",
    };
  })()`);
  assertEqual(
    rerolledOffer.pending.join("|") !== offerBeforeReroll.join("|"),
    true,
    "the army advisor should replace the current three-command offer",
  );
  assertEqual(
    rerolledOffer.cards.join("|"),
    rerolledOffer.pending.join("|"),
    "the visible rerolled cards should match the persisted pending offer",
  );
  assertEqual(rerolledOffer.rerollUsed, true, "reroll use should persist on the arena run");
  assertEqual(rerolledOffer.disabled, true, "each arena run should allow only one reroll");
  assertEqual(
    rerolledOffer.toast.includes("军师已重排"),
    true,
    "rerolling should explain how many commands were replaced",
  );

  await setViewport(390, 844, true);
  const mobileArenaReward = await evaluate(`(() => {
    const width = document.documentElement.clientWidth;
    const report = document.querySelector(".arena-battle-report");
    const layout = document.querySelector(".arena-reward-layout");
    const panels = [
      document.querySelector(".arena-grade"),
      document.querySelector(".arena-report-copy"),
      document.querySelector(".arena-mvp"),
    ].filter(Boolean);
    const actionable = [
      ...document.querySelectorAll(".arena-reward-options .arena-boon"),
      document.querySelector("button[data-action=follow-arena-advice]"),
      document.querySelector("button[data-action=reroll-arena-boons]"),
    ].filter(Boolean);
    const overlaps = [];
    for (let index = 0; index < panels.length; index += 1) {
      for (let other = index + 1; other < panels.length; other += 1) {
        const a = panels[index].getBoundingClientRect();
        const b = panels[other].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        ) {
          overlaps.push([index, other]);
        }
      }
    }
    const visibleImages = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 1 && rect.height > 1 && style.display !== "none";
    });
    return {
      width,
      documentHeight: document.documentElement.scrollHeight,
      reportVisible: Boolean(report && report.getBoundingClientRect().height > 0),
      layoutOutside: layout
        ? layout.getBoundingClientRect().left < -0.5 ||
          layout.getBoundingClientRect().right > width + 0.5
        : true,
      clippedActionable: actionable.filter(
        (node) => node.scrollWidth > node.clientWidth + 1,
      ).length,
      overlaps: overlaps.length,
      brokenImages: visibleImages.filter(
        (image) => !image.complete || image.naturalWidth <= 0,
      ).length,
      stretchedImages: visibleImages.filter((image) => {
        if (getComputedStyle(image).objectFit !== "fill") return false;
        const rect = image.getBoundingClientRect();
        const naturalRatio =
          image.naturalWidth / Math.max(1, image.naturalHeight);
        const renderedRatio = rect.width / Math.max(1, rect.height);
        return (
          Math.abs(naturalRatio - renderedRatio) /
            Math.max(naturalRatio, renderedRatio) >
          0.025
        );
      }).length,
      overflow: document.documentElement.scrollWidth - width,
    };
  })()`);
  assertEqual(mobileArenaReward.width, 390, "arena reward should render at 390px");
  assertEqual(mobileArenaReward.reportVisible, true, "mobile arena reward should keep its battle report visible");
  assertEqual(mobileArenaReward.layoutOutside, false, "mobile arena reward should stay inside the viewport");
  assertEqual(mobileArenaReward.clippedActionable, 0, "mobile reward actions should not clip their labels");
  assertEqual(mobileArenaReward.overlaps, 0, "mobile battle report panels should not overlap");
  assertEqual(mobileArenaReward.brokenImages, 0, "mobile arena reward should not show broken artwork");
  assertEqual(mobileArenaReward.stretchedImages, 0, "mobile arena reward should preserve image aspect ratios");
  assertEqual(mobileArenaReward.overflow, 0, "mobile arena reward should not overflow horizontally");
  const mobileArenaScreenshot = await socket.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: 390,
      height: Math.min(mobileArenaReward.documentHeight, 2400),
      scale: 1,
    },
  });
  const mobileArenaScreenshotPath = "/tmp/shuihu-arena-reward-mobile.png";
  await writeFile(
    mobileArenaScreenshotPath,
    Buffer.from(mobileArenaScreenshot.data, "base64"),
  );
  await setViewport(1440, 900, false);

  await socket.send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await openNavScreen("nav-arena");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena")');
  assertEqual(
    await evaluate('document.body.innerText.includes("本周军令")'),
    true,
    "arena should offer the persisted run after a restart",
  );
  assertEqual(
    await evaluate('document.querySelectorAll(".arena-record > span").length'),
    4,
    "arena record should include wave, score, bounties, and run count",
  );
  await click('button[data-action="resume-arena"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")');
  assertEqual(
    await evaluate('document.querySelectorAll("button[data-action=choose-arena-reward]").length'),
    3,
    "a persisted reward choice should reopen instead of skipping the next boon",
  );

  await setSave(arenaEventFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await openNavScreen("nav-arena");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena")');
  await click('button[data-action="resume-arena"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")');
  assertEqual(
    await evaluate('document.querySelectorAll("i[data-lucide]").length'),
    0,
    "event reward should resolve every selected Lucide icon",
  );
  assertEqual(
    await evaluate("document.documentElement.dataset.uiScale"),
    "largest",
    "event reward should apply the persisted largest UI scale",
  );
  assertEqual(
    await evaluate("document.documentElement.dataset.contrast"),
    "high",
    "event reward should apply the persisted high-contrast theme",
  );
  assertEqual(
    await evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)"),
    18.4,
    "largest UI scale should raise the root text size without scaling artwork",
  );
  const eventChoice = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      cards: document.querySelectorAll("button[data-action=choose-arena-event]").length,
      disabledBoons: document.querySelectorAll("button[data-action=choose-arena-reward]:disabled").length,
      score: save.arena.activeRun.score,
      copper: save.inventory.copper,
      health: save.arena.activeRun.healthRatios,
    };
  })()`);
  assertEqual(eventChoice.cards, 3, "every third wave should offer three inter-wave events");
  assertEqual(eventChoice.disabledBoons, 3, "boons should wait until an inter-wave event is chosen");
  await click('button[data-action="choose-arena-event"][data-event="raid"]');
  const afterEvent = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      selected: save.arena.activeRun.selectedEvent,
      score: save.arena.activeRun.score,
      copper: save.inventory.copper,
      health: save.arena.activeRun.healthRatios,
      disabledBoons: document.querySelectorAll("button[data-action=choose-arena-reward]:disabled").length,
    };
  })()`);
  assertEqual(afterEvent.selected, "raid", "event choice should persist on the arena run");
  assertEqual(afterEvent.score > eventChoice.score, true, "risky event should award immediate merit");
  assertEqual(
    afterEvent.copper >= eventChoice.copper + 80,
    true,
    "raiding the supply line should award copper",
  );
  assertEqual(
    afterEvent.health.likui < eventChoice.health.likui,
    true,
    "raiding the supply line should cost current health",
  );
  assertEqual(afterEvent.disabledBoons, 0, "boons should unlock after the event is chosen");
  await click('button[data-action="choose-arena-reward"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-battle")');
  const afterEventLaunch = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).arena.activeRun',
  );
  assertEqual(afterEventLaunch.wave, 4, "event choice should launch the next arena wave");
  assertEqual(afterEventLaunch.boons.length, 3, "the post-wave command should be added after the event");
  assertEqual(afterEventLaunch.lastEvent, "raid", "the chosen event should remain recorded for the next wave");
  assertEqual(afterEventLaunch.eventOffer.length, 0, "settled events should not be offered twice");

  await setSave(arenaAutoFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await openNavScreen("nav-arena");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena")');
  await click('button[data-action="resume-arena"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")');
  assertEqual(
    await evaluate('document.querySelector("button[data-action=toggle-arena-auto]")?.getAttribute("aria-pressed")'),
    "true",
    "arena reward should expose the persisted auto-continue setting",
  );
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-battle")',
    5000,
  );
  const autoContinuedRun = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).arena.activeRun',
  );
  assertEqual(autoContinuedRun.wave, 2, "arena auto-continue should launch the pending wave");
  assertEqual(autoContinuedRun.pendingBoons.length, 0, "auto-continue should consume the reward choice");
  assertEqual(autoContinuedRun.boons.length, 2, "auto-continue should add the advisor recommendation");

  const autoEventState = arenaEventFixture();
  autoEventState.settings.autoArena = true;
  autoEventState.settings.autoBattle = true;
  autoEventState.settings.battleSpeed = 4;
  await setSave(autoEventState);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await openNavScreen("nav-arena");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena")');
  await click('button[data-action="resume-arena"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")');
  await new Promise((resolve) => setTimeout(resolve, 1800));
  assertEqual(
    await evaluate('document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")'),
    true,
    "auto-continue should wait while an inter-wave event is undecided",
  );
  assertEqual(
    await evaluate('document.querySelector("button[data-action=toggle-arena-auto]")?.innerText.includes("奇遇待决")'),
    true,
    "auto-continue should explain why it paused for the event",
  );
  await click('button[data-action="choose-arena-event"][data-event="feast"]');
  await waitFor(
    'document.querySelector(".game-frame")?.classList.contains("screen-battle")',
    5000,
  );
  const autoEventRun = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).arena.activeRun',
  );
  assertEqual(autoEventRun.lastEvent, "feast", "event decision should persist before auto-continue");
  assertEqual(autoEventRun.pendingBoons.length, 0, "auto-continue should resume after the event decision");

  await setSave(arenaEventFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await openNavScreen("nav-arena");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena")');
  await click('button[data-action="resume-arena"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena-reward")');
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 1,
    mobile: true,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const mobileEventLayout = await evaluate(`(() => {
    const width = document.documentElement.clientWidth;
    const cards = [...document.querySelectorAll(".arena-event-card")];
    const boons = [...document.querySelectorAll(".arena-reward-options .arena-boon")];
    const documentHeight = document.documentElement.scrollHeight;
    return {
      width,
      documentHeight,
      innerHeight,
      cards: cards.length,
      clipped: cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > width + 0.5;
      }).length,
      outOfFlow: [...cards, ...boons].filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.top + scrollY + rect.height > documentHeight + 1;
      }).length,
      overflow: document.documentElement.scrollWidth - width,
    };
  })()`);
  assertEqual(mobileEventLayout.width, 390, "event reward should render at 390px");
  assertEqual(mobileEventLayout.cards, 3, "mobile event reward should keep all three choices");
  assertEqual(mobileEventLayout.clipped, 0, "mobile event cards should stay within the viewport");
  assertEqual(
    mobileEventLayout.documentHeight > mobileEventLayout.innerHeight,
    true,
    "mobile event reward should remain vertically scrollable",
  );
  assertEqual(
    mobileEventLayout.outOfFlow,
    0,
    "mobile event and boon choices should contribute to the document height",
  );
  assertEqual(mobileEventLayout.overflow, 0, "mobile event reward should not overflow horizontally");
  await socket.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    screenWidth: 1440,
    screenHeight: 900,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
    dontSetVisibleSize: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  await setSave(newGamePlusFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-ending")');
  const endingRouteGuide = await evaluate(`(() => ({
    goals: document.querySelectorAll(".ending-letter .route-goal").length,
    collectionRows: document.querySelectorAll(".ending-collection-record span").length,
    hasNextChoices: [...document.querySelectorAll(".ending-letter .route-goal")]
      .every((goal) => Boolean(goal.dataset.action)),
  }))()`);
  assertEqual(endingRouteGuide.goals, 3, "the ending should offer three concrete continuation paths");
  assertEqual(endingRouteGuide.collectionRows, 6, "the ending should show the six long-term collection tracks");
  assertEqual(endingRouteGuide.hasNextChoices, true, "every ending continuation path should be actionable");
  await clickText("携星图重开");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  const newCycle = await evaluate(
    'JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"))',
  );
  assertEqual(newCycle.newGamePlus, 1, "New Game+ counter should advance");
  assertEqual(newCycle.settings.battleSpeed, 4, "battle speed should survive New Game+");
  assertEqual(newCycle.settings.autoTactic, "hunter", "auto tactic should survive New Game+");
  assertEqual(newCycle.settings.musicVolume, 42, "music volume should survive New Game+");
  assertEqual(newCycle.arena.bestWave, 20, "arena record should survive New Game+");
  assertEqual(
    newCycle.bondArchive.includes("wind_snow") &&
      newCycle.bondArchive.includes("three_mountains"),
    true,
    "hero bond archive should survive New Game+",
  );
  assertEqual(
    newCycle.chapterMedals.ferry.length,
    2,
    "chapter medals should survive New Game+",
  );
  assertEqual(newCycle.achievements.includes("ten_stands"), true, "achievements should survive");
  assertEqual(
    newCycle.heroMastery.linchong.trials.length,
    HERO_TRIALS.length,
    "mastery should survive New Game+",
  );
  assertEqual(
    newCycle.doctrines.linchong,
    "snowblade",
    "hero doctrine should survive New Game+",
  );
  assertEqual(
    newCycle.heroQuests.claimed.includes("linchong_old_tassel"),
    true,
    "hero quest archive and mastery should survive New Game+",
  );
  assertEqual(
    newCycle.heroLegends.completed.includes(HERO_LEGENDS.linchong.id),
    true,
    "hero legend archive should survive New Game+",
  );

  await setSave(campaignFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await clickMoreAction("nav-settings");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-settings")');
  await click('button[data-action="ui-scale"][data-scale="largest"]');
  await click('button[data-action="toggle-contrast"]');
  const accessibilitySettings = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    const cards = [...document.querySelectorAll(".settings-card")];
    return {
      uiScale: save.settings.uiScale,
      highContrast: save.settings.highContrast,
      datasetScale: document.documentElement.dataset.uiScale,
      datasetContrast: document.documentElement.dataset.contrast,
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
      headingTitleLines: (() => {
        const title = document.querySelector(".settings-heading h1");
        const range = document.createRange();
        range.selectNodeContents(title);
        return range.getClientRects().length;
      })(),
      clippedCards: cards.filter(
        (card) => card.scrollWidth > card.clientWidth + 1,
      ).length,
      tacticChoices: document.querySelectorAll(
        ".auto-tactic-choice button[data-action='auto-tactic']",
      ).length,
      selectedTactics: document.querySelectorAll(
        ".auto-tactic-choice button.is-selected",
      ).length,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  })()`);
  assertEqual(accessibilitySettings.uiScale, "largest", "UI scale setting should persist");
  assertEqual(accessibilitySettings.highContrast, true, "high contrast setting should persist");
  assertEqual(accessibilitySettings.datasetScale, "largest", "UI scale should apply immediately");
  assertEqual(accessibilitySettings.datasetContrast, "high", "high contrast should apply immediately");
  assertEqual(accessibilitySettings.rootFont, 18.4, "largest UI scale should update root text size");
  assertEqual(accessibilitySettings.headingTitleLines, 1, "largest UI scale should keep the settings title on one line");
  assertEqual(accessibilitySettings.clippedCards, 0, "largest UI scale should not clip settings cards");
  assertEqual(accessibilitySettings.tacticChoices, 4, "settings should expose all four auto tactics");
  assertEqual(accessibilitySettings.selectedTactics, 1, "settings should mark exactly one auto tactic as selected");
  assertEqual(accessibilitySettings.overflow, 0, "largest UI scale should not overflow horizontally");

  const audioMixBeforeMute = await evaluate(`(() => {
    const setRange = (key, value) => {
      const input = document.querySelector(
        \`[data-volume-setting="\${key}"]\`,
      );
      if (!input) return false;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    return {
      ranges: [setRange("musicVolume", 27), setRange("sfxVolume", 63)],
      save: JSON.parse(localStorage.getItem("xingming-shuihu-save-v1")).settings,
      musicDataset: document.documentElement.dataset.musicVolume,
      sfxDataset: document.documentElement.dataset.sfxVolume,
    };
  })()`);
  assertEqual(
    audioMixBeforeMute.ranges.every(Boolean),
    true,
    "settings should expose music and sound-effect volume sliders",
  );
  assertEqual(audioMixBeforeMute.save.musicVolume, 27, "music volume should persist on change");
  assertEqual(audioMixBeforeMute.save.sfxVolume, 63, "sound-effect volume should persist on change");
  assertEqual(audioMixBeforeMute.musicDataset, "0.27", "music volume should apply immediately");
  assertEqual(audioMixBeforeMute.sfxDataset, "0.63", "sound-effect volume should apply immediately");
  await click('button[data-action="toggle-sound"]');
  const mutedAudio = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      sound: save.settings.sound,
      audio: document.documentElement.dataset.audio,
    };
  })()`);
  assertEqual(mutedAudio.sound, false, "global mute should persist");
  assertEqual(mutedAudio.audio, "off", "global mute should stop the audio engine");

  await socket.send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await clickMoreAction("nav-settings");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-settings")');
  const restoredAudio = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      sound: save.settings.sound,
      music: Number(document.querySelector(
        '[data-volume-setting="musicVolume"]',
      )?.value),
      sfx: Number(document.querySelector(
        '[data-volume-setting="sfxVolume"]',
      )?.value),
      outputs: [...document.querySelectorAll(".volume-controls output")]
        .map((output) => output.value),
      audio: document.documentElement.dataset.audio,
    };
  })()`);
  assertEqual(restoredAudio.sound, false, "reload should retain the muted state");
  assertEqual(restoredAudio.music, 27, "reload should retain music volume");
  assertEqual(restoredAudio.sfx, 63, "reload should retain sound-effect volume");
  assertEqual(
    restoredAudio.outputs.join(","),
    "27%,63%",
    "reload should render the saved volume values",
  );
  assertEqual(restoredAudio.audio, "off", "reload should keep the audio engine muted");
  await evaluate(`(() => {
    window.__audioPlaySamples = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__audioPlaySamples.push({
        loop: Boolean(this.loop),
        src: this.currentSrc || this.src || "",
      });
      return originalPlay.call(this);
    };
    return true;
  })()`);
  await click('button[data-action="toggle-sound"]');
  const audioPlayback = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem("xingming-shuihu-save-v1"));
    return {
      sound: save.settings.sound,
      audio: document.documentElement.dataset.audio,
      samples: window.__audioPlaySamples || [],
    };
  })()`);
  assertEqual(audioPlayback.sound, true, "unmute should persist");
  assertEqual(audioPlayback.audio, "on", "unmute should restart the audio engine");
  assertEqual(
    audioPlayback.samples.length > 0,
    true,
    "unmute should restart the current scene track",
  );
  assertEqual(
    audioPlayback.samples.some(
      (sample) =>
        sample.loop === true && sample.src.includes("/assets/audio/"),
    ),
    true,
    "restarted music should use a looping runtime audio asset",
  );
  const audioSettings = {
    musicVolume: restoredAudio.music,
    sfxVolume: restoredAudio.sfx,
    mutePersisted: true,
    mutedAcrossReload: true,
    unmuteRestartedLoopingTrack: true,
  };

  const rawBeforeExport = await evaluate(
    `localStorage.getItem(${JSON.stringify(SAVE_KEY)})`,
  );
  const exportedSave = await evaluate(`(async () => {
    let capturedBlob = null;
    let capturedName = "";
    const originalCreateObjectURL = URL.createObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => {
      capturedBlob = blob;
      return "blob:e2e-save-export";
    };
    HTMLAnchorElement.prototype.click = function () {
      capturedName = this.download;
    };
    document.querySelector('button[data-action="export-save"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    URL.createObjectURL = originalCreateObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
    return capturedBlob
      ? { name: capturedName, text: await capturedBlob.text() }
      : null;
  })()`);
  assertEqual(Boolean(exportedSave), true, "save export should create a JSON file");
  assertEqual(exportedSave.name.endsWith(".json"), true, "exported save should use a JSON filename");
  const exportedState = JSON.parse(exportedSave.text);
  assertEqual(exportedState.currentChapter, 4, "exported save should preserve chapter progress");
  assertEqual(exportedState.recruited.length, HERO_ORDER.length, "exported save should preserve recruitment");

  await evaluate(`(() => {
    const input = document.querySelector("[data-save-import]");
    const file = new File(["{broken"], "broken-save.json", { type: "application/json" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 220));
  const invalidImport = await evaluate(`({
    save: localStorage.getItem(${JSON.stringify(SAVE_KEY)}),
    modal: Boolean(document.querySelector("[data-modal-panel]")),
    toast: document.querySelector(".toast")?.innerText || "",
  })`);
  assertEqual(invalidImport.save, rawBeforeExport, "invalid import should not overwrite the current save");
  assertEqual(invalidImport.modal, false, "invalid import should not open the replacement confirmation");
  assertEqual(invalidImport.toast.includes("损坏"), true, "invalid import should explain the save is damaged");

  const importedState = JSON.parse(rawBeforeExport);
  importedState.inventory.copper = 12345;
  importedState.lastSavedAt = "2026-10-18T12:00:00.000Z";
  const importedRaw = JSON.stringify(importedState);
  await evaluate(`(() => {
    const input = document.querySelector("[data-save-import]");
    const file = new File([${JSON.stringify(importedRaw)}], "imported-save.json", { type: "application/json" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor('Boolean(document.querySelector("[data-modal-panel]"))');
  assertEqual(
    await evaluate('document.querySelector("[data-modal-panel]")?.innerText.includes("载入这份战卷")'),
    true,
    "valid import should ask before replacing the current save",
  );
  await click('button[data-action="confirm-save-import"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  const importedPersistence = await evaluate(`({
    active: JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})),
    backup: JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_BACKUP_KEY)})),
  })`);
  assertEqual(importedPersistence.active.inventory.copper, 12345, "valid import should replace the active save");
  assertEqual(importedPersistence.backup.currentChapter, 4, "valid import should retain the replaced save as a safety copy");

  await evaluate(
    `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, "{corrupted-primary-save")`,
  );
  await socket.send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  assertEqual(
    await evaluate('document.querySelector("[data-action=continue-game]")?.innerText.includes("续上旧卷")'),
    true,
    "title should offer recovery when the primary save is corrupted",
  );
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  assertEqual(
    await evaluate('document.querySelector(".chapter-focus")?.innerText.includes("清风寨月箭")'),
    true,
    "corrupted primary save should recover the backed-up chapter",
  );
  const saveLifecycle = {
    exportName: exportedSave.name,
    invalidImportRejected: true,
    importedCopper: importedPersistence.active.inventory.copper,
    backupChapter: importedPersistence.backup.currentChapter,
    corruptPrimaryRecovered: true,
  };
  const securityHardening = {
    csp: true,
    thirdPartyNotices: true,
    legalDocuments: true,
    permissionRequestsDenied: true,
  };

  const releaseLayouts = [];
  const releaseFixture = campaignFixture();
  releaseFixture.settings.uiScale = "largest";
  releaseFixture.settings.highContrast = true;
  await setSave(releaseFixture);
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  const releaseViewports = [
    ["1080p", 1920, 1080, false],
    ["1440p", 2560, 1440, false],
    ["4K", 3840, 2160, false],
    ["16:10", 1680, 1050, false],
    ["steamDeck", 1280, 800, false],
    ["mobile", 390, 844, true],
  ];
  const assertPageScrolling = (layout, label, mobile) => {
    assertEqual(layout.overflow, 0, `${label} should not overflow horizontally`);
    if (!mobile) {
      assertEqual(
        layout.documentHeight,
        layout.height,
        `${label} should keep page scrolling out of the desktop viewport`,
      );
    }
  };
  for (const [name, width, height, mobile] of releaseViewports) {
    await setViewport(width, height, mobile);
    const layout = await evaluate(`(() => {
      const main = document.querySelector(".map-layout");
      const topbar = document.querySelector(".topbar");
      const mainRect = main?.getBoundingClientRect();
      const topbarRect = topbar?.getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOutside: mainRect
          ? mainRect.left < -0.5 || mainRect.right > innerWidth + 0.5
          : true,
        topbarOutside: topbarRect
          ? topbarRect.left < -0.5 || topbarRect.right > innerWidth + 0.5
          : true,
        chapters: document.querySelectorAll("button[data-action=select-chapter]").length,
      };
    })()`);
    assertEqual(layout.width, width, `${name} map should use requested viewport width`);
    assertEqual(layout.height, height, `${name} map should use requested viewport height`);
    assertPageScrolling(layout, `${name} map`, mobile);
    assertEqual(layout.mainOutside, false, `${name} map should stay inside the viewport`);
    assertEqual(layout.topbarOutside, false, `${name} top bar should stay inside the viewport`);
    assertEqual(layout.chapters, CHAPTERS.length, `${name} map should expose every chapter`);
    releaseLayouts.push({ screen: "map", name, ...layout });
  }

  await setViewport(1440, 900, false);
  if (!(await evaluate('document.querySelector(".game-frame")?.classList.contains("screen-story-hub")'))) {
    await openNavScreen("nav-story-hub");
  }
  await click('button[data-action="enter-story-memory"][data-chapter="stone_tablet"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story")');
  const archiveStoryControls = await evaluate(`(() => ({
    skip: document.querySelector('button[data-action="story-skip"]')?.textContent.includes("跳过开卷") || false,
    title: document.querySelector(".story-chapter-mark b")?.textContent.trim() || "",
    bg: getComputedStyle(document.querySelector(".story-screen")).getPropertyValue("--story-bg").trim(),
  }))()`);
  assertEqual(archiveStoryControls.skip, true, "story hub should mark the entering narrative as an archive replay");
  assertEqual(archiveStoryControls.title, STORY_ARCHIVE_CHAPTERS[0].title, "story hub should open the selected saga chapter");
  assertEqual(archiveStoryControls.bg.includes("longhu_mountain.png"), true, "story hub should use the saga chapter backdrop");
  await click('button[data-action="story-menu"]');
  await waitFor('document.querySelector("[data-modal-panel]")');
  await click('button[data-action="story-exit-map"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-story-hub") || document.querySelector(".game-frame")?.classList.contains("screen-map")');
  if (!(await evaluate('document.querySelector(".game-frame")?.classList.contains("screen-story-hub")'))) {
    await openNavScreen("nav-story-hub");
  }
  for (const [name, width, height, mobile] of releaseViewports) {
    await setViewport(width, height, mobile);
    const layout = await evaluate(`(() => {
      const main = document.querySelector(".story-hub-layout");
      const topbar = document.querySelector(".topbar");
      const nav = document.querySelector(".topbar-nav");
      const cards = [...document.querySelectorAll(".story-hub-card")];
      const mainRect = main?.getBoundingClientRect();
      const topbarRect = topbar?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const clipped = [...document.querySelectorAll(
        ".story-hub-copy small, .story-hub-copy b, .story-hub-status",
      )].filter(
        (node) => node.scrollWidth > node.clientWidth + 1 ||
          node.scrollHeight > node.clientHeight + 1,
      );
      const narrowSummaries = [...document.querySelectorAll(".story-hub-copy em")]
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight) || 18;
          return rect.height < lineHeight * 1.8;
        });
      return {
        width: innerWidth,
        height: innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOutside: mainRect
          ? mainRect.left < -0.5 || mainRect.right > innerWidth + 0.5
          : true,
        topbarOutside: topbarRect
          ? topbarRect.left < -0.5 || topbarRect.right > innerWidth + 0.5
          : true,
        navOutside: navRect
          ? navRect.left < -0.5 ||
            navRect.right > innerWidth + 0.5 ||
            navRect.top < -0.5 ||
            navRect.bottom > innerHeight + 0.5
          : true,
        navOverflow: nav ? Math.max(0, nav.scrollWidth - nav.clientWidth) : 1,
        navButtons: nav?.querySelectorAll(".nav-button").length || 0,
        cards: cards.length,
        cardOverflow: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
        clippedText: clipped.length,
        narrowSummaries: ${JSON.stringify(mobile)} ? narrowSummaries.length : 0,
      };
    })()`);
    assertEqual(layout.width, width, `${name} story hub should use requested viewport width`);
    assertEqual(layout.height, height, `${name} story hub should use requested viewport height`);
    assertPageScrolling(layout, `${name} story hub`, mobile);
    assertEqual(layout.mainOutside, false, `${name} story hub should stay inside the viewport`);
    assertEqual(layout.topbarOutside, false, `${name} story top bar should stay inside the viewport`);
    assertEqual(layout.navOutside, false, `${name} story hub navigation should stay inside the viewport`);
    assertEqual(layout.navOverflow, 0, `${name} story hub navigation should fit all items`);
    assertEqual(layout.navButtons, 5, `${name} story hub should keep primary navigation compact`);
    assertEqual(layout.cards, STORY_ARCHIVE_CHAPTERS.length, `${name} story hub should expose every saga chapter`);
    assertEqual(layout.cardOverflow, 0, `${name} story hub cards should stay contained`);
    assertEqual(layout.clippedText, 0, `${name} story hub labels should stay readable`);
    assertEqual(layout.narrowSummaries, 0, `${name} story hub summaries should keep multi-line copy`);
    releaseLayouts.push({ screen: "story-hub", name, ...layout });
  }

  await setViewport(1440, 900, false);
  await click('button[data-action="nav-quests"]');
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-quests")');
  for (const [name, width, height, mobile] of releaseViewports) {
    await setViewport(width, height, mobile);
    const layout = await evaluate(`(() => {
      const main = document.querySelector(".quests-layout");
      const topbar = document.querySelector(".topbar");
      const cards = [...document.querySelectorAll(".quest-card")];
      const recruitmentCards = [...document.querySelectorAll(".recruitment-card")];
      const legend = document.querySelector(".hero-legend-mission");
      const legendArt = document.querySelector(".hero-legend-mission-art");
      const visibleImages = [...document.querySelectorAll(".quests-screen img")].filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      });
      const mainRect = main?.getBoundingClientRect();
      const topbarRect = topbar?.getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOutside: mainRect
          ? mainRect.left < -0.5 || mainRect.right > innerWidth + 0.5
          : true,
        topbarOutside: topbarRect
          ? topbarRect.left < -0.5 || topbarRect.right > innerWidth + 0.5
          : true,
        cards: cards.length,
        clippedCards: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
        recruitmentCards: recruitmentCards.length,
        clippedRecruitments: recruitmentCards.filter(
          (card) => card.scrollWidth > card.clientWidth + 1,
        ).length,
        recruitmentOutside: recruitmentCards.some(
          (card) =>
            card.getBoundingClientRect().left < -0.5 ||
            card.getBoundingClientRect().right > innerWidth + 0.5,
        ),
        legendVisible: Boolean(legend && legend.getBoundingClientRect().height > 1),
        legendOutside: legend
          ? legend.getBoundingClientRect().left < -0.5 ||
            legend.getBoundingClientRect().right > innerWidth + 0.5
          : true,
        legendClipped: legend ? legend.scrollWidth > legend.clientWidth + 1 : true,
        legendArtCover: legendArt
          ? getComputedStyle(legendArt)
              .backgroundSize.split(",")
              .every((size) => size.trim() === "cover")
          : false,
        stretchedImages: visibleImages.filter((image) => {
          if (getComputedStyle(image).objectFit !== "fill") return false;
          const rect = image.getBoundingClientRect();
          const natural = image.naturalWidth / Math.max(1, image.naturalHeight);
          const rendered = rect.width / Math.max(1, rect.height);
          return Math.abs(natural - rendered) / Math.max(natural, rendered) > 0.025;
        }).length,
      };
    })()`);
    assertEqual(layout.width, width, `${name} quests should use requested viewport width`);
    assertEqual(layout.height, height, `${name} quests should use requested viewport height`);
    assertPageScrolling(layout, `${name} quests`, mobile);
    assertEqual(layout.mainOutside, false, `${name} quests should stay inside the viewport`);
    assertEqual(layout.topbarOutside, false, `${name} quest top bar should stay inside the viewport`);
    assertEqual(layout.cards, 3, `${name} quests should expose the full three-stage chain`);
    assertEqual(layout.clippedCards, 0, `${name} quests should not clip card content`);
    assertEqual(
      layout.recruitmentCards <= Object.keys(HERO_RECRUITMENTS).length,
      true,
      `${name} quests should keep recruitment scrolls within the complete roster`,
    );
    assertEqual(
      layout.clippedRecruitments,
      0,
      `${name} recruitment cards should not clip card content`,
    );
    assertEqual(
      layout.recruitmentOutside,
      false,
      `${name} recruitment cards should stay inside the viewport`,
    );
    assertEqual(layout.legendVisible, true, `${name} quests should expose the legend mission`);
    assertEqual(layout.legendOutside, false, `${name} legend mission should stay inside the viewport`);
    assertEqual(layout.legendClipped, false, `${name} legend mission should not clip its content`);
    assertEqual(layout.legendArtCover, true, `${name} legend art should crop proportionally`);
    assertEqual(layout.stretchedImages, 0, `${name} quest art should preserve its aspect ratio`);
    releaseLayouts.push({ screen: "quests", name, ...layout });
    if (name === "steamDeck" || name === "mobile") {
      await captureVisualQaScreenshot(`shuihu-recruitment-${name}.png`);
    }
  }

  await setViewport(1440, 900, false);
  await clickMoreAction("nav-settings");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-settings")');
  await click('button[data-action="show-third-party-notices"]');
  await waitFor('document.querySelector(".legal-notice-text")?.textContent.includes("steamworks.js")');
  const legalNotice = await evaluate(`(() => {
    const text = document.querySelector(".legal-notice-text")?.textContent || "";
    const panel = document.querySelector("[data-modal-panel]");
    const rect = panel?.getBoundingClientRect();
    return {
      electron: text.includes("Electron"),
      chromium: text.includes("Chromium"),
      steamworks: text.includes("steamworks.js"),
      valve: text.includes("Valve Steamworks SDK"),
      lucide: text.includes("Lucide icons"),
      kenney: text.includes("Kenney Interface Sounds"),
      insideViewport: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth),
      readable: Boolean(
        document.querySelector(".legal-notice-text")?.scrollHeight > 0
      ),
    };
  })()`);
  assertEqual(legalNotice.electron, true, "third-party notices should credit Electron");
  assertEqual(legalNotice.chromium, true, "third-party notices should credit Chromium");
  assertEqual(legalNotice.steamworks, true, "third-party notices should credit steamworks.js");
  assertEqual(legalNotice.valve, true, "third-party notices should identify Valve SDK terms");
  assertEqual(legalNotice.lucide, true, "third-party notices should credit Lucide");
  assertEqual(legalNotice.kenney, true, "third-party notices should credit Kenney open-source UI and sound assets");
  assertEqual(legalNotice.insideViewport, true, "third-party notices should stay inside the viewport");
  assertEqual(legalNotice.readable, true, "third-party notices should render readable text");
  await click('[data-modal-panel] button[data-action="close-modal"]');
  await waitFor('!document.querySelector("[data-modal-panel]")');
  const legalDocuments = [
    ["privacy", "隐私说明", "本地保存的数据"],
    ["eula", "最终用户许可协议", "许可范围"],
    ["support", "支持与版本更新", "提交问题"],
    ["refund", "退款说明", "消费者权利"],
  ];
  for (const [documentId, title, expectedText] of legalDocuments) {
    await click(
      `button[data-action="show-legal-document"][data-document="${documentId}"]`,
    );
    await waitFor(
      `document.querySelector("[data-modal-panel]")?.innerText.includes(${JSON.stringify(expectedText)})`,
    );
    const legalDocument = await evaluate(`(() => {
      const panel = document.querySelector("[data-modal-panel]");
      const text = panel?.querySelector(".legal-notice-text");
      const rect = panel?.getBoundingClientRect();
      return {
        title: panel?.querySelector("h2")?.textContent || "",
        readable: Boolean(text && text.scrollHeight > text.clientHeight),
        insideViewport: Boolean(
          rect &&
          rect.left >= -0.5 &&
          rect.right <= innerWidth + 0.5 &&
          rect.top >= -0.5 &&
          rect.bottom <= innerHeight + 0.5
        ),
      };
    })()`);
    assertEqual(
      legalDocument.title,
      title,
      `${documentId} legal document should expose its title`,
    );
    assertEqual(
      legalDocument.readable,
      true,
      `${documentId} legal document should use a scrollable readable body`,
    );
    assertEqual(
      legalDocument.insideViewport,
      true,
      `${documentId} legal document should stay inside the viewport`,
    );
    await click('[data-modal-panel] button[data-action="close-modal"]');
    await waitFor('!document.querySelector("[data-modal-panel]")');
  }
  for (const [name, width, height, mobile] of releaseViewports) {
    await setViewport(width, height, mobile);
    const layout = await evaluate(`(() => {
      const main = document.querySelector(".settings-layout");
      const cards = [...document.querySelectorAll(".settings-card")];
      const mainRect = main?.getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOutside: mainRect
          ? mainRect.left < -0.5 || mainRect.right > innerWidth + 0.5
          : true,
        cards: cards.length,
        clippedCards: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      };
    })()`);
    assertEqual(layout.width, width, `${name} settings should use requested viewport width`);
    assertEqual(layout.height, height, `${name} settings should use requested viewport height`);
    assertPageScrolling(layout, `${name} settings`, mobile);
    assertEqual(layout.mainOutside, false, `${name} settings should stay inside the viewport`);
    assertEqual(layout.cards >= 9, true, `${name} settings should render every preferences card`);
    assertEqual(layout.clippedCards, 0, `${name} settings should not clip preference cards`);
    if (name === "1080p" || name === "mobile") {
      await evaluate(
        `document.querySelector(".auto-tactic-choice")?.scrollIntoView({ block: "center" })`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      await captureVisualQaScreenshot(`shuihu-settings-tactics-${name}.png`);
    }
    releaseLayouts.push({ screen: "settings", name, ...layout });
  }
  await setViewport(1440, 900, false);

  await setViewport(390, 844, true);
  await setSave(campaignFixture());
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
  await clickText("续上旧卷");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-map")');
  await clickMoreAction("nav-codex");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-codex")');
  const mobileCodex = await evaluate(`(() => {
    const rects = [...document.querySelectorAll(".star-node")].map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    const overlaps = [];
    for (let index = 0; index < rects.length; index += 1) {
      for (let other = index + 1; other < rects.length; other += 1) {
        const a = rects[index];
        const b = rects[other];
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
        ) overlaps.push([index, other]);
      }
    }
    return {
      width: innerWidth,
      stars: rects.length,
      medalChapters: document.querySelectorAll(".campaign-medal-chapter").length,
      clippedMedalLabels: [...document.querySelectorAll(".campaign-medal-chapter b")]
        .filter((label) => label.scrollWidth > label.clientWidth + 1).length,
      overlaps: overlaps.length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  await clickMoreAction("nav-arena");
  await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-arena")');
  await click('button[data-action="select-arena-mode"][data-mode="weekly"]');
  await waitFor('Boolean(document.querySelector(".arena-week-card"))');
  const mobileArena = await evaluate(`(() => {
    const modeButtons = [...document.querySelectorAll(".arena-mode-switch button")];
    const weekCard = document.querySelector(".arena-week-card");
    const weekPoolLabels = [...document.querySelectorAll(".arena-week-pools b")];
    return {
      arenaModes: modeButtons.length,
      weeklyCardVisible: Boolean(weekCard && weekCard.getBoundingClientRect().height > 0),
      weeklyPoolLabels: weekPoolLabels.length,
      clippedWeeklyPoolLabels: weekPoolLabels.filter(
        (label) => label.scrollWidth > label.clientWidth + 1,
      ).length,
      weeklyCardOverflow: weekCard
        ? Math.max(0, weekCard.scrollWidth - weekCard.clientWidth)
        : -1,
    };
  })()`);
  const mobileLayout = { ...mobileCodex, ...mobileArena };
  assertEqual(mobileLayout.width, 390, "mobile viewport should render at 390px");
  assertEqual(mobileLayout.stars, HERO_ORDER.length, "mobile codex should show every hero");
  assertEqual(mobileLayout.medalChapters, CHAPTERS.length, "mobile codex should show every chapter rating");
  assertEqual(mobileLayout.clippedMedalLabels, 0, "mobile chapter rating labels should fit");
  assertEqual(mobileLayout.overlaps, 0, "mobile codex nodes should not overlap");
  assertEqual(mobileLayout.overflow, 0, "mobile codex should not overflow horizontally");
  assertEqual(mobileLayout.arenaModes, 2, "mobile arena should expose both modes");
  assertEqual(mobileLayout.weeklyCardVisible, true, "mobile weekly brief should render");
  assertEqual(mobileLayout.weeklyPoolLabels, 7, "mobile weekly pool should show four boons and three bounties");
  assertEqual(mobileLayout.clippedWeeklyPoolLabels, 0, "mobile weekly pool labels should fit");
  assertEqual(mobileLayout.weeklyCardOverflow, 0, "mobile weekly brief should not overflow");
  await setViewport(1440, 900, false);

  if (expectWebApp) {
    await socket.send("Page.navigate", { url: `${origin}/` });
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await socket.send("Page.reload", { ignoreCache: false });
    await waitFor(
      'Boolean(navigator.serviceWorker?.controller)',
      10000,
    );
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")');
    await socket.send("Network.enable");
    await socket.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      connectionType: "none",
    });
    await socket.send("Page.reload", { ignoreCache: true });
    await waitFor('document.querySelector(".game-frame")?.classList.contains("screen-title")', 15000);
    webApp.offlineReload = await evaluate(`Boolean(
      navigator.serviceWorker?.controller &&
      document.querySelector(".game-frame")?.classList.contains("screen-title")
    )`);
    await socket.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "wifi",
    });
    assertEqual(webApp.offlineReload, true, "installed browser game should reload offline");
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        campaign: {
          result: "qingfeng auto battle to reward",
          medals: afterBattle.chapterMedals.qingfeng,
        },
        fullCampaign: {
          result: "full campaign and all three endings reached through the UI",
          chapters: fullCampaign,
        },
        arena: {
          result: "four-part reward settled and persisted run restored after reload",
          reward: arenaReward,
        },
        newGamePlus: "archive and settings preserved",
        heroQuests: heroQuestRegression,
        heroLegend: legendRegression,
        audio: audioSettings,
        gamepad: gamepadRegression,
        saveLifecycle,
        securityHardening: {
          ...securityHardening,
          webApp,
        },
        steamDeck: {
          battle: steamDeckBattle,
        },
        releaseLayouts,
        mobile: mobileLayout,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (!(error instanceof EquipmentFocusComplete)) throw error;
} finally {
  if (inputStateCleanup && socket?.ws?.readyState === WebSocket.OPEN) {
    try {
      await evaluate("inputStateCleanup?.()");
    } catch {
      // The page may already be closed.
    }
  }
  socket?.ws?.close();
  await stopProcess(chrome);
  await stopProcess(devServer);
  await rm(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 150,
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}
