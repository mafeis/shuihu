import assert from "node:assert/strict";
import test from "node:test";

import {
  equipmentWeights,
  recommendEquipment,
  scoreEquipmentSet,
} from "../src/equipment-recommendation.js";
import { EQUIPMENT, HEROES } from "../src/data.js";
import {
  createInitialState,
  equipItem,
} from "../src/state.js";

test("recommended equipment improves the current weighted loadout", () => {
  const state = createInitialState();
  state.inventory.ring_saber = 1;
  state.inventory.blood_tunic = 1;
  state.inventory.tiger_tooth = 1;
  const recommendation = recommendEquipment(state, "linchong");
  assert.ok(recommendation.changes.length > 0);
  assert.ok(recommendation.score > recommendation.currentScore);

  for (const change of recommendation.changes) {
    assert.equal(
      equipItem(state, "linchong", change.to),
      true,
      `${change.slot} recommendation should be equipable`,
    );
  }
  const equipped = state.roster.linchong.equipment;
  assert.equal(
    scoreEquipmentSet(HEROES.linchong, equipped),
    recommendation.score,
  );
});

test("equipment advice respects path and row priorities", () => {
  const front = equipmentWeights(HEROES.linchong);
  const agile = equipmentWeights(HEROES.yanqing);
  assert.ok(front.hp > agile.hp);
  assert.ok(front.def > agile.def);
  assert.ok(agile.spd > front.spd);
});

test("gear combinations stay unique and never use an unavailable item", () => {
  const state = createInitialState();
  state.inventory.ring_saber = 1;
  state.inventory.black_axe_pair = 1;
  state.inventory.scout_boots = 1;
  state.inventory.courier_token = 1;
  const recommendation = recommendEquipment(state, "linchong");
  const itemIds = Object.values(recommendation.equipment).filter(Boolean);
  assert.equal(new Set(itemIds).size, itemIds.length);
  for (const itemId of itemIds) {
    assert.ok(EQUIPMENT[itemId]);
    assert.ok(
      state.roster.linchong.equipment[EQUIPMENT[itemId].slot] === itemId ||
        (state.inventory[itemId] || 0) > 0,
      `${itemId} must be currently owned`,
    );
  }
});

test("recommendation safely keeps a strong loadout and handles unknown heroes", () => {
  const state = createInitialState();
  const current = recommendEquipment(state, "linchong");
  assert.equal(current.changes.length, 0);
  assert.equal(current.improvement, 0);

  const missing = recommendEquipment(state, "not-a-hero");
  assert.deepEqual(missing.equipment, {
    weapon: null,
    armor: null,
    token: null,
  });
  assert.deepEqual(missing.changes, []);
});
