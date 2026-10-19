import assert from "node:assert/strict";
import test from "node:test";

import {
  ARENA_BOONS,
  ARENA_BOON_MASTERIES,
  ARENA_BOUNTIES,
  ARENA_ENCOUNTERS,
  ARENA_SYNERGIES,
  CAMP_BUILDINGS,
  CAMP_RECIPES,
  CHAPTERS,
  CHAIN_FORMATIONS,
  EQUIPMENT,
  HERO_BONDS,
  HERO_LEGENDS,
  HERO_ORDER,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HEROES,
} from "../src/data.js";
import {
  CHAPTER_MEDALS,
  SAVE_VERSION,
  activeHeroBonds,
  applyBattleRewards,
  applyHeroRecruitmentRewards,
  battleEnemyScale,
  buildCampBuilding,
  campAreaSize,
  campBuildingStatus,
  campRecipeStatus,
  checkAchievements,
  chooseNewestSaveText,
  claimHeroQuest,
  collectCampResource,
  craftCampItem,
  createInitialState,
  deriveHeroStats,
  discoverHeroBonds,
  discoverChainFormations,
  equipmentMatchesCategory,
  evaluateChapterMedals,
  expandCampArea,
  heroDoctrineUnlocked,
  heroLegendCompleted,
  heroLegendUnlocked,
  heroRecruitmentCompleted,
  heroRecruitmentUnlocked,
  heroQuestClaimed,
  heroQuestMasteryScale,
  heroQuestProgress,
  heroQuestUnlocked,
  isHeroQuestComplete,
  recommendTeam,
  setHeroDoctrine,
  validateSaveText,
} from "../src/state.js";

test("campaign victories raise enemy scaling within a fixed safety ceiling", () => {
  const state = createInitialState();
  const baseline = battleEnemyScale(state);
  const upgradedHero = state.team[0];
  const statsBeforeProgress = deriveHeroStats(state, upgradedHero);
  const chapterRewards = [];
  for (const chapter of CHAPTERS.slice(0, 3)) {
    chapterRewards.push(applyBattleRewards(state, chapter));
  }
  const statsAfterProgress = deriveHeroStats(state, upgradedHero);
  assert.ok(chapterRewards.every((reward) => reward.xp > 0));
  assert.ok(state.roster[upgradedHero].level > 1);
  assert.ok(statsAfterProgress.maxHp > statsBeforeProgress.maxHp);
  assert.ok(statsAfterProgress.atk > statsBeforeProgress.atk);

  state.completedChapters = [
    ...new Set(CHAPTERS.slice(0, 3).map((chapter) => chapter.id)),
  ];
  state.stats.battlesWon = 8;
  assert.ok(battleEnemyScale(state) > baseline);
  assert.ok(battleEnemyScale(state) < 1.1);

  state.completedChapters = CHAPTERS.map((chapter) => chapter.id).concat(
    CHAPTERS.map((chapter) => chapter.id),
    ["not-a-chapter"],
  );
  state.stats.battlesWon = 1000;
  assert.equal(battleEnemyScale(state), 1.22);
});

test("recommended formation keeps chain-ready path diversity while stacking bonds", () => {
  const state = createInitialState();
  state.recruited = [];
  state.roster = {};
  state.team = [null, null, null];
  for (const heroId of HERO_ORDER) {
    state.recruited.push(heroId);
    state.roster[heroId] = { level: 1, xp: 0, equipment: {} };
  }

  const recommendation = recommendTeam(state);
  const members = new Set(recommendation.team);
  assert.equal(recommendation.team.length, 3);
  assert.equal(new Set(recommendation.team).size, 3);
  assert.equal(
    new Set(recommendation.team.map((heroId) => HEROES[heroId].path)).size,
    3,
    "the advisor should leave the team able to trigger a three-path chain",
  );
  assert.equal(
    recommendation.bonds.length >= 2,
    true,
    "path diversity should not discard the strongest practical bond core",
  );
  for (const bond of recommendation.bonds) {
    assert.equal(
      bond.heroIds.every((heroId) => members.has(heroId)),
      true,
      `${bond.id} should be active in the recommended formation`,
    );
  }
});

