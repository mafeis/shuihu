import assert from "node:assert/strict";
import test from "node:test";

import { ARENA_ENCOUNTERS } from "../src/data.js";
import {
  arenaEncountersForWave,
  pickArenaEncounter,
  resolveArenaEncounter,
} from "../src/arena-encounters.js";

test("arena encounter packs unlock gradually without early unfair rules", () => {
  assert.equal(Object.keys(ARENA_ENCOUNTERS).length, 8);
  assert.equal(arenaEncountersForWave(1).length, 1);
  assert.equal(arenaEncountersForWave(7).length, 8);
  assert.equal(
    arenaEncountersForWave(20).every(
      (encounter) => encounter.minWave <= 20,
    ),
    true,
  );
});

test("arena encounter selection is deterministic for a saved run seed", () => {
  const run = {
    mode: "endless",
    seed: 920101,
    wave: 6,
    encounterId: "",
  };
  const first = resolveArenaEncounter(run);
  const second = resolveArenaEncounter(run);

  assert.equal(first.id, second.id);
  assert.equal(first.minWave <= run.wave, true);
  assert.equal(Boolean(first.enemyModifiers), true);
  assert.equal(Boolean(first.effects), true);
});

test("arena encounter selection avoids repeating the previous rule", () => {
  const previousId = "iron_phalanx";
  for (let wave = 2; wave <= 20; wave += 1) {
    const encounter = pickArenaEncounter({
      mode: "weekly",
      seed: 202642,
      wave,
      previousId,
    });
    assert.notEqual(encounter.id, previousId);
  }
});

test("weekly encounters share the fixed weekly seed across players", () => {
  const left = resolveArenaEncounter({
    mode: "weekly",
    weekKey: "2026-W42",
    seed: 19300042,
    wave: 4,
    encounterId: "",
  });
  const right = resolveArenaEncounter({
    mode: "weekly",
    weekKey: "2026-W42",
    seed: 19300042,
    wave: 4,
    encounterId: "",
  });
  assert.equal(left.id, right.id);
});

