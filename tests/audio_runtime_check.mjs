import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const origin = process.env.GAME_ORIGIN || "http://localhost:4173";
const profileDir = await mkdtemp(path.join(tmpdir(), "shuihu-audio-"));
const browser = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});

try {
  const page = browser.pages()[0] || (await browser.newPage());
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.click('button[data-action="new-game"]');
  await page.click('button[data-action="enter-chapter"]');
  await page.click('button[data-action="story-skip"]');
  await page.click('button[data-action="story-choice"][data-option="0"]');
  await page.click('button[data-action="story-to-battle"]');
  await page.waitForSelector(".screen-battle");
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.music),
    "battle_theme",
    "starting battle should switch to the battle theme",
  );

  const report = await page.evaluate(async () => {
    const music = document.documentElement.dataset.music;
    const response = await fetch("/assets/audio/battle_theme.mp3");
    const bytes = (await response.arrayBuffer()).byteLength;
    const audioElementCount = globalThis.__shuihuAudioElements?.() || 0;
    const audioPlayAttempts =
      globalThis.__shuihuAudioPlayAttempts?.("battle_theme") || 0;
    const sound = globalThis.__shuihuSound;
    const sfx = [];
    const cues = [
      "battle-start",
      "blade",
      "impact",
      "volley",
      "guard",
      "evade",
      "restore",
      "ultimate",
      "victory",
      "defeat",
    ];
    const loadedBuffers = await sound.preloadCombatSfx();
    for (const cue of cues) {
      sound.playCombatCue(cue);
      sfx.push({ cue, lastCue: sound.lastCue });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    const sfxStatus = globalThis.__shuihuCombatSfxStatus?.();
    const sfxBytes = {};
    for (const cue of cues) {
      const sfxResponse = await fetch(`/assets/audio/sfx/${cue}.mp3`);
      sfxBytes[cue] = (await sfxResponse.arrayBuffer()).byteLength;
    }
    const media = [
      ...performance.getEntriesByType("resource")
        .filter((entry) => entry.name.endsWith(".mp3"))
        .map((entry) => ({ src: entry.name })),
    ];
    return {
      music,
      bytes,
      media,
      audioElementCount,
      audioPlayAttempts,
      sfx,
      sfxStatus,
      loadedBufferCount: loadedBuffers.filter(Boolean).length,
      sfxBytes,
    };
  });

  assert.equal(report.music, "battle_theme");
  assert.ok(report.bytes > 0, "battle music should be available");
  assert.ok(report.media.length > 0, "battle music should be requested");
  assert.ok(report.audioElementCount > 0, "battle music should use an audio layer");
  assert.ok(report.audioPlayAttempts > 0, "battle music should attempt playback");
  assert.equal(
    report.sfx.every((entry) => entry.cue === entry.lastCue),
    true,
    "every combat cue should reach the audio engine",
  );
  assert.equal(
    report.loadedBufferCount,
    10,
    "all ten generated combat one-shots should decode",
  );
  assert.equal(
    report.sfxStatus.loaded.length,
    10,
    "the runtime should cache every generated combat one-shot",
  );
  assert.equal(
    report.sfxStatus.failures.length,
    0,
    "generated combat one-shots should not fail to load",
  );
  assert.ok(
    report.sfxStatus.generatedPlays >= 10,
    "combat cues should play from generated buffers after preload",
  );
  assert.equal(
    Object.values(report.sfxBytes).every((bytes) => bytes > 8_000),
    true,
    "every generated combat one-shot should contain audio data",
  );
  assert.ok(
    report.media.some((entry) => entry.src.includes("/assets/audio/sfx/")),
    "the browser should request generated combat one-shots",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await rm(profileDir, { recursive: true, force: true });
}
