import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAPTERS,
  HEROES,
} from "../src/data.js";
import {
  autoTargetForSkill,
  chooseAutoBattleAction,
  normalizeAutoBattleTactic,
} from "../src/auto-battle.js";
import { createBattle } from "../src/battle.js";
import { createInitialState } from "../src/state.js";

function stateWithTeam(heroIds) {
  const state = createInitialState();
  state.recruited = [...heroIds];
  state.roster = Object.fromEntries(
    heroIds.map((heroId) => [
      heroId,
      { level: 1, xp: 0, equipment: {} },
    ]),
  );
  state.team = [...heroIds, null, null, null].slice(0, 3);
  return state;
}

function battleFor(heroIds, chapterId = "ferry") {
  return createBattle(
    stateWithTeam(heroIds),
    CHAPTERS.find((chapter) => chapter.id === chapterId),
  );
}

test("auto-battle tactics prioritize distinct enemy targets", () => {
  const battle = battleFor(
    ["huarong", "linchong", "luzhishen"],
    "bianjing",
  );
  const actor = battle.heroes.find((unit) => unit.refId === "huarong");
  const [front, middle, back] = battle.enemies;
  for (const enemy of battle.enemies) enemy.path = actor.path;

  front.row = 0;
  front.hp = Math.round(front.maxHp * 0.82);
  front.poise = Math.round(front.poiseMax * 0.94);
  front.atk = 45;

  middle.row = 1;
  middle.hp = Math.round(middle.maxHp * 0.2);
  middle.poise = Math.round(middle.poiseMax * 0.2);
  middle.atk = 58;

  back.row = 2;
  back.hp = Math.round(back.maxHp * 0.62);
  back.poise = Math.round(back.poiseMax * 0.3);
  back.atk = 92;

  const skill = HEROES.huarong.skills.find(
    (entry) => entry.id === "hua_basic",
  );
  assert.equal(
    autoTargetForSkill(battle, actor, skill, "breaker").uid,
    front.uid,
  );
  assert.equal(
    autoTargetForSkill(battle, actor, skill, "guardian").uid,
    back.uid,
  );
  assert.equal(
    autoTargetForSkill(battle, actor, skill, "hunter").uid,
    middle.uid,
  );
});

test("guardian auto-battle holds a damage ultimate while the line is healthy", () => {
  const battle = battleFor(["huarong", "linchong", "luzhishen"]);
  const actor = battle.heroes.find((unit) => unit.refId === "huarong");
  actor.yiqi = 100;
  actor.cooldowns = {};

  const breakerAction = chooseAutoBattleAction(battle, actor, "breaker");
  const guardianAction = chooseAutoBattleAction(battle, actor, "guardian");

  assert.equal(breakerAction.skill.id, "hua_ult");
  assert.notEqual(guardianAction.skill.id, "hua_ult");
});

test("unknown auto-battle tactics fall back to balanced", () => {
  assert.equal(normalizeAutoBattleTactic("unknown"), "balanced");
  assert.equal(normalizeAutoBattleTactic("hunter"), "hunter");
});
