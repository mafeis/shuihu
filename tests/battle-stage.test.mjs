import assert from "node:assert/strict";
import test from "node:test";

import { battleVfxProfile } from "../src/battle-vfx.js";
import {
  BattleStageScene,
  battlePerformanceKind,
} from "../src/battle-stage.js";

const actor = {
  uid: "hero-linchong-0",
  side: "hero",
  row: 0,
  path: "gang",
};

function damageResult(skill, targetUid = "enemy-runner-0") {
  return {
    ok: true,
    actorUid: actor.uid,
    kind: "damage",
    targets: [targetUid],
    events: [
      {
        type: "damage",
        targetUid,
        damage: 120,
        critical: true,
      },
    ],
  };
}

test("battle stage receives resolved targets and visual cues", () => {
  const skill = {
    id: "linchong_spear",
    name: "寒星枪",
    path: "gang",
    power: 1,
  };
  const result = damageResult(skill);
  const profile = battleVfxProfile({ skill, actor, result });

  assert.equal(profile.template, "blade");
  assert.deepEqual(profile.targetUids, ["enemy-runner-0"]);
  assert.equal(profile.events.length, 1);
  assert.equal(profile.events[0].damage, 120);
  assert.equal(profile.events[0].critical, true);
});

test("skill templates map to stable performance durations", () => {
  for (const kind of [
    "blade",
    "volley",
    "impact",
    "guard",
    "restore",
    "ultimate",
  ]) {
    assert.equal(battlePerformanceKind({ template: kind }), kind);
  }
  assert.equal(battlePerformanceKind({ template: "unknown" }), "blade");
  assert.equal(battlePerformanceKind(null), "blade");
});

test("attack profile does not mutate the combat result", () => {
  const skill = {
    name: "流星赶月",
    path: "ling",
    power: 1.35,
  };
  const result = damageResult(skill);
  const snapshot = structuredClone(result);
  battleVfxProfile({ skill, actor, result });
  assert.deepEqual(result, snapshot);
});

function stubCanvas(width, height) {
  return {
    width,
    height,
    getBoundingClientRect: () => ({ width, height }),
  };
}

test("stage layout separates rows and mirrors both sides", () => {
  const stage = new BattleStageScene(stubCanvas(1000, 600), {
    context: {},
  });
  stage.width = 1000;
  stage.height = 600;
  const units = [
    { uid: "hero-front", side: "hero", row: 0 },
    { uid: "enemy-front", side: "enemy", row: 0 },
  ];
  const layout = stage.computeLayout(units).units;
  const viewport = stage.getBattleViewport();
  const centerX = viewport.x + viewport.width / 2;

  assert.equal(layout.get("hero-front").x, centerX);
  assert.equal(layout.get("enemy-front").x, centerX);

  const three = stage.computeLayout([
    { uid: "hero-front", side: "hero", row: 0 },
    { uid: "hero-left", side: "hero", row: 1 },
    { uid: "hero-right", side: "hero", row: 2 },
    { uid: "enemy-front", side: "enemy", row: 0 },
  ]).units;
  assert.equal(three.get("hero-front").x, centerX);
  assert.ok(three.get("hero-left").x < centerX);
  assert.ok(three.get("hero-right").x > centerX);
  assert.ok(three.get("hero-left").y >= three.get("hero-front").y);
  stage.destroy();
});

test("renderer ticks speed up but stay bounded", () => {
  const stage = new BattleStageScene(stubCanvas(1000, 600), {
    context: {},
    speed: 4,
  });
  assert.equal(stage.ticks(1000), 250);
  stage.reducedMotion = true;
  assert.equal(stage.ticks(1000), 6250);
  stage.destroy();
});