test("camp grid expands through victories and unlocks buildings", () => {
  const state = createInitialState();
  assert.deepEqual(campAreaSize(state), [5, 4]);
  assert.equal(campBuildingStatus(state, "hall"), "built");
  assert.equal(campBuildingStatus(state, "farmland"), "locked");
  assert.equal(buildCampBuilding(state, "farmland").reason, "locked");
  state.stats.battlesWon = 2;
  assert.equal(campBuildingStatus(state, "farmland"), "available");
  const copper = state.inventory.copper;
  assert.equal(buildCampBuilding(state, "farmland").ok, true);
  assert.equal(state.inventory.copper, copper - CAMP_BUILDINGS.farmland.cost);
  assert.equal(buildCampBuilding(state, "farmland").reason, "built");
  state.stats.battlesWon = 5;
  assert.deepEqual(campAreaSize(state), [5, 5]);
  state.inventory.copper = 2000;
  assert.equal(expandCampArea(state).reason, "timber");
  state.camp.stock.timber = 4;
  assert.equal(expandCampArea(state).ok, true);
  assert.deepEqual(campAreaSize(state), [6, 5]);
  state.stats.battlesWon = 10;
  assert.deepEqual(campAreaSize(state), [6, 5]);
  state.inventory.copper += 500;
  state.camp.stock.timber = 8;
  state.camp.stock.iron_ore = 4;
  assert.equal(expandCampArea(state).ok, true);
  assert.equal(state.camp.areaUnlocked.length, 2);
  assert.deepEqual(campAreaSize(state), [8, 5]);
});

test("camp production turns wheat into flour and steamed buns", () => {
  const state = createInitialState();
  const mill = Object.values(CAMP_BUILDINGS).find(
    (building) => building.id === "mill",
  );
  const kitchen = Object.values(CAMP_BUILDINGS).find(
    (building) => building.id === "kitchen",
  );
  const farm = Object.values(CAMP_BUILDINGS).find(
    (building) => building.id === "farmland",
  );
  state.inventory.copper = 2000;
  state.stats.battlesWon = 5;
  for (const building of [farm, mill, kitchen]) {
    assert.equal(buildCampBuilding(state, building.id).ok, true);
  }
  assert.equal(collectCampResource(state, "farmland").ok, true);
  assert.equal(state.camp.stock.wheat, 2);
  assert.equal(craftCampItem(state, "grind_wheat").output, 1);
  assert.equal(state.camp.stock.wheat, 0);
  assert.equal(state.camp.stock.flour, 1);
  assert.equal(craftCampItem(state, "steam_bun").output, 2);
  assert.equal(state.camp.stock.flour, 0);
  assert.equal(state.camp.stock.steamed_bun, 2);
  assert.equal(craftCampItem(state, "steam_bun").reason, "material");
  assert.equal(CAMP_RECIPES.length, 2);
  assert.equal(campRecipeStatus(state, "grind_wheat").reason, "material");
});

