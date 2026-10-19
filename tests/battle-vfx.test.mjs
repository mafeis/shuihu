import assert from "node:assert/strict";
import test from "node:test";

import { battleVfxProfile } from "../src/battle-vfx.js";

test("battle VFX profiles follow the four combat paths", () => {
  const result = {
    ok: true,
    actorUid: "hero-1",
    kind: "damage",
    targets: ["enemy-1"],
    events: [
      {
        type: "damage",
        targetUid: "enemy-1",
        damage: 20,
        critical: true,
      },
    ],
  };

  assert.equal(
    battleVfxProfile({
      skill: { name: "断岳", path: "gang", power: 0.8 },
      actor: { uid: "hero-1", side: "hero", path: "gang" },
      result,
    }).kind,
    "slash",
  );
  assert.equal(
    battleVfxProfile({
      skill: { name: "追风", path: "ling", power: 0.8 },
      actor: { uid: "hero-1", side: "hero", path: "ling" },
      result,
    }).kind,
    "projectile",
  );
  assert.equal(
    battleVfxProfile({
      skill: { name: "星阵", path: "tao", power: 0.8 },
      actor: { uid: "hero-1", side: "hero", path: "tao" },
      result,
    }).kind,
    "sigil",
  );
  assert.equal(
    battleVfxProfile({
      skill: { name: "铁壁", path: "shou", power: 0.8 },
      actor: { uid: "hero-1", side: "hero", path: "shou" },
      result,
    }).kind,
    "guard",
  );
});

test("heavy, healing, support and chain skills receive distinct VFX", () => {
  const actor = { uid: "hero-1", side: "hero", path: "gang" };
  assert.equal(
    battleVfxProfile({
      skill: { name: "天罡破军", path: "gang", ultimate: true },
      actor,
      result: {
        ok: true,
        actorUid: "hero-1",
        kind: "damage",
        targets: ["enemy-1"],
        events: [{ type: "damage", targetUid: "enemy-1" }],
      },
    }).kind,
    "quake",
  );
  assert.equal(
    battleVfxProfile({
      skill: { name: "回春", path: "tao", heal: true },
      actor,
      result: {
        ok: true,
        actorUid: "hero-1",
        kind: "heal",
        targets: ["hero-1"],
        events: [{ type: "heal", targetUid: "hero-1", healing: 30 }],
      },
    }).kind,
    "mend",
  );
  assert.equal(
    battleVfxProfile({
      skill: { name: "列阵", path: "shou" },
      actor,
      result: {
        ok: true,
        actorUid: "hero-1",
        kind: "support",
        targets: ["hero-1", "hero-2"],
        events: [],
      },
    }).kind,
    "ward",
  );
  const combo = battleVfxProfile({
    skill: { name: "星命合击", path: "gang", ultimate: true },
    actor,
    result: {
      ok: true,
      actorUid: "hero-1",
      kind: "combo",
      targets: ["enemy-1", "enemy-2"],
      events: [
        { type: "combo", targetUid: "enemy-1" },
        { type: "damage", targetUid: "enemy-1" },
        { type: "damage", targetUid: "enemy-2", pathAdvantage: true },
      ],
    },
  });
  assert.equal(combo.kind, "starfall");
  assert.equal(combo.heavy, true);
  assert.deepEqual(combo.targetUids, ["enemy-1", "enemy-2"]);
  assert.equal(combo.pathAdvantage, true);
});

test("failed actions do not render a stale VFX overlay", () => {
  assert.equal(
    battleVfxProfile({
      skill: { name: "空招", path: "gang" },
      actor: { uid: "hero-1", side: "hero", path: "gang" },
      result: { ok: false, events: [] },
    }),
    null,
  );
});
