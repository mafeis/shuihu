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
  new URL("../artifacts/qa/1440-layout", import.meta.url),
);

function progressedFixture() {
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
  state.settings.autoArena = false;
  return state;
}

function starterFixture() {
  const state = createInitialState();
  state.flags.tutorialSeen = true;
  state.settings.autoArena = false;
  return state;
}

function arenaRewardFixture() {
  const state = progressedFixture();
  state.arena.activeRun = {
    mode: "endless",
    wave: 7,
    boons: ["vanguard", "vanguard", "vanguard", "rally", "rally"],
    pendingBoons: ["breaker", "swift", "remedy"],
    rerollUsed: false,
    eventOffer: ["feast", "raid", "drill"],
    selectedEvent: null,
    healthRatios: { likui: 0.72, linchong: 0.42, huarong: 1 },
    completedWave: 6,
    lastReward: { copper: 188, xp: 162, score: 740 },
    score: 3380,
    lastUnlocks: [{ relicId: "ember", wave: 3 }],
    lastDiscoveries: { masteries: [], synergies: [], encounters: [] },
    lastWeeklyMarks: [],
    trialIds: [],
    defeated: false,
  };
  return state;
}

function recruitmentRewardFixture() {
  const state = progressedFixture();
  const targetHero = "shijin";
  state.currentChapter = 4;
  state.completedChapters = CHAPTERS.slice(0, 4).map((chapter) => chapter.id);
  state.recruited = HERO_ORDER.filter((heroId) => heroId !== targetHero);
  state.roster = Object.fromEntries(
    state.recruited.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = 16;
      return [heroId, entry];
    }),
  );
  state.team = ["likui", "linchong", "huarong"];
  state.heroRecruitments = { completed: [] };
  state.settings.autoBattle = true;
  state.settings.battleSpeed = 4;
  return state;
}

function finalChoiceFixture() {
  const state = progressedFixture();
  state.currentChapter = CHAPTERS.length;
  state.completedChapters = CHAPTERS.map((chapter) => chapter.id);
  state.flags.finalBattleWon = true;
  state.ending = null;
  state.endingsUnlocked = ["brotherhood"];
  return state;
}

