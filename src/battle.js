import {
  CHAIN_FORMATIONS,
  DIFFICULTIES,
  ENEMIES,
  HERO_DOCTRINES,
  HEROES,
  PATHS,
  ROWS,
  STATUS_DEFS,
} from "./data.js";
import {
  activeHeroBonds,
  activeHeroes,
  deriveEnemyStats,
  yiqiMultiplier,
} from "./state.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const chance = (probability) => Math.random() < probability;
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const NEGATIVE_STATUSES = new Set([
  "armorBreak",
  "bleeding",
  "stun",
  "sealed",
]);

function addModifiers(totals, effects = {}) {
  for (const [key, value] of Object.entries(effects)) {
    if (key === "openingGuard") {
      totals[key] = Math.max(totals[key] || 0, Number(value) || 0);
    } else {
      totals[key] = (totals[key] || 0) + (Number(value) || 0);
    }
  }
  return totals;
}

function uid(side, id, index) {
  return `${side}-${id}-${index}`;
}

export function createBattle(state, chapter, options = {}) {
  const activeBonds = activeHeroBonds(state);
  const fieldedHeroes = activeHeroes(state);
  const bondModifiers = activeBonds.reduce(
    (totals, bond) => addModifiers(totals, bond.effects),
    {},
  );
  const modifiers = {
    hpPct: 0,
    atkPct: 0,
    defPct: 0,
    spdPct: 0,
    healPct: 0,
    yiqiPct: 0,
    critPct: 0,
    poisePct: 0,
    enemyStartPoisePct: 0,
    counterBonus: 0,
    brokenDamageBonus: 0,
    guardBonus: 0,
    damageReductionPct: 0,
    openingGuard: 0,
    waveHealPct: 0,
    chainPowerPct: 0,
    allEnemiesPowerPct: 0,
    stoneRicochetChance: 0,
    startYiqi: 0,
    openingInspiration: 0,
    statusDurationBonus: 0,
  };
  addModifiers(modifiers, bondModifiers);
  for (const { heroId } of fieldedHeroes) {
    const doctrineId = state.doctrines?.[heroId];
    const doctrine = HERO_DOCTRINES[heroId]?.paths?.[doctrineId];
    if (doctrine?.teamEffects) addModifiers(modifiers, doctrine.teamEffects);
    const passiveEffects = HEROES[heroId]?.passive?.effects || {};
    addModifiers(modifiers, {
      openingGuard: passiveEffects.teamOpeningGuard || 0,
      startYiqi: passiveEffects.teamStartYiqi || 0,
      openingInspiration: passiveEffects.teamOpeningInspiration || 0,
      enemyStartPoisePct: passiveEffects.enemyStartPoisePct || 0,
      poisePct: passiveEffects.teamPoisePct || 0,
    });
  }
  addModifiers(modifiers, options.modifiers || {});
  const legendRule = options.legendRule || null;
  const specialRule = options.specialRule || legendRule;
  const legendRuleEffects = legendRule?.effects || {};
  const specialRuleEffects = specialRule?.effects || {};
  addModifiers(modifiers, specialRuleEffects.teamModifiers || {});
  if (specialRuleEffects.stoneRicochetChance) {
    modifiers.stoneRicochetChance +=
      Number(specialRuleEffects.stoneRicochetChance) || 0;
  }
  const enemyModifiers = {
    hpPct: 0,
    atkPct: 0,
    defPct: 0,
    spdPct: 0,
    ...(options.enemyModifiers || {}),
  };
  const fieldedHeroIds = new Set(fieldedHeroes.map(({ heroId }) => heroId));
  const openingYiqiBonus =
    (fieldedHeroIds.has("songjiang") ? 10 : 0) +
    (fieldedHeroIds.has("wuyong") ? 14 : 0);
  const heroes = fieldedHeroes.map(({ heroId, row, stats }, index) => {
    const hero = HEROES[heroId];
    const doctrineId = state.doctrines?.[heroId];
    const doctrine = HERO_DOCTRINES[heroId]?.paths?.[doctrineId] || null;
    const unitEffects = doctrine?.effects || {};
    const legendUnitEffects =
      heroId === options.legendHeroId
        ? legendRuleEffects.protagonist || {}
        : {};
    const openingInspiration = Math.max(
      Number(modifiers.openingInspiration) || 0,
      Number(specialRuleEffects.teamOpeningInspiration) || 0,
    );
    const guardStacks =
      (modifiers.openingGuard || 0) +
      (unitEffects.openingGuard || 0);
    const openingStatuses = {};
    if (guardStacks) openingStatuses.guard = guardStacks + 1;
    if (openingInspiration) {
      openingStatuses.inspiration = openingInspiration;
    }
    for (const effect of specialRuleEffects.heroOpeningStatuses || []) {
      if (
        !STATUS_DEFS[effect.status] ||
        (effect.row !== undefined && effect.row !== row)
      ) {
        continue;
      }
      openingStatuses[effect.status] = Math.max(
        openingStatuses[effect.status] || 0,
        Math.max(1, Number(effect.duration) || 1),
      );
    }
    const maxHp = Math.round(
      stats.maxHp *
        (1 +
          modifiers.hpPct +
          (unitEffects.hpPct || 0) +
          (legendUnitEffects.hpPct || 0)),
    );
    const healthRatio = options.healthRatios?.[heroId];
    return {
      uid: uid("hero", heroId, index),
      side: "hero",
      refId: heroId,
      name: hero.name,
      nickname: hero.nickname,
      path: hero.path,
      row,
      level: state.roster[heroId].level,
      hp:
        typeof healthRatio === "number"
          ? Math.max(0, Math.round(maxHp * clamp(healthRatio, 0, 1)))
          : maxHp,
      maxHp,
      atk: Math.round(
        stats.atk *
          (1 +
            modifiers.atkPct +
            (unitEffects.atkPct || 0) +
            (legendUnitEffects.atkPct || 0)),
      ),
      def: Math.round(
        stats.def *
          (1 +
            modifiers.defPct +
            (unitEffects.defPct || 0) +
            (legendUnitEffects.defPct || 0)),
      ),
      spd: Math.round(
        stats.spd *
          (1 +
            modifiers.spdPct +
            (unitEffects.spdPct || 0) +
            (legendUnitEffects.spdPct || 0)),
      ),
      yiqi: Math.min(
        100,
        (heroId === "linchong" ? 25 : 15) +
          openingYiqiBonus +
          (modifiers.startYiqi || 0),
      ),
      poise: 0,
      poiseMax: 100,
      broken: 0,
      statuses: openingStatuses,
      cooldowns: {},
      passiveUsed: false,
      evadedRound: 0,
      ultimateUsed: false,
      doctrineId: doctrine?.id || null,
      doctrineName: doctrine?.name || null,
      doctrineCritPct:
        (unitEffects.critPct || 0) +
        (legendUnitEffects.critPct || 0),
      legendRule:
        heroId === options.legendHeroId ? legendRule : null,
      portrait: hero.cutout,
      keyart: hero.keyart,
      palette: hero.palette,
      passiveEffects: hero.passive?.effects || {},
    };
  });

  const enemies = chapter.battle.enemies.map((config, index) => {
    const enemy = ENEMIES[config.id];
    const stats = deriveEnemyStats(enemy, config.level);
    const enemyScale = options.enemyScale ?? 1;
    const openingStatuses = Object.fromEntries(
      (specialRuleEffects.enemyOpeningStatuses || [])
        .filter((effect) => effect.row === undefined || effect.row === config.row)
        .map((effect) => [effect.status, effect.duration || 1]),
    );
    return {
      uid: uid("enemy", config.id, index),
      side: "enemy",
      refId: config.id,
      name: enemy.name,
      path: enemy.path,
      row: config.row,
      level: config.level,
      hp: Math.round(
        stats.maxHp * enemyScale * (1 + enemyModifiers.hpPct),
      ),
      maxHp: Math.round(
        stats.maxHp * enemyScale * (1 + enemyModifiers.hpPct),
      ),
      atk: Math.round(
        stats.atk *
          Math.sqrt(enemyScale) *
          (1 + enemyModifiers.atkPct),
      ),
      def: Math.round(
        stats.def *
          Math.sqrt(enemyScale) *
          (1 + enemyModifiers.defPct),
      ),
      spd: Math.round(
        stats.spd *
          (1 + Math.max(0, enemyScale - 1) * 0.12) *
          (1 + enemyModifiers.spdPct),
      ),
      yiqi: enemy.boss ? 70 : 30,
      poise: Math.round(
        stats.poiseMax * clamp(modifiers.enemyStartPoisePct || 0, 0, 0.8),
      ),
      poiseMax: stats.poiseMax,
      broken: 0,
      statuses: openingStatuses,
      cooldowns: {},
      boss: Boolean(enemy.boss),
      bossPhaseTriggered: false,
      portraitPosition: enemy.portraitPosition,
      sprite: enemy.sprite,
    };
  });

  const battle = {
    id: `${chapter.id}-${Date.now()}`,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    backdrop: chapter.bg,
    heroes,
    enemies,
    round: 0,
    turnQueue: [],
    currentUid: null,
    phase: "loading",
    log: [],
    chainAttacks: 0,
    poiseBreaks: 0,
    replay: Boolean(options.replay),
    difficulty: state.difficulty,
    turnsTaken: 0,
    damageDealt: 0,
    heroMetrics: {},
    defeatedEnemyIds: [],
    actionResult: null,
    chain: 0,
    chainLastPath: null,
    chainHeroes: [],
    chainReady: false,
    mode: options.mode || "campaign",
    arenaWave: options.arenaWave || 0,
    modifiers,
    enemyModifiers,
    legendHeroId: options.legendHeroId || null,
    recruitmentHeroId: options.recruitmentHeroId || null,
    protagonistRefId:
      options.legendHeroId || options.recruitmentHeroId || null,
    legendRule,
    specialRule,
    bondIds: activeBonds.map((bond) => bond.id),
    bondTriggerRounds: {},
    timelyRescueUsed: false,
    doctrines: Object.fromEntries(
      heroes
        .filter((hero) => hero.doctrineId)
        .map((hero) => [hero.refId, hero.doctrineId]),
    ),
  };
  pushLog(battle, "system", `战起：${chapter.title}`);
  if (activeBonds.length) {
    pushLog(
      battle,
      "good",
      `兄弟契成阵：${activeBonds.map((bond) => bond.name).join("、")}`,
    );
  }
  const activeDoctrines = heroes.filter((hero) => hero.doctrineName);
  if (activeDoctrines.length) {
    pushLog(
      battle,
      "good",
      `星命命途：${activeDoctrines
        .map((hero) => `${hero.name}·${hero.doctrineName}`)
        .join("、")}`,
    );
  }
  if (specialRule) {
    const ruleLabel =
      options.specialRuleLabel ||
      (legendRule ? "群英战意" : "聚义战意");
    pushLog(
      battle,
      "good",
      `${ruleLabel}「${specialRule.name}」：${specialRule.desc}`,
    );
  }
  if (options.replay) pushLog(battle, "system", "重游旧战，收益有所降低。");
  startNextTurn(battle);
  return battle;
}

