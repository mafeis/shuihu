import assert from "node:assert/strict";
import test from "node:test";

import {
  battleVfxProfile,
  battleVfxTemplate,
} from "../src/battle-vfx.js";

function damageResult(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test("skill behavior selects one of six reusable VFX templates", () => {
  assert.equal(
    battleVfxTemplate({
      skill: { name: "寒星枪", desc: "单体刺击", power: 0.92 },
      result: damageResult(),
    }),
    "blade",
  );
  assert.equal(
    battleVfxTemplate({
      skill: { name: "穿云箭", desc: "精准射击单体", power: 1 },
      result: damageResult(),
    }),
    "volley",
  );
  assert.equal(
    battleVfxTemplate({
      skill: { name: "狼牙碎甲", desc: "重棒砸击单体", power: 0.92 },
      result: damageResult(),
    }),
    "impact",
  );
  assert.equal(
    battleVfxTemplate({
      skill: { name: "震天雷", desc: "掷出铁壳雷炮，造成范围伤害", power: 0.63 },
      result: damageResult(),
    }),
    "impact",
  );
  assert.equal(
    battleVfxTemplate({
      skill: { name: "横枪守阵", target: "self", power: 0 },
      result: { ok: true, kind: "support", events: [], targets: ["hero-1"] },
    }),
    "guard",
  );
  assert.equal(
    battleVfxTemplate({
      skill: { name: "金针渡厄", heal: 1.55, power: 0 },
      result: {
        ok: true,
        kind: "heal",
        targets: ["hero-1"],
        events: [{ type: "heal", targetUid: "hero-1", healing: 30 }],
      },
    }),
    "restore",
  );
  assert.equal(
    battleVfxTemplate({
      skill: { name: "风雪山神庙", ultimate: true, power: 0.78, hits: 3 },
      result: damageResult(),
    }),
    "ultimate",
  );
});

test("metadata overrides path-specific identity while path only changes tone", () => {
  const actor = { uid: "hero-1", side: "hero", path: "gang", row: 1 };
  const arrow = battleVfxProfile({
    skill: {
      id: "arrow",
      name: "雁翎箭雨",
      desc: "射击全体敌人",
      path: "gang",
      target: "allEnemies",
      power: 0.62,
    },
    actor,
    result: damageResult({ targets: ["enemy-1", "enemy-2"] }),
  });
  assert.equal(arrow.kind, "volley");
  assert.equal(arrow.tone, "cinnabar");
  assert.equal(arrow.videoKey, undefined);
  assert.equal(arrow.multiTarget, true);

  const staff = battleVfxProfile({
    skill: {
      id: "staff",
      name: "禅杖横扫",
      desc: "攻击全体敌人",
      path: "ling",
      target: "allEnemies",
      power: 0.56,
    },
    actor: { ...actor, path: "ling" },
    result: damageResult({ targets: ["enemy-1", "enemy-2"] }),
  });
  assert.equal(staff.kind, "impact");
  assert.equal(staff.tone, "teal");
});

test("defensive supports and healing ultimates retain their functional template", () => {
  const actor = { uid: "hero-1", side: "hero", path: "shou", row: 0 };
  const guard = battleVfxProfile({
    skill: {
      name: "禁军枪阵",
      path: "shou",
      target: "allAllies",
      power: 0,
      effects: [{ type: "teamStatus", status: "guard", duration: 1 }],
    },
    actor,
    result: {
      ok: true,
      actorUid: "hero-1",
      kind: "support",
      targets: ["hero-1", "hero-2"],
      events: [],
    },
  });
  assert.equal(guard.kind, "guard");
  assert.equal(guard.ultimate, false);

  const healUltimate = battleVfxProfile({
    skill: {
      name: "神医下山",
      path: "shou",
      target: "allAllies",
      power: 0,
      heal: 1.85,
      ultimate: true,
    },
    actor,
    result: {
      ok: true,
      actorUid: "hero-1",
      kind: "heal",
      targets: ["hero-1", "hero-2"],
      events: [{ type: "heal", targetUid: "hero-1", healing: 42 }],
    },
  });
  assert.equal(healUltimate.kind, "restore");
  assert.equal(healUltimate.ultimate, true);
  assert.ok(healUltimate.duration > 940);
});

test("chain attacks use the ultimate template and retain event flags", () => {
  const combo = battleVfxProfile({
    skill: { name: "星命合击", path: "gang", ultimate: true },
    actor: { uid: "hero-1", side: "hero", path: "gang", row: 1 },
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
  assert.equal(combo.kind, "ultimate");
  assert.equal(combo.heavy, true);
  assert.equal(combo.ultimate, true);
  assert.equal(combo.pathAdvantage, true);
  assert.deepEqual(combo.targetUids, ["enemy-1", "enemy-2"]);
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