async function measureScreen(page, name) {
  return page.evaluate((screenName) => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 1 &&
        rect.height > 1
      );
    };
    const controls = [...document.querySelectorAll("button, input, select, a")]
      .filter(visible)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        let ancestor = node.parentElement;
        let insideHorizontalScroller = false;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          if (
            ["auto", "scroll"].includes(style.overflowX) &&
            ancestor.scrollWidth > ancestor.clientWidth + 1
          ) {
            insideHorizontalScroller = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return {
          text:
            node.getAttribute("aria-label") ||
            node.innerText?.trim().slice(0, 60) ||
            node.tagName,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          insideHorizontalScroller,
        };
      });
    const images = [...document.querySelectorAll("img")]
      .filter(visible)
      .map((image) => {
        const rect = image.getBoundingClientRect();
        return {
          src: image.getAttribute("src"),
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
          width: rect.width,
          height: rect.height,
        };
      });
    const videos = [...document.querySelectorAll("video")]
      .filter(visible)
      .map((video) => {
        const rect = video.getBoundingClientRect();
        return {
          src: video.currentSrc || video.getAttribute("src"),
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          objectFit: getComputedStyle(video).objectFit,
          width: rect.width,
          height: rect.height,
        };
      });
    const backdrops = [
      ...document.querySelectorAll(
        ".reward-background, .final-background, .ending-background",
      ),
    ]
      .filter(visible)
      .map((node) => ({
        className: node.className,
        backgroundImage: getComputedStyle(node).backgroundImage,
      }));
    const headings = [
      ...document.querySelectorAll(
        "h1, h2, .story-chapter-mark b, .battle-title b",
      ),
    ]
      .filter(visible)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          text: node.innerText.trim().slice(0, 80),
          top: rect.top,
          bottom: rect.bottom,
        };
      });
    const activeModal = document.querySelector("[data-modal-panel]");
    const textRects = [
      ...document.querySelectorAll(
        "h1, h2, h3, h4, h5, h6, p, small, b, strong, em, span, button, label, dt, dd, li",
      ),
    ]
      .filter((node) => {
        if (!visible(node) || node.closest('[aria-hidden="true"]')) return false;
        if (activeModal && !activeModal.contains(node)) return false;
        return [...node.childNodes].some(
          (child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
        );
      })
      .map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        let clipLeft = 0;
        let clipRight = innerWidth;
        let clipTop = 0;
        let clipBottom = innerHeight;
        let ancestor = node.parentElement;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
            clipLeft = Math.max(clipLeft, bounds.left);
            clipRight = Math.min(clipRight, bounds.right);
          }
          if (["auto", "scroll", "hidden", "clip"].includes(style.overflowY)) {
            clipTop = Math.max(clipTop, bounds.top);
            clipBottom = Math.min(clipBottom, bounds.bottom);
          }
          ancestor = ancestor.parentElement;
        }
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, clipRight) - Math.max(rect.left, clipLeft),
        );
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, clipBottom) - Math.max(rect.top, clipTop),
        );
        return {
          node,
          text: node.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          visibleRatio:
            (visibleWidth * visibleHeight) /
            Math.max(1, (rect.right - rect.left) * (rect.bottom - rect.top)),
        };
      })
      .filter(
        (entry) =>
          entry.right > entry.left + 1 &&
          entry.bottom > entry.top + 1 &&
          entry.right > 0 &&
          entry.left < innerWidth &&
          entry.bottom > 0 &&
          entry.top < innerHeight &&
          entry.visibleRatio >= 0.9,
      );
    const textOverlaps = [];
    for (let first = 0; first < textRects.length; first += 1) {
      for (let second = first + 1; second < textRects.length; second += 1) {
        const a = textRects[first];
        const b = textRects[second];
        if (a.node.contains(b.node) || b.node.contains(a.node)) continue;
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width <= 4 || height <= 8) continue;
        const overlapArea = width * height;
        const smallerArea = Math.min(
          (a.right - a.left) * (a.bottom - a.top),
          (b.right - b.left) * (b.bottom - b.top),
        );
        if (overlapArea / Math.max(1, smallerArea) < 0.2) continue;
        textOverlaps.push({
          first: a.text,
          second: b.text,
          firstClass: a.node.className || a.node.tagName,
          secondClass: b.node.className || b.node.tagName,
          overlapWidth: Math.round(width),
          overlapHeight: Math.round(height),
          overlapArea: Math.round(overlapArea),
        });
      }
    }
    const screen = document.querySelector(
      ".app-screen, .title-screen, .story-screen, .battle-screen, .reward-screen, .final-choice-screen, .ending-screen",
    );
    const screenRect = screen?.getBoundingClientRect();
    const modal = document.querySelector("[data-modal-panel]");
    const modalRect = modal?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      screen: screenName,
      pageOverflowX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      pageOverflowY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      screenRect: screenRect
        ? {
            top: screenRect.top,
            right: screenRect.right,
            bottom: screenRect.bottom,
            left: screenRect.left,
          }
        : null,
      controls,
      images,
      videos,
      backdrops,
      headings,
      textOverlaps: textOverlaps.slice(0, 20),
      modalRect: modalRect
        ? {
            top: modalRect.top,
            right: modalRect.right,
            bottom: modalRect.bottom,
            left: modalRect.left,
          }
        : null,
      arenaLockedHeading: (() => {
        const node = document.querySelector(".arena-locked h2");
        if (!visible(node)) return null;
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, text: node.innerText };
      })(),
    };
  }, name);
}