export function combatantById(battle, combatantUid) {
  return (
    battle.heroes.find((unit) => unit.uid === combatantUid) ||
    battle.enemies.find((unit) => unit.uid === combatantUid) ||
    null
  );
}

function battleHasBond(battle, bondId) {
  return Boolean(battle?.bondIds?.includes(bondId));
}

function claimBondTrigger(battle, bondId) {
  if (!battleHasBond(battle, bondId)) return false;
  battle.bondTriggerRounds ||= {};
  if (battle.bondTriggerRounds[bondId] === battle.round) return false;
  battle.bondTriggerRounds[bondId] = battle.round;
  return true;
}

function claimBondOnce(battle, bondId) {
  if (!battleHasBond(battle, bondId)) return false;
  battle.bondTriggeredOnce ||= {};
  if (battle.bondTriggeredOnce[bondId]) return false;
  battle.bondTriggeredOnce[bondId] = true;
  return true;
}

function doctrineFor(battle, actor) {
  if (!actor || actor.side !== "hero") return null;
  const doctrineId = battle?.doctrines?.[actor.refId];
  return HERO_DOCTRINES[actor.refId]?.paths?.[doctrineId] || null;
}

function ruleEffectsFor(battle, actor) {
  if (
    !battle?.specialRule?.effects ||
    !actor ||
    actor.side !== "hero" ||
    actor.refId !== battle.protagonistRefId
  ) {
    return {};
  }
  return battle.specialRule.effects;
}

export function currentCombatant(battle) {
  return combatantById(battle, battle.currentUid);
}

export function livingSide(battle, side) {
  return (side === "hero" ? battle.heroes : battle.enemies).filter(
    (unit) => unit.hp > 0,
  );
}

export function opponentsOf(battle, combatant) {
  return livingSide(battle, combatant.side === "hero" ? "enemy" : "hero");
}

export function alliesOf(battle, combatant) {
  return livingSide(battle, combatant.side);
}

function startRound(battle) {
  battle.round += 1;
  const alive = [...battle.heroes, ...battle.enemies].filter((unit) => unit.hp > 0);
  alive.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd;
    if (a.side !== b.side) return a.side === "hero" ? -1 : 1;
    return a.uid.localeCompare(b.uid);
  });
  battle.turnQueue = alive.map((unit) => unit.uid);
  pushLog(battle, "round", `第 ${battle.round} 回合`);
}

export function startNextTurn(battle) {
  if (battle.phase === "victory" || battle.phase === "defeat") return null;
  if (battle.turnQueue.length === 0) startRound(battle);

  let actor = null;
  while (battle.turnQueue.length > 0 && !actor) {
    const candidate = combatantById(battle, battle.turnQueue.shift());
    if (candidate && candidate.hp > 0) actor = candidate;
  }
  if (!actor) {
    startRound(battle);
    return startNextTurn(battle);
  }

  battle.currentUid = actor.uid;
  battle.turnsTaken += 1;
  actor.statusesAppliedThisTurn = [];
  for (const [skillId, turns] of Object.entries(actor.cooldowns)) {
    actor.cooldowns[skillId] = Math.max(0, turns - 1);
  }

  if (actor.side === "hero" && actor.refId === "daizong" && !actor.passiveUsed) {
    actor.passiveUsed = true;
    for (const ally of livingSide(battle, "hero")) {
      gainYiqi(ally, 12, battle);
    }
    pushLog(battle, "good", "戴宗施展神行法，全队义气上升。");
  }

  if (
    actor.side === "enemy" &&
    actor.boss &&
    !actor.bossPhaseTriggered &&
    actor.hp / actor.maxHp <= 0.5
  ) {
    triggerBossPhase(battle, actor);
  }

  const bleedDamage = tickBleed(actor, battle);
  if (bleedDamage > 0) {
    pushLog(battle, "bad", `${actor.name}因流血失去 ${bleedDamage} 生命。`);
    if (checkBattleEnd(battle)) return actor;
  }

  if ((actor.statuses.stun || 0) > 0) {
    actor.statuses.stun -= 1;
    pushLog(battle, "bad", `${actor.name}眩晕，无法行动。`);
    finishActorTurn(battle, actor);
    battle.phase = "skipping";
    return actor;
  }

  battle.phase = actor.side === "hero" ? "select" : "enemy";
  return actor;
}

function triggerBossPhase(battle, actor) {
  actor.bossPhaseTriggered = true;
  const rule = ENEMIES[actor.refId]?.bossPhase;
  if (rule) {
    let heal = 0;
    if (rule.healPct) {
      heal = Math.round(actor.maxHp * rule.healPct);
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    }
    if (rule.yiqi) {
      actor.yiqi = Math.max(actor.yiqi || 0, rule.yiqi);
    }
    for (const [status, stacks] of Object.entries(rule.selfStatuses || {})) {
      actor.statuses[status] = Math.max(actor.statuses[status] || 0, stacks);
    }
    for (const hero of livingSide(battle, "hero")) {
      for (const [status, stacks] of Object.entries(rule.heroStatuses || {})) {
        hero.statuses[status] = Math.max(hero.statuses[status] || 0, stacks);
      }
    }
    pushLog(battle, "boss", rule.text.replace("{heal}", String(heal)));
    return;
  }
  if (actor.refId === "executioner") {
    actor.statuses.inspiration = Math.max(actor.statuses.inspiration || 0, 3);
    actor.yiqi = 100;
    for (const hero of livingSide(battle, "hero")) {
      hero.statuses.bleeding = Math.max(hero.statuses.bleeding || 0, 2);
      hero.statuses.armorBreak = Math.max(hero.statuses.armorBreak || 0, 2);
    }
    pushLog(
      battle,
      "boss",
      "江州行刑官掷下朱笔：断头令已出，全队陷入流血与破甲。",
    );
    return;
  }
  if (actor.refId === "captain") {
    const heal = Math.round(actor.maxHp * 0.14);
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    actor.statuses.guard = Math.max(actor.statuses.guard || 0, 2);
    actor.statuses.inspiration = Math.max(actor.statuses.inspiration || 0, 2);
    pushLog(
      battle,
      "boss",
      `沧州押差困兽反扑，恢复 ${heal} 生命并披上两层护御。`,
    );
    return;
  }
  actor.statuses.inspiration = Math.max(actor.statuses.inspiration || 0, 2);
  pushLog(battle, "boss", `${actor.name}进入背水死战。`);
}

function tickBleed(actor, battle) {
  if (!(actor.statuses.bleeding > 0) || actor.hp <= 0) return 0;
  const damage = Math.max(6, Math.round(actor.maxHp * 0.075));
  actor.hp = Math.max(0, actor.hp - damage);
  actor.statuses.bleeding -= 1;
  battle.damageDealt += actor.side === "enemy" ? damage : 0;
  return damage;
}

export function skillUsable(actor, skill) {
  if (!actor || actor.hp <= 0) return false;
  if (skill.yiqiCost && actor.yiqi < skill.yiqiCost) return false;
  return !(actor.cooldowns[skill.id] > 0);
}

export function heroSkillList(actor) {
  return HEROES[actor.refId].skills;
}

export function enemySkillList(actor) {
  return ENEMIES[actor.refId].skills;
}

export function validTargets(battle, actorUid, skill) {
  if (!skill) return [];
  const actor = combatantById(battle, actorUid);
  if (!actor) return [];
  const enemies = opponentsOf(battle, actor);
  const allies = alliesOf(battle, actor);
  switch (skill.target) {
    case "enemy":
    case "allEnemies":
      return enemies;
    case "frontEnemy": {
      const target =
        enemies.find((unit) => unit.row === 0) ||
        [...enemies].sort((a, b) => a.row - b.row)[0];
      return target ? [target] : [];
    }
    case "backEnemy": {
      const target =
        enemies
          .filter((unit) => unit.row === 2)
          .sort((a, b) => b.spd - a.spd)[0] ||
        [...enemies].sort((a, b) => b.row - a.row)[0];
      return target ? [target] : [];
    }
    case "lowestEnemy":
      return [...enemies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 1);
    case "ally":
    case "allAllies":
      return allies;
    case "self":
      return [actor];
    default:
      return [];
  }
}

export function chooseEnemyAction(battle, actor) {
  const skills = enemySkillList(actor).filter(
    (skill) =>
      (!skill.minRound || battle.round >= skill.minRound) &&
      skillUsable(actor, skill) &&
      validTargets(battle, actor.uid, skill).length > 0,
  );
  const weighted = [];
  for (const skill of skills) {
    for (let i = 0; i < (skill.weight || 1); i += 1) weighted.push(skill);
  }
  if (!weighted.length) return null;
  const skill = pick(weighted);
  const targets = validTargets(battle, actor.uid, skill);
  let target = targets[0] || null;
  if (
    skill &&
    (skill.target === "enemy" || skill.target === "allEnemies")
  ) {
    const weightedTargets = [];
    for (const unit of targets) {
      const rowWeight = ROWS[unit.row]?.aggro || 1;
      const lowHpWeight = unit.hp / unit.maxHp < 0.35 ? 0.55 : 1;
      const weight = Math.max(1, Math.round(rowWeight * 4 * lowHpWeight));
      for (let i = 0; i < weight; i += 1) weightedTargets.push(unit);
    }
    target = pick(weightedTargets.length ? weightedTargets : targets);
  }
  return { skill, target };
}

