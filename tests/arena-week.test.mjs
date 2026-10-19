import assert from "node:assert/strict";
import test from "node:test";

import {
  ARENA_WEEK_MARKS,
  getArenaWeekBoonOffer,
  getArenaWeekBounty,
  getArenaWeekConfig,
  getArenaWeekEventOffer,
  getIsoWeekKey,
  getIsoWeekRange,
} from "../src/arena-week.js";
import {
  createInitialState,
  syncArenaWeek,
  validateSaveText,
} from "../src/state.js";
import { ARENA_EVENTS } from "../src/data.js";

test("ISO week keys stay stable across year boundaries and time zones", () => {
  assert.equal(getIsoWeekKey("2025-12-29T00:00:00.000Z"), "2026-W01");
  assert.equal(getIsoWeekKey("2026-01-01T23:59:59.000Z"), "2026-W01");
  assert.equal(getIsoWeekKey("2026-01-05T00:00:00.000Z"), "2026-W02");
  assert.equal(getIsoWeekKey("2026-01-05T07:59:59.000+08:00"), "2026-W01");
  assert.equal(getIsoWeekKey("2026-01-05T08:00:00.000+08:00"), "2026-W02");
  assert.equal(getIsoWeekRange("2026-W02"), "1月5日 - 1月11日");
});

test("weekly rules produce a deterministic fixed pool and offer", () => {
  const first = getArenaWeekConfig("2026-W42");
  const second = getArenaWeekConfig("2026-W42");
  assert.deepEqual(first, second);
  assert.equal(first.boonPool.length, 4);
  assert.equal(new Set(first.boonPool).size, 4);
  assert.equal(first.bountyPool.length, 3);
  assert.equal(new Set(first.bountyPool).size, 3);
  assert.ok(first.rule.id);

  const opening = getArenaWeekBoonOffer(first, 0, 3);
  assert.deepEqual(
    opening.map((boon) => boon.id),
    getArenaWeekBoonOffer(second, 0, 3).map((boon) => boon.id),
  );
  assert.equal(opening.length, 3);
  assert.equal(
    opening.every((boon) => first.boonPool.includes(boon.id)),
    true,
  );
  const reroll = getArenaWeekBoonOffer(first, 0, 3, 1);
  assert.deepEqual(
    reroll.map((boon) => boon.id),
    getArenaWeekBoonOffer(second, 0, 3, 1).map((boon) => boon.id),
  );
  assert.notDeepEqual(
    reroll.map((boon) => boon.id),
    opening.map((boon) => boon.id),
  );
  assert.equal(
    reroll.every((boon) => first.boonPool.includes(boon.id)),
    true,
  );
  assert.ok(getArenaWeekBounty(first, 1));
  const events = getArenaWeekEventOffer(first, 6, 3);
  assert.deepEqual(events, getArenaWeekEventOffer(second, 6, 3));
  assert.equal(events.length, 3);
  assert.equal(new Set(events).size, 3);
  assert.equal(events.every((eventId) => ARENA_EVENTS[eventId]), true);
  assert.deepEqual(
    new Set(events),
    new Set(getArenaWeekEventOffer(first, 6, 3)),
  );
});

test("weekly rollover archives records and expires an old weekly run", () => {
  const state = createInitialState();
  state.arena.weekly = {
    weekKey: "2026-W01",
    bestScore: 1880,
    bestWave: 6,
    runs: 3,
    marks: ["first"],
    history: [],
  };
  state.arena.activeRun = {
    mode: "weekly",
    weekKey: "2026-W01",
    wave: 4,
    boons: ["vanguard"],
    pendingBoons: ["rally", "ironwall", "breaker"],
  };

  const result = syncArenaWeek(state, new Date("2026-01-12T00:00:00.000Z"));
  assert.equal(result.changed, true);
  assert.equal(state.arena.weekly.weekKey, "2026-W03");
  assert.equal(state.arena.weekly.bestScore, 0);
  assert.equal(state.arena.activeRun, null);
  assert.equal(state.arena.weekly.history.length, 1);
  assert.equal(state.arena.weekly.history[0].weekKey, "2026-W01");
  assert.equal(state.arena.weekly.history[0].bestScore, 1880);
});

test("weekly save data sanitizes marks, discoveries, and pending choices", () => {
  const state = createInitialState();
  state.arena.discoveries = {
    masteries: ["vanguard", "not-a-boon", "vanguard"],
    synergies: ["vanguard_breaker", "not-a-synergy"],
  };
  state.arena.weekly.marks = ["first", "not-a-mark"];
  state.arena.activeRun = {
    mode: "weekly",
    weekKey: state.arena.weekly.weekKey,
    seed: 123,
    wave: 5,
    boons: ["vanguard", "vanguard", "vanguard"],
    pendingBoons: ["rally", "not-a-boon", "breaker"],
    eventOffer: ["feast", "not-an-event", "raid", "feast"],
    selectedEvent: "raid",
    lastEvent: "not-an-event",
    completedWave: 4,
    lastDiscoveries: {
      masteries: ["vanguard", "not-a-boon"],
      synergies: ["vanguard_breaker"],
    },
    lastWeeklyMarks: ["first", "not-a-mark"],
  };

  const restored = validateSaveText(JSON.stringify(state));
  assert.deepEqual(restored.arena.discoveries, {
    masteries: ["vanguard"],
    synergies: ["vanguard_breaker"],
    encounters: [],
  });
  assert.deepEqual(restored.arena.weekly.marks, ["first"]);
  assert.deepEqual(restored.arena.activeRun.pendingBoons, [
    "rally",
    "breaker",
  ]);
  assert.deepEqual(restored.arena.activeRun.eventOffer, ["feast", "raid"]);
  assert.equal(restored.arena.activeRun.selectedEvent, "raid");
  assert.equal(restored.arena.activeRun.lastEvent, null);
  assert.deepEqual(restored.arena.activeRun.lastDiscoveries, {
    masteries: ["vanguard"],
    synergies: ["vanguard_breaker"],
    encounters: [],
  });
  assert.deepEqual(restored.arena.activeRun.lastWeeklyMarks, ["first"]);
  assert.equal(ARENA_WEEK_MARKS.length, 3);
});