test("legacy saves migrate into the current schema", () => {
  const legacy = {
    version: 1,
    difficulty: "normal",
    currentChapter: 1,
    completedChapters: ["ferry"],
    recruited: ["linchong", "luzhishen"],
    roster: {
      linchong: { level: 3, xp: 20, equipment: {} },
      luzhishen: { level: 2, xp: 0, equipment: {} },
    },
    team: ["linchong", "luzhishen", null],
    inventory: { copper: 200 },
    settings: {
      sound: false,
      battleSpeed: 3,
      autoTactic: "reckless",
    },
    stats: { battlesWon: 4, enemiesDefeated: 12, damageDealt: 900 },
  };

  const migrated = validateSaveText(JSON.stringify(legacy));
  assert.ok(migrated);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.settings.battleSpeed, 1);
  assert.equal(migrated.settings.sound, false);
  assert.equal(migrated.settings.uiScale, "normal");
  assert.equal(migrated.settings.highContrast, false);
  assert.equal(migrated.settings.autoArena, false);
  assert.equal(migrated.settings.autoBattle, true);
  assert.equal(migrated.settings.autoTactic, "balanced");
  assert.deepEqual(migrated.bondArchive, []);
  assert.deepEqual(migrated.chainArchive, []);
  assert.deepEqual(migrated.doctrines, {});
  assert.deepEqual(migrated.heroQuests, { claimed: [] });
  assert.deepEqual(migrated.heroLegends, { completed: [] });
  assert.deepEqual(migrated.heroRecruitments, { completed: [] });
  assert.ok(Array.isArray(migrated.achievements));
  assert.ok(Array.isArray(migrated.endingsUnlocked));
  assert.deepEqual(migrated.chapterMedals.ferry, []);
  assert.ok(migrated.arena);
  assert.equal(migrated.arena.bestScore, 0);
  assert.equal(migrated.arena.totalBounties, 0);
  assert.equal(migrated.arena.activeRun, null);
  assert.ok(migrated.heroMastery.linchong);
  assert.equal(migrated.heroMastery.linchong.wins, 4);
  assert.equal(validateSaveText("{broken"), null);
});

test("version 16 saves migrate recruitment progress without replaying rewards", () => {
  const state = createInitialState();
  state.version = 16;
  delete state.heroRecruitments;
  state.currentChapter = 4;
  state.recruited.push("yangzhi");
  state.roster.yangzhi = {
    level: 1,
    xp: 0,
    equipment: {},
  };
  state.heroRecruitments = { completed: ["yangzhi", "unknown"] };

  const migrated = validateSaveText(JSON.stringify(state));
  assert.ok(migrated);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.deepEqual(migrated.heroRecruitments.completed, ["yangzhi"]);
  assert.equal(heroRecruitmentCompleted(migrated, "yangzhi"), true);
  assert.equal(heroRecruitmentUnlocked(migrated, "yangzhi"), false);
  assert.equal(heroRecruitmentUnlocked(migrated, "gongsunsheng"), true);
});

test("version 24 saves migrate the expanded roster and default equipment", () => {
  const state = createInitialState();
  state.version = 24;
  state.recruited.push("yangxiong", "shixiu", "unknown");
  delete state.roster.yangxiong;
  state.roster.shixiu = {
    level: 4,
    xp: 20,
    equipment: { weapon: "worn_spear" },
  };

  const migrated = validateSaveText(JSON.stringify(state));
  assert.ok(migrated);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 27);
  assert.equal(migrated.recruited.includes("unknown"), false);
  assert.equal(migrated.recruited.includes("shixiu"), true);
  assert.equal(migrated.roster.yangxiong.level, 1);
  assert.equal(
    migrated.roster.yangxiong.equipment.weapon,
    "jizhou_falchion",
  );
  assert.equal(migrated.roster.shixiu.level, 4);
  assert.equal(migrated.roster.shixiu.equipment.weapon, "worn_spear");
  assert.equal(migrated.roster.shixiu.equipment.armor, "rooftop_jacket");
  assert.equal(
    migrated.roster.shixiu.equipment.token,
    "rope_dart",
  );
});

