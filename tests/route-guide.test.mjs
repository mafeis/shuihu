import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA_BOONS,
  ARENA_ENCOUNTERS,
  ARENA_RELICS,
  CHAPTERS,
  CHAIN_FORMATIONS,
  HERO_DOCTRINES,
  HERO_ORDER,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HERO_TRIALS,
} from "../src/data.js";
import { achievementProgress, buildRoutePlan } from "../src/route-guide.js";
import { createInitialState } from "../src/state.js";

test("route guide starts with the active chapter without offering a locked arena", () => {
  const state = createInitialState();
  const goals = buildRoutePlan(state, { limit: 4 });
  assert.equal(goals[0].id, `story-${CHAPTERS[0].id}`);
  assert.equal(goals.some((goal) => goal.action === "route-arena"), false);
});

test("route guide surfaces a completed hero story before the main chapter", () => {
  const state = createInitialState();
  state.currentChapter = 1;
  state.completedChapters = [CHAPTERS[0].id];
  state.heroMastery.linchong.wins = 2;
  const goals = buildRoutePlan(state, { limit: 3 });
  assert.equal(goals[0].action, "route-quest");
  assert.equal(goals[0].heroId, "linchong");
  assert.equal(goals[0].eyebrow, "异闻可领取");
});

test("route guide prioritizes an unfinished ending path after the campaign", () => {
  const state = createInitialState();
  state.completedChapters = CHAPTERS.map((chapter) => chapter.id);
  state.currentChapter = CHAPTERS.length;
  state.recruited = [...HERO_ORDER];
  state.team = HERO_ORDER.slice(0, 3);
  state.ending = "brotherhood";
  state.endingsUnlocked = ["brotherhood"];
  const goals = buildRoutePlan(state, { limit: 3 });
  assert.equal(goals[0].action, "route-new-cycle");
  assert.match(goals[0].title, /再启一卷/);
  assert.equal(goals[0].progress.label, "1/3 种结局");
});

test("route guide resumes a persisted arena run", () => {
  const state = createInitialState();
  state.recruited = HERO_ORDER.slice(0, 3);
  state.team = HERO_ORDER.slice(0, 3);
  state.arena.activeRun = {
    mode: "endless",
    wave: 4,
    boons: [Object.keys(ARENA_BOONS)[0]],
    pendingBoons: [],
  };
  const goals = buildRoutePlan(state, { limit: 2 });
  assert.equal(goals[0].action, "route-arena");
  assert.equal(goals[0].id, "arena-resume");
  assert.match(goals[0].title, /第 4 阵/);
});

test("achievement progress exposes concrete counters for locked goals", () => {
  const state = createInitialState();
  state.stats.battlesWon = 7;
  state.recruited = HERO_ORDER.slice(0, 4);
  assert.deepEqual(
    {
      current: achievementProgress(state, "ten_stands").current,
      target: achievementProgress(state, "ten_stands").target,
      label: achievementProgress(state, "ten_stands").label,
    },
    { current: 7, target: 10, label: "7/10 场胜利" },
  );
  assert.equal(
    achievementProgress(state, "all_sworn").label,
    `4/${HERO_ORDER.length} 位好汉`,
  );
  state.arena.discoveries.encounters = Object.keys(ARENA_ENCOUNTERS).slice(0, 3);
  assert.deepEqual(
    {
      current: achievementProgress(state, "arena_encounters").current,
      target: achievementProgress(state, "arena_encounters").target,
      label: achievementProgress(state, "arena_encounters").label,
    },
    { current: 3, target: 8, label: "3/8 种军势" },
  );
});

test("route guide steers three-hero formations toward an undiscovered chain", () => {
  const state = createInitialState();
  state.currentChapter = 3;
  state.completedChapters = CHAPTERS.slice(0, 3).map((chapter) => chapter.id);
  state.recruited = ["linchong", "wusong", "wuyong"];
  state.team = [...state.recruited];
  state.heroRecruitments.completed = Object.keys(HERO_RECRUITMENTS);
  state.heroQuests.claimed = state.recruited.flatMap((heroId) =>
    (HERO_QUESTS[heroId] || []).map((quest) => quest.id),
  );
  state.heroMastery = Object.fromEntries(
    state.recruited.map((heroId) => [
      heroId,
      {
        wins: 0,
        kills: 0,
        damage: 0,
        ultimates: 0,
        trials: HERO_TRIALS.map((trial) => trial.id),
      },
    ]),
  );
  state.doctrines = Object.fromEntries(
    state.recruited.map((heroId) => [
      heroId,
      Object.keys(HERO_DOCTRINES[heroId].paths)[0],
    ]),
  );
  state.arena.bestWave = 40;
  state.arena.relics = Object.keys(ARENA_RELICS);
  state.chainArchive = Object.keys(CHAIN_FORMATIONS).slice(0, 2);
  const goal = buildRoutePlan(state, { limit: 6 }).find(
    (entry) => entry.id === "chain-archive",
  );
  assert.ok(goal);
  assert.equal(goal.action, "nav-codex");
  assert.equal(
    goal.progress.label,
    `2/${Object.keys(CHAIN_FORMATIONS).length} 阵`,
  );
});
