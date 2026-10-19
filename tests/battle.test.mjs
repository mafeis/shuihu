import assert from "node:assert/strict";
import test from "node:test";

import {
  ARENA_ENCOUNTERS,
  CHAPTERS,
  CHAIN_FORMATIONS,
  ENEMIES,
  HEROES,
  HERO_LEGENDS,
  HERO_RECRUITMENTS,
} from "../src/data.js";
import {
  chainFormationForBattle,
  chainPathsForBattle,
  createBattle,
  enemySkillList,
  heroSkillList,
  performChainAttack,
  performAction,
  startNextTurn,
} from "../src/battle.js";
import { createInitialState } from "../src/state.js";

function stateWithTeam(heroIds) {
  const state = createInitialState();
  state.recruited = [...heroIds];
  state.roster = Object.fromEntries(
    heroIds.map((heroId) => [
      heroId,
      { level: 1, xp: 0, equipment: {} },
    ]),
  );
  state.team = [...heroIds, null, null, null].slice(0, 3);
  return state;
}

function withRandom(value, callback) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return callback();
  } finally {
    Math.random = original;
  }
}

function triggerBoss(chapterId, bossId) {
  const state = createInitialState();
  const chapter = CHAPTERS.find((item) => item.id === chapterId);
  const battle = createBattle(state, chapter);
  const boss = battle.enemies.find((unit) => unit.refId === bossId);
  boss.hp = Math.round(boss.maxHp * 0.48);
  battle.turnQueue = [boss.uid];
  battle.phase = "skipping";
  const hpBefore = boss.hp;
  startNextTurn(battle);
  return { battle, boss, hpBefore };
}

function legendBattle(state, heroId, enemyLevel = 10) {
  const legend = HERO_LEGENDS[heroId];
  const chapter = {
    id: `legend-${legend.id}`,
    title: legend.title,
    location: legend.location,
    bg: legend.bg,
    battle: {
      enemies: legend.enemies.map((enemy) => ({
        ...enemy,
        level: enemyLevel,
      })),
    },
  };
  return createBattle(state, chapter, {
    mode: "legend",
    legendHeroId: heroId,
    legendRule: legend.rule,
  });
}

test("captain boss phase heals and gains guard", () => {
  const { battle, boss, hpBefore } = triggerBoss("liangshan", "captain");
  assert.equal(boss.bossPhaseTriggered, true);
  assert.ok(boss.hp > hpBefore);
  assert.equal(boss.statuses.guard, 2);
  assert.equal(boss.statuses.inspiration, 2);
  assert.match(
    battle.log.find((entry) => entry.type === "boss").text,
    /恢复 .* 生命/,
  );
});

test("executioner boss phase applies bleeding and armor break", () => {
  const { battle, boss } = triggerBoss("jiangzhou", "executioner");
  assert.equal(boss.bossPhaseTriggered, true);
  assert.equal(boss.yiqi, 100);
  assert.equal(boss.statuses.inspiration, 3);
  for (const hero of battle.heroes) {
    assert.equal(hero.statuses.bleeding, 2);
    assert.equal(hero.statuses.armorBreak, 2);
  }
  assert.match(
    battle.log.find((entry) => entry.type === "boss").text,
    /断头令/,
  );
});

test("battle setup applies health ratios and enemy scaling", () => {
  const state = createInitialState();
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter, {
    enemyScale: 1.5,
    healthRatios: { linchong: 0.5 },
  });
  const baseBattle = createBattle(state, chapter);
  const hero = battle.heroes.find((unit) => unit.refId === "linchong");
  const enemy = battle.enemies[0];
  assert.equal(hero.hp, Math.round(hero.maxHp * 0.5));
  assert.ok(enemy.maxHp > baseBattle.enemies[0].maxHp);
  assert.equal(battle.phase === "select" || battle.phase === "enemy", true);
});

test("a zero enemy scale remains valid for newly skipped combat", () => {
  const state = createInitialState();
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter, { enemyScale: 0 });
  assert.equal(battle.enemies.every((unit) => unit.hp === 0), true);
});