test("hero recruitment prerequisites gate each thread and reward only once", () => {
  const state = createInitialState();
  const recruitment = HERO_RECRUITMENTS.yangzhi;
  assert.equal(heroRecruitmentUnlocked(state, "yangzhi"), false);

  state.currentChapter = recruitment.requiredChapter;
  assert.equal(heroRecruitmentUnlocked(state, "yangzhi"), true);
  assert.equal(heroRecruitmentUnlocked(state, "gongsunsheng"), false);

  const copperBefore = state.inventory.copper;
  const first = applyHeroRecruitmentRewards(state, "yangzhi");
  assert.equal(first.ok, true);
  assert.equal(first.copper, recruitment.reward.copper);
  assert.equal(state.inventory.copper, copperBefore + recruitment.reward.copper);
  assert.equal(state.recruited.includes("yangzhi"), true);
  assert.equal(state.heroRecruitments.completed.includes("yangzhi"), true);
  state.currentChapter = HERO_RECRUITMENTS.gongsunsheng.requiredChapter;
  assert.equal(heroRecruitmentUnlocked(state, "gongsunsheng"), true);

  const copperAfterFirst = state.inventory.copper;
  const duplicate = applyHeroRecruitmentRewards(state, "yangzhi");
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "completed");
  assert.equal(state.inventory.copper, copperAfterFirst);
  assert.deepEqual(state.heroRecruitments.completed, ["yangzhi"]);
});

test("hero quests unlock in order, pay once, and add permanent mastery", () => {
  const state = createInitialState();
  state.currentChapter = 1;
  state.heroMastery.linchong.wins = 2;
  state.heroMastery.linchong.ultimates = 2;
  const [firstQuest, secondQuest] = HERO_QUESTS.linchong;
  const statsBefore = deriveHeroStats(state, "linchong");
  const copperBefore = state.inventory.copper;

  assert.equal(heroQuestUnlocked(state, firstQuest.id), true);
  assert.equal(heroQuestUnlocked(state, secondQuest.id), false);
  assert.equal(heroQuestProgress(state, firstQuest.id), 2);
  assert.equal(isHeroQuestComplete(state, firstQuest.id), true);

  const firstClaim = claimHeroQuest(state, firstQuest.id);
  assert.equal(firstClaim.ok, true);
  assert.equal(firstClaim.copper, firstQuest.reward.copper);
  assert.equal(firstClaim.xp, firstQuest.reward.xp);
  assert.equal(state.inventory.copper, copperBefore + firstQuest.reward.copper);
  assert.equal(state.roster.linchong.xp, firstQuest.reward.xp);
  assert.equal(heroQuestClaimed(state, firstQuest.id), true);
  assert.equal(heroQuestMasteryScale(state, "linchong"), 1.005);
  assert.ok(
    deriveHeroStats(state, "linchong").maxHp > statsBefore.maxHp,
    "a completed hero quest should increase all-around combat stats",
  );

  const copperAfterFirst = state.inventory.copper;
  const duplicate = claimHeroQuest(state, firstQuest.id);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "claimed");
  assert.equal(state.inventory.copper, copperAfterFirst);

  state.currentChapter = 3;
  assert.equal(heroQuestUnlocked(state, secondQuest.id), true);
  assert.equal(claimHeroQuest(state, secondQuest.id).ok, true);
  assert.equal(heroQuestMasteryScale(state, "linchong"), 1.01);

  state.heroQuests.claimed.push(firstQuest.id, "unknown_quest");
  const restored = validateSaveText(JSON.stringify(state));
  assert.deepEqual(restored.heroQuests.claimed, [
    firstQuest.id,
    secondQuest.id,
  ]);
});

test("hero legends migrate, sanitize, and unlock from campaign progress", () => {
  const state = createInitialState();
  const legend = HERO_LEGENDS.linchong;
  state.currentChapter = legend.requiredChapter;
  assert.equal(heroLegendUnlocked(state, "linchong"), false);
  assert.equal(heroLegendCompleted(state, "linchong"), false);

  state.currentChapter = legend.requiredChapter - 1;
  assert.equal(heroLegendUnlocked(state, "linchong"), false);
  state.currentChapter = legend.requiredChapter;
  state.heroQuests.claimed = HERO_QUESTS.linchong.map((quest) => quest.id);
  assert.equal(heroLegendUnlocked(state, "linchong"), true);

  state.recruited = state.recruited.filter((heroId) => heroId !== "linchong");
  assert.equal(heroLegendUnlocked(state, "linchong"), false);
  state.recruited.push("linchong");

  state.heroLegends.completed = [legend.id, "unknown_legend", legend.id];
  const restored = validateSaveText(JSON.stringify(state));
  assert.deepEqual(restored.heroLegends.completed, [legend.id]);
  assert.equal(heroLegendCompleted(restored, "linchong"), true);

  state.heroLegends.completed = ["unknown_legend"];
  const sanitized = validateSaveText(JSON.stringify(state));
  assert.deepEqual(sanitized.heroLegends.completed, []);
});

