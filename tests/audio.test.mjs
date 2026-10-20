import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_SFX_ASSETS,
  COMBAT_SFX_CUES,
  UI_SFX_ASSETS,
  UI_SFX_CUES,
  combatSfxAsset,
  combatSfxCue,
  sceneMusicTrack,
} from "../src/audio.js";

test("combat audio exposes every battle and result cue", () => {
  assert.deepEqual(COMBAT_SFX_CUES, [
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
  ]);
  assert.equal(
    combatSfxAsset("blade"),
    "/assets/audio/sfx/blade.mp3",
  );
  assert.equal(combatSfxAsset("unknown"), null);
  assert.equal(Object.keys(COMBAT_SFX_ASSETS).length, COMBAT_SFX_CUES.length);
});

test("open-source interface sounds are available to the shared audio bus", () => {
  assert.deepEqual(UI_SFX_CUES, [
    "click",
    "confirm",
    "open",
    "back",
    "error",
    "select",
  ]);
  assert.equal(
    combatSfxAsset("open"),
    "/assets/audio/ui/kenney/open.wav",
  );
  assert.equal(Object.keys(UI_SFX_ASSETS).length, UI_SFX_CUES.length);
});

test("scene music follows the campaign chapter and switches to the boss theme", () => {
  assert.equal(sceneMusicTrack("title"), "title_theme");
  assert.equal(
    sceneMusicTrack("battle", { chapterId: "qingfeng" }),
    "battle_theme",
  );
  assert.equal(
    sceneMusicTrack("story", { chapterId: "qingfeng" }),
    "qingfeng_theme",
  );
  assert.equal(
    sceneMusicTrack("battle", { chapterId: "damingfu" }),
    "damingfu_theme",
  );
  assert.equal(
    sceneMusicTrack("battle", { chapterId: "damingfu", boss: true }),
    "boss_theme",
  );
  assert.equal(
    sceneMusicTrack("reward", { chapterId: "recruitment-lin-chong" }),
    "recruitment_theme",
  );
  assert.equal(
    sceneMusicTrack("story", { chapterId: "liangshan" }),
    "ending_theme",
  );
  assert.equal(
    sceneMusicTrack("battle", { chapterId: "qingfeng" }),
    "battle_theme",
  );
  assert.equal(
    sceneMusicTrack("reward", { chapterId: "qingfeng" }),
    "ending_theme",
  );
});

test("combat cues reflect skill behavior, evasion and results", () => {
  const hit = { ok: true, kind: "damage", events: [{ type: "damage" }] };
  assert.equal(
    combatSfxCue({
      skill: { path: "gang", target: "enemy", power: 0.9 },
      result: hit,
    }),
    "blade",
  );
  assert.equal(
    combatSfxCue({
      skill: {
        path: "tao",
        target: "enemy",
        power: 0.92,
        name: "狼牙碎甲",
        desc: "重棒砸击单体",
      },
      result: hit,
    }),
    "impact",
  );
  assert.equal(
    combatSfxCue({
      skill: {
        path: "ling",
        target: "enemy",
        power: 1,
        name: "穿云箭",
        desc: "精准射击单体",
      },
      result: hit,
    }),
    "volley",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "ling", target: "enemy" },
      result: { ok: true, events: [{ type: "evade" }] },
    }),
    "evade",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "gang", target: "enemy" },
      result: { ok: true, kind: "combo", events: [{ type: "combo" }] },
    }),
    "ultimate",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "shou", target: "ally" },
      result: { ok: true, events: [{ type: "heal" }] },
    }),
    "restore",
  );
  assert.equal(
    combatSfxCue({
      skill: {
        path: "shou",
        target: "self",
        power: 0,
        name: "横枪守阵",
        effects: [{ type: "selfStatus", status: "guard" }],
      },
      result: { ok: true, kind: "support", events: [] },
    }),
    "guard",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "gang", target: "enemy" },
      result: { phase: "victory", events: [] },
    }),
    "victory",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "ling", target: "enemy" },
      result: { phase: "defeat", events: [] },
    }),
    "defeat",
  );
});
