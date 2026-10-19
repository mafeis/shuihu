import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_SFX_CUES,
  combatSfxCue,
  sceneMusicTrack,
} from "../src/audio.js";

test("combat audio exposes every battle and result cue", () => {
  assert.deepEqual(COMBAT_SFX_CUES, [
    "battle-start",
    "slash",
    "heavy",
    "projectile",
    "block",
    "evade",
    "heal",
    "combo",
    "victory",
    "defeat",
  ]);
});

test("scene music follows the campaign chapter and switches to the boss theme", () => {
  assert.equal(sceneMusicTrack("title"), "title_theme");
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
});

test("combat cues reflect path, impact, evasion and results", () => {
  const hit = { ok: true, kind: "damage", events: [{ type: "damage" }] };
  assert.equal(
    combatSfxCue({ skill: { path: "gang", target: "enemy" }, result: hit }),
    "slash",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "tao", target: "enemy", power: 1.3 },
      result: hit,
    }),
    "heavy",
  );
  assert.equal(
    combatSfxCue({ skill: { path: "ling", target: "enemy" }, result: hit }),
    "projectile",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "ling", target: "enemy" },
      result: { events: [{ type: "evade" }] },
    }),
    "evade",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "gang", target: "enemy" },
      result: { events: [{ type: "combo" }] },
    }),
    "combo",
  );
  assert.equal(
    combatSfxCue({
      skill: { path: "shou", target: "ally" },
      result: { events: [{ type: "heal" }] },
    }),
    "heal",
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
