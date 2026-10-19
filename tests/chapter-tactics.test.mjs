import assert from "node:assert/strict";
import test from "node:test";

import { CHAPTERS, STATUS_DEFS } from "../src/data.js";
import {
  CHAPTER_TACTIC_IDS,
  CHAPTER_TACTICS,
  chapterTacticArchiveCount,
  getChapterTactic,
  totalChapterTactics,
} from "../src/chapter-tactics.js";
import {
  createInitialState,
  recordChapterTactic,
  validateSaveText,
} from "../src/state.js";
import { createBattle } from "../src/battle.js";

test("every campaign choice has one distinct playable tactic", () => {
  assert.equal(totalChapterTactics(), 19);
  assert.equal(CHAPTER_TACTIC_IDS.size, totalChapterTactics());
  for (const chapter of CHAPTERS) {
    const tactics = CHAPTER_TACTICS[chapter.id];
    assert.ok(Array.isArray(tactics), `${chapter.id} needs tactics`);
    assert.equal(
      tactics.length,
      chapter.choice.options.length,
      `${chapter.id} tactics must match its choices`,
    );
    for (const [index, tactic] of tactics.entries()) {
      assert.equal(getChapterTactic(chapter.id, index), tactic);
      assert.ok(tactic.name.length >= 2);
      assert.ok(tactic.desc.length >= 12);
      assert.ok(tactic.icon);
      assert.ok(["blue", "teal", "gold", "cinnabar"].includes(tactic.tone));
      assert.ok(tactic.effects && Object.keys(tactic.effects).length > 0);
      for (const status of [
        ...(tactic.effects.heroOpeningStatuses || []),
        ...(tactic.effects.enemyOpeningStatuses || []),
      ]) {
        assert.ok(STATUS_DEFS[status.status], `${tactic.id} has unknown status`);
      }
      assert.equal(CHAPTER_TACTICS[chapter.id][index].id, tactic.id);
    }
  }
});

test("campaign tactics feed real opening combat rules", () => {
  const state = createInitialState();
  const rescue = getChapterTactic("ferry", 0);
  const rescueBattle = createBattle(state, CHAPTERS[0], {
    specialRule: rescue,
  });
  assert.equal(rescueBattle.heroes[0].statuses.guard, 1);
  assert.equal(rescueBattle.modifiers.damageReductionPct, 0.06);

  const boat = getChapterTactic("ferry", 1);
  const boatBattle = createBattle(state, CHAPTERS[0], {
    specialRule: boat,
  });
  assert.equal(boatBattle.modifiers.spdPct, 0.1);
  assert.ok(boatBattle.heroes[0].yiqi >= 30);
});

test("tactic archive rewards only first discovery and survives migration", () => {
  const state = createInitialState();
  const copperBefore = state.inventory.copper;
  const xpBefore = state.roster.linchong.xp;

  const first = recordChapterTactic(state, "ferry", 0);
  assert.equal(first.newlyDiscovered, true);
  assert.equal(first.copper, 60);
  assert.equal(first.xp, 45);
  assert.equal(state.inventory.copper, copperBefore + 60);
  assert.ok(state.roster.linchong.xp >= xpBefore + 45);
  assert.deepEqual(state.tacticArchive, ["ferry_rescue"]);
  assert.equal(chapterTacticArchiveCount(state.tacticArchive, "ferry"), 1);

  const copperAfter = state.inventory.copper;
  const duplicate = recordChapterTactic(state, "ferry", 0);
  assert.equal(duplicate.newlyDiscovered, false);
  assert.equal(state.inventory.copper, copperAfter);

  const restored = validateSaveText(JSON.stringify(state));
  assert.deepEqual(restored.tacticArchive, ["ferry_rescue"]);
  state.tacticArchive.push("unknown_tactic", "ferry_rescue");
  const sanitized = validateSaveText(JSON.stringify(state));
  assert.deepEqual(sanitized.tacticArchive, ["ferry_rescue"]);
});

test("tactics reject unknown chapters and choice indexes", () => {
  assert.equal(getChapterTactic("unknown", 0), null);
  assert.equal(getChapterTactic("ferry", -1), null);
  assert.equal(getChapterTactic("ferry", 99), null);
  const state = createInitialState();
  const result = recordChapterTactic(state, "ferry", 99);
  assert.equal(result.newlyDiscovered, false);
  assert.deepEqual(state.tacticArchive, []);
});