test("battle actions expose hit, critical, evade and heal feedback", () => {
  const state = stateWithTeam(["linchong", "wusong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");

  const damageBattle = createBattle(state, chapter);
  const attacker = damageBattle.heroes.find((unit) => unit.refId === "linchong");
  const target = damageBattle.enemies[0];
  target.hp = target.maxHp = 1_000_000;
  damageBattle.phase = "select";
  damageBattle.currentUid = attacker.uid;
  const strike = heroSkillList(attacker).find((skill) => skill.power > 0);
  const damageResult = withRandom(0.5, () =>
    performAction(damageBattle, attacker.uid, strike, target.uid),
  );
  const hit = damageResult.events.find(
    (event) => event.type === "damage" && event.targetUid === target.uid,
  );
  assert.ok(hit, "an attack should emit damage feedback for its target");
  assert.ok(hit.damage >= 5);
  assert.equal(typeof hit.critical, "boolean");

  const evadeBattle = createBattle(state, chapter);
  const yanqing = evadeBattle.heroes.find((unit) => unit.refId === "yanqing");
  const enemy = evadeBattle.enemies[0];
  evadeBattle.phase = "enemy";
  evadeBattle.currentUid = enemy.uid;
  const enemyStrike = enemySkillList(enemy).find((skill) => skill.power > 0);
  const evadeResult = withRandom(0, () =>
    performAction(evadeBattle, enemy.uid, enemyStrike, yanqing.uid),
  );
  assert.deepEqual(
    evadeResult.events.find((event) => event.targetUid === yanqing.uid),
    { type: "evade", targetUid: yanqing.uid },
  );

  const healBattle = createBattle(state, chapter);
  const healer = healBattle.heroes.find((unit) => unit.refId === "linchong");
  healer.hp = Math.round(healer.maxHp * 0.5);
  healBattle.phase = "select";
  healBattle.currentUid = healer.uid;
  const healSkill = {
    id: "heal_probe",
    name: "疗伤试招",
    target: "ally",
    heal: 0.2,
  };
  const healResult = performAction(
    healBattle,
    healer.uid,
    healSkill,
    healer.uid,
  );
  const healing = healResult.events.find((event) => event.type === "heal");
  assert.equal(healing.targetUid, healer.uid);
  assert.ok(healing.healing > 0);
});

test("weekly enemy modifiers affect enemy stats without changing hero scaling", () => {
  const state = createInitialState();
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const baseBattle = createBattle(state, chapter);
  const weeklyBattle = createBattle(state, chapter, {
    enemyModifiers: { hpPct: 0.14, atkPct: 0.08, spdPct: 0.12 },
  });

  const baseEnemy = baseBattle.enemies[0];
  const weeklyEnemy = weeklyBattle.enemies[0];
  assert.ok(weeklyEnemy.maxHp > baseEnemy.maxHp);
  assert.ok(weeklyEnemy.atk > baseEnemy.atk);
  assert.ok(weeklyEnemy.spd > baseEnemy.spd);
  assert.equal(weeklyBattle.heroes[0].maxHp, baseBattle.heroes[0].maxHp);
  assert.deepEqual(weeklyBattle.enemyModifiers, {
    hpPct: 0.14,
    atkPct: 0.08,
    defPct: 0,
    spdPct: 0.12,
  });
});

test("hero bonds activate from the fielded trio and alter battle setup", () => {
  const solo = createInitialState();
  const bonded = createInitialState();
  bonded.recruited = ["linchong", "luzhishen", "wusong"];
  bonded.roster = {
    linchong: { level: 1, xp: 0, equipment: {} },
    luzhishen: { level: 1, xp: 0, equipment: {} },
    wusong: { level: 1, xp: 0, equipment: {} },
  };
  bonded.team = ["linchong", "luzhishen", "wusong"];

  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const soloBattle = createBattle(solo, chapter);
  const bondedBattle = createBattle(bonded, chapter);

  assert.deepEqual(bondedBattle.bondIds, ["wind_snow", "three_mountains"]);
  assert.equal(bondedBattle.modifiers.hpPct, 0.06);
  assert.equal(soloBattle.modifiers.hpPct, 0);
  assert.ok(
    bondedBattle.heroes.every((hero) => hero.statuses.guard >= 1),
    "defensive pair bond should open with guard",
  );
  assert.ok(
    bondedBattle.heroes.every((hero) => hero.yiqi >= 25),
    "trio bond should grant opening yiqi",
  );
  assert.match(
    bondedBattle.log.map((entry) => entry.text).join(" "),
    /兄弟契成阵/,
  );
});

test("unlocked hero doctrines alter the fielded hero and battle state", () => {
  const state = createInitialState();
  state.heroMastery.linchong.trials = [
    "first_star",
    "oath_echo",
    "slayer_name",
  ];
  state.doctrines.linchong = "garrison";
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const baseBattle = createBattle(createInitialState(), chapter);
  const battle = createBattle(state, chapter);
  const hero = battle.heroes.find((unit) => unit.refId === "linchong");
  const baseHero = baseBattle.heroes.find((unit) => unit.refId === "linchong");

  assert.equal(hero.doctrineId, "garrison");
  assert.equal(hero.doctrineName, "禁军铁壁");
  assert.ok(hero.def > baseHero.def);
  assert.ok(hero.statuses.guard >= 2);
  assert.equal(battle.doctrines.linchong, "garrison");
  assert.match(
    battle.log.map((entry) => entry.text).join(" "),
    /星命命途.*林冲·禁军铁壁/,
  );
});

test("star-chain records three distinct paths without double-counting a repeated path", () => {
  const state = stateWithTeam(["linchong", "wusong", "wuyong"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const [linchong, wusong, wuyong] = battle.heroes;
  const target = battle.enemies[0];
  target.hp = 1_000_000;
  target.maxHp = 1_000_000;
  const probe = {
    id: "chain_probe",
    name: "星命试招",
    target: "enemy",
    power: 0.01,
    poise: 0,
    combo: true,
  };
  const act = (actor) => {
    battle.phase = "select";
    battle.currentUid = actor.uid;
    performAction(battle, actor.uid, probe, target.uid);
  };

  act(linchong);
  act(wusong);
  act(linchong);
  assert.deepEqual(chainPathsForBattle(battle), ["ling", "gang"]);
  assert.equal(battle.chain, 2);
  assert.equal(battle.chainReady, false);

  act(wuyong);
  assert.deepEqual(chainPathsForBattle(battle), ["ling", "gang", "tao"]);
  assert.equal(battle.chain, 3);
  assert.equal(battle.chainReady, true);
  assert.equal(chainFormationForBattle(battle).id, "sky_break");
});

test("star-chain attacks resolve into four distinct three-path formations", () => {
  const cases = [
    {
      formationId: "sky_break",
      heroIds: ["linchong", "wusong", "wuyong"],
    },
    {
      formationId: "hundred_birds",
      heroIds: ["linchong", "wusong", "andaoquan"],
    },
    {
      formationId: "iron_bastion",
      heroIds: ["linchong", "wuyong", "andaoquan"],
    },
    {
      formationId: "wind_thunder",
      heroIds: ["wusong", "wuyong", "andaoquan"],
    },
  ];
  const chapter = CHAPTERS.find((item) => item.id === "ferry");

  for (const testCase of cases) {
    const battle = createBattle(
      stateWithTeam(testCase.heroIds),
      chapter,
    );
    battle.phase = "select";
    battle.currentUid = battle.heroes[0].uid;
    battle.chain = 3;
    battle.chainReady = true;
    battle.chainHeroes = battle.heroes.map((hero) => hero.uid);
    for (const enemy of battle.enemies) {
      enemy.hp = 1_000_000;
      enemy.maxHp = 1_000_000;
      enemy.poise = 0;
      enemy.poiseMax = 1_000_000;
    }
    if (testCase.formationId === "iron_bastion") {
      for (const hero of battle.heroes) {
        hero.hp = Math.round(hero.maxHp * 0.4);
      }
    }

    const formation = chainFormationForBattle(battle);
    assert.equal(formation.id, testCase.formationId);
    assert.equal(formation, CHAIN_FORMATIONS[testCase.formationId]);

    const result = performChainAttack(battle, battle.heroes[0].uid);
    assert.equal(result.formationId, testCase.formationId);
    assert.match(result.lines[0], new RegExp(formation.name));
    assert.deepEqual(battle.chainFormationIds, [testCase.formationId]);

    if (formation.enemyStatus) {
      assert.ok(
        battle.enemies.every(
          (enemy) => enemy.statuses[formation.enemyStatus.status] >= 2,
        ),
      );
    }
    if (formation.teamGuard) {
      assert.ok(
        battle.heroes.every(
          (hero) => hero.statuses.guard >= formation.teamGuard,
        ),
      );
    }
    if (formation.teamInspiration) {
      assert.ok(
        battle.heroes.every(
          (hero) => hero.statuses.inspiration >= formation.teamInspiration,
        ),
      );
    }
    if (formation.teamHealPct) {
      assert.ok(
        battle.heroes.every((hero) => hero.hp > Math.round(hero.maxHp * 0.4)),
      );
    }
  }
});

test("Songjiang triggers one team-wide rescue when an ally falls below 35% hp", () => {
  const state = stateWithTeam(["songjiang", "linchong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const target = battle.heroes.find((unit) => unit.refId === "linchong");
  const enemy = battle.enemies[0];
  target.hp = Math.round(target.maxHp * 0.35) + 1;
  enemy.atk = 0;
  const strike = {
    id: "test_rescue",
    name: "试炼重击",
    target: "enemy",
    power: 0.01,
    poise: 0,
  };

  const result = withRandom(0.5, () =>
    performAction(battle, enemy.uid, strike, target.uid),
  );

  assert.equal(battle.timelyRescueUsed, true);
  assert.ok(target.hp > 0);
  assert.ok(
    battle.heroes.every((hero) => hero.statuses.guard >= 1),
    "the rescue should guard every living hero",
  );
  assert.match(result.lines.join(" "), /呼保义/);
});

test("Husanniang deals bonus damage to armored-broken targets", () => {
  const state = stateWithTeam(["husanniang", "linchong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const hero = battle.heroes.find((unit) => unit.refId === "husanniang");
  const target = battle.enemies[0];
  const moonSlash = HEROES.husanniang.skills.find(
    (skill) => skill.id === "hu_moon",
  );
  target.hp = 9999;
  target.maxHp = 9999;
  target.statuses.armorBreak = 0;
  const plainHp = target.hp;
  withRandom(0.5, () =>
    performAction(battle, hero.uid, moonSlash, target.uid),
  );
  const plainDamage = plainHp - target.hp;

  const armoredBattle = createBattle(state, chapter);
  const armoredHero = armoredBattle.heroes.find(
    (unit) => unit.refId === "husanniang",
  );
  const armoredTarget = armoredBattle.enemies[0];
  armoredTarget.hp = 9999;
  armoredTarget.maxHp = 9999;
  armoredTarget.statuses.armorBreak = 2;
  const armoredHp = armoredTarget.hp;
  withRandom(0.5, () =>
    performAction(
      armoredBattle,
      armoredHero.uid,
      moonSlash,
      armoredTarget.uid,
    ),
  );
  const armoredDamage = armoredHp - armoredTarget.hp;

  assert.ok(
    armoredDamage >= Math.round(plainDamage * 1.35),
    `expected a meaningful armor-break bonus, got ${plainDamage} -> ${armoredDamage}`,
  );
});

test("Songjiang and Wuyong grant their distinct opening yiqi bonuses", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const songjiangBattle = createBattle(
    stateWithTeam(["songjiang", "wusong", "yanqing"]),
    chapter,
  );
  const wuyongBattle = createBattle(
    stateWithTeam(["wuyong", "wusong", "yanqing"]),
    chapter,
  );
  const pairedBattle = createBattle(
    stateWithTeam(["songjiang", "wuyong", "yanqing"]),
    chapter,
  );

  assert.ok(
    songjiangBattle.heroes.every((hero) => hero.yiqi === 25),
    "Songjiang should add 10 opening yiqi",
  );
  assert.ok(
    wuyongBattle.heroes.every((hero) => hero.yiqi === 29),
    "Wuyong should add 14 opening yiqi",
  );
  assert.ok(
    pairedBattle.heroes.every((hero) => hero.yiqi === 57),
    "their bond should add another 18 opening yiqi",
  );
});

test("Yanqing evades the first direct hit each round and gains yiqi", () => {
  const state = stateWithTeam(["yanqing", "linchong", "wusong"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const yanqing = battle.heroes.find((unit) => unit.refId === "yanqing");
  const enemy = battle.enemies[0];
  const enemyStrike = ENEMIES.runner.skills[0];
  const hpBefore = yanqing.hp;
  const yiqiBefore = yanqing.yiqi;

  const result = withRandom(0, () =>
    performAction(battle, enemy.uid, enemyStrike, yanqing.uid),
  );

  assert.equal(yanqing.hp, hpBefore);
  assert.equal(yanqing.yiqi, Math.min(100, yiqiBefore + 12));
  assert.match(result.lines.join(" "), /借势闪避/);
});

test("Yang Zhi counters from the front row while Zhang Shun evades and gains yiqi", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const counterBattle = createBattle(
    stateWithTeam(["yangzhi", "linchong", "yanqing"]),
    chapter,
  );
  const yangzhi = counterBattle.heroes.find(
    (hero) => hero.refId === "yangzhi",
  );
  const counterEnemy = counterBattle.enemies[0];
  counterEnemy.hp = 9999;
  counterEnemy.maxHp = 9999;
  counterEnemy.atk = 18;
  const counterHpBefore = counterEnemy.hp;
  const strike = {
    id: "passive_test_strike",
    name: "试击",
    target: "enemy",
    power: 0.12,
    poise: 0,
  };
  const counterResult = withRandom(0, () =>
    performAction(
      counterBattle,
      counterEnemy.uid,
      strike,
      yangzhi.uid,
    ),
  );
  assert.ok(counterEnemy.hp < counterHpBefore);
  assert.match(counterResult.lines.join(" "), /杨志挺枪反击/);

  const evadeBattle = createBattle(
    stateWithTeam(["zhangshun", "linchong", "yanqing"]),
    chapter,
  );
  const zhangshun = evadeBattle.heroes.find(
    (hero) => hero.refId === "zhangshun",
  );
  const evadeEnemy = evadeBattle.enemies[0];
  const evasionHpBefore = zhangshun.hp;
  const evasionYiqiBefore = zhangshun.yiqi;
  const evadeResult = withRandom(0, () =>
    performAction(
      evadeBattle,
      evadeEnemy.uid,
      strike,
      zhangshun.uid,
    ),
  );
  assert.equal(zhangshun.hp, evasionHpBefore);
  assert.equal(zhangshun.yiqi, Math.min(100, evasionYiqiBefore + 14));
  assert.match(evadeResult.lines.join(" "), /借势闪避/);
});

test("Lu Junyi keeps his full-health damage bonus and Gongsun Sheng guards the team", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const fullBattle = createBattle(
    stateWithTeam(["lujunyi", "linchong", "yanqing"]),
    chapter,
  );
  const fullLu = fullBattle.heroes.find((hero) => hero.refId === "lujunyi");
  const fullTarget = fullBattle.enemies[0];
  fullTarget.hp = 99999;
  fullTarget.maxHp = 99999;
  const fullHpBefore = fullTarget.hp;
  const spear = HEROES.lujunyi.skills.find(
    (skill) => skill.id === "lu_j_basic",
  );
  withRandom(0.5, () =>
    performAction(fullBattle, fullLu.uid, spear, fullTarget.uid),
  );
  const fullDamage = fullHpBefore - fullTarget.hp;

  const woundedBattle = createBattle(
    stateWithTeam(["lujunyi", "linchong", "yanqing"]),
    chapter,
  );
  const woundedLu = woundedBattle.heroes.find(
    (hero) => hero.refId === "lujunyi",
  );
  const woundedTarget = woundedBattle.enemies[0];
  woundedTarget.hp = 99999;
  woundedTarget.maxHp = 99999;
  woundedLu.hp = Math.round(woundedLu.maxHp * 0.5);
  const woundedHpBefore = woundedTarget.hp;
  withRandom(0.5, () =>
    performAction(
      woundedBattle,
      woundedLu.uid,
      spear,
      woundedTarget.uid,
    ),
  );
  const woundedDamage = woundedHpBefore - woundedTarget.hp;
  assert.ok(
    fullDamage > woundedDamage,
    `full-health Lu Junyi should hit harder: ${fullDamage} vs ${woundedDamage}`,
  );

  const guardBattle = createBattle(
    stateWithTeam(["gongsunsheng", "linchong", "yanqing"]),
    chapter,
  );
  assert.ok(
    guardBattle.heroes.every((hero) => hero.statuses.guard >= 2),
    "Gongsun Sheng should add an opening guard layer to the whole team",
  );
});

test("recruitment battles apply their dedicated battle oath", () => {
  const recruitment = HERO_RECRUITMENTS.yangzhi;
  const state = stateWithTeam(["linchong", "luzhishen", "wusong"]);
  const chapter = {
    id: `recruitment-${recruitment.heroId}`,
    title: recruitment.title,
    location: recruitment.location,
    bg: recruitment.bg,
    battle: {
      enemies: recruitment.enemies.map((enemy) => ({
        ...enemy,
        level: 8,
      })),
    },
  };
  const battle = createBattle(state, chapter, {
    mode: "recruitment",
    recruitmentHeroId: recruitment.heroId,
    specialRule: recruitment.rule,
  });

  assert.equal(battle.mode, "recruitment");
  assert.equal(battle.specialRule.id, recruitment.rule.id);
  assert.ok(
    battle.heroes.every((hero) => hero.statuses.guard >= 2),
    "the oath should add opening guard to every hero",
  );
  assert.ok(
    battle.enemies
      .filter((enemy) => enemy.row === 0)
      .every((enemy) => enemy.statuses.armorBreak === 1),
  );
  assert.match(
    battle.log.map((entry) => entry.text).join(" "),
    /聚义战意「旧纲重押」/,
  );
});

test("legend rules can open with team inspiration and enemy armor break", () => {
  const tacticianState = stateWithTeam(["wuyong", "wusong", "yanqing"]);
  const tacticianBase = createBattle(
    tacticianState,
    CHAPTERS.find((item) => item.id === "ferry"),
  );
  const tacticianBattle = legendBattle(tacticianState, "wuyong");
  assert.equal(tacticianBattle.legendRule.name, "空城灯影");
  assert.ok(
    tacticianBattle.heroes.every(
      (hero) => hero.statuses.inspiration === 1,
    ),
  );
  assert.ok(
    tacticianBattle.heroes.every(
      (hero, index) => hero.yiqi >= tacticianBase.heroes[index].yiqi + 20,
    ),
  );
  assert.match(
    tacticianBattle.log.map((entry) => entry.text).join(" "),
    /群英战意「空城灯影」/,
  );

  const lassoState = stateWithTeam(["husanniang", "linchong", "yanqing"]);
  const lassoBase = createBattle(
    lassoState,
    CHAPTERS.find((item) => item.id === "ferry"),
  );
  const lassoBattle = legendBattle(lassoState, "husanniang");
  const lassoHero = lassoBattle.heroes.find(
    (hero) => hero.refId === "husanniang",
  );
  const baseLassoHero = lassoBase.heroes.find(
    (hero) => hero.refId === "husanniang",
  );
  assert.ok(lassoHero.atk > baseLassoHero.atk);
  assert.ok(
    lassoBattle.enemies
      .filter((enemy) => enemy.row === 0)
      .every((enemy) => enemy.statuses.armorBreak === 1),
  );
  assert.ok(
    lassoBattle.enemies
      .filter((enemy) => enemy.row !== 0)
      .every((enemy) => !enemy.statuses.armorBreak),
  );
});

test("Lin Chong legend rule triggers a one-time last stand below half health", () => {
  const state = stateWithTeam(["linchong", "wusong", "yanqing"]);
  const battle = legendBattle(state, "linchong", 6);
  const linchong = battle.heroes.find((hero) => hero.refId === "linchong");
  const enemy = battle.enemies[0];
  linchong.hp = Math.round(linchong.maxHp * 0.5) + 1;
  linchong.statuses.guard = 0;
  const yiqiBefore = linchong.yiqi;
  enemy.atk = 80;
  const strike = {
    id: "legend_test_strike",
    name: "列传试击",
    target: "enemy",
    power: 0.2,
    poise: 0,
  };

  const result = withRandom(0.5, () =>
    performAction(battle, enemy.uid, strike, linchong.uid),
  );

  assert.equal(battle.legendLowHpTriggered, true);
  assert.equal(linchong.statuses.guard, 2);
  assert.ok(linchong.yiqi >= yiqiBefore + 15);
  assert.match(result.lines.join(" "), /残旗不退/);
});

test("Shi Jin follows a broken target with a guaranteed spear chase", () => {
  const state = stateWithTeam(["shijin", "linchong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const shijin = battle.heroes.find((hero) => hero.refId === "shijin");
  const target = battle.enemies[0];
  target.hp = 9999;
  target.maxHp = 9999;
  target.statuses.armorBreak = 2;
  const skill = HEROES.shijin.skills.find((entry) => entry.id === "shi_basic");
  const hpBefore = target.hp;

  const result = withRandom(0.5, () =>
    performAction(battle, shijin.uid, skill, target.uid),
  );

  assert.ok(target.hp < hpBefore);
  assert.equal(shijin.comboChasedRound, battle.round);
  assert.match(result.lines.join(" "), /九龙追锋/);
});

test("Qin Ming turns all-enemy attacks into steady poise pressure", () => {
  const state = stateWithTeam(["qinming", "linchong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const qinming = battle.heroes.find((hero) => hero.refId === "qinming");
  const skill = HEROES.qinming.skills.find((entry) => entry.id === "qin_sweep");
  const targets = [...battle.enemies];
  const poiseBefore = targets.map((target) => target.poise);

  const result = withRandom(0.5, () =>
    performAction(battle, qinming.uid, skill),
  );

  assert.equal(result.targets.length, targets.length);
  targets.forEach((target, index) => {
    assert.ok(
      target.poise > poiseBefore[index] || target.broken > 0,
      `${target.name} should lose poise from Qin Ming's sweep`,
    );
  });
});

test("Chai Jin converts support into an extra guard and yiqi aid", () => {
  const state = stateWithTeam(["chaiin", "linchong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const chaiin = battle.heroes.find((hero) => hero.refId === "chaiin");
  const linchong = battle.heroes.find((hero) => hero.refId === "linchong");
  linchong.hp = Math.round(linchong.maxHp * 0.35);
  linchong.yiqi = 0;
  linchong.statuses.guard = 0;
  for (const hero of battle.heroes) hero.statuses.bleeding = 1;
  const skill = HEROES.chaiin.skills.find((entry) => entry.id === "chai_supply");

  const result = withRandom(0.5, () =>
    performAction(battle, chaiin.uid, skill, chaiin.uid),
  );

  assert.equal(chaiin.supportAidRound, battle.round);
  assert.ok(linchong.hp > Math.round(linchong.maxHp * 0.35));
  assert.ok(linchong.statuses.guard >= 1);
  assert.ok(linchong.yiqi >= 8);
  assert.equal(linchong.statuses.bleeding, 0);
  assert.match(result.lines.join(" "), /仗义疏财/);
});

test("Guan Sheng counters from the front row with armor break and guard", () => {
  const state = stateWithTeam(["guansheng", "linchong", "yanqing"]);
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(state, chapter);
  const guansheng = battle.heroes.find((hero) => hero.refId === "guansheng");
  const enemy = battle.enemies[0];
  enemy.hp = 9999;
  enemy.maxHp = 9999;
  enemy.atk = 12;
  guansheng.statuses.guard = 0;
  const strike = {
    id: "guan_counter_test",
    name: "试刀",
    target: "enemy",
    power: 0.12,
    poise: 0,
  };
  const enemyHpBefore = enemy.hp;

  const result = withRandom(0, () =>
    performAction(battle, enemy.uid, strike, guansheng.uid),
  );

  assert.ok(enemy.hp < enemyHpBefore);
  assert.equal(enemy.statuses.armorBreak, 2);
  assert.ok(guansheng.statuses.guard >= 1);
  assert.match(result.lines.join(" "), /挥刀反击/);
});

test("Zhang Qing ricochets his first flying stone into a second enemy", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(
    stateWithTeam(["zhangqing", "linchong", "luzhishen"]),
    chapter,
  );
  const zhangqing = battle.heroes.find(
    (hero) => hero.refId === "zhangqing",
  );
  const primary = [...battle.enemies].sort((a, b) => b.row - a.row)[0];
  const secondary = battle.enemies.find((enemy) => enemy.uid !== primary.uid);
  const primaryHp = primary.hp;
  const secondaryHp = secondary.hp;
  const stone = HEROES.zhangqing.skills.find(
    (skill) => skill.id === "zhang_basic",
  );

  const result = withRandom(0, () =>
    performAction(battle, zhangqing.uid, stone),
  );

  assert.ok(primary.hp < primaryHp);
  assert.ok(secondary.hp < secondaryHp);
  assert.match(result.lines.join(" "), /飞石连星/);
  assert.match(result.lines.join(" "), /护势伤害/);
});

test("Xu Ning hooks an armor-broken line into a second enemy and empowers Lin Chong", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const battle = createBattle(
    stateWithTeam(["xuning", "linchong", "yanqing"]),
    chapter,
  );
  const xuning = battle.heroes.find((hero) => hero.refId === "xuning");
  const linchong = battle.heroes.find((hero) => hero.refId === "linchong");
  const primary = battle.enemies.find((enemy) => enemy.row === 0);
  const secondary = battle.enemies.find(
    (enemy) => enemy.uid !== primary.uid,
  );
  primary.statuses.armorBreak = 1;
  xuning.yiqi = 0;
  linchong.yiqi = 0;
  linchong.statuses.guard = 0;
  const secondaryHp = secondary.hp;
  const hook = HEROES.xuning.skills.find(
    (skill) => skill.id === "xu_basic",
  );

  const result = performAction(battle, xuning.uid, hook);

  assert.ok(secondary.hp < secondaryHp);
  assert.equal(secondary.statuses.armorBreak, 2);
  assert.ok(xuning.yiqi >= 6);
  assert.ok(linchong.yiqi >= 6);
  assert.ok(linchong.statuses.guard >= 1);
  assert.match(result.lines.join(" "), /钩镰锁阵/);
  assert.match(result.lines.join(" "), /金枪同门/);
});

test("arena encounter rules open with visible tactical status changes", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const fireBattle = createBattle(
    stateWithTeam(["linchong", "luzhishen", "yanqing"]),
    chapter,
    {
      mode: "arena",
      specialRule: ARENA_ENCOUNTERS.fire_trap,
      specialRuleLabel: "演武军势",
    },
  );
  assert.equal(
    fireBattle.heroes.some((hero) => hero.statuses.bleeding >= 1),
    true,
  );
  assert.match(
    fireBattle.log.map((entry) => entry.text).join(" "),
    /演武军势「火油伏阵」/,
  );

  const sealedBattle = createBattle(
    stateWithTeam(["linchong", "luzhishen", "yanqing"]),
    chapter,
    {
      mode: "arena",
      specialRule: ARENA_ENCOUNTERS.sealed_pass,
      specialRuleLabel: "演武军势",
    },
  );
  assert.equal(
    sealedBattle.heroes.every((hero) => hero.statuses.sealed === 2),
    true,
  );
});

test("linked camp bolsters every surviving enemy when one is defeated", () => {
  const battle = createBattle(
    stateWithTeam(["guansheng", "linchong", "yanqing"]),
    CHAPTERS.find((item) => item.id === "ferry"),
    {
      mode: "arena",
      specialRule: ARENA_ENCOUNTERS.linked_camp,
      specialRuleLabel: "演武军势",
    },
  );
  const hero = battle.heroes.find((unit) => unit.refId === "guansheng");
  const target = battle.enemies[0];
  const skill = HEROES.guansheng.skills.find(
    (entry) => entry.target === "enemy" && entry.power > 0,
  );
  target.hp = 1;
  const survivorsBefore = battle.enemies.filter(
    (unit) => unit.uid !== target.uid,
  );

  const result = withRandom(0.5, () =>
    performAction(battle, hero.uid, skill, target.uid),
  );

  assert.equal(target.hp, 0);
  assert.equal(survivorsBefore.length > 0, true);
  assert.equal(
    survivorsBefore.every(
      (unit) =>
        unit.statuses.guard >= 1 && unit.statuses.inspiration >= 1,
    ),
    true,
  );
  assert.match(result.lines.join(" "), /连环战营.*余下官军/);
});

test("new heroes express their signature passives in combat", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const strike = {
    id: "test_signature_strike",
    name: "试招",
    target: "enemy",
    power: 0.04,
    poise: 0,
  };

  const lijunBattle = createBattle(
    stateWithTeam(["lijun", "linchong", "wusong"]),
    chapter,
  );
  const lijun = lijunBattle.heroes.find((unit) => unit.refId === "lijun");
  const lijunEnemy = lijunBattle.enemies[0];
  lijunEnemy.atk = 0;
  const yiqiBefore = new Map(
    lijunBattle.heroes.map((unit) => [unit.uid, unit.yiqi]),
  );
  const evadeResult = withRandom(0, () =>
    performAction(lijunBattle, lijunEnemy.uid, strike, lijun.uid),
  );
  assert.match(evadeResult.lines.join(" "), /潮信鼓舞全队/);
  assert.equal(
    lijunBattle.heroes.every(
      (unit) =>
        unit.statuses.guard >= 1 &&
        unit.yiqi > yiqiBefore.get(unit.uid),
    ),
    true,
  );

  const ruanBattle = createBattle(
    stateWithTeam(["ruanxiaoqi", "linchong", "wusong"]),
    chapter,
  );
  const ruan = ruanBattle.heroes.find(
    (unit) => unit.refId === "ruanxiaoqi",
  );
  const ruanTarget = ruanBattle.enemies[0];
  ruanTarget.hp = 1_000_000;
  ruanTarget.maxHp = 1_000_000;
  ruanTarget.def = 0;
  const ruanResult = withRandom(0, () =>
    performAction(
      ruanBattle,
      ruan.uid,
      HEROES.ruanxiaoqi.skills.find((skill) => skill.id === "ruan_hunt"),
      ruanTarget.uid,
    ),
  );
  assert.ok(ruanTarget.statuses.bleeding >= 2);
  assert.match(ruanResult.lines.join(" "), /活阎罗：暴击撕开旧伤/);

  const sunBattle = createBattle(
    stateWithTeam(["sunerniang", "linchong", "wusong"]),
    chapter,
  );
  const sun = sunBattle.heroes.find(
    (unit) => unit.refId === "sunerniang",
  );
  const sunTarget = sunBattle.enemies[0];
  sunTarget.hp = 1_000_000;
  sunTarget.maxHp = 1_000_000;
  const sunResult = withRandom(0, () =>
    performAction(
      sunBattle,
      sun.uid,
      HEROES.sunerniang.skills.find((skill) => skill.id === "sun_basic"),
      sunTarget.uid,
    ),
  );
  assert.ok(sunTarget.statuses.armorBreak >= 3);
  assert.match(sunResult.lines.join(" "), /持续时间延长至 3 回合/);

  const guBattle = createBattle(
    stateWithTeam(["gudashao", "linchong", "wusong"]),
    chapter,
  );
  const gu = guBattle.heroes.find((unit) => unit.refId === "gudashao");
  const guEnemy = guBattle.enemies[0];
  guEnemy.atk = 0;
  guEnemy.poiseMax = 1_000;
  const guResult = withRandom(0, () =>
    performAction(guBattle, guEnemy.uid, strike, gu.uid),
  );
  assert.ok(guEnemy.poise >= 18);
  assert.ok(gu.statuses.guard >= 1);
  assert.match(guResult.lines.join(" "), /门闩震开敌势/);

  const lingBattle = createBattle(
    stateWithTeam(["lingzhen", "linchong", "wusong"]),
    chapter,
  );
  const ling = lingBattle.heroes.find(
    (unit) => unit.refId === "lingzhen",
  );
  for (const enemy of lingBattle.enemies) {
    enemy.hp = 1_000_000;
    enemy.maxHp = 1_000_000;
    enemy.poiseMax = 1_000;
  }
  const lingResult = withRandom(0, () =>
    performAction(
      lingBattle,
      ling.uid,
      HEROES.lingzhen.skills.find((skill) => skill.id === "ling_basic"),
      lingBattle.enemies[0].uid,
    ),
  );
  assert.equal(
    lingBattle.enemies.every((enemy) => enemy.statuses.stun >= 1),
    true,
  );
  assert.match(lingResult.lines.join(" "), /轰天雷：炮火在阵中炸响/);

  function fullHealthDamage(hpRatio) {
    const battle = createBattle(
      stateWithTeam(["huyanzhuo", "linchong", "wusong"]),
      chapter,
    );
    const huyan = battle.heroes.find(
      (unit) => unit.refId === "huyanzhuo",
    );
    const enemy = battle.enemies[0];
    enemy.hp = 1_000_000;
    enemy.maxHp = 1_000_000;
    enemy.def = 0;
    huyan.hp = Math.round(huyan.maxHp * hpRatio);
    const before = battle.damageDealt;
    withRandom(0.5, () =>
      performAction(
        battle,
        huyan.uid,
        HEROES.huyanzhuo.skills.find((skill) => skill.id === "hu_basic"),
        enemy.uid,
      ),
    );
    return battle.damageDealt - before;
  }

  assert.ok(fullHealthDamage(1) > fullHealthDamage(0.5));
});

test("the six newest heroes and the Dengzhou bond create distinct combat turns", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const strike = {
    id: "new_hero_counter_test",
    name: "试击",
    target: "enemy",
    power: 0.03,
    poise: 0,
  };

  function damageAtHpRatio(heroId, skillId, hpRatio) {
    const battle = createBattle(
      stateWithTeam([heroId, "linchong", "wusong"]),
      chapter,
    );
    const hero = battle.heroes.find((unit) => unit.refId === heroId);
    const target = battle.enemies[0];
    target.hp = 1_000_000;
    target.maxHp = 1_000_000;
    target.def = 0;
    hero.hp = Math.round(hero.maxHp * hpRatio);
    const before = battle.damageDealt;
    withRandom(0.5, () =>
      performAction(
        battle,
        hero.uid,
        HEROES[heroId].skills.find((skill) => skill.id === skillId),
        target.uid,
      ),
    );
    return battle.damageDealt - before;
  }

  assert.ok(
    damageAtHpRatio("liutang", "liutang_basic", 0.2) >
      damageAtHpRatio("liutang", "liutang_basic", 1),
    "Liu Tang should hit harder while wounded",
  );

  const liyingBattle = createBattle(
    stateWithTeam(["liying", "linchong", "wusong"]),
    chapter,
  );
  const liying = liyingBattle.heroes.find(
    (unit) => unit.refId === "liying",
  );
  const liyingTarget = liyingBattle.enemies[0];
  liyingTarget.hp = 1_000_000;
  liyingTarget.maxHp = 1_000_000;
  const liyingResult = withRandom(0, () =>
    performAction(
      liyingBattle,
      liying.uid,
      HEROES.liying.skills.find((skill) => skill.id === "liying_basic"),
      liyingTarget.uid,
    ),
  );
  assert.match(liyingResult.lines.join(" "), /借暴击回气/);

  const zhutongBattle = createBattle(
    stateWithTeam(["zhutong", "linchong", "wusong"]),
    chapter,
  );
  const zhutong = zhutongBattle.heroes.find(
    (unit) => unit.refId === "zhutong",
  );
  const zhutongAlly = zhutongBattle.heroes.find(
    (unit) => unit.refId === "linchong",
  );
  const zhutongEnemy = zhutongBattle.enemies[0];
  zhutongEnemy.atk = 12;
  zhutongAlly.hp = Math.round(zhutongAlly.maxHp * 0.45);
  const allyHp = zhutongAlly.hp;
  const zhutongResult = withRandom(0, () =>
    performAction(
      zhutongBattle,
      zhutongEnemy.uid,
      strike,
      zhutong.uid,
    ),
  );
  assert.ok(zhutongAlly.hp > allyHp);
  assert.ok(zhutong.statuses.guard >= 1);
  assert.match(zhutongResult.lines.join(" "), /反手护住/);

  for (const [heroId, skillId] of [
    ["leiheng", "leiheng_basic"],
    ["jiebao", "jiebao_basic"],
  ]) {
    const battle = createBattle(
      stateWithTeam([heroId, "linchong", "wusong"]),
      chapter,
    );
    const hero = battle.heroes.find((unit) => unit.refId === heroId);
    const enemy = battle.enemies[0];
    enemy.hp = 1_000_000;
    enemy.maxHp = 1_000_000;
    enemy.atk = 12;
    const result = withRandom(0, () =>
      performAction(battle, enemy.uid, strike, hero.uid),
    );
    assert.ok(enemy.statuses.armorBreak >= 1);
    assert.match(result.lines.join(" "), /反击/);
    assert.equal(HEROES[heroId].skills.some((skill) => skill.id === skillId), true);
  }

  const xieBattle = createBattle(
    stateWithTeam(["jiezhen", "jiebao", "linchong"]),
    chapter,
  );
  const jiezhen = xieBattle.heroes.find(
    (unit) => unit.refId === "jiezhen",
  );
  const jiebao = xieBattle.heroes.find((unit) => unit.refId === "jiebao");
  const defeated = xieBattle.enemies[0];
  defeated.row = 2;
  defeated.hp = 1;
  jiezhen.statuses.guard = 0;
  jiebao.statuses.guard = 0;
  jiebao.yiqi = 0;
  const xieResult = withRandom(0.5, () =>
    performAction(
      xieBattle,
      jiezhen.uid,
      HEROES.jiezhen.skills.find((skill) => skill.id === "jiezhen_basic"),
      defeated.uid,
    ),
  );
  assert.equal(defeated.hp, 0);
  assert.ok(jiezhen.statuses.guard >= 1);
  assert.ok(jiebao.statuses.guard >= 1);
  assert.ok(jiebao.yiqi >= 12);
  assert.match(xieResult.lines.join(" "), /登州双猎/);
});

test("the expanded roster turns its new passives and bonds into combat decisions", () => {
  const chapter = CHAPTERS.find((item) => item.id === "ferry");
  const strike = {
    id: "expanded_roster_strike",
    name: "试击",
    target: "enemy",
    power: 0.02,
    poise: 0,
  };

  const openingBattle = createBattle(
    stateWithTeam(["yuehe", "yanqing", "daizong"]),
    chapter,
  );
  assert.ok(openingBattle.bondIds.includes("river_music"));
  assert.equal(openingBattle.modifiers.startYiqi, 10);
  assert.ok(
    openingBattle.heroes.every(
      (hero) => hero.statuses.inspiration >= 1 && hero.yiqi >= 25,
    ),
  );
  const yuehe = openingBattle.heroes.find((unit) => unit.refId === "yuehe");
  const lowestAlly = [...openingBattle.heroes].sort(
    (a, b) => a.hp / a.maxHp - b.hp / b.maxHp,
  )[0];
  lowestAlly.hp = Math.round(lowestAlly.maxHp * 0.4);
  openingBattle.enemies[0].hp = 1_000_000;
  openingBattle.enemies[0].maxHp = 1_000_000;
  const songResult = withRandom(0.5, () =>
    performAction(
      openingBattle,
      yuehe.uid,
      HEROES.yuehe.skills.find((skill) => skill.id === "yuehe_basic"),
      openingBattle.enemies[0].uid,
    ),
  );
  assert.ok(lowestAlly.statuses.guard >= 1);
  assert.match(songResult.lines.join(" "), /铁叫子和声/);

  const pinnedBattle = createBattle(
    stateWithTeam(["shixiu", "linchong", "wusong"]),
    chapter,
  );
  const shixiu = pinnedBattle.heroes.find(
    (unit) => unit.refId === "shixiu",
  );
  const shixiuTarget = pinnedBattle.enemies[0];
  shixiuTarget.hp = 1_000_000;
  shixiuTarget.maxHp = 1_000_000;
  const shixiuHp = shixiu.hp;
  const desperate = HEROES.shixiu.skills.find(
    (skill) => skill.id === "shixiu_desperate",
  );
  const desperateResult = withRandom(0.5, () =>
    performAction(pinnedBattle, shixiu.uid, desperate, shixiuTarget.uid),
  );
  assert.ok(shixiu.hp < shixiuHp);
  assert.match(desperateResult.lines.join(" "), /以伤换势/);

  const executionBattle = createBattle(
    stateWithTeam(["shixiu", "linchong", "wusong"]),
    chapter,
  );
  const executionShixiu = executionBattle.heroes.find(
    (unit) => unit.refId === "shixiu",
  );
  executionShixiu.hp = Math.round(executionShixiu.maxHp * 0.5);
  executionShixiu.statuses.guard = 0;
  const woundedBefore = executionShixiu.hp;
  for (const enemy of executionBattle.enemies) {
    enemy.hp = 1_000_000;
    enemy.maxHp = 1_000_000;
  }
  const victim = executionBattle.enemies[0];
  victim.hp = 1;
  const executionResult = withRandom(0.5, () =>
    performAction(
      executionBattle,
      executionShixiu.uid,
      HEROES.shixiu.skills.find((skill) => skill.id === "shixiu_execute"),
      victim.uid,
    ),
  );
  assert.equal(victim.hp, 0);
  assert.ok(executionShixiu.hp > woundedBefore);
  assert.ok(executionShixiu.statuses.guard >= 1);
  assert.match(executionResult.lines.join(" "), /乘胜追击/);

  const jailBattle = createBattle(
    stateWithTeam(["yangxiong", "shixiu", "linchong"]),
    chapter,
  );
  const yangxiong = jailBattle.heroes.find(
    (unit) => unit.refId === "yangxiong",
  );
  const partner = jailBattle.heroes.find((unit) => unit.refId === "shixiu");
  const jailEnemy = jailBattle.enemies[0];
  jailEnemy.hp = 1_000_000;
  jailEnemy.maxHp = 1_000_000;
  jailEnemy.atk = 0;
  yangxiong.hp = Math.round(yangxiong.maxHp * 0.51);
  yangxiong.statuses.guard = 0;
  partner.statuses.guard = 0;
  partner.yiqi = 0;
  const jailResult = withRandom(0.5, () =>
    performAction(jailBattle, jailEnemy.uid, strike, yangxiong.uid),
  );
  assert.ok(yangxiong.statuses.guard >= 1);
  assert.ok(partner.statuses.guard >= 1);
  assert.ok(partner.yiqi >= 12);
  assert.match(jailResult.lines.join(" "), /病关拼命/);

  const dengzhouBattle = createBattle(
    stateWithTeam(["sunli", "jiezhen", "jiebao"]),
    chapter,
  );
  const sunli = dengzhouBattle.heroes.find(
    (unit) => unit.refId === "sunli",
  );
  const dengzhouTarget = dengzhouBattle.enemies[0];
  dengzhouTarget.hp = 1;
  for (const ally of dengzhouBattle.heroes) {
    ally.statuses.guard = 0;
    ally.yiqi = 0;
  }
  const dengzhouResult = withRandom(0.5, () =>
    performAction(
      dengzhouBattle,
      sunli.uid,
      HEROES.sunli.skills.find((skill) => skill.id === "sunli_basic"),
      dengzhouTarget.uid,
    ),
  );
  assert.equal(dengzhouTarget.hp, 0);
  assert.ok(
    dengzhouBattle.heroes.every(
      (hero) => hero.statuses.guard >= 1 && hero.yiqi >= 8,
    ),
  );
  assert.match(dengzhouResult.lines.join(" "), /登州三杰/);

  const scholarBattle = createBattle(
    stateWithTeam(["xiaorang", "jiangjing", "linchong"]),
    chapter,
  );
  assert.ok(scholarBattle.bondIds.includes("scholar_quartermaster"));
  assert.equal(scholarBattle.modifiers.statusDurationBonus, 1);
  assert.ok(
    scholarBattle.enemies.every((enemy) => enemy.poise > 0),
  );
  const xiaorang = scholarBattle.heroes.find(
    (unit) => unit.refId === "xiaorang",
  );
  const xiaorangTarget = scholarBattle.enemies[0];
  xiaorangTarget.hp = 1_000_000;
  xiaorangTarget.maxHp = 1_000_000;
  const orderResult = withRandom(0, () =>
    performAction(
      scholarBattle,
      xiaorang.uid,
      HEROES.xiaorang.skills.find((skill) => skill.id === "xiaorang_order"),
      xiaorangTarget.uid,
    ),
  );
  assert.ok(xiaorangTarget.statuses.sealed >= 4);
  assert.match(orderResult.lines.join(" "), /持续时间延长/);

  const supplyBattle = createBattle(
    stateWithTeam(["jiangjing", "linchong", "wusong"]),
    {
      ...chapter,
      battle: {
        enemies: HERO_RECRUITMENTS.jiangjing.enemies.map((enemy) => ({
          ...enemy,
          level: 10,
        })),
      },
    },
    {
      mode: "recruitment",
      recruitmentHeroId: "jiangjing",
      specialRule: HERO_RECRUITMENTS.jiangjing.rule,
    },
  );
  const jiangjing = supplyBattle.heroes.find(
    (unit) => unit.refId === "jiangjing",
  );
  for (const ally of supplyBattle.heroes) ally.statuses.guard = 0;
  const supplyResult = performAction(supplyBattle, jiangjing.uid, {
    id: "test_quartermaster_supply",
    name: "试拨军需",
    target: "allAllies",
    power: 0,
    effects: [{ type: "teamYiqi", amount: 1 }],
  });
  assert.ok(
    supplyBattle.heroes.every((hero) => hero.statuses.guard >= 1),
  );
  assert.match(supplyResult.lines.join(" "), /军需落阵/);
});