test("hero doctrines unlock after three trials and can be switched freely", () => {
  const state = createInitialState();
  assert.equal(heroDoctrineUnlocked(state, "linchong"), false);
  assert.equal(setHeroDoctrine(state, "linchong", "garrison"), false);

  state.heroMastery.linchong.trials = ["first_star", "oath_echo", "slayer_name"];
  assert.equal(heroDoctrineUnlocked(state, "linchong"), true);
  assert.equal(setHeroDoctrine(state, "linchong", "garrison"), true);
  assert.equal(state.doctrines.linchong, "garrison");
  assert.equal(setHeroDoctrine(state, "linchong", "snowblade"), true);
  assert.equal(state.doctrines.linchong, "snowblade");
  assert.equal(setHeroDoctrine(state, "linchong", "unknown"), false);

  const restored = validateSaveText(JSON.stringify(state));
  assert.equal(restored.doctrines.linchong, "snowblade");
  state.doctrines.linchong = "unknown";
  const sanitized = validateSaveText(JSON.stringify(state));
  assert.deepEqual(sanitized.doctrines, {});
});

test("hero bond archive discovers once and grants its first-use rewards", () => {
  const state = createInitialState();
  state.recruited = ["linchong", "luzhishen", "wusong"];
  state.roster = {
    linchong: { level: 1, xp: 0, equipment: {} },
    luzhishen: { level: 1, xp: 0, equipment: {} },
    wusong: { level: 1, xp: 0, equipment: {} },
  };
  state.team = ["linchong", "luzhishen", "wusong"];

  assert.deepEqual(
    activeHeroBonds(state).map((bond) => bond.id),
    ["wind_snow", "three_mountains"],
  );

  const battle = {
    bondIds: ["wind_snow", "three_mountains"],
    heroes: state.recruited.map((heroId) => ({ refId: heroId })),
  };
  const copperBefore = state.inventory.copper;
  const first = discoverHeroBonds(state, battle);
  assert.deepEqual(
    first.bonds.map((bond) => bond.id),
    ["wind_snow", "three_mountains"],
  );
  assert.equal(first.copper, 300);
  assert.equal(first.xp, 150);
  assert.equal(state.inventory.copper, copperBefore + 300);
  assert.deepEqual(state.bondArchive, ["wind_snow", "three_mountains"]);
  assert.equal(
    state.roster.linchong.xp,
    150,
    "first discovery should grant experience to the fielded heroes",
  );

  const second = discoverHeroBonds(state, battle);
  assert.deepEqual(second.bonds, []);
  assert.equal(state.inventory.copper, copperBefore + 300);
});

test("star-chain archives discover once and reward the fielded formation", () => {
  const state = createInitialState();
  state.recruited = ["linchong", "wusong", "wuyong"];
  state.roster = {
    linchong: { level: 1, xp: 0, equipment: {} },
    wusong: { level: 1, xp: 0, equipment: {} },
    wuyong: { level: 1, xp: 0, equipment: {} },
  };
  state.team = ["linchong", "wusong", "wuyong"];
  const battle = {
    chainFormationIds: ["sky_break", "wind_thunder"],
    heroes: state.recruited.map((heroId) => ({ refId: heroId })),
  };
  const copperBefore = state.inventory.copper;

  const first = discoverChainFormations(state, battle);
  assert.deepEqual(
    first.formations.map((formation) => formation.id),
    ["sky_break", "wind_thunder"],
  );
  assert.equal(
    first.copper,
    CHAIN_FORMATIONS.sky_break.reward.copper +
      CHAIN_FORMATIONS.wind_thunder.reward.copper,
  );
  assert.deepEqual(state.chainArchive, ["sky_break", "wind_thunder"]);
  assert.equal(state.inventory.copper, copperBefore + first.copper);
  assert.ok(
    state.roster.wuyong.xp > 0 || state.roster.wuyong.level > 1,
    "fielded heroes should receive first-discovery experience",
  );

  const second = discoverChainFormations(state, battle);
  assert.deepEqual(second.formations, []);
  assert.equal(state.inventory.copper, copperBefore + first.copper);
});

