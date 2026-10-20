import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAPTERS,
  HERO_ORDER,
  HERO_RECRUITMENTS,
} from "../src/data.js";
import {
  chooseAutoBattleAction,
  recordAutoBattleChoice,
} from "../src/auto-battle.js";
import {
  chainAttackReady,
  chooseEnemyAction,
  createBattle,
  currentCombatant,
  enemySkillList,
  finishResolutionAndAdvance,
  heroSkillList,
  performChainAttack,
  performAction,
  skillUsable,
  validTargets,
} from "../src/battle.js";
import { openingCinematicProfile } from "../src/cinematic.js";
import {
  getChapterTactic,
} from "../src/chapter-tactics.js";
import {
  battleEnemyScale,
  applyBattleRewards,
  applyHeroRecruitmentRewards,
  createInitialState,
  createRosterEntry,
  recruitmentEnemyLevel,
  recordChoice,
  recruitHero,
  recommendTeam,
} from "../src/state.js";

function stateWithTeam(heroIds, level) {
  const state = createInitialState({ difficulty: "story" });
  state.recruited = [...heroIds];
  state.roster = Object.fromEntries(
    heroIds.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = level;
      return [heroId, entry];
    }),
  );
  state.team = [...heroIds, null, null].slice(0, 3);
  return state;
}

function recruitmentBattle(heroId, stateOrHeroIds, level = 1) {
  const state = Array.isArray(stateOrHeroIds)
    ? stateWithTeam(stateOrHeroIds, level)
    : stateOrHeroIds;
  const recruitment = HERO_RECRUITMENTS[heroId];
  const enemyLevel = recruitmentEnemyLevel(state, recruitment);
  const chapter = {
    id: `recruitment-${heroId}`,
    index: -1,
    title: recruitment.title,
    location: recruitment.location,
    bg: recruitment.bg,
    battle: {
      enemies: recruitment.enemies.map((enemy) => ({
        ...enemy,
        level: enemyLevel,
      })),
      reward: recruitment.reward,
    },
    recruitment,
  };
  const battle = createBattle(state, chapter, {
    mode: "recruitment",
    recruitmentHeroId: heroId,
    specialRule: recruitment.rule,
    enemyScale: battleEnemyScale(state) * recruitment.enemyScale,
    enemyModifiers: recruitment.enemyModifiers,
  });
  return { state, battle };
}