async function captureScreen(page, name, metrics) {
  assert.equal(
    metrics.pageOverflowX,
    0,
    `${name}: page has horizontal overflow`,
  );
  assert.equal(
    metrics.pageOverflowY,
    0,
    `${name}: page has vertical overflow`,
  );
  assert.ok(metrics.screenRect, `${name}: app screen is missing`);
  assert.ok(
    metrics.screenRect.top <= 1 &&
      metrics.screenRect.left <= 1 &&
      metrics.screenRect.right >= metrics.viewport.width - 1 &&
      metrics.screenRect.bottom >= metrics.viewport.height - 1,
    `${name}: app screen does not cover the viewport ${JSON.stringify(
      metrics.screenRect,
    )}`,
  );
  assert.ok(metrics.headings.length > 0, `${name}: no visible page heading`);
  const minimumHeadingTop = ["story", "battle"].includes(name) ? -1 : 70;
  assert.ok(
    metrics.headings.some(
      (heading) =>
        heading.bottom > minimumHeadingTop &&
        heading.top < metrics.viewport.height &&
        heading.bottom > heading.top,
    ),
    `${name}: page heading is outside the first viewport ${JSON.stringify(
      metrics.headings,
    )}`,
  );
  for (const control of metrics.controls) {
    if (control.insideHorizontalScroller) continue;
    assert.ok(
      control.left >= -1 && control.right <= metrics.viewport.width + 1,
      `${name}: control escapes horizontally ${JSON.stringify(control)}`,
    );
  }
  for (const image of metrics.images) {
    assert.ok(
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      `${name}: broken image ${image.src}`,
    );
    assert.notEqual(
      image.objectFit,
      "fill",
      `${name}: stretched image ${image.src}`,
    );
  }
  for (const video of metrics.videos) {
    assert.notEqual(
      video.objectFit,
      "fill",
      `${name}: stretched video ${video.src}`,
    );
    if (video.readyState >= 2) {
      assert.ok(
        video.videoWidth > 0 && video.videoHeight > 0,
        `${name}: video metadata is invalid ${video.src}`,
      );
    }
  }
  for (const backdrop of metrics.backdrops) {
    assert.notEqual(
      backdrop.backgroundImage,
      "none",
      `${name}: full-screen backdrop has no image (${backdrop.className})`,
    );
  }
  assert.deepEqual(
    metrics.textOverlaps,
    [],
    `${name}: visible text overlaps ${JSON.stringify(metrics.textOverlaps)}`,
  );
  if (metrics.modalRect) {
    assert.ok(
      metrics.modalRect.left >= -1 &&
        metrics.modalRect.right <= metrics.viewport.width + 1 &&
        metrics.modalRect.top >= -1 &&
        metrics.modalRect.bottom <= metrics.viewport.height + 1,
      `${name}: modal escapes the viewport ${JSON.stringify(
        metrics.modalRect,
      )}`,
    );
  }
  await page.screenshot({
    path: `${outputDir}/${name}-1440x900.png`,
    fullPage: false,
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
  const reports = [];

  const starterPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const starterErrors = [];
  starterPage.on("pageerror", (error) => starterErrors.push(error.message));
  await starterPage.goto(origin, { waitUntil: "networkidle" });
  await starterPage.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(starterFixture())],
  );
  await starterPage.reload({ waitUntil: "networkidle" });
  await starterPage.click('button[data-action="continue-game"]');
  await starterPage.waitForSelector(".screen-map");
  await starterPage.click('.topbar button[data-action="nav-arena"]');
  await starterPage.waitForSelector(".screen-arena");
  await starterPage.waitForTimeout(200);
  const arenaLocked = await measureScreen(starterPage, "arena-locked");
  assert.ok(arenaLocked.arenaLockedHeading, "arena locked: guide heading missing");
  assert.ok(
    arenaLocked.arenaLockedHeading.top >= 70 &&
      arenaLocked.arenaLockedHeading.bottom <= 900,
    `arena locked: guide is outside the initial viewport ${JSON.stringify(
      arenaLocked.arenaLockedHeading,
    )}`,
  );
  await starterPage.screenshot({
    path: `${outputDir}/arena-locked-1440x900.png`,
    fullPage: false,
  });
  reports.push({ name: "arena-locked", controls: arenaLocked.controls.length });
  assert.deepEqual(starterErrors, [], "starter-state screens should not throw");
  await starterPage.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const fixture = progressedFixture();
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(fixture)],
  );
  await page.reload({ waitUntil: "networkidle" });
  let metrics = await measureScreen(page, "title");
  await captureScreen(page, "title", metrics);
  reports.push({ name: "title", controls: metrics.controls.length });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");

  const screens = [
    ["map", 'button[data-action="nav-map"]', ".screen-map"],
    ["story-hub", 'button[data-action="nav-story-hub"]', ".screen-story-hub"],
    ["camp", 'button[data-action="nav-camp"]', ".screen-camp"],
    ["arena", 'button[data-action="nav-arena"]', ".screen-arena"],
    ["roster", 'button[data-action="nav-roster"]', ".screen-roster"],
    ["quests", 'button[data-action="nav-quests"]', ".screen-quests"],
    ["codex", 'button[data-action="nav-codex"]', ".screen-codex"],
    ["settings", 'button[data-action="nav-settings"]', ".screen-settings"],
  ];
  for (const [name, selector, screenSelector] of screens) {
    await page.click(`.topbar ${selector}`);
    await page.waitForSelector(screenSelector);
    await page.waitForTimeout(160);
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll("img")]
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 1 && rect.height > 1;
          })
          .map(
            (image) =>
              image.complete
                ? image.decode().catch(() => {})
                : new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                  }),
          ),
      ),
    );
    const metrics = await measureScreen(page, name);
    await captureScreen(page, name, metrics);
    reports.push({ name, controls: metrics.controls.length });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.querySelector('button[data-action="nav-story-hub"]')?.click();
  });
  await page.waitForSelector(".screen-story-hub");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "story-hub-mobile");
  await captureScreen(page, "story-hub-mobile", metrics);
  reports.push({ name: "story-hub-mobile", controls: metrics.controls.length });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.click('.topbar button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  await page.click('button[data-action="nav-formation"]');
  await page.waitForSelector(".screen-formation");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "formation");
  await captureScreen(page, "formation", metrics);
  reports.push({ name: "formation", controls: metrics.controls.length });

  await page.click('.topbar button[data-action="nav-roster"]');
  await page.waitForSelector(".screen-roster");
  await page.locator(".hero-card-hit").first().click();
  await page.waitForSelector(".hero-dossier.is-open");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "roster-dossier");
  await captureScreen(page, "roster-dossier", metrics);
  reports.push({ name: "roster-dossier", controls: metrics.controls.length });
  await page.click(
    '.hero-dossier button[data-action="equipment-hero"]',
  );
  await page.waitForSelector(".screen-equipment");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "equipment");
  await captureScreen(page, "equipment", metrics);
  reports.push({ name: "equipment", controls: metrics.controls.length });

  await page.click('.topbar button[data-action="nav-map"]');
  await page.waitForSelector(".screen-map");
  await page.click('button[data-action="enter-chapter"]');
  await page.waitForSelector(".screen-story");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "story");
  await captureScreen(page, "story", metrics);
  reports.push({ name: "story", controls: metrics.controls.length });

  await page.click('button[data-action="story-skip"]');
  const choice = page.locator('button[data-action="story-choice"]').first();
  if (await choice.count()) await choice.click();
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  await page.waitForTimeout(260);
  metrics = await measureScreen(page, "battle");
  await captureScreen(page, "battle", metrics);
  reports.push({ name: "battle", controls: metrics.controls.length });
  await page.click('button[data-action="battle-menu"]');
  await page.waitForSelector("[data-modal-panel]");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "battle-menu");
  await captureScreen(page, "battle-menu", metrics);
  reports.push({ name: "battle-menu", controls: metrics.controls.length });
  await page.click('[data-modal-panel] button[data-action="close-modal"]');
  await page.waitForSelector("[data-modal-panel]", { state: "detached" });
  if (!(await page.locator('button[data-action="toggle-auto-battle"].is-active').count())) {
    await page.click('button[data-action="toggle-auto-battle"]');
  }
  await page.click('.battle-speed-control button[data-speed="4"]');
  if (await page.locator('button[data-action="dismiss-battle-tutorial"]').count()) {
    await page.click('button[data-action="dismiss-battle-tutorial"]');
  }
  await page.waitForSelector(".screen-reward", { timeout: 60000 });
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "story-reward");
  await captureScreen(page, "story-reward", metrics);
  const chapterRecruit = await page.evaluate(() => {
    const card = document.querySelector(".recruit-section article");
    const image = card?.querySelector("img");
    if (!card || !image) return null;
    const cardRect = card.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    return {
      card: {
        top: cardRect.top,
        right: cardRect.right,
        bottom: cardRect.bottom,
        left: cardRect.left,
      },
      image: {
        top: imageRect.top,
        right: imageRect.right,
        bottom: imageRect.bottom,
        left: imageRect.left,
      },
      visible:
        cardRect.top >= 0 &&
        cardRect.left >= 0 &&
        cardRect.right <= innerWidth &&
        cardRect.bottom <= innerHeight,
      imageComplete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      cardScrollWidth: card.scrollWidth,
      cardClientWidth: card.clientWidth,
      cardScrollHeight: card.scrollHeight,
      cardClientHeight: card.clientHeight,
    };
  });
  assert.ok(chapterRecruit, "story reward: new recruit card is missing");
  assert.equal(
    chapterRecruit.visible,
    true,
    `story reward: new recruit card is outside the first viewport ${JSON.stringify(
      chapterRecruit.card,
    )}`,
  );
  assert.equal(
    chapterRecruit.imageComplete,
    true,
    "story reward: new recruit portrait did not load",
  );
  assert.ok(
    chapterRecruit.naturalWidth > 0 && chapterRecruit.naturalHeight > 0,
    "story reward: new recruit portrait has invalid metadata",
  );
  assert.equal(
    chapterRecruit.objectFit,
    "contain",
    "story reward: new recruit portrait should preserve its silhouette",
  );
  assert.ok(
    chapterRecruit.image.top >= chapterRecruit.card.top - 1 &&
      chapterRecruit.image.bottom <= chapterRecruit.card.bottom + 1 &&
      chapterRecruit.image.left >= chapterRecruit.card.left - 1 &&
      chapterRecruit.image.right <= chapterRecruit.card.right + 1,
    `story reward: new recruit portrait is clipped ${JSON.stringify(
      chapterRecruit,
    )}`,
  );
  assert.ok(
    chapterRecruit.cardScrollWidth <= chapterRecruit.cardClientWidth + 1 &&
      chapterRecruit.cardScrollHeight <= chapterRecruit.cardClientHeight + 1,
    `story reward: new recruit card clips its content ${JSON.stringify(
      chapterRecruit,
    )}`,
  );
  const rewardAction = await page.evaluate(() => {
    const button = document.querySelector(
      '.screen-reward .reward-actions button[data-action="story-outro"]',
    );
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const scroll = document.querySelector(".screen-reward .reward-scroll");
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      visible:
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.bottom <= innerHeight,
      scrollHeight: scroll?.scrollHeight || 0,
      clientHeight: scroll?.clientHeight || 0,
    };
  });
  assert.ok(rewardAction, "story reward: continue action is missing");
  assert.equal(
    rewardAction.visible,
    true,
    `story reward: continue action is outside the viewport ${JSON.stringify(
      rewardAction,
    )}`,
  );
  assert.ok(
    rewardAction.scrollHeight > rewardAction.clientHeight,
    "story reward: long reward content should scroll independently",
  );
  reports.push({ name: "story-reward", controls: rewardAction.visible ? 1 : 0 });

  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(arenaRewardFixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('.topbar button[data-action="nav-arena"]');
  await page.waitForSelector(".screen-arena");
  await page.click('button[data-action="resume-arena"]');
  await page.waitForSelector(".screen-arena-reward");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "arena-reward");
  await captureScreen(page, "arena-reward", metrics);
  reports.push({ name: "arena-reward", controls: metrics.controls.length });

  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(recruitmentRewardFixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-map");
  await page.click('.topbar button[data-action="nav-quests"]');
  await page.waitForSelector(".screen-quests");
  await page.click(
    'button[data-action="start-hero-recruitment"][data-hero="shijin"]',
  );
  await page.waitForTimeout(160);
  if (
    await page
      .locator('button[data-action="recommend-recruitment-team"]')
      .count()
  ) {
    await page.click('button[data-action="recommend-recruitment-team"]');
  }
  await page.waitForSelector(".screen-story");
  await page.click('button[data-action="story-skip"]');
  const recruitmentChoice = page.locator(
    'button[data-action="story-choice"]',
  ).first();
  if (await recruitmentChoice.count()) await recruitmentChoice.click();
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  if (
    await page.locator('button[data-action="dismiss-battle-tutorial"]').count()
  ) {
    await page.click('button[data-action="dismiss-battle-tutorial"]');
  }
  await page.waitForSelector(".screen-reward", { timeout: 60000 });
  await page.waitForTimeout(260);
  metrics = await measureScreen(page, "recruitment-reward");
  await captureScreen(page, "recruitment-reward", metrics);
  const recruitmentReward = await page.evaluate(() => {
    const panel = document.querySelector(".recruitment-reward-panel");
    const art = panel?.querySelector(".recruitment-reward-art");
    const image = art?.querySelector("img");
    const copy = panel?.querySelector(".recruitment-reward-copy");
    if (!panel || !art || !image || !copy) return null;
    const rect = (node) => {
      const bounds = node.getBoundingClientRect();
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      };
    };
    return {
      panel: rect(panel),
      art: rect(art),
      image: rect(image),
      copy: rect(copy),
      imageComplete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      duplicateRecruitCard: Boolean(document.querySelector(".recruit-cards")),
      copyScrollWidth: copy.scrollWidth,
      copyClientWidth: copy.clientWidth,
      copyScrollHeight: copy.scrollHeight,
      copyClientHeight: copy.clientHeight,
    };
  });
  assert.ok(recruitmentReward, "recruitment reward: hero panel is missing");
  assert.equal(
    recruitmentReward.imageComplete,
    true,
    "recruitment reward: hero portrait did not load",
  );
  assert.ok(
    recruitmentReward.naturalWidth > 0 && recruitmentReward.naturalHeight > 0,
    "recruitment reward: hero portrait has invalid metadata",
  );
  assert.equal(
    recruitmentReward.objectFit,
    "contain",
    "recruitment reward: hero portrait should preserve its full silhouette",
  );
  assert.ok(
    recruitmentReward.image.top >= recruitmentReward.panel.top - 1 &&
      recruitmentReward.image.bottom <= recruitmentReward.panel.bottom + 1 &&
      recruitmentReward.image.left >= recruitmentReward.panel.left - 1 &&
      recruitmentReward.image.right <= recruitmentReward.panel.right + 1,
    `recruitment reward: hero portrait is clipped by its panel ${JSON.stringify(
      recruitmentReward,
    )}`,
  );
  assert.ok(
    recruitmentReward.copy.left >= recruitmentReward.art.right - 1,
    "recruitment reward: copy overlaps the hero portrait",
  );
  assert.equal(
    recruitmentReward.duplicateRecruitCard,
    false,
    "recruitment reward: the same hero should not appear twice",
  );
  assert.ok(
    recruitmentReward.copyScrollWidth <=
      recruitmentReward.copyClientWidth + 1 &&
      recruitmentReward.copyScrollHeight <=
        recruitmentReward.copyClientHeight + 1,
    `recruitment reward: copy is clipped by its column ${JSON.stringify(
      recruitmentReward,
    )}`,
  );
  reports.push({
    name: "recruitment-reward",
    controls: metrics.controls.length,
  });

  await page.evaluate(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify(finalChoiceFixture())],
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.click('button[data-action="continue-game"]');
  await page.waitForSelector(".screen-final-choice");
  await page.waitForTimeout(160);
  metrics = await measureScreen(page, "final-choice");
  await captureScreen(page, "final-choice", metrics);
  reports.push({ name: "final-choice", controls: metrics.controls.length });

  await page.click(
    'button[data-action="choose-ending"][data-ending="brotherhood"]',
  );
  await page.waitForSelector(".screen-ending");
  if (await page.locator('button[data-action="skip-ending-cinematic"]').count()) {
    await page.click('button[data-action="skip-ending-cinematic"]');
  }
  await page.waitForTimeout(220);
  metrics = await measureScreen(page, "ending");
  await captureScreen(page, "ending", metrics);
  const endingActions = await page.evaluate(async () => {
    const screen = document.querySelector(".ending-screen");
    const actions = [...document.querySelectorAll(".ending-actions button")];
    if (!screen || !actions.length) return null;
    screen.scrollTop = screen.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    return {
      scrollTop: screen.scrollTop,
      scrollHeight: screen.scrollHeight,
      clientHeight: screen.clientHeight,
      buttons: actions.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          action: button.dataset.action,
          visible:
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            rect.bottom <= innerHeight,
          rect: {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          },
        };
      }),
    };
  });
  assert.ok(endingActions, "ending: final actions are missing");
  assert.ok(
    endingActions.scrollHeight > endingActions.clientHeight,
    "ending: long content should live in an independently reachable scroller",
  );
  assert.equal(
    endingActions.buttons.length,
    3,
    "ending: expected three final actions",
  );
  for (const action of endingActions.buttons) {
    assert.equal(
      action.visible,
      true,
      `ending: ${action.action} is unreachable at the end of the scroll area ${JSON.stringify(
        action.rect,
      )}`,
    );
  }
  reports.push({ name: "ending", controls: metrics.controls.length });

  assert.deepEqual(runtimeErrors, [], "1440x900 screens should not throw");
  console.log(JSON.stringify({ status: "passed", reports }, null, 2));
} finally {
  await browser.close();
}