test("accessibility settings survive valid saves and sanitize invalid values", () => {
  const state = createInitialState();
  state.settings.uiScale = "largest";
  state.settings.highContrast = true;
  state.settings.autoArena = true;
  state.settings.autoTactic = "hunter";
  const restored = validateSaveText(JSON.stringify(state));
  assert.equal(restored.settings.uiScale, "largest");
  assert.equal(restored.settings.highContrast, true);
  assert.equal(restored.settings.autoArena, true);
  assert.equal(restored.settings.autoTactic, "hunter");

  state.settings.uiScale = "oversized";
  state.settings.highContrast = 1;
  state.settings.autoTactic = "unknown";
  const sanitized = validateSaveText(JSON.stringify(state));
  assert.equal(sanitized.settings.uiScale, "normal");
  assert.equal(sanitized.settings.highContrast, true);
  assert.equal(sanitized.settings.autoArena, true);
  assert.equal(sanitized.settings.autoTactic, "balanced");
});

test("active arena runs survive migration with duplicate boons intact", () => {
  const state = createInitialState();
  state.arena.activeRun = {
    wave: 7,
    boons: ["vanguard", "vanguard", "vanguard", "rally", "rally", "unknown"],
    trialIds: [
      "black_cloud",
      "unknown",
      "iron_wall",
      "evil_wind",
      "cut_supply",
    ],
    healthRatios: { linchong: 0.42, luzhishen: 2, invalid: "bad" },
    completedWave: 6,
    rerollUsed: true,
    lastReward: { copper: 88, xp: 62, score: 540 },
    score: 2380,
    bountiesCleared: 3,
    currentBounty: "chain",
    lastBounty: { id: "breaker", cleared: true, copper: 40, score: 170 },
    lastPerformance: {
      grade: "S",
      bonusScore: 100,
      rounds: 5,
      survivors: 3,
      heroCount: 3,
      mvpHeroId: "linchong",
      mvpDamage: 920,
      mvpKills: 2,
      mvpUltimates: 1,
      objectives: [
        { id: "unbroken", label: "全阵而归", met: true },
        { id: "unknown", label: "无效目标", met: true },
      ],
    },
    defeated: false,
  };
  state.arena.starTrials = {
    bestScore: 2380,
    bestWave: 6,
    maxSelected: 99,
    runs: 2,
  };

  const restored = validateSaveText(JSON.stringify(state));
  assert.deepEqual(restored.arena.activeRun.boons, [
    "vanguard",
    "vanguard",
    "vanguard",
    "rally",
    "rally",
  ]);
  assert.equal(restored.arena.activeRun.wave, 7);
  assert.deepEqual(restored.arena.activeRun.trialIds, [
    "black_cloud",
    "iron_wall",
    "evil_wind",
  ]);
  assert.deepEqual(restored.arena.starTrials, {
    bestScore: 2380,
    bestWave: 6,
    maxSelected: 3,
    runs: 2,
  });
  assert.equal(restored.arena.activeRun.healthRatios.linchong, 0.42);
  assert.equal(restored.arena.activeRun.healthRatios.luzhishen, 1);
  assert.equal(restored.arena.activeRun.currentBounty, "chain");
  assert.equal(restored.arena.activeRun.rerollUsed, true);
  assert.equal(restored.arena.activeRun.score, 2380);
  assert.equal(restored.arena.activeRun.lastBounty.cleared, true);
  assert.equal(restored.arena.activeRun.lastPerformance.grade, "S");
  assert.equal(restored.arena.activeRun.lastPerformance.mvpHeroId, "linchong");
  assert.deepEqual(restored.arena.activeRun.lastPerformance.objectives, [
    { id: "unbroken", label: "全阵而归", met: true },
  ]);
});