export function performAction(battle, actorUid, skill, targetUid = null) {
  const actor = combatantById(battle, actorUid);
  if (!actor || actor.hp <= 0 || !skillUsable(actor, skill)) {
    return { ok: false, message: "无法施展。" };
  }
  battle.phase = "resolving";
  const targets = resolveTargets(battle, actor, skill, targetUid);
  if (!targets.length) return { ok: false, message: "没有有效目标。" };

  const result = {
    ok: true,
    actorUid,
    skillId: skill.id,
    targets: [],
    events: [],
    lines: [],
    kind: skill.power > 0 ? "damage" : skill.heal ? "heal" : "support",
  };

  if (skill.yiqiCost) {
    actor.yiqi = Math.max(0, actor.yiqi - skill.yiqiCost);
    actor.ultimateUsed = true;
  }
  if (skill.cooldown) actor.cooldowns[skill.id] = skill.cooldown;
  if (skill.ultimate) gainHeroMetric(battle, actor, "ultimates", 1);

  if (skill.selfDamagePct && actor.hp > 1) {
    const selfDamage = Math.min(
      actor.hp - 1,
      Math.max(1, Math.round(actor.hp * clamp(skill.selfDamagePct, 0, 0.5))),
    );
    actor.hp -= selfDamage;
    result.events.push({
      type: "damage",
      targetUid: actor.uid,
      damage: selfDamage,
      critical: false,
      pathAdvantage: false,
    });
    result.lines.push(
      `${actor.name}以伤换势，失去 ${selfDamage} 生命。`,
    );
  }

  if (skill.power > 0) {
    const hits = skill.hits || 1;
    for (let hitIndex = 0; hitIndex < hits; hitIndex += 1) {
      const hitTargets =
        skill.wildHits && hitIndex > 0
          ? [pick(opponentsOf(battle, actor))]
          : targets.filter((target) => target.hp > 0);
      for (const target of hitTargets) {
        if (!target || target.hp <= 0) continue;
        const forceCrit =
          (skill.finalCrit && hitIndex === hits - 1) ||
          (skill.executeCrit && target.hp / target.maxHp < 0.45);
        const damageInfo = damageTarget(
          battle,
          actor,
          target,
          skill,
          forceCrit,
          hitIndex,
        );
        result.targets.push(target.uid);
        result.events.push(
          ...damageInfo.events.map((event) => ({
            ...event,
            targetUid: target.uid,
          })),
        );
        result.lines.push(...damageInfo.lines);
        if (skill.rowBonus?.[target.row]) {
          const bonus = Math.round(damageInfo.damage * (skill.rowBonus[target.row] - 1));
          target.hp = Math.max(0, target.hp - bonus);
          battle.damageDealt += bonus;
          result.events.push({
            type: "damage",
            targetUid: target.uid,
            damage: bonus,
            critical: false,
            pathAdvantage: false,
          });
          result.lines.push(
            `${target.name}身处${ROWS[target.row]?.name || "该阵位"}，额外受到 ${bonus} 伤害。`,
          );
        }
        if (target.hp <= 0) {
          markDefeated(battle, target, result, actor);
        }
      }
    }
  }

  if (skill.heal) {
    const healTargets =
      skill.target === "self" ? [actor] : targets.filter((target) => target.hp > 0);
    for (const target of healTargets) {
      const heal = healTarget(actor, target, skill.heal, skill, battle);
      result.targets.push(target.uid);
      result.events.push({ type: "heal", targetUid: target.uid, healing: heal });
      result.lines.push(`${target.name}恢复 ${heal} 生命。`);
    }
  }

  applySkillEffects(battle, actor, targets, skill, result);
  if (skill.power > 0 || skill.heal) {
    const baseGain = skill.yiqi || 12;
    gainYiqi(actor, baseGain, battle);
  }

  pushLog(
    battle,
    actor.side === "hero" ? "hero" : "enemy",
    `${actor.name}施展「${skill.name}」`,
  );
  if (actor.side === "hero") updateHeroChain(battle, actor, skill);
  battle.actionResult = result;
  if (checkBattleEnd(battle)) return result;
  finishActorTurn(battle, actor);
  return result;
}

function updateHeroChain(battle, actor, skill) {
  if (battle.chainReady || skill.combo === false) return;
  battle.chainHeroes = battle.chainHeroes.filter((uidValue) => {
    const unit = combatantById(battle, uidValue);
    return unit?.side === "hero" && unit.path !== actor.path;
  });
  battle.chainHeroes.push(actor.uid);
  if (battle.chainHeroes.length > 3) battle.chainHeroes.shift();
  battle.chainLastPath = actor.path;
  battle.chain = chainPathsForBattle(battle).length;
  if (battle.chain >= 3) {
    battle.chainReady = true;
    const formation = chainFormationForBattle(battle);
    pushLog(
      battle,
      "good",
      `三路星火已经蓄势，可结成「${formation.name}」。`,
    );
  }
}

export function chainAttackReady(battle) {
  return Boolean(
    battle &&
      battle.chainReady &&
      battle.phase === "select" &&
      livingSide(battle, "hero").length > 0,
  );
}

export function chainPathsForBattle(battle) {
  const pathIds = [];
  const seen = new Set();
  for (const uidValue of battle?.chainHeroes || []) {
    const unit = combatantById(battle, uidValue);
    if (
      !unit ||
      unit.side !== "hero" ||
      unit.hp <= 0 ||
      seen.has(unit.path)
    ) {
      continue;
    }
    seen.add(unit.path);
    pathIds.push(unit.path);
  }
  return pathIds;
}

const THREE_STAR_FORMATION = {
  id: "three_star",
  name: "三星同辉",
  paths: [],
  icon: "sparkles",
  tone: "gold",
  desc: "三路星火同发，攻击全体敌军并鼓舞全队。",
  powerPct: 0,
  poiseBonus: 0,
};

export function chainFormationForBattle(battle) {
  const pathIds = new Set(chainPathsForBattle(battle));
  return (
    Object.values(CHAIN_FORMATIONS).find(
      (formation) =>
        formation.paths.length === pathIds.size &&
        formation.paths.every((pathId) => pathIds.has(pathId)),
    ) || THREE_STAR_FORMATION
  );
}

export function performChainAttack(battle, actorUid) {
  const actor = combatantById(battle, actorUid);
  if (!actor || actor.side !== "hero" || !chainAttackReady(battle)) {
    return { ok: false, message: "星命合击尚未蓄势。" };
  }

  battle.phase = "resolving";
  const chainHeroes = battle.chainHeroes
    .map((uidValue) => combatantById(battle, uidValue))
    .filter((unit) => unit?.side === "hero" && unit.hp > 0);
  const participants = chainHeroes.length
    ? chainHeroes
    : livingSide(battle, "hero");
  const enemies = livingSide(battle, "enemy");
  const formation = chainFormationForBattle(battle);
  const result = {
    ok: true,
    actorUid,
    skillId: "chain-attack",
    formationId: formation.id,
    targets: [],
    events: enemies.map((target) => ({
      type: "combo",
      targetUid: target.uid,
    })),
    lines: [
      `${participants.map((unit) => unit.name).join("、")}踏星换位，结成「${formation.name}」。`,
    ],
    kind: "combo",
  };
  const totalForce = participants.reduce(
    (sum, unit) => sum + unit.atk * 0.58 + 14,
    0,
  ) *
    (1 + (battle.modifiers?.chainPowerPct || 0)) *
    (1 + (formation.powerPct || 0));
  const spread = 1 + Math.max(0, enemies.length - 1) * 0.14;
  const statusDuration =
    (Number(formation.enemyStatus?.duration) || 0) +
    Math.max(0, Math.floor(Number(battle.modifiers?.statusDurationBonus) || 0));

  for (const target of enemies) {
    const pathBonuses = participants.reduce(
      (sum, unit) => sum + (PATHS[unit.path]?.beats === target.path ? 0.16 : 0),
      0,
    );
    let raw =
      (totalForce / spread - target.def * 0.32) *
      (1 + Math.min(0.48, pathBonuses));
    if (target.broken > 0) raw *= 1.22;
    const damage = Math.max(12, Math.round(raw));
    target.hp = Math.max(0, target.hp - damage);
    battle.damageDealt += damage;
    result.events.push({
      type: "damage",
      targetUid: target.uid,
      damage,
      critical: false,
      pathAdvantage: pathBonuses > 0,
    });
    for (const unit of participants) {
      gainHeroMetric(
        battle,
        unit,
        "damage",
        Math.round(damage / Math.max(1, participants.length)),
      );
    }
    result.targets.push(target.uid);
    result.lines.push(
      `星命锋芒贯穿${target.name}，造成 ${damage} 伤害${
        pathBonuses > 0 ? "，并引发路数共鸣" : ""
      }。`,
    );
    if (
      target.hp > 0 &&
      formation.enemyStatus &&
      STATUS_DEFS[formation.enemyStatus.status] &&
      statusDuration > 0
    ) {
      target.statuses[formation.enemyStatus.status] = Math.max(
        target.statuses[formation.enemyStatus.status] || 0,
        statusDuration,
      );
      result.lines.push(
        `${target.name}陷入${STATUS_DEFS[formation.enemyStatus.status].name} ${statusDuration} 回合。`,
      );
    }
    if (target.hp > 0 && target.broken <= 0) {
      target.poise +=
        48 +
        participants.length * 12 +
        (formation.poiseBonus || 0);
      if (target.poise >= target.poiseMax) {
        target.poise = 0;
        target.broken = 2;
        battle.poiseBreaks += 1;
        result.lines.push(`${target.name}护势崩解，陷入破势。`);
      }
    }
    if (target.hp <= 0) {
      markDefeated(battle, target, result, participants.length ? participants : actor);
    }
  }

  for (const unit of livingSide(battle, "hero")) {
    gainYiqi(unit, 16 + (formation.teamYiqiBonus || 0), battle);
    if (formation.teamGuard) {
      unit.statuses.guard = Math.max(
        unit.statuses.guard || 0,
        formation.teamGuard,
      );
      unit.statusesAppliedThisTurn ||= [];
      if (!unit.statusesAppliedThisTurn.includes("guard")) {
        unit.statusesAppliedThisTurn.push("guard");
      }
    }
    if (formation.teamInspiration) {
      unit.statuses.inspiration = Math.max(
        unit.statuses.inspiration || 0,
        formation.teamInspiration,
      );
      unit.statusesAppliedThisTurn ||= [];
      if (!unit.statusesAppliedThisTurn.includes("inspiration")) {
        unit.statusesAppliedThisTurn.push("inspiration");
      }
    }
    if (formation.teamHealPct) {
      const heal = Math.min(
        unit.maxHp - unit.hp,
        Math.max(1, Math.round(unit.maxHp * formation.teamHealPct)),
      );
      unit.hp += heal;
    }
  }
  const supportLines = [];
  if (formation.teamGuard) {
    supportLines.push(`获得 ${formation.teamGuard} 层护御`);
  }
  if (formation.teamInspiration) {
    supportLines.push(`获得 ${formation.teamInspiration} 回合鼓舞`);
  }
  if (formation.teamHealPct) {
    supportLines.push(`恢复 ${Math.round(formation.teamHealPct * 100)}% 生命`);
  }
  result.lines.push(
    `合击余威鼓舞全队，所有好汉获得 ${
      16 + (formation.teamYiqiBonus || 0)
    } 义气${supportLines.length ? `，并${supportLines.join("、")}` : ""}。`,
  );
  battle.chainFormationIds ||= [];
  if (
    formation.id !== THREE_STAR_FORMATION.id &&
    !battle.chainFormationIds.includes(formation.id)
  ) {
    battle.chainFormationIds.push(formation.id);
  }
  battle.lastChainFormationId = formation.id;
  pushLog(battle, "good", `星命合击：${formation.name}`);
  battle.chain = 0;
  battle.chainLastPath = null;
  battle.chainHeroes = [];
  battle.chainReady = false;
  battle.chainAttacks += 1;
  battle.actionResult = result;
  if (checkBattleEnd(battle)) return result;
  finishActorTurn(battle, actor);
  return result;
}

