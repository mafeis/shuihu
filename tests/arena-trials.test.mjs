import test from "node:test";
import assert from "node:assert/strict";

import {
  ARENA_TRIAL_LIMIT,
  ARENA_TRIALS,
  arenaTrialEffects,
  availableArenaTrials,
  sanitizeArenaTrialIds,
} from "../src/arena-trials.js";

test("arena star trials form a progressive risk ladder", () => {
  const trials = Object.values(ARENA_TRIALS);
  assert.equal(trials.length, 6);
  assert.equal(
    new Set(trials.map((trial) => trial.id)).size,
    trials.length,
  );
  assert.equal(
    new Set(trials.map((trial) => trial.unlockWave)).size,
    trials.length,
  );
  assert.deepEqual(
    trials.map((trial) => trial.unlockWave),
    [0, 4, 8, 12, 16, 20],
  );
  for (const trial of trials) {
    assert.ok(trial.name.length >= 4);
    assert.ok(trial.desc.length >= 12);
    assert.ok(trial.risk.length >= 6);
    assert.ok(trial.reward.length >= 8);
    assert.ok(trial.scorePct > 0);
    assert.ok(
      Object.keys(trial.heroModifiers || {}).length +
        Object.keys(trial.enemyModifiers || {}).length >
        0,
    );
  }
});

test("available star trials unlock from the recorded best wave", () => {
  assert.deepEqual(
    availableArenaTrials(0).map((trial) => trial.id),
    ["black_cloud"],
  );
  assert.deepEqual(
    availableArenaTrials(8).map((trial) => trial.id),
    ["black_cloud", "iron_wall", "evil_wind"],
  );
  assert.equal(availableArenaTrials(99).length, 6);
});

test("star trial selection is sanitized, unlocked and capped at three", () => {
  assert.deepEqual(
    sanitizeArenaTrialIds(
      [
        "black_cloud",
        "black_cloud",
        "iron_wall",
        "evil_wind",
        "cut_supply",
        "missing",
      ],
      { bestWave: 12 },
    ),
    ["black_cloud", "iron_wall", "evil_wind"],
  );
  assert.deepEqual(
    sanitizeArenaTrialIds(["black_cloud", "ten_ambush"], { bestWave: 10 }),
    ["black_cloud"],
  );
  assert.equal(
    sanitizeArenaTrialIds(Object.keys(ARENA_TRIALS), {
      bestWave: 99,
      limit: 99,
    }).length,
    ARENA_TRIAL_LIMIT,
  );
});

test("star trials combine battle modifiers and reward multipliers", () => {
  const effects = arenaTrialEffects([
    "black_cloud",
    "evil_wind",
    "fire_raid",
  ]);
  assert.equal(effects.count, 3);
  assert.deepEqual(effects.trialIds, [
    "black_cloud",
    "evil_wind",
    "fire_raid",
  ]);
  assert.equal(effects.enemyModifiers.hpPct, 0.26);
  assert.equal(effects.enemyModifiers.atkPct, 0.12);
  assert.equal(effects.enemyModifiers.spdPct, 0.16);
  assert.equal(effects.heroModifiers.yiqiPct, -0.18);
  assert.equal(effects.scorePct, 0.72);
  assert.equal(effects.copperPct, 0.12);
  assert.ok(Math.abs(effects.xpPct - 0.33) < 1e-12);
});

test("no selected star trials produce neutral effects", () => {
  const effects = arenaTrialEffects([]);
  assert.equal(effects.count, 0);
  assert.equal(effects.scorePct, 0);
  assert.equal(effects.copperPct, 0);
  assert.equal(effects.xpPct, 0);
  assert.deepEqual(effects.heroModifiers, {});
  assert.deepEqual(effects.enemyModifiers, {});
});