function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = Math.imul(value ^ (value >>> 15), value | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateAutoBattle(
  battle,
  tactics = ["balanced"],
  seed = 0x5eed,
) {
  const random = Math.random;
  Math.random = randomSource(seed);
  try {
    return simulateAutoBattleWithRandom(battle, tactics);
  } finally {
    Math.random = random;
  }
}

function simulateAutoBattleWithRandom(battle, tactics) {
  let tacticIndex = 0;
  for (let step = 0; step < 5000; step += 1) {
    if (battle.phase === "victory" || battle.phase === "defeat") {
      return battle.phase;
    }
    const actor = currentCombatant(battle);
    if (actor?.side === "enemy") {
      let action = chooseEnemyAction(battle, actor);
      if (!action?.skill) {
        finishResolutionAndAdvance(battle);
        continue;
      }
      if (
        action?.skill &&
        !validTargets(battle, actor.uid, action.skill).length
      ) {
        action = chooseEnemyAction(battle, actor);
        if (
          action?.skill &&
          !validTargets(battle, actor.uid, action.skill).length
        ) {
          const fallbackSkill = enemySkillList(actor).find(
            (skill) =>
              skillUsable(actor, skill) &&
              validTargets(battle, actor.uid, skill).length,
          );
          action = fallbackSkill
            ? {
                skill: fallbackSkill,
                target: validTargets(battle, actor.uid, fallbackSkill)[0],
              }
            : action;
        }
      }
      const result = action?.skill
        ? performAction(battle, actor.uid, action.skill, action.target?.uid)
        : { ok: false };
      if (!result.ok) {
        throw new Error(`Enemy ${actor.name} could not take its turn`);
      }
    } else if (actor?.side === "hero") {
      const tactic = tactics[tacticIndex % tactics.length];
      tacticIndex += 97;
      if (chainAttackReady(battle)) {
        const result = performChainAttack(battle, actor.uid);
        if (!result.ok) {
          throw new Error(`Hero ${actor.name} could not chain attack`);
        }
        finishResolutionAndAdvance(battle);
        continue;
      }
      let action = chooseAutoBattleAction(battle, actor, tactic);
      if (
        action?.skill &&
        !validTargets(battle, actor.uid, action.skill).length
      ) {
        const fallback = heroSkillList(actor)
          .filter((skill) => skillUsable(actor, skill))
          .find(
            (skill) => validTargets(battle, actor.uid, skill).length,
          );
        action = fallback
          ? {
              skill: fallback,
              target: validTargets(battle, actor.uid, fallback)[0],
            }
          : action;
      }
      if (!action) {
        finishResolutionAndAdvance(battle);
        continue;
      }
      recordAutoBattleChoice(battle, action);
      const result = performAction(
        battle,
        actor.uid,
        action.skill,
        action.target?.uid,
      );
      if (!result.ok) {
        throw new Error(`Hero ${actor.name} could not take its turn`);
      }
    } else {
      throw new Error(
        `No combatant available at phase ${battle.phase}`,
      );
    }
    finishResolutionAndAdvance(battle);
  }
  throw new Error(`Battle ${battle.chapterTitle} did not finish`);
}

function campaignBattle(state, chapter, optionIndex = 0) {
  return createBattle(
    state,
    {
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      location: chapter.location,
      bg: chapter.bg,
      battle: {
        enemies: chapter.battle.enemies.map((enemy) => ({
          ...enemy,
        })),
        reward: chapter.battle.reward,
        recruit: chapter.battle.recruit,
      },
    },
    {
      enemyScale: battleEnemyScale(state),
      specialRule: getChapterTactic(chapter.id, optionIndex),
    },
  );
}

function cloneState(state) {
  return structuredClone(state);
}

function stateBeforeChapter(chapterId) {
  const state = createInitialState({ difficulty: "story" });
  state.team = ["linchong", null, null];
  for (const [index, chapter] of CHAPTERS.entries()) {
    if (chapter.id === chapterId) return state;
    state.team = recommendTeam(state).team;
    recordChoice(
      state,
      chapter.id,
      0,
      chapter.choice.options[0].effect,
    );
    applyBattleRewards(state, chapter);
    if (CHAPTERS[index + 1]?.id === chapterId) return state;
    for (const recruitment of Object.values(HERO_RECRUITMENTS).filter(
      (entry) => entry.requiredChapter === index,
    )) {
      applyHeroRecruitmentRewards(state, recruitment.heroId);
      recruitHero(state, recruitment.heroId);
    }
  }
  throw new Error(`Unknown chapter ${chapterId}`);
}

function simulateFirstPlaythrough() {
  const state = createInitialState({ difficulty: "story" });
  state.team = ["linchong", null, null];
  const played = [];
  const play = (chapter, optionIndex = 0) => {
    const outcomes = Array.from({ length: 200 }, (_, sample) =>
      simulateAutoBattle(
        campaignBattle(cloneState(state), chapter, optionIndex),
        ["balanced"],
        0x90000 + played.length * 1000 + sample,
      ),
    );
    const victories = outcomes.filter((outcome) => outcome === "victory").length;
    played.push({ title: chapter.title, victories, optionIndex });
  };

  for (const [index, chapter] of CHAPTERS.entries()) {
    state.team = recommendTeam(state).team;
    for (const optionIndex of chapter.choice.options.keys()) {
      play(chapter, optionIndex);
    }
    recordChoice(
      state,
      chapter.id,
      0,
      chapter.choice.options[0].effect,
    );
    applyBattleRewards(state, chapter);
    for (const recruitment of Object.values(HERO_RECRUITMENTS).filter(
      (entry) => entry.requiredChapter === index,
    )) {
      state.team = recommendTeam(state).team;
      const snapshot = cloneState(state);
      const testedBattle = recruitmentBattle(
        recruitment.heroId,
        snapshot,
      ).battle;
      assert.equal(
        simulateAutoBattle(testedBattle),
        "victory",
        `${recruitment.title} economy battle`,
      );
      recordChoice(
        state,
        testedBattle.chapterId,
        0,
        recruitment.choice.options[0].effect,
      );
      applyHeroRecruitmentRewards(state, recruitment.heroId);
      // Recruit the target even if its economy battle is sampled below.
      recruitHero(state, recruitment.heroId);
    }
  }
  return played;
}

test("chapter seven recruitment comes before its chapter battle", () => {
  const recruitment = HERO_RECRUITMENTS.xiaorang;
  assert.equal(recruitment.requiredChapter, 7);
  assert.equal(recruitment.title, "笔改灯市");
});
test("笔改灯市 has a viable auto-battle path for every doctrine", () => {
  for (const [index, tactics] of [
    ["balanced"],
    ["breaker", "hunter"],
    ["guardian"],
  ].entries()) {
    const { battle } = recruitmentBattle(
      "xiaorang",
      ["linchong", "wusong", "songjiang"],
      13,
    );
    assert.equal(
      simulateAutoBattle(battle, tactics, 0x100 + index),
      "victory",
    );
  }
});
test("recruitments chain into every later chapter", () => {
  const state = createInitialState({ difficulty: "story" });
  state.team = ["linchong", null, null];
  for (const [index, chapter] of CHAPTERS.entries()) {
    const outcomes = Array.from({ length: 40 }, (_, sample) =>
      simulateAutoBattle(
        campaignBattle(state, chapter),
        ["balanced"],
        0x10000 + chapter.index * 1000 + sample,
      ),
    );
    const victories = outcomes.filter((outcome) => outcome === "victory").length;
    console.log(
      `${chapter.id}: ${victories}/40 automatic campaign victories`,
    );
    applyBattleRewards(state, chapter);
    for (const recruitment of Object.values(HERO_RECRUITMENTS).filter(
      (entry) => entry.requiredChapter === index,
    )) {
      state.team = recommendTeam(state).team;
      const recruited = recruitmentBattle(recruitment.heroId, state);
      assert.equal(
        simulateAutoBattle(recruited.battle),
        "victory",
        recruitment.title,
      );
      applyHeroRecruitmentRewards(state, recruitment.heroId);
    }
  }
});
test("every campaign chapter has a viable formation and auto-battle tactic", () => {
  const state = createInitialState({ difficulty: "story" });
  state.team = ["linchong", null, null];
  const tactics = ["balanced", "breaker", "guardian", "hunter"];
  for (const chapter of CHAPTERS) {
    state.team = recommendTeam(state).team;
    const recommendations = [
      state.team,
      ...HERO_ORDER.filter((heroId) => state.recruited.includes(heroId))
        .flatMap((heroId) =>
          HERO_ORDER.filter(
            (partnerId) =>
              partnerId !== heroId &&
              state.recruited.includes(partnerId),
          ).map((partnerId) => [
            heroId,
            partnerId,
            state.team.find(
              (teammate) =>
                teammate !== heroId && teammate !== partnerId,
            ),
          ]),
        ),
    ].slice(0, 5);
    let viable = false;
    for (const team of recommendations) {
      state.team = team;
      for (const tactic of tactics) {
        const battle = campaignBattle(state, chapter);
        if (
          simulateAutoBattle(
            battle,
            [tactic],
            0x30000 + chapter.index * 100 + tactics.indexOf(tactic),
          ) === "victory"
        ) {
          viable = true;
          break;
        }
      }
      if (viable) break;
    }
    assert.ok(
      viable,
      `${chapter.id} has no viable formation and auto-battle route`,
    );
    applyBattleRewards(state, chapter);
  }
});

test("玉麟出府 stays reliable across late-campaign auto-battle seeds", () => {
  const state = stateBeforeChapter("damingfu");
  state.team = recommendTeam(state).team;
  const seeds = [
    16934,
    ...Array.from({ length: 20000 }, (_, sample) => sample),
  ];
  const outcomes = seeds.map((seed) => {
    const battle = recruitmentBattle("lujunyi", cloneState(state)).battle;
    return {
      seed,
      phase: simulateAutoBattle(
        battle,
        ["balanced"],
        seed,
      ),
      battle,
    };
  });
  const defeats = outcomes
    .filter((outcome) => outcome.phase === "defeat")
    .map((outcome) => outcome.seed);
  if (defeats.length) {
    const failed = outcomes.find((outcome) => outcome.phase === "defeat");
    console.error(
      JSON.stringify(failed.battle.log.slice(-24), null, 2),
      "\nHeroes:",
      failed.battle.heroes.map(({ name, hp, maxHp, yiqi }) => ({
        name,
        hp,
        maxHp,
        yiqi,
      })),
      "\nEnemies:",
      failed.battle.enemies.map(({ name, hp, maxHp, yiqi }) => ({
        name,
        hp,
        maxHp,
        yiqi,
      })),
    );
  }
  assert.deepEqual(defeats, []);
});

test("没羽入阵 stays inside the chapter-eight level band", () => {
  const state = createInitialState({ difficulty: "story" });
  state.recruited = HERO_ORDER.filter((heroId) => heroId !== "zhangqing");
  state.roster = Object.fromEntries(
    state.recruited.map((heroId) => {
      const entry = createRosterEntry(heroId);
      entry.level = 21;
      return [heroId, entry];
    }),
  );
  state.team = ["luzhishen", "shiqian", "daizong"];
  state.currentChapter = 7;
  state.completedChapters = CHAPTERS.slice(0, 7).map(
    (chapter) => chapter.id,
  );
  state.stats.battlesWon = 24;
  state.bondArchive = ["wind_snow"];
  state.chainArchive = ["sky_break"];
  state.heroRecruitments.completed = Object.keys(HERO_RECRUITMENTS).filter(
    (heroId) => heroId !== "zhangqing",
  );

  const recruitment = HERO_RECRUITMENTS.zhangqing;
  assert.equal(
    recruitmentEnemyLevel(state, recruitment),
    13,
    "late recruitment enemies should follow chapter eight instead of active levels",
  );

  const teams = [
    recommendTeam(state).team,
    ["luzhishen", "shiqian", "daizong"],
  ];
  for (const team of teams) {
    state.team = [...team];
    for (let seed = 0; seed < 80; seed += 1) {
      const { battle } = recruitmentBattle(
        "zhangqing",
        cloneState(state),
      );
      assert.equal(
        simulateAutoBattle(battle, ["balanced"], 0x60000 + seed),
        "victory",
        `${team.join("、")} should clear 没羽入阵 with seed ${seed}`,
      );
    }
  }
});

test("first playthrough gives every chapter and recruitment a reachable route", () => {
  const campaign = simulateFirstPlaythrough();
  assert.equal(
    campaign.length,
    CHAPTERS.reduce(
      (total, chapter) => total + chapter.choice.options.length,
      0,
    ),
  );
  const weakChapters = campaign
    .filter((entry) => entry.victories < 160)
    .map((entry) => `${entry.title} ${entry.victories}/200`)
    .join("、");
  assert.equal(
    weakChapters,
    "",
    `Expected each chapter branch to win at least 160/200, failed: ${weakChapters}`,
  );
  for (const endingId of ["brotherhood", "order", "freedom"]) {
    assert.equal(
      openingCinematicProfile({ ending: endingId }).scenes.length,
      4,
      `${endingId} should not hide the next opening cinematic`,
    );
  }
});