function resolveTargets(battle, actor, skill, selectedTargetUid) {
  const enemies = opponentsOf(battle, actor);
  const allies = alliesOf(battle, actor);
  switch (skill.target) {
    case "allEnemies":
      return enemies;
    case "allAllies":
      return allies;
    case "self":
      return [actor];
    case "frontEnemy":
      return [enemies.find((unit) => unit.row === 0) || enemies[0]];
    case "backEnemy":
      return [
        enemies.filter((unit) => unit.row === 2).sort((a, b) => b.spd - a.spd)[0] ||
          [...enemies].sort((a, b) => b.row - a.row)[0],
      ];
    case "lowestEnemy":
      return [[...enemies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
    case "ally": {
      const selected = combatantById(battle, selectedTargetUid);
      return selected && selected.side === actor.side && selected.hp > 0
        ? [selected]
        : [allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
    }
    case "enemy":
    default: {
      const selected = combatantById(battle, selectedTargetUid);
      return selected && selected.side !== actor.side && selected.hp > 0
        ? [selected]
        : [enemies[0]];
    }
  }
}

function damageTarget(battle, actor, target, skill, forceCrit, hitIndex) {
  const lines = [];
  const targetLegendEffects = target.legendRule?.effects || {};
  const targetRuleEffects = ruleEffectsFor(battle, target);
  const targetDoctrine = doctrineFor(battle, target);
  const targetPassiveEffects = target.passiveEffects || {};
  const evadeChance = Math.max(
    Number(targetLegendEffects.evadeChance) || 0,
    Number(targetRuleEffects.evadeChance) || 0,
    Number(targetPassiveEffects.evadeChance) || 0,
    target.side === "hero" && target.refId === "yanqing" ? 0.3 : 0,
  );
  if (
    actor.side === "enemy" &&
    target.side === "hero" &&
    target.hp > 0 &&
    target.evadedRound !== battle.round &&
    evadeChance > 0 &&
    chance(evadeChance)
  ) {
    target.evadedRound = battle.round;
    const personalYiqi =
      (targetLegendEffects.evadeYiqi ??
        targetRuleEffects.evadeYiqi ??
        targetPassiveEffects.evadeYiqi ??
        12) + (targetDoctrine?.evadeYiqiBonus || 0);
    gainYiqi(
      target,
      personalYiqi,
      battle,
    );
    const teamYiqi =
      (targetLegendEffects.evadeTeamYiqi ||
        targetRuleEffects.evadeTeamYiqi ||
        targetPassiveEffects.evadeTeamYiqi ||
        0) + (targetDoctrine?.evadeTeamYiqiBonus || 0);
    const teamGuard =
      targetLegendEffects.evadeTeamGuard ||
      targetRuleEffects.evadeTeamGuard ||
      targetPassiveEffects.evadeTeamGuard ||
      0;
    if (teamYiqi || teamGuard) {
      for (const ally of livingSide(battle, "hero")) {
        if (teamYiqi) gainYiqi(ally, teamYiqi, battle);
        if (teamGuard) {
          ally.statuses.guard = Math.max(
            ally.statuses.guard || 0,
            teamGuard,
          );
        }
      }
    }
    return {
      damage: 0,
      events: [{ type: "evade" }],
      lines: [
        `${target.name}借势闪避攻击，并获得 ${personalYiqi} 义气${
          teamYiqi || teamGuard
            ? `；潮信鼓舞全队，获得 ${teamYiqi} 义气${
                teamGuard ? `与 ${teamGuard} 层护御` : ""
              }`
            : ""
        }。`,
      ],
    };
  }
  const doctrine = doctrineFor(battle, actor);
  const actorRuleEffects = ruleEffectsFor(battle, actor);
  const actorLegendEffects = actor.legendRule?.effects || {};
  const actorPassiveEffects = actor.passiveEffects || {};
  const pathAdvantage = PATHS[actor.path]?.beats === target.path;
  const pathDisadvantage = PATHS[target.path]?.beats === actor.path;
  let defense = target.def;
  if (actor.side === "hero" && actor.refId === "wusong") {
    if (target.hp / target.maxHp > actor.hp / actor.maxHp) defense *= 0.85;
    if (
      doctrine?.defenseIgnorePct &&
      target.hp / target.maxHp > actor.hp / actor.maxHp
    ) {
      defense *= 1 - doctrine.defenseIgnorePct;
    }
  }

  let raw = Math.max(9, skill.power * actor.atk * 1.82 - defense * 0.54);
  if (actor.side === "hero" && skill.target === "allEnemies") {
    raw *= 1 + (battle.modifiers?.allEnemiesPowerPct || 0);
  }
  if (pathAdvantage) raw *= 1.2 + (battle.modifiers?.counterBonus || 0);
  if (pathDisadvantage) raw *= 0.9;
  if (target.broken > 0) {
    raw *=
      1.32 +
      (battle.modifiers?.brokenDamageBonus || 0) +
      (actorPassiveEffects.brokenDamagePct || 0) +
      (actorLegendEffects.brokenDamagePct || 0) +
      (doctrine?.brokenDamagePct || 0);
  }
  if (target.statuses.armorBreak > 0) raw *= 1.18;
  if (actor.side === "hero") {
    const armorBreakDamagePct = Math.max(
      actor.refId === "husanniang" ? 0.2 : 0,
      actorPassiveEffects.armorBreakDamagePct || 0,
      actorLegendEffects.armorBreakDamagePct || 0,
      doctrine?.armorBreakDamagePct || 0,
    );
    if (
      armorBreakDamagePct &&
      ((target.statuses.armorBreak || 0) > 0 || target.broken > 0)
    ) {
      raw *= 1 + armorBreakDamagePct;
    }
  }
  if (skill.armorBreakBonus && target.statuses.armorBreak > 0) {
    raw *= skill.armorBreakBonus;
  }
  if (skill.brokenBonus && target.broken > 0) {
    raw *= skill.brokenBonus;
  }
  if (actor.statuses.inspiration > 0) raw *= 1.18;
  if (target.statuses.guard > 0) {
    raw *= clamp(0.56 - (battle.modifiers?.guardBonus || 0), 0.34, 0.8);
  }
  if (target.side === "hero") {
    raw *= 1 - clamp(battle.modifiers?.damageReductionPct || 0, 0, 0.42);
  }
  const ignoresRow =
    skill.ignoreRow ||
    Boolean(actorPassiveEffects.ignoreRow) ||
    Boolean(actorLegendEffects.ignoreRow) ||
    (actor.side === "hero" && actor.refId === "huarong" && actor.row === 2);
  if (!ignoresRow) {
    raw *= [1.08, 1, 0.91][target.row] || 1;
  }
  if (skill.executeBonus && target.hp / target.maxHp < 0.4) {
    raw *= skill.executeBonus;
  }
  if (doctrine?.executeDamagePct && target.hp / target.maxHp < 0.45) {
    raw *= 1 + doctrine.executeDamagePct;
  }
  const bleedDamagePct =
    (actorPassiveEffects.bleedDamagePct || 0) +
    (actorLegendEffects.bleedDamagePct || 0) +
    (doctrine?.bleedDamagePct || 0);
  if (bleedDamagePct && (target.statuses.bleeding || 0) > 0) {
    raw *= 1 + bleedDamagePct;
  }
  if (
    doctrine?.ultimateDamagePct &&
    actor.refId === "huarong" &&
    skill.ultimate
  ) {
    raw *= 1 + doctrine.ultimateDamagePct;
  }
  if (actor.side === "hero") {
    const lowHpDamagePct =
      actorPassiveEffects.lowHpDamagePct ??
      doctrine?.lowHpDamagePct ??
      (actor.refId === "likui" ? 0.3 : 0);
    if (lowHpDamagePct) {
      raw *= 1 + lowHpDamagePct * (1 - actor.hp / actor.maxHp);
    }
  }
  if (actor.side === "hero" && actorLegendEffects.missingHpDamagePct) {
    raw *=
      1 +
      actorLegendEffects.missingHpDamagePct *
        (1 - actor.hp / actor.maxHp);
  }
  if (actorRuleEffects.missingHpDamagePct) {
    raw *=
      1 +
      actorRuleEffects.missingHpDamagePct *
        (1 - actor.hp / actor.maxHp);
  }
  if (actor.side === "hero") {
    const fullHpDamagePct =
      (actorPassiveEffects.fullHpDamagePct || 0) +
      (actorLegendEffects.fullHpDamagePct || 0) +
      (doctrine?.fullHpDamagePct || 0) +
      (actorRuleEffects.fullHpDamagePct || 0);
    const fullHpThreshold =
      actor.refId === "lujunyi" ? 0.85 : 0.8;
    if (fullHpDamagePct && actor.hp / actor.maxHp >= fullHpThreshold) {
      raw *= 1 + fullHpDamagePct;
    }
  }
  if (
    actor.side === "enemy" &&
    actor.refId === "executioner" &&
    actor.bossPhaseTriggered
  ) {
    raw *= 1.15;
  }
  if (
    target.side === "enemy" &&
    target.refId === "captain" &&
    target.bossPhaseTriggered
  ) {
    raw *= 0.88;
  }
  raw *= 0.93 + Math.random() * 0.14;

  const speedGap = actor.spd - target.spd;
  let critChance = 0.09 + clamp(speedGap, -20, 30) * 0.0025;
  if (actor.side === "hero") {
    critChance += battle.modifiers?.critPct || 0;
    critChance += actor.doctrineCritPct || 0;
  }
  if (
    actor.side === "hero" &&
    actor.refId === "shiqian" &&
    actor.row === 2
  ) {
    critChance += 0.18;
  }
  if (
    actor.side === "hero" &&
    actor.refId === "huarong" &&
    actor.row === 2
  ) {
    critChance += 0.12;
  }
  if (
    actor.side === "hero" &&
    actor.refId === "yanqing" &&
    actor.row === 2
  ) {
    critChance += 0.1;
  }
  const crit = forceCrit || chance(critChance);
  if (crit) raw *= 1.55;

  if (actor.side === "enemy") {
    const diff = DIFFICULTIES[battle.difficulty] || DIFFICULTIES.normal;
    raw *= diff.enemyDamage;
  }

  const damage = Math.max(5, Math.round(raw));
  const events = [
    {
      type: "damage",
      damage,
      critical: crit,
      pathAdvantage,
    },
  ];
  target.hp = Math.max(0, target.hp - damage);
  if (actor.side === "hero") {
    battle.damageDealt += damage;
    gainHeroMetric(battle, actor, "damage", damage);
    if (crit && actorPassiveEffects.critYiqi) {
      gainYiqi(actor, actorPassiveEffects.critYiqi, battle);
      lines.push(
        `${actor.name}借暴击回气，获得 ${actorPassiveEffects.critYiqi} 义气。`,
      );
    }
  }

  const onHit = actorLegendEffects.onHit;
  if (
    actor.side === "hero" &&
    target.side === "enemy" &&
    target.hp > 0 &&
    onHit &&
    chance(onHit.chance ?? 1)
  ) {
    if (onHit.status) {
      applyStatus(
        battle,
        actor,
        target,
        onHit.status,
        onHit.duration || 1,
        { lines },
      );
    }
    if (onHit.stealYiqi) {
      const stolen = Math.min(
        onHit.stealYiqi,
        Math.max(0, target.yiqi || 0),
      );
      target.yiqi = Math.max(0, (target.yiqi || 0) - stolen);
      if (stolen > 0) {
        gainYiqi(actor, stolen, battle);
        lines.push(`${actor.name}从${target.name}夺得 ${stolen} 义气。`);
      }
    }
  }

  const lowHp = targetLegendEffects.lowHp;
  if (
    target.side === "hero" &&
    target.hp > 0 &&
    lowHp &&
    !battle.legendLowHpTriggered &&
    target.hp / target.maxHp <= (lowHp.threshold || 0.5)
  ) {
    battle.legendLowHpTriggered = true;
    target.statuses.guard = Math.max(
      target.statuses.guard || 0,
      lowHp.guard || 1,
    );
    gainYiqi(target, lowHp.yiqi || 0, battle);
    lines.push(
      `${target.name}触发「${target.legendRule.name}」，获得 ${lowHp.guard || 1} 层护御与 ${lowHp.yiqi || 0} 义气。`,
    );
  }

  if (
    crit &&
    actor.side === "hero" &&
    actor.refId === "husanniang" &&
    target.hp > 0 &&
    target.side === "enemy"
  ) {
    target.statuses.armorBreak = Math.max(target.statuses.armorBreak || 0, 2);
    lines.push("红锦缚敌：暴击撕开甲缝，破甲延长至 2 回合。");
  }

  if (
    crit &&
    actor.side === "hero" &&
    actor.refId === "ruanxiaoqi" &&
    target.side === "enemy" &&
    target.hp > 0
  ) {
    const bleedChance =
      actorPassiveEffects.bleedOnCritChance ||
      doctrine?.bleedOnCritChance ||
      0;
    if (bleedChance && chance(bleedChance)) {
      applyStatus(battle, actor, target, "bleeding", 2, { lines });
      lines.push("活阎罗：暴击撕开旧伤，目标血流不止。");
    }
  }

  if (
    actor.side === "hero" &&
    actor.refId === "husanniang" &&
    target.side === "enemy" &&
    (target.statuses.armorBreak || 0) > 0 &&
    claimBondTrigger(battle, "red_banner_oath")
  ) {
    for (const ally of livingSide(battle, "hero")) gainYiqi(ally, 8, battle);
    lines.push("红锦护义：扈三娘锁住敌甲，全队获得 8 义气。");
  }

  if (
    target.side === "hero" &&
    target.hp > 0 &&
    target.hp / target.maxHp <= 0.5 &&
    ["yangxiong", "shixiu"].includes(target.refId) &&
    claimBondOnce(battle, "jailbreak_oath")
  ) {
    const partners = livingSide(battle, "hero").filter((unit) =>
      ["yangxiong", "shixiu"].includes(unit.refId),
    );
    for (const partner of partners) {
      partner.statuses.guard = Math.max(partner.statuses.guard || 0, 1);
      partner.statusesAppliedThisTurn ||= [];
      if (!partner.statusesAppliedThisTurn.includes("guard")) {
        partner.statusesAppliedThisTurn.push("guard");
      }
      gainYiqi(partner, 12, battle);
    }
    lines.push(
      `病关拼命：${partners.map((unit) => unit.name).join("、")}各获得 1 层护御与 12 义气。`,
    );
  }

  if (
    target.side === "hero" &&
    target.hp > 0 &&
    target.hp / target.maxHp < 0.35 &&
    !battle.timelyRescueUsed
  ) {
    const songjiang = livingSide(battle, "hero").find(
      (unit) => unit.refId === "songjiang",
    );
    if (songjiang) {
      battle.timelyRescueUsed = true;
      const rescueDoctrine = doctrineFor(battle, songjiang);
      const rescuePct =
        0.08 + (rescueDoctrine?.emergencyHealBonus || 0);
      for (const ally of livingSide(battle, "hero")) {
        const heal = Math.min(
          ally.maxHp - ally.hp,
          Math.max(1, Math.round(ally.maxHp * rescuePct)),
        );
        ally.hp += heal;
        ally.statuses.guard = Math.max(ally.statuses.guard || 0, 1);
      }
      lines.push(
        `呼保义：宋江喝令救援，全队恢复 ${Math.round(rescuePct * 100)}% 生命并获得护御。`,
      );
    }
  }

  if (
    actor.side === "enemy" &&
    target.side === "hero" &&
    target.hp > 0 &&
    ["linchong", "luzhishen"].includes(target.refId) &&
    claimBondTrigger(battle, "wind_snow")
  ) {
    const partnerId = target.refId === "linchong" ? "luzhishen" : "linchong";
    const partner = livingSide(battle, "hero").find(
      (unit) => unit.refId === partnerId,
    );
    if (partner) {
      gainYiqi(partner, 10, battle);
      partner.statuses.guard = Math.max(partner.statuses.guard || 0, 1);
      lines.push(
        `风雪同袍：${partner.name}获得 10 义气，并立即横身护住${target.name}。`,
      );
    }
  }

  const inflictsControl = (skill.effects || []).some(
    (effect) =>
      effect.type === "status" &&
      ["stun", "sealed", "armorBreak"].includes(effect.status),
  );
  const poiseDamage = Math.round(
    (skill.poise || 8) *
      (crit ? 1.35 : 1) *
      (actor.side === "hero"
        ? 1 +
          (battle.modifiers?.poisePct || 0) +
          (doctrine?.poisePct || 0) +
          (actor.refId === "wuyong" ? 0.15 : 0) +
          (inflictsControl
            ? (doctrine?.controlPoisePct || 0) +
              (actorPassiveEffects.controlPoisePct || 0)
            : 0) +
          (skill.bomb
            ? (actorPassiveEffects.artilleryPoisePct || 0) +
              (doctrine?.artilleryPoisePct || 0) +
              (actorRuleEffects.artilleryPoisePct || 0)
            : 0) +
          (skill.stone ? doctrine?.stonePoisePct || 0 : 0) +
          (skill.target === "allEnemies"
            ? (doctrine?.allEnemiesPoisePct || 0) +
              (actorPassiveEffects.allEnemiesPoisePct || 0) +
              (actorLegendEffects.allEnemiesPoisePct || 0)
            : 0)
        : 1),
  );
  if (target.hp > 0 && target.broken <= 0) {
    target.poise += poiseDamage;
    if (target.poise >= target.poiseMax) {
      target.poise = 0;
      target.broken = 2;
      battle.poiseBreaks += 1;
      lines.push(`${target.name}护势崩解，陷入破势。`);
    }
  }

  if (
    actor.side === "hero" &&
    skill.bomb &&
    target.side === "enemy" &&
    target.hp > 0 &&
    target.broken <= 0
  ) {
    const stunChance =
      (actorPassiveEffects.bombStunChance || 0) +
      (doctrine?.bombStunChance || 0) +
      (actorRuleEffects.bombStunChance || 0);
    if (stunChance && chance(stunChance)) {
      applyStatus(battle, actor, target, "stun", 1, { lines });
      lines.push("轰天雷：炮火在阵中炸响，敌阵被震得一时失序。");
    }
  }

  lines.unshift(
    `${target.name}受到 ${damage} 伤害${crit ? "，暴击" : ""}${
      pathAdvantage ? "，路数克制" : ""
    }。`,
  );

  if (
    actor.side === "hero" &&
    actor.refId === "shijin" &&
    target.side === "enemy" &&
    target.hp > 0 &&
    skill.power > 0 &&
    skill.target !== "allEnemies" &&
    actor.comboChasedRound !== battle.round
  ) {
    const chaseChance =
      (actorPassiveEffects.comboChaseChance || 0) +
      (doctrine?.comboChaseBonus || 0);
    const guaranteed =
      actorPassiveEffects.comboChaseBrokenGuaranteed &&
      (target.statuses.armorBreak || 0) > 0;
    if (guaranteed || chance(chaseChance)) {
      actor.comboChasedRound = battle.round;
      const chaseDamage = Math.max(
        5,
        Math.round(
          damage *
            ((actorPassiveEffects.comboChasePowerPct || 0.35) +
              (doctrine?.comboChaseDamagePct || 0)),
        ),
      );
      target.hp = Math.max(0, target.hp - chaseDamage);
      battle.damageDealt += chaseDamage;
      gainHeroMetric(battle, actor, "damage", chaseDamage);
      events.push({
        type: "damage",
        damage: chaseDamage,
        critical: false,
        pathAdvantage: false,
      });
      lines.push(
        `九龙追锋：${actor.name}顺势追刺${target.name}，追加 ${chaseDamage} 伤害。`,
      );
    }
  }

  if (
    actor.side === "hero" &&
    actor.refId === "zhangqing" &&
    skill.stone &&
    target.side === "enemy" &&
    actor.stoneRicochetRound !== battle.round
  ) {
    const ricochetChance =
      (actorPassiveEffects.stoneRicochetChance || 0) +
      (battle.modifiers?.stoneRicochetChance || 0) +
      (doctrine?.stoneRicochetBonus || 0);
    const candidates = livingSide(battle, "enemy").filter(
      (unit) => unit.uid !== target.uid,
    );
    if (candidates.length && chance(ricochetChance)) {
      actor.stoneRicochetRound = battle.round;
      const ricochetTarget = pick(candidates);
      const ricochetDamage = Math.max(
        5,
        Math.round(
          damage *
            ((actorPassiveEffects.stoneRicochetPowerPct || 0.38) +
              (doctrine?.stoneRicochetPowerBonus || 0)),
        ),
      );
      ricochetTarget.hp = Math.max(0, ricochetTarget.hp - ricochetDamage);
      battle.damageDealt += ricochetDamage;
      gainHeroMetric(battle, actor, "damage", ricochetDamage);
      events.push({
        type: "damage",
        damage: ricochetDamage,
        critical: false,
        pathAdvantage: false,
      });
      const ricochetPoise = Math.round(
        (actorPassiveEffects.stoneRicochetPoise || 16) *
          (1 +
            (battle.modifiers?.poisePct || 0) +
            (doctrine?.stonePoisePct || 0)),
      );
      if (ricochetTarget.hp > 0 && ricochetTarget.broken <= 0) {
        ricochetTarget.poise += ricochetPoise;
        if (ricochetTarget.poise >= ricochetTarget.poiseMax) {
          ricochetTarget.poise = 0;
          ricochetTarget.broken = 2;
          battle.poiseBreaks += 1;
          lines.push(`${ricochetTarget.name}被飞石震散护势。`);
        }
      }
      lines.push(
        `飞石连星：石子折向${ricochetTarget.name}，追加 ${ricochetDamage} 伤害与 ${ricochetPoise} 护势伤害。`,
      );
    }
  }

  if (
    actor.side === "hero" &&
    actor.refId === "xuning" &&
    skill.hook &&
    target.side === "enemy" &&
    actor.hookSplashRound !== battle.round
  ) {
    const candidates = livingSide(battle, "enemy")
      .filter((unit) => unit.uid !== target.uid)
      .sort(
        (a, b) =>
          Number(b.row === target.row) - Number(a.row === target.row) ||
          a.row - b.row ||
          a.uid.localeCompare(b.uid),
      );
    if (candidates.length) {
      actor.hookSplashRound = battle.round;
      const hooked = candidates[0];
      const powerBonus =
        (doctrine?.hookSplashPowerBonus || 0) +
        (actorLegendEffects.hookSplashPowerPct || 0) +
        (battle.specialRule?.effects?.hookSplashPowerPct || 0);
      const hookDamage = Math.max(
        5,
        Math.round(
          damage *
            ((actorPassiveEffects.hookSplashPowerPct || 0.34) + powerBonus),
        ),
      );
      hooked.hp = Math.max(0, hooked.hp - hookDamage);
      battle.damageDealt += hookDamage;
      gainHeroMetric(battle, actor, "damage", hookDamage);
      events.push({
        type: "damage",
        damage: hookDamage,
        critical: false,
        pathAdvantage: false,
      });
      const hookPoise = Math.max(
        1,
        Math.round(
          (actorPassiveEffects.hookSplashPoise || 10) +
            (doctrine?.hookSplashPoiseBonus || 0) +
            (actorLegendEffects.hookSplashPoise || 0) +
            (battle.specialRule?.effects?.hookSplashPoise || 0),
        ),
      );
      if (hooked.hp > 0 && hooked.broken <= 0) {
        hooked.poise += hookPoise;
        if (hooked.poise >= hooked.poiseMax) {
          hooked.poise = 0;
          hooked.broken = 2;
          battle.poiseBreaks += 1;
          lines.push(`${hooked.name}被倒钩扯乱阵脚，护势崩解。`);
        }
      }
      if (hooked.hp > 0) {
        hooked.statuses.armorBreak = Math.max(
          hooked.statuses.armorBreak || 0,
          2,
        );
      }
      lines.push(
        `钩镰锁阵：倒钩扯向${hooked.name}，追加 ${hookDamage} 伤害、${hookPoise} 护势伤害并破甲。`,
      );

      if ((target.statuses.armorBreak || 0) > 0 || target.broken > 0) {
        const hookYiqi =
          (actorPassiveEffects.hookArmorBreakYiqi || 6) +
          (doctrine?.hookArmorBreakYiqiBonus || 0);
        gainYiqi(actor, hookYiqi, battle);
        lines.push(`${actor.name}借旧甲缝回枪，获得 ${hookYiqi} 义气。`);
        if (battleHasBond(battle, "golden_spear_oath")) {
          const linchong = livingSide(battle, "hero").find(
            (unit) => unit.refId === "linchong",
          );
          if (linchong) {
            gainYiqi(linchong, 6, battle);
            linchong.statuses.guard = Math.max(
              linchong.statuses.guard || 0,
              1,
            );
            lines.push("金枪同门：林冲获得 6 义气与护御。");
          }
        }
      }
    }
  }

  if (
    actor.side === "hero" &&
    actor.refId === "shiqian" &&
    actor.row === 2
  ) {
    actor.statuses.guard = Math.max(actor.statuses.guard || 0, 1);
  }

  if (
    target.side === "hero" &&
    target.hp > 0 &&
    actor.side === "enemy" &&
    (targetPassiveEffects.counterRow === undefined ||
      target.row === targetPassiveEffects.counterRow) &&
    (target.refId === "linchong" ||
      (targetPassiveEffects.counterChance || 0) > 0 ||
      (targetLegendEffects.counterChance || 0) > 0 ||
      (targetDoctrine?.counterChanceBonus || 0) > 0) &&
    chance(
      (target.refId === "linchong" ? 0.22 : 0) +
        (targetPassiveEffects.counterChance || 0) +
        (targetDoctrine?.counterChanceBonus || 0) +
      (targetRuleEffects.counterChance || 0) +
        (targetLegendEffects.counterChance || 0),
    )
  ) {
    const counter = Math.max(
      6,
      Math.round(
        (target.atk * 0.7 - actor.def * 0.3) *
          (1 + (battle.modifiers?.counterBonus || 0)),
      ),
    );
    actor.hp = Math.max(0, actor.hp - counter);
    battle.damageDealt += counter;
    events.push({
      type: "damage",
      damage: counter,
      critical: false,
      pathAdvantage: false,
    });
    lines.push(
      `${target.name}${target.refId === "guansheng" ? "挥刀" : "挺枪"}反击，造成 ${counter} 伤害。`,
    );
    const counterPoise =
      (targetPassiveEffects.counterPoise || 0) +
      (targetDoctrine?.counterPoiseBonus || 0) +
      (targetRuleEffects.counterPoise || 0);
    if (counterPoise && actor.hp > 0 && actor.broken <= 0) {
      actor.poise += counterPoise;
      lines.push(
        `${target.name}以门闩震开敌势，追加 ${counterPoise} 护势伤害。`,
      );
      if (actor.poise >= actor.poiseMax) {
        actor.poise = 0;
        actor.broken = 2;
        battle.poiseBreaks += 1;
        lines.push(`${actor.name}护势崩解，陷入破势。`);
      }
    }
    const counterArmorBreakChance = Math.max(
      Number(targetPassiveEffects.counterArmorBreakChance) || 0,
      Number(targetRuleEffects.counterArmorBreakChance) || 0,
      Number(targetLegendEffects.counterArmorBreakChance) || 0,
      Number(targetDoctrine?.counterArmorBreakChance) || 0,
    );
    if (
      counterArmorBreakChance &&
      actor.hp > 0 &&
      chance(counterArmorBreakChance)
    ) {
      applyStatus(battle, target, actor, "armorBreak", 2, { lines });
    }
    const counterGuard =
      (targetPassiveEffects.counterGuard || 0) +
      (targetDoctrine?.counterGuard || 0) +
      (targetRuleEffects.counterGuard || 0);
    if (counterGuard > 0) {
      const guardRecipient =
        targetDoctrine?.counterGuard && target.refId === "gudashao"
          ? livingSide(battle, "hero").sort(
              (a, b) =>
                a.hp / Math.max(1, a.maxHp) -
                  b.hp / Math.max(1, b.maxHp) ||
                a.uid.localeCompare(b.uid),
            )[0]
          : target;
      const recipient = guardRecipient || target;
      recipient.statuses.guard = Math.max(
        recipient.statuses.guard || 0,
        counterGuard,
      );
      const counterHealPct =
        (targetPassiveEffects.counterHealPct || 0) +
        (targetDoctrine?.counterHealPct || 0);
      if (counterHealPct) {
        const healRecipient =
          target.refId === "zhutong"
            ? livingSide(battle, "hero").sort(
                (a, b) =>
                  a.hp / Math.max(1, a.maxHp) -
                    b.hp / Math.max(1, b.maxHp) ||
                  a.uid.localeCompare(b.uid),
              )[0] || target
            : recipient;
        const heal = Math.min(
          healRecipient.maxHp - healRecipient.hp,
          Math.max(1, Math.round(healRecipient.maxHp * counterHealPct)),
        );
        healRecipient.hp += heal;
        if (heal > 0) {
          lines.push(
            `${target.name}反手护住${healRecipient.name}，恢复 ${heal} 生命。`,
          );
        }
      }
      target.statuses.guard = Math.max(
        target.statuses.guard || 0,
        targetPassiveEffects.counterGuard || 0,
      );
      lines.push(
        `${recipient.name}借反击稳住刀势，获得 ${counterGuard} 层护御。`,
      );
    }
    const counterTeamYiqi =
      (targetPassiveEffects.counterTeamYiqi || 0) +
      (targetDoctrine?.counterTeamYiqi || 0) +
      (targetRuleEffects.counterTeamYiqi || 0) +
      (targetLegendEffects.counterTeamYiqi || 0);
    if (counterTeamYiqi > 0) {
      for (const ally of livingSide(battle, "hero")) {
        gainYiqi(ally, counterTeamYiqi, battle);
      }
      lines.push(
        `${target.name}反击成势，全队获得 ${counterTeamYiqi} 义气。`,
      );
    }
    if (actor.hp <= 0) {
      lines.push(`${actor.name}被反击击倒。`);
    }
  }

  if (hitIndex > 0 && (target.statuses.bleeding || 0) > 0) {
    const extra = Math.max(4, Math.round(target.maxHp * 0.02));
    target.hp = Math.max(0, target.hp - extra);
    events.push({
      type: "damage",
      damage: extra,
      critical: false,
      pathAdvantage: false,
    });
    lines.push(`旧伤崩裂，${target.name}额外失去 ${extra} 生命。`);
  }
  return { damage, events, lines };
}

function healTarget(actor, target, power, skill, battle) {
  let amount = Math.round(actor.atk * power * 2.2 + 26);
  amount = Math.round(amount * (1 + (battle.modifiers?.healPct || 0)));
  if (actor.side === "hero" && actor.refId === "andaoquan") {
    if (target.hp / target.maxHp < 0.3) amount = Math.round(amount * 1.25);
  }
  const doctrine = doctrineFor(battle, actor);
  if (
    actor.side === "hero" &&
    actor.refId === "andaoquan" &&
    doctrine?.lowHealBonus &&
    target.hp / target.maxHp < 0.3
  ) {
    amount = Math.round(amount * (1 + doctrine.lowHealBonus));
  }
  if (
    actor.side === "hero" &&
    actor.refId === "chaiin" &&
    target.hp / target.maxHp < 0.45
  ) {
    amount = Math.round(
      amount *
        (1 +
          (doctrine?.supportHealPct || 0) +
          (battle.specialRule?.effects?.supportHealPct || 0)),
    );
  }
  amount = Math.min(target.maxHp - target.hp, amount);
  target.hp += amount;
  return amount;
}

function applySkillEffects(battle, actor, targets, skill, result) {
  const doctrine = doctrineFor(battle, actor);
  const actorPassiveEffects = actor.passiveEffects || {};
  for (const effect of skill.effects || []) {
    switch (effect.type) {
      case "status": {
        for (const target of targets) {
          if (!target || target.hp <= 0) continue;
          if (chance(effect.chance ?? 1)) {
            applyStatus(battle, actor, target, effect.status, effect.duration, result);
          }
        }
        break;
      }
      case "selfStatus":
        applyStatus(battle, actor, actor, effect.status, effect.duration, result);
        break;
      case "targetStatus": {
        const target = targets[0] || actor;
        applyStatus(battle, actor, target, effect.status, effect.duration, result);
        break;
      }
      case "teamStatus":
        for (const ally of alliesOf(battle, actor)) {
          applyStatus(battle, actor, ally, effect.status, effect.duration, result);
        }
        break;
      case "teamCleanse":
        for (const ally of alliesOf(battle, actor)) cleanseTarget(ally, result);
        break;
      case "targetCleanse":
        if (targets[0]) cleanseTarget(targets[0], result);
        break;
      case "targetRemoveGood":
        if (targets[0]) {
          targets[0].statuses.guard = 0;
          targets[0].statuses.inspiration = 0;
          result.lines.push(`${targets[0].name}的增益被移除。`);
        }
        break;
      case "teamYiqi":
        for (const ally of alliesOf(battle, actor)) {
          gainYiqi(ally, effect.amount || 0, battle);
        }
        result.lines.push(`全队义气上升。`);
        break;
      case "targetYiqi":
        if (targets[0]) {
          gainYiqi(targets[0], effect.amount || 0, battle);
          result.lines.push(`${targets[0].name}获得 ${effect.amount} 义气。`);
        }
        break;
      case "lowestAllyYiqi": {
        const ally = livingSide(battle, "hero")
          .filter((unit) => unit.hp > 0)
          .sort(
            (a, b) =>
              a.yiqi - b.yiqi ||
              a.hp / a.maxHp - b.hp / b.maxHp ||
              a.uid.localeCompare(b.uid),
          )[0];
        if (ally) {
          gainYiqi(ally, effect.amount || 0, battle);
          result.lines.push(
            `${ally.name}义气最低，获得 ${effect.amount || 0} 义气。`,
          );
        }
        break;
      }
      case "selfYiqi":
        gainYiqi(actor, effect.amount || 0, battle);
        break;
      case "stealYiqi": {
        const target = targets[0];
        if (!target) break;
        const requested = Math.round(
          (effect.amount || 0) * (1 + (doctrine?.stealPct || 0)),
        );
        const stolen = Math.min(requested, target.yiqi || 0);
        target.yiqi = Math.max(0, (target.yiqi || 0) - stolen);
        if (stolen > 0) {
          gainYiqi(actor, stolen, battle);
          result.lines.push(`${actor.name}从${target.name}身上夺得 ${stolen} 义气。`);
          if (doctrine?.guardOnSteal) {
            actor.statuses.guard = Math.max(actor.statuses.guard || 0, 1);
            result.lines.push(`${actor.name}借影藏身，获得护御。`);
          }
        } else {
          gainYiqi(actor, Math.round(requested * 0.45), battle);
          result.lines.push(`${target.name}义气已空，${actor.name}只得凝神蓄势。`);
        }
        if (claimBondTrigger(battle, "miracle_hands")) {
          const ally = livingSide(battle, "hero")
            .filter((unit) => unit.hp < unit.maxHp)
            .sort(
              (a, b) =>
                a.hp / a.maxHp - b.hp / b.maxHp ||
                a.uid.localeCompare(b.uid),
            )[0];
          if (ally) {
            const heal = Math.min(
              ally.maxHp - ally.hp,
              Math.max(1, Math.round(ally.maxHp * 0.06)),
            );
            ally.hp += heal;
            result.lines.push(
              `妙手相济：安道全隔阵施针，${ally.name}恢复 ${heal} 生命。`,
            );
          }
        }
        break;
      }
      case "selfHeal": {
        const heal = healTarget(actor, actor, effect.power || 0.2, skill, battle);
        result.events.push({ type: "heal", targetUid: actor.uid, healing: heal });
        result.lines.push(`${actor.name}恢复 ${heal} 生命。`);
        break;
      }
      default:
        break;
    }
  }
  if (
    doctrine?.supportGuard &&
    skill.target === "ally" &&
    (skill.effects || []).some((effect) => effect.type === "targetYiqi")
  ) {
    const target = targets[0];
    if (target) {
      applyStatus(battle, actor, target, "guard", 1, result);
    }
  }
  const qiSupportEffectTypes = new Set([
    "teamYiqi",
    "targetYiqi",
    "lowestAllyYiqi",
    "selfYiqi",
  ]);
  const isQiSupportSkill = (skill.effects || []).some((effect) =>
    qiSupportEffectTypes.has(effect.type),
  );
  if (isQiSupportSkill) {
    const actorRuleEffects = ruleEffectsFor(battle, actor);
    const supportLowestGuard =
      actor.refId === "yuehe"
        ? Math.max(
            Number(battle.modifiers?.supportLowestGuard) || 0,
            Number(actorRuleEffects.supportLowestGuard) || 0,
            Number(battle.specialRule?.effects?.supportLowestGuard) || 0,
          )
        : 0;
    if (supportLowestGuard) {
      const recipient = livingSide(battle, "hero")
        .filter((unit) => unit.hp > 0)
        .sort(
          (a, b) =>
            a.hp / Math.max(1, a.maxHp) -
              b.hp / Math.max(1, b.maxHp) ||
            a.uid.localeCompare(b.uid),
        )[0];
      if (recipient) {
        applyStatus(
          battle,
          actor,
          recipient,
          "guard",
          supportLowestGuard,
          result,
        );
        result.lines.push(
          `铁叫子和声，护住生命最低的${recipient.name}。`,
        );
      }
    }
    const supportTeamGuard =
      actor.refId === "jiangjing"
        ? Math.max(
            Number(actorRuleEffects.supportTeamGuard) || 0,
            Number(battle.specialRule?.effects?.supportTeamGuard) || 0,
          )
        : 0;
    if (supportTeamGuard) {
      for (const ally of livingSide(battle, "hero")) {
        applyStatus(
          battle,
          actor,
          ally,
          "guard",
          supportTeamGuard,
          result,
        );
      }
      result.lines.push("军需落阵，全队获得护御。");
    }
  }
  const isSupportSkill =
    skill.heal > 0 ||
    skill.target === "allAllies" ||
    skill.target === "ally" ||
    (skill.effects || []).some((effect) =>
      ["teamYiqi", "targetYiqi", "lowestAllyYiqi", "teamCleanse"].includes(
        effect.type,
      ),
    );
  if (
    actor.side === "hero" &&
    actor.refId === "chaiin" &&
    actorPassiveEffects.supportAidGuard &&
    actor.supportAidRound !== battle.round &&
    isSupportSkill
  ) {
    const recipient = livingSide(battle, "hero")
      .filter((unit) => unit.hp > 0)
      .sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp ||
          a.yiqi - b.yiqi ||
          a.uid.localeCompare(b.uid),
      )[0];
    if (recipient) {
      actor.supportAidRound = battle.round;
      recipient.statuses.guard = Math.max(
        recipient.statuses.guard || 0,
        actorPassiveEffects.supportAidGuard,
      );
      gainYiqi(recipient, actorPassiveEffects.supportAidYiqi || 0, battle);
      result.lines.push(
        `仗义疏财：${recipient.name}获得护御与 ${actorPassiveEffects.supportAidYiqi || 0} 义气。`,
      );
    }
  }
  if (
    doctrine?.bleedOnControl &&
    ["an_basic", "an_powder"].includes(skill.id)
  ) {
    for (const target of targets) {
      if (target?.side === "enemy" && target.hp > 0) {
        applyStatus(battle, actor, target, "bleeding", 2, result);
      }
    }
  }
}

function applyStatus(battle, source, target, status, duration, result) {
  if (!STATUS_DEFS[status] || !target || target.hp <= 0) return false;
  if (status === "stun" && target.side === "hero" && target.refId === "luzhishen") {
    if (chance(0.35)) {
      gainYiqi(target, 18, battle);
      result.lines.push("鲁智深以倒拔垂杨柳之势抵抗了控制。");
      const doctrine = doctrineFor(battle, target);
      if (doctrine?.controlResistGuard) {
        for (const ally of livingSide(battle, "hero")) {
          ally.statuses.guard = Math.max(ally.statuses.guard || 0, 1);
        }
        result.lines.push("金刚不坏：全队获得护御。");
      }
      return false;
    }
  }
  const sourceDoctrine = doctrineFor(battle, source);
  const durationBonus =
    source?.side !== target.side && NEGATIVE_STATUSES.has(status)
      ? Math.min(
          3,
          (Number(source?.passiveEffects?.statusDurationBonus) || 0) +
            (Number(sourceDoctrine?.statusDurationBonus) || 0) +
            (Number(battle.modifiers?.statusDurationBonus) || 0) +
            (Number(battle.specialRule?.effects?.statusDurationBonus) || 0),
        )
      : 0;
  const appliedDuration = Math.max(1, (duration || 1) + durationBonus);
  target.statuses[status] = Math.max(
    target.statuses[status] || 0,
    appliedDuration,
  );
  target.statusesAppliedThisTurn ||= [];
  if (!target.statusesAppliedThisTurn.includes(status)) {
    target.statusesAppliedThisTurn.push(status);
  }
  result.lines.push(
    `${target.name}获得「${STATUS_DEFS[status].name}」${
      durationBonus ? `，持续时间延长至 ${appliedDuration} 回合` : ""
    }。`,
  );
  return true;
}

function cleanseTarget(target, result) {
  let removed = 0;
  for (const status of ["armorBreak", "bleeding", "stun", "sealed"]) {
    if (target.statuses[status]) {
      target.statuses[status] = 0;
      removed += 1;
    }
  }
  if (removed) result.lines.push(`${target.name}的负面状态被净化。`);
}

function gainYiqi(actor, amount, battle) {
  if (!actor || actor.hp <= 0 || actor.statuses.sealed > 0) return;
  const multiplier =
    yiqiMultiplier({ facilities: { tower: battle.towerLevel || 1 } }) *
    (1 + (battle.modifiers?.yiqiPct || 0));
  actor.yiqi = Math.min(100, actor.yiqi + Math.round(amount * multiplier));
}

function gainHeroMetric(battle, actor, metric, amount) {
  if (!battle || actor?.side !== "hero" || amount <= 0) return;
  battle.heroMetrics[actor.refId] ||= {
    kills: 0,
    damage: 0,
    ultimates: 0,
  };
  battle.heroMetrics[actor.refId][metric] += amount;
}

export function setBattleFacilityContext(battle, state) {
  battle.towerLevel = state.facilities.tower || 1;
}

function finishActorTurn(battle, actor) {
  const freshStatuses = new Set(actor.statusesAppliedThisTurn || []);
  for (const status of Object.keys(actor.statuses)) {
    if (actor.statuses[status] > 0 && !freshStatuses.has(status)) {
      actor.statuses[status] -= 1;
    }
  }
  actor.statusesAppliedThisTurn = [];
  if (actor.broken > 0) actor.broken -= 1;
  checkBattleEnd(battle);
}

function markDefeated(battle, target, result, creditedActor) {
  const creditedActors = Array.isArray(creditedActor)
    ? creditedActor
    : [creditedActor];
  let newlyDefeated = false;
  if (target.side === "enemy" && !battle.defeatedEnemyIds.includes(target.uid)) {
    battle.defeatedEnemyIds.push(target.uid);
    result.lines.push(`${target.name}被击败。`);
    newlyDefeated = true;
  } else if (target.side === "hero") {
    result.lines.push(`${target.name}倒下。`);
  }
  if (!newlyDefeated) return;
  const defeatRule = battle.specialRule?.effects?.onEnemyDefeat;
  if (defeatRule) {
    const survivors = livingSide(battle, "enemy");
    if (survivors.length) {
      for (const survivor of survivors) {
        if (defeatRule.guard) {
          survivor.statuses.guard = Math.max(
            survivor.statuses.guard || 0,
            defeatRule.guard,
          );
        }
        if (defeatRule.inspiration) {
          survivor.statuses.inspiration = Math.max(
            survivor.statuses.inspiration || 0,
            defeatRule.inspiration,
          );
        }
        if (defeatRule.healPct && survivor.hp > 0) {
          survivor.hp = Math.min(
            survivor.maxHp,
            survivor.hp +
              Math.max(1, Math.round(survivor.maxHp * defeatRule.healPct)),
          );
        }
      }
      result.lines.push(
        `「${battle.specialRule.name}」发动：余下官军${defeatRule.guard ? "获得护御" : ""}${defeatRule.guard && defeatRule.inspiration ? "与" : ""}${defeatRule.inspiration ? "鼓舞" : ""}${defeatRule.healPct ? `${defeatRule.guard || defeatRule.inspiration ? "并" : ""}恢复生命` : ""}。`,
      );
    }
  }
  for (const actor of creditedActors) {
    if (actor?.side === "hero") {
      gainHeroMetric(battle, actor, "kills", 1);
      const actorDoctrine = doctrineFor(battle, actor);
      const actorRuleEffects = ruleEffectsFor(battle, actor);
      const killGuard = Math.max(
        actor.passiveEffects?.killGuard || 0,
        actorDoctrine?.killGuard || 0,
        actorRuleEffects.onKill?.guard || 0,
      );
      if (killGuard) {
        actor.statuses.guard = Math.max(
          actor.statuses.guard || 0,
          killGuard,
        );
        actor.statusesAppliedThisTurn ||= [];
        if (!actor.statusesAppliedThisTurn.includes("guard")) {
          actor.statusesAppliedThisTurn.push("guard");
        }
        result.lines.push(
          `${actor.name}猎杀得手，借势获得 ${killGuard} 层护御。`,
        );
      }
      const killHealPct = Math.max(
        Number(actor.passiveEffects?.killHealPct) || 0,
        Number(actorDoctrine?.killHealPct) || 0,
        Number(actorRuleEffects.onKill?.healPct) || 0,
      );
      if (killHealPct && actor.hp > 0 && actor.hp < actor.maxHp) {
        const heal = Math.min(
          actor.maxHp - actor.hp,
          Math.max(1, Math.round(actor.maxHp * killHealPct)),
        );
        actor.hp += heal;
        result.lines.push(
          `${actor.name}乘胜追击，恢复 ${heal} 生命。`,
        );
      }
    }
  }
  const dengzhouKiller = creditedActors.find(
    (actor) =>
      actor?.side === "hero" &&
      ["sunli", "jiezhen", "jiebao"].includes(actor.refId),
  );
  if (dengzhouKiller && claimBondTrigger(battle, "dengzhou_three")) {
    for (const ally of livingSide(battle, "hero")) {
      ally.statuses.guard = Math.max(ally.statuses.guard || 0, 1);
      ally.statusesAppliedThisTurn ||= [];
      if (!ally.statusesAppliedThisTurn.includes("guard")) {
        ally.statusesAppliedThisTurn.push("guard");
      }
      gainYiqi(ally, 8, battle);
    }
    result.lines.push(
      `登州三杰：${dengzhouKiller.name}破敌，全队获得护御与 8 义气。`,
    );
  }
  const hunterKiller = creditedActors.find(
    (actor) =>
      actor?.side === "hero" &&
      ["jiezhen", "jiebao"].includes(actor.refId),
  );
  if (hunterKiller && claimBondTrigger(battle, "xie_brothers")) {
    const partnerId = hunterKiller.refId === "jiezhen" ? "jiebao" : "jiezhen";
    const partner = livingSide(battle, "hero").find(
      (actor) => actor.refId === partnerId,
    );
    if (partner) {
      gainYiqi(partner, 12, battle);
      partner.statuses.guard = Math.max(partner.statuses.guard || 0, 1);
      result.lines.push(
        `登州双猎：${partner.name}接住杀势，获得 12 义气与护御。`,
      );
    }
  }
  const likui = creditedActors.find(
    (actor) => actor?.side === "hero" && actor.refId === "likui",
  );
  if (likui) {
    gainYiqi(likui, 15, battle);
    result.lines.push("李逵杀性大发，获得 15 义气。");
    if (doctrineFor(battle, likui)?.killHealPct) {
      likui.statuses.guard = Math.max(likui.statuses.guard || 0, 1);
      result.lines.push("铁牛护主：李逵踏住敌阵，获得护御。");
    }
  }
  const legendKiller = creditedActors.find(
    (actor) =>
      actor?.side === "hero" &&
      actor.refId === battle.legendHeroId &&
      actor.legendRule?.effects?.onKill,
  );
  const legendKillEffect = legendKiller?.legendRule?.effects?.onKill;
  if (legendKiller && legendKillEffect) {
    if (legendKillEffect.yiqi) {
      gainYiqi(legendKiller, legendKillEffect.yiqi, battle);
    }
    if (legendKillEffect.teamYiqi) {
      for (const ally of livingSide(battle, "hero")) {
        gainYiqi(ally, legendKillEffect.teamYiqi, battle);
      }
    }
    if (legendKillEffect.healPct && legendKiller.hp > 0) {
      const heal = Math.min(
        legendKiller.maxHp - legendKiller.hp,
        Math.max(
          1,
          Math.round(legendKiller.maxHp * legendKillEffect.healPct),
        ),
      );
      legendKiller.hp += heal;
      result.lines.push(
        `「${legendKiller.legendRule.name}」令${legendKiller.name}恢复 ${heal} 生命。`,
      );
    }
    if (legendKillEffect.guard) {
      legendKiller.statuses.guard = Math.max(
        legendKiller.statuses.guard || 0,
        legendKillEffect.guard,
      );
    }
    if (
      legendKillEffect.yiqi ||
      legendKillEffect.teamYiqi ||
      legendKillEffect.guard
    ) {
      result.lines.push(
        `${legendKiller.name}以「${legendKiller.legendRule.name}」再振战意。`,
      );
    }
  }
  const wusong = creditedActors.find(
    (actor) => actor?.side === "hero" && actor.refId === "wusong",
  );
  const wusongDoctrine = doctrineFor(battle, wusong);
  if (
    wusong &&
    wusongDoctrine?.killYiqi
  ) {
    for (const ally of livingSide(battle, "hero")) {
      gainYiqi(ally, wusongDoctrine.killYiqi, battle);
    }
    result.lines.push(
      `行者无归：武松破敌，全队获得 ${wusongDoctrine.killYiqi} 义气。`,
    );
  }
  if (wusong && claimBondTrigger(battle, "swift_walker")) {
    for (const ally of livingSide(battle, "hero")) gainYiqi(ally, 10, battle);
    result.lines.push("行者神行：武松得手，全队踏风再起，获得 10 义气。");
  }
  const arrowPartner = creditedActors
    .map((actor) =>
      actor?.refId === "huarong"
        ? "likui"
        : actor?.refId === "likui"
          ? "huarong"
          : null,
    )
    .find(Boolean);
  if (arrowPartner && claimBondTrigger(battle, "black_whirlwind_arrows")) {
    const partner = livingSide(battle, "hero").find(
      (actor) => actor.refId === arrowPartner,
    );
    if (partner) {
      gainYiqi(partner, 12, battle);
      result.lines.push(
        `黑风箭雨：${partner.name}接住破阵之势，获得 12 义气。`,
      );
    }
  }
}

export function checkBattleEnd(battle) {
  if (battle.phase === "victory" || battle.phase === "defeat") return true;
  if (livingSide(battle, "enemy").length === 0) {
    battle.phase = "victory";
    pushLog(battle, "victory", "敌阵已破。");
    return true;
  }
  if (livingSide(battle, "hero").length === 0) {
    battle.phase = "defeat";
    pushLog(battle, "defeat", "梁山众人力竭败退。");
    return true;
  }
  return false;
}

export function pushLog(battle, type, text) {
  battle.log.push({ type, text, at: Date.now() });
  if (battle.log.length > 30) battle.log.shift();
}

export function turnPreview(battle, limit = 6) {
  const preview = [];
  if (battle.currentUid) preview.push(battle.currentUid);
  for (const turnUid of battle.turnQueue) {
    const unit = combatantById(battle, turnUid);
    if (unit?.hp > 0 && !preview.includes(turnUid)) preview.push(turnUid);
    if (preview.length >= limit) break;
  }
  return preview.map((turnUid) => combatantById(battle, turnUid)).filter(Boolean);
}

export function finishResolutionAndAdvance(battle) {
  if (battle.phase === "victory" || battle.phase === "defeat") return battle.phase;
  return startNextTurn(battle);
}
