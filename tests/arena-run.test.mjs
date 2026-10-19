import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateArenaPerformance,
  nextArenaSynergy,
  planArenaAutoContinue,
  recommendArenaBoon,
} from "../src/arena-run.js";

test("arena advisor completes a known formation before taking a generic boon", () => {
  const recommendation = recommendArenaBoon(
    ["remedy", "ironwall", "ironwall"],
    ["rally", "remedy", "bulwark"],
  );

  assert.ok(recommendation);
  assert.equal(recommendation.boonId, "remedy");
  assert.match(recommendation.reason, /仁壁阵法/);
});

test("arena advisor prioritizes a third copy that completes a mastery", () => {
  const recommendation = recommendArenaBoon(
    ["vanguard", "vanguard"],
    ["rally", "vanguard", "swift"],
  );

  assert.ok(recommendation);
  assert.equal(recommendation.boonId, "vanguard");
  assert.match(recommendation.reason, /锋矢阵眼/);
});

test("arena build points to the nearest incomplete formation", () => {
  const next = nextArenaSynergy([
    "rally",
    "rally",
    "linked",
    "vanguard",
  ]);

  assert.ok(next);
  assert.equal(next.synergy.id, "rally_linked");
  assert.equal(next.missingTotal, 1);
  assert.deepEqual(
    next.requirements.map(({ boonId, current, required, missing }) => ({
      boonId,
      current,
      required,
      missing,
    })),
    [
      { boonId: "rally", current: 2, required: 2, missing: 0 },
      { boonId: "linked", current: 1, required: 2, missing: 1 },
    ],
  );
});

test("arena build reports no next formation after every formation is active", () => {
  const completed = [
    "vanguard",
    "vanguard",
    "breaker",
    "breaker",
    "ironwall",
    "ironwall",
    "remedy",
    "remedy",
    "swift",
    "swift",
    "insight",
    "insight",
    "rally",
    "rally",
    "rally",
    "rally",
    "bulwark",
    "bulwark",
    "linked",
    "linked",
    "volley",
    "volley",
    "pursuit",
    "pursuit",
    "aegis",
    "aegis",
  ];

  assert.equal(nextArenaSynergy(completed), null);
});

test("arena auto-continue follows the advisor only when no event is pending", () => {
  const run = {
    boons: ["vanguard", "vanguard"],
    pendingBoons: ["rally", "vanguard", "swift"],
    eventOffer: [],
    selectedEvent: null,
    defeated: false,
  };
  const plan = planArenaAutoContinue(run, ["rally", "vanguard", "swift"]);

  assert.equal(plan.action, "continue");
  assert.equal(plan.boonId, "vanguard");
});

test("arena auto-continue pauses for inter-wave events and stops without offers", () => {
  assert.deepEqual(
    planArenaAutoContinue({
      boons: ["vanguard"],
      pendingBoons: ["rally"],
      eventOffer: ["feast"],
      selectedEvent: null,
      defeated: false,
    }, ["rally"]),
    { action: "pause", reason: "event" },
  );
  assert.deepEqual(
    planArenaAutoContinue({
      boons: ["vanguard"],
      pendingBoons: [],
      eventOffer: [],
      selectedEvent: null,
      defeated: false,
    }),
    { action: "stop", reason: "no-pending-boons" },
  );
});

test("arena battle report grades tactical objectives and selects an MVP", () => {
  const battle = {
    round: 5,
    chainAttacks: 1,
    heroes: [
      { refId: "linchong", hp: 120 },
      { refId: "luzhishen", hp: 180 },
      { refId: "huarong", hp: 90 },
    ],
    heroMetrics: {
      linchong: { damage: 820, kills: 2, ultimates: 0 },
      luzhishen: { damage: 460, kills: 1, ultimates: 1 },
      huarong: { damage: 700, kills: 1, ultimates: 1 },
    },
  };

  const report = evaluateArenaPerformance(battle, 4, true);
  assert.equal(report.grade, "S");
  assert.equal(report.bonusScore, 100);
  assert.equal(report.mvpHeroId, "linchong");
  assert.equal(report.survivors, 3);
  assert.equal(report.objectives.every((objective) => objective.met), true);
});

test("arena battle report degrades cleanly when objectives are missed", () => {
  const battle = {
    round: 10,
    chainAttacks: 0,
    heroes: [
      { refId: "linchong", hp: 0 },
      { refId: "luzhishen", hp: 30 },
      { refId: "huarong", hp: 0 },
    ],
    heroMetrics: {
      linchong: { damage: 300, kills: 1, ultimates: 0 },
      luzhishen: { damage: 90, kills: 0, ultimates: 0 },
      huarong: { damage: 50, kills: 0, ultimates: 0 },
    },
  };

  const report = evaluateArenaPerformance(battle, 5, false);
  assert.equal(report.grade, "B");
  assert.equal(report.bonusScore, 20);
  assert.equal(report.mvpHeroId, "linchong");
  assert.equal(report.survivors, 1);
  assert.equal(report.objectives.some((objective) => objective.met), false);
});
