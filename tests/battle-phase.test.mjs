import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_PHASES,
  battlePhasePresentation,
  canTransitionBattlePhase,
  isBattlePhase,
  isTerminalBattlePhase,
  setBattlePhase,
} from "../src/battle-phase.js";

test("battle phases expose stable transitions and terminal states", () => {
  assert.equal(
    canTransitionBattlePhase(BATTLE_PHASES.SELECT, BATTLE_PHASES.RESOLVING),
    true,
  );
  assert.equal(
    canTransitionBattlePhase(BATTLE_PHASES.ENEMY, BATTLE_PHASES.SKIPPING),
    true,
  );
  assert.equal(
    canTransitionBattlePhase(BATTLE_PHASES.VICTORY, BATTLE_PHASES.SELECT),
    false,
  );
  assert.equal(isTerminalBattlePhase(BATTLE_PHASES.DEFEAT), true);
  assert.equal(isTerminalBattlePhase(BATTLE_PHASES.SELECT), false);
});

test("setBattlePhase records one canonical transition", () => {
  const battle = {
    phase: BATTLE_PHASES.LOADING,
    round: 2,
    turnsTaken: 5,
  };

  setBattlePhase(battle, BATTLE_PHASES.SELECT, { reason: "turn-start" });
  assert.equal(battle.phase, BATTLE_PHASES.SELECT);
  assert.equal(battle.phaseSerial, 1);
  assert.equal(battle.phaseTransition.from, BATTLE_PHASES.LOADING);
  assert.equal(battle.phaseTransition.to, BATTLE_PHASES.SELECT);
  assert.equal(battle.phaseTransition.reason, "turn-start");

  setBattlePhase(battle, BATTLE_PHASES.SELECT);
  assert.equal(battle.phaseSerial, 1);
  assert.throws(
    () => setBattlePhase(battle, "unknown"),
    /Unknown battle phase/,
  );
});

test("battle phase presentation names the acting unit and next decision", () => {
  const select = battlePhasePresentation(
    { phase: BATTLE_PHASES.SELECT, round: 3 },
    { name: "花荣" },
    { autoBattle: false },
  );
  assert.equal(select.id, BATTLE_PHASES.SELECT);
  assert.equal(select.label, "花荣待命");
  assert.equal(select.eyebrow, "择招");
  assert.equal(select.actionable, true);
  assert.equal(select.round, 3);

  const auto = battlePhasePresentation(
    { phase: BATTLE_PHASES.SELECT, round: 3 },
    { name: "花荣" },
    { autoBattle: true },
  );
  assert.equal(auto.actionable, false);
  assert.match(auto.detail, /自动战法/);

  const enemy = battlePhasePresentation(
    { phase: BATTLE_PHASES.ENEMY, round: 3 },
    { name: "禁军教头" },
  );
  assert.equal(enemy.tone, "enemy");
  assert.match(enemy.detail, /禁军教头/);
});

test("terminal phase presentation remains readable after combat", () => {
  const victory = battlePhasePresentation({
    phase: BATTLE_PHASES.VICTORY,
    round: 6,
  });
  assert.equal(victory.label, "敌阵已破");
  assert.equal(victory.terminal, true);
  assert.equal(victory.tone, "victory");
  assert.equal(isBattlePhase(victory, BATTLE_PHASES.VICTORY), false);
  assert.equal(
    isBattlePhase({ phase: BATTLE_PHASES.VICTORY }, BATTLE_PHASES.VICTORY),
    true,
  );
});
