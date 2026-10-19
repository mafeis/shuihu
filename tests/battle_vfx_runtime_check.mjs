import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const screenshotDir =
  process.env.BATTLE_VFX_SCREENSHOT_DIR ||
  path.join(tmpdir(), "shuihu-battle-vfx");
const profileDir = await mkdtemp(path.join(tmpdir(), "shuihu-vfx-"));
const browser = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  viewport: { width: 1440, height: 1000 },
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});

async function enterBattle(page) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.click('button[data-action="new-game"]');
  await page.click('button[data-action="enter-chapter"]');
  await page.click('button[data-action="story-skip"]');
  await page.click('button[data-action="story-choice"][data-option="0"]');
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  await page.waitForSelector('button[data-action="dismiss-battle-tutorial"]');
  await page.click('button[data-action="dismiss-battle-tutorial"]');
  const autoToggle = page.locator(
    'button[data-action="toggle-auto-battle"].is-active',
  );
  if (await autoToggle.count()) await autoToggle.click();
}

async function triggerFirstSkill(page) {
  const skill = page.locator(
    '.skill-button:not([disabled])[data-action="select-skill"]',
  ).first();
  await skill.waitFor();
  await skill.click();
  await page.waitForTimeout(60);
  const target = page.locator(".battle-unit.is-targetable").first();
  if (await target.count()) await target.click();
  const impact = page.locator(".skill-impact").first();
  await impact.waitFor();
  return impact;
}

async function readImpact(page) {
  return page.evaluate(() => {
    const impact = document.querySelector(".skill-impact");
    const core = impact?.querySelector(".impact-core");
    const hud = impact?.closest(".battle-unit")?.querySelector(".unit-hud");
    const rect = impact?.getBoundingClientRect();
    return {
      template: impact?.dataset.vfxTemplate || null,
      kind: [...(impact?.classList || [])].find((name) =>
        name.startsWith("is-"),
      ),
      classes: [...(impact?.classList || [])],
      streaks: impact?.querySelectorAll(".vfx-streaks i").length || 0,
      shards: impact?.querySelectorAll(".vfx-shards i").length || 0,
      motes: impact?.querySelectorAll(".vfx-motes i").length || 0,
      coreAnimation: core ? getComputedStyle(core).animationName : "",
      hudZ: hud ? Number(getComputedStyle(hud).zIndex) : 0,
      impactZ: impact ? Number(getComputedStyle(impact).zIndex) : 0,
      impactTransform: impact ? getComputedStyle(impact).transform : "",
      videos: document.querySelectorAll(".screen-battle video").length,
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0),
    };
  });
}

try {
  await mkdir(screenshotDir, { recursive: true });
  const page = browser.pages()[0] || (await browser.newPage());
  await enterBattle(page);
  await triggerFirstSkill(page);
  await page.waitForTimeout(160);
  const desktop = await readImpact(page);
  await page.screenshot({
    path: path.join(screenshotDir, "battle-vfx-desktop.png"),
    fullPage: true,
  });

  assert.ok(desktop.template, "a semantic VFX template should render");
  assert.notEqual(desktop.coreAnimation, "none");
  assert.ok(desktop.streaks >= 8);
  assert.ok(desktop.shards >= 10);
  assert.ok(desktop.motes >= 8);
  assert.equal(desktop.videos, 0, "battle VFX should not load path videos");
  assert.ok(
    desktop.hudZ > desktop.impactZ,
    "unit stats should stay above the battle VFX layer",
  );

  await page.waitForTimeout(950);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(180);
  await triggerFirstSkill(page);
  await page.waitForTimeout(120);
  const mobile = await readImpact(page);
  await page.screenshot({
    path: path.join(screenshotDir, "battle-vfx-mobile.png"),
    fullPage: true,
  });
  assert.ok(mobile.template, "mobile should render the same semantic template");
  assert.notEqual(mobile.impactTransform, "none");
  assert.ok(
    mobile.width <= 390,
    `mobile impact anchor should not create horizontal overflow (${mobile.width}px)`,
  );
  assert.ok(
    mobile.hudZ > mobile.impactZ,
    "mobile unit stats should stay above the battle VFX layer",
  );

  console.log(
    JSON.stringify(
      {
        desktop,
        mobile,
        screenshots: screenshotDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await rm(profileDir, { recursive: true, force: true });
}