test("arena masteries, synergies, and bounties reference valid content", () => {
  const boonIds = new Set(Object.keys(ARENA_BOONS));
  assert.deepEqual(
    Object.keys(ARENA_BOON_MASTERIES).sort(),
    [...boonIds].sort(),
  );
  for (const synergy of Object.values(ARENA_SYNERGIES)) {
    assert.ok(synergy.requires.length >= 2);
    for (const [boonId, count] of synergy.requires) {
      assert.equal(boonIds.has(boonId), true);
      assert.ok(count >= 2);
    }
  }

  const battle = {
    heroes: [{ hp: 10 }, { hp: 5 }],
    round: 4,
    arenaWave: 3,
    chainAttacks: 1,
    poiseBreaks: 2,
    heroMetrics: {
      linchong: { ultimates: 1 },
      wusong: { ultimates: 1 },
    },
  };
  assert.equal(
    ARENA_BOUNTIES.every((bounty) => bounty.check(battle)),
    true,
  );
});

test("cloud save selection keeps the newest valid timeline", () => {
  const local = createInitialState();
  local.lastSavedAt = "2026-10-18T10:00:00.000Z";
  local.inventory.copper = 220;
  const cloud = {
    ...local,
    lastSavedAt: "2026-10-18T11:00:00.000Z",
    inventory: { ...local.inventory, copper: 440 },
  };

  const fromCloud = chooseNewestSaveText(
    JSON.stringify(local),
    JSON.stringify(cloud),
  );
  assert.equal(fromCloud.source, "cloud");
  assert.equal(JSON.parse(fromCloud.text).inventory.copper, 440);

  const fromLocal = chooseNewestSaveText(
    JSON.stringify(local),
    JSON.stringify({ ...cloud, lastSavedAt: "2026-10-18T09:00:00.000Z" }),
  );
  assert.equal(fromLocal.source, "local");
  assert.equal(JSON.parse(fromLocal.text).inventory.copper, 220);

  assert.equal(chooseNewestSaveText("{broken", JSON.stringify(cloud)).source, "cloud");
  assert.equal(chooseNewestSaveText(JSON.stringify(local), "{broken").source, "local");
  assert.equal(chooseNewestSaveText("{broken", "{broken"), null);
});

test("achievements grant rewards once and persist their unlock id", () => {
  const state = createInitialState();
  state.stats.battlesWon = 1;
  const startingCopper = state.inventory.copper;
  const startingXp = state.roster.linchong.xp;

  const unlocked = checkAchievements(state);
  assert.deepEqual(
    unlocked.map((achievement) => achievement.id),
    ["first_blood"],
  );
  assert.ok(state.achievements.includes("first_blood"));
  assert.equal(state.inventory.copper, startingCopper + 80);
  assert.equal(state.roster.linchong.xp, startingXp + 40);

  const copperAfterUnlock = state.inventory.copper;
  assert.deepEqual(checkAchievements(state), []);
  assert.equal(state.inventory.copper, copperAfterUnlock);
});

test("formation discoveries unlock permanent archive achievements", () => {
  const state = createInitialState();
  state.arena.discoveries = {
    masteries: Object.keys(ARENA_BOON_MASTERIES),
    synergies: Object.keys(ARENA_SYNERGIES),
    encounters: Object.keys(ARENA_ENCOUNTERS),
  };

  const unlocked = checkAchievements(state);
  assert.deepEqual(
    unlocked.map((achievement) => achievement.id),
    ["arena_masteries", "arena_synergies", "arena_encounters"],
  );
  assert.equal(state.achievements.includes("arena_masteries"), true);
  assert.equal(state.achievements.includes("arena_synergies"), true);
  assert.equal(state.achievements.includes("arena_encounters"), true);
});

test("campaign rewards recruit heroes and advance the chapter", () => {
  const state = createInitialState();
  const chapter = CHAPTERS[0];
  const startingCopper = state.inventory.copper;
  const reward = applyBattleRewards(state, chapter);

  assert.equal(state.inventory.copper, startingCopper + reward.copper);
  assert.ok(state.recruited.includes("luzhishen"));
  assert.ok(state.completedChapters.includes("ferry"));
  assert.equal(state.currentChapter, 1);
  assert.equal(state.stats.battlesWon, 1);
  assert.equal(reward.item, "bamboo_token");
});

test("equipment categories are derived from item slots", () => {
  for (const item of Object.values(EQUIPMENT)) {
    assert.equal(equipmentMatchesCategory(item.id, "all"), true);
    assert.equal(equipmentMatchesCategory(item.id, item.slot), true);
    for (const slot of ["weapon", "armor", "token"]) {
      if (slot !== item.slot) {
        assert.equal(equipmentMatchesCategory(item.id, slot), false);
      }
    }
  }
  assert.equal(equipmentMatchesCategory("not-an-item", "all"), false);
});

test("replaying a chapter reduces rewards without duplicating completion", () => {
  const state = createInitialState();
  state.completedChapters = ["ferry"];
  state.currentChapter = 1;
  const chapter = CHAPTERS[0];
  const copperBefore = state.inventory.copper;
  const itemBefore = state.inventory.bamboo_token;

  const reward = applyBattleRewards(state, chapter, true);
  assert.equal(state.inventory.copper, copperBefore + reward.copper);
  assert.equal(reward.item, null);
  assert.equal(state.inventory.bamboo_token, itemBefore);
  assert.deepEqual(state.completedChapters, ["ferry"]);
  assert.equal(state.currentChapter, 1);
});

test("chapter medals are evaluated once and complete a permanent rating", () => {
  const state = createInitialState();
  const chapter = CHAPTERS[0];
  const battle = {
    round: chapter.parRounds - 1,
    chainAttacks: 1,
    heroes: [{ hp: 10 }, { hp: 20 }],
  };
  const copperBefore = state.inventory.copper;

  const first = evaluateChapterMedals(state, chapter, battle);
  assert.deepEqual(
    first.earned,
    CHAPTER_MEDALS.map((medal) => medal.id),
  );
  assert.equal(first.newlyEarned.length, CHAPTER_MEDALS.length);
  assert.equal(first.completed, true);
  assert.ok(first.copper > 0);
  assert.equal(state.inventory.copper, copperBefore + first.copper);

  const copperAfter = state.inventory.copper;
  const second = evaluateChapterMedals(state, chapter, battle);
  assert.deepEqual(second.newlyEarned, []);
  assert.equal(second.copper, 0);
  assert.equal(state.inventory.copper, copperAfter);
});

test("chapter medal achievements unlock at three and across all chapters", () => {
  const state = createInitialState();
  state.chapterMedals = {
    ferry: ["unbroken", "star_combo", "swift"],
  };
  assert.deepEqual(
    checkAchievements(state).map((achievement) => achievement.id),
    ["medal_three"],
  );
  assert.equal(state.achievements.includes("medal_all"), false);

  state.chapterMedals = Object.fromEntries(
    CHAPTERS.map((chapter) => [
      chapter.id,
      ["unbroken", "star_combo", "swift"],
    ]),
  );
  const unlocked = checkAchievements(state).map((achievement) => achievement.id);
  assert.ok(unlocked.includes("medal_all"));
  assert.equal(state.achievements.includes("medal_all"), true);
});
