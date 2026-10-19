import { AUTO_BATTLE_TACTICS, PATHS } from "./data.js";
import {
  heroSkillList,
  skillUsable,
  validTargets,
} from "./battle.js";

const REPEATED_SUPPORT_LIMIT = 2;
const REPEATED_ACTION_LIMIT = 3;
const battleActionMemory = new WeakMap();

export function normalizeAutoBattleTactic(value) {
  return AUTO_BATTLE_TACTICS[value] ? value : "balanced";
}

function battleMemory(battle) {
  let memory = battleActionMemory.get(battle);
  if (!memory) {
    memory = {
      supportStreak: 0,
      supportLastAction: null,
      streak: 0,
      lastAction: null,
      lastActorUid: null,
    };
    battleActionMemory.set(battle, memory);
  }
  return memory;
}

export function recordAutoBattleChoice(battle, action) {
  if (!battle || !action?.skill) return;
  const memory = battleMemory(battle);
  const actionKey = [
    action.skill.id,
    action.target?.uid || action.skill.target,
  ].join(":");
  memory.streak =
    memory.lastActorUid === action.actorUid &&
    memory.lastAction === actionKey
      ? memory.streak + 1
      : 1;
  memory.lastActorUid = action.actorUid;
  memory.lastAction = actionKey;
  if (action.skill.power > 0 || action.skill.target === "allEnemies") {
    memory.supportStreak = 0;
    memory.supportLastAction = null;
    return;
  }
  memory.supportStreak =
    memory.supportLastAction === actionKey
      ? memory.supportStreak + 1
      : 1;
  memory.supportLastAction = actionKey;
}

function hasEffect(skill, type, status = null) {
  return (skill.effects || []).some(
    (effect) =>
      effect.type === type &&
      (!status || effect.status === status),
  );
}

function hitCount(skill) {
  return skill.target === "allEnemies"
    ? 2
    : Math.max(1, Number(skill.hits) || 1);
}

function lastHeroStanding(battle) {
  return battle.heroes.filter((unit) => unit.hp > 0).length <= 1;
}

function targetScore(actor, unit, tactic, livingEnemies) {
  const hpRatio = unit.hp / Math.max(1, unit.maxHp);
  const poiseRatio = unit.poise / Math.max(1, unit.poiseMax);
  const enemyCount = livingEnemies.length;
  let score = 0;

  if (tactic === "breaker") {
    score =
      poiseRatio * 68 +
      (1 - hpRatio) * 22 +
      (unit.row === 0 ? 18 : 0) +
      (unit.broken > 0 ? 12 : 0);
  } else if (tactic === "guardian") {
    const threat = unit.atk * (unit.row === 2 ? 1.25 : 1);
    score = hpRatio * 16 + (unit.row === 2 ? 12 : 0);
  } else if (tactic === "hunter") {
    score =
      (1 - hpRatio) * 92 +
      (hpRatio < 0.35 ? 32 : 0) +
      (hpRatio < 0.2 ? 18 : 0);
  } else {
    score =
      (1 - hpRatio) * 58 +
      (unit.statuses.armorBreak > 0 ? 9 : 0) +
      (unit.statuses.bleeding > 0 && actor.refId === "wusong" ? 16 : 0);
  }

  if (PATHS[actor.path]?.beats === unit.path) {
    score += tactic === "guardian" ? 18 : 26;
  }
  if (PATHS[unit.path]?.beats === actor.path) {
    score -= tactic === "guardian" ? 18 : 12;
  }
  if (unit.boss) score += tactic === "hunter" ? 8 : 18;
  if (enemyCount === 1) score += 20;
  if (actor.refId === "ruanxiaoqi" && (unit.statuses.bleeding || 0) > 0) {
    score += 24;
  }
  if (
    actor.refId === "sunerniang" &&
    ((unit.statuses.sealed || 0) > 0 ||
      (unit.statuses.armorBreak || 0) > 0)
  ) {
    score += 16;
  }
  if (
    actor.refId === "lingzhen" &&
    poiseRatio >= 0.7 &&
    unit.broken <= 0
  ) {
    score += 12;
  }
  return score;
}

function estimateDamage(actor, skill, target, battle) {
  const power = Number(skill.power) || 0;
  if (!target || power <= 0) return 0;
  let defense = target.def;
  if (
    actor.refId === "wusong" &&
    target.hp / Math.max(1, target.maxHp) >
      actor.hp / Math.max(1, actor.maxHp)
  ) {
    defense *= 0.85;
  }
  let estimate = Math.max(
    9,
    power * actor.atk * 1.82 - defense * 0.54,
  );
  if (PATHS[actor.path]?.beats === target.path) estimate *= 1.2;
  if (PATHS[target.path]?.beats === actor.path) estimate *= 0.9;
  if (target.broken > 0) estimate *= 1.32;
  if (target.statuses.armorBreak > 0) estimate *= 1.18;
  if (actor.statuses.inspiration > 0) estimate *= 1.18;
  if (target.statuses.guard > 0) estimate *= 0.56;
  estimate *= 1 - Math.max(0, battle.modifiers?.damageReductionPct || 0);
  if (skill.executeBonus && target.hp / target.maxHp < 0.4) {
    estimate *= skill.executeBonus;
  }
  if (target.statuses.bleeding > 0 && skill.bleedBonus) {
    estimate *= skill.bleedBonus;
  }
  return Math.max(1, estimate);
}

function damageUnits(actor, skill, target, battle) {
  if (!target || Number(skill.power) <= 0) return 0;
  if (skill.target !== "allEnemies") {
    return Math.min(
      target.hp,
      estimateDamage(actor, skill, target, battle) *
        Math.max(1, Number(skill.hits) || 1),
    );
  }
  return battle.enemies
    .filter((enemy) => enemy.hp > 0)
    .reduce(
      (total, enemy) =>
        total + Math.min(enemy.hp, estimateDamage(actor, skill, enemy, battle)),
      0,
    );
}

export function autoTargetForSkill(
  battle,
  actor,
  skill,
  tacticValue = "balanced",
) {
  const tactic = normalizeAutoBattleTactic(tacticValue);
  const livingHeroes = battle.heroes.filter((unit) => unit.hp > 0);
  const livingEnemies = battle.enemies.filter((unit) => unit.hp > 0);

  if (skill.target === "ally") {
    const wantsYiqi = hasEffect(skill, "targetYiqi");
    return [...livingHeroes].sort((a, b) => {
      if (wantsYiqi && b.yiqi !== a.yiqi) return a.yiqi - b.yiqi;
      if (
        tactic === "guardian" ||
        hasEffect(skill, "targetCleanse") ||
        (skill.heal && (skill.healBattle || skill.heal))
      ) {
        const healthDifference =
          a.hp / Math.max(1, a.maxHp) - b.hp / Math.max(1, b.maxHp);
        if (Math.abs(healthDifference) > 0.01) return healthDifference;
      }
      return (
        a.hp / Math.max(1, a.maxHp) -
          b.hp / Math.max(1, b.maxHp) ||
        a.yiqi - b.yiqi ||
        a.uid.localeCompare(b.uid)
      );
    })[0] || null;
  }

  if (
    !["enemy", "frontEnemy", "backEnemy", "lowestEnemy"].includes(
      skill.target,
    )
  ) {
    return null;
  }

  const targetPool =
    skill.target === "frontEnemy"
      ? livingEnemies.filter((unit) => unit.row === 0)
      : skill.target === "backEnemy"
        ? livingEnemies.filter((unit) => unit.row === 2)
        : livingEnemies;
  return [...(targetPool.length ? targetPool : livingEnemies)].sort(
    (a, b) => {
      const aDamage = damageUnits(actor, skill, a, battle);
      const bDamage = damageUnits(actor, skill, b, battle);
      const aFinished = aDamage >= a.hp;
      const bFinished = bDamage >= b.hp;
      if (tactic === "guardian") {
        const threat = threatGap(b) - threatGap(a);
        if (Math.abs(threat) >= 1) return threat;
      }
      if (tactic !== "guardian" && tactic !== "breaker" && aFinished !== bFinished) {
        return aFinished ? -1 : 1;
      }
      return (
        bDamage - aDamage ||
        targetScore(actor, b, tactic, livingEnemies) -
          targetScore(actor, a, tactic, livingEnemies) ||
        (tactic === "hunter"
          ? b.hp / Math.max(1, b.maxHp) - a.hp / Math.max(1, a.maxHp)
          : 0) ||
        a.uid.localeCompare(b.uid)
      );
    },
  )[0] || null;
}

function threatGap(unit) {
  return unit.atk;
}

function defensiveSkillScore(skill) {
  let score = skill.heal ? skill.heal * 50 : 0;
  if (hasEffect(skill, "teamStatus", "guard")) score += 42;
  if (hasEffect(skill, "targetStatus", "guard")) score += 24;
  if (hasEffect(skill, "teamCleanse")) score += 36;
  if (hasEffect(skill, "targetCleanse")) score += 22;
  if (hasEffect(skill, "teamYiqi")) score += 26;
  if (hasEffect(skill, "targetYiqi")) score += 18;
  if (hasEffect(skill, "selfYiqi")) score += 14;
  if (hasEffect(skill, "selfStatus", "guard")) score += 20;
  if (hasEffect(skill, "selfStatus", "inspiration")) score += 12;
  return score;
}

function damageSkillScore(actor, skill, target, tactic, battle) {
  const hitTargets =
    skill.target === "allEnemies" ? battle.enemies : [target];
  const expectedDamage = hitTargets
    .filter((unit) => unit?.hp > 0)
    .reduce(
      (total, unit) =>
        total +
        Math.min(unit.hp, estimateDamage(actor, skill, unit, battle)) *
          hitCount(skill),
      0,
    );
  const immediateYiqi = Math.max(0, Number(skill.yiqi) || 12);
  let score =
    Math.max(1, expectedDamage) +
    Math.max(0, skill.poise || 0) * 0.75 +
    immediateYiqi * 2;
  const livingHeroes = battle.heroes.filter((unit) => unit.hp > 0);
  if (
    hasEffect(skill, "teamYiqi") &&
    livingHeroes.some((unit) => unit.yiqi < 100)
  ) {
    score += hitTargets
      .filter((unit) => unit?.hp > 0)
      .reduce((total, unit) => total + Math.max(0, 100 - unit.yiqi), 0);
  }
  if (hasEffect(skill, "targetYiqi") && target && target.yiqi < 100) {
    score += (100 - target.yiqi) * 2;
  }

  if (skill.bomb) score *= 1.08 + Math.max(0, skill.poise || 0) / 400;
  if (
    actor.refId === "ruanxiaoqi" &&
    actor.hp / Math.max(1, actor.maxHp) < 0.5
  ) {
    score *= 1.08;
  }
  if (tactic === "breaker") {
    score *= 1 + (skill.poise || 0) / 120;
    if (hasEffect(skill, "status", "armorBreak")) score *= 1.18;
    if (skill.target === "allEnemies") score *= 1.08;
  }
  if (tactic === "guardian") {
    score *= 0.94;
    if (target?.boss) score *= 1.06;
  }
  if (!lastHeroStanding(battle)) {
    if (target?.boss) score *= 1.4;
    else if (skill.target === "allEnemies") score *= 0.8;
  }
  if (tactic === "hunter") {
    if (target && target.hp / target.maxHp < 0.45) score *= 1.12;
    if (target && expectedDamage >= target.hp) score *= 1.2;
    if (skill.target !== "allEnemies") score *= 1.08;
  }
  if (
    skill.heal &&
    target?.side === "hero" &&
    target.hp / target.maxHp < 0.55
  ) {
    score *= target.hp / target.maxHp < 0.35 ? 0.05 : 0.5;
  }
  return score;
}

function availableAction(battle, actor, skill, tactic) {
  if (!skill) return null;
  const targets = validTargets(battle, actor.uid, skill);
  if (!targets.length) return null;
  const assumesTarget = [
    "enemy",
    "frontEnemy",
    "backEnemy",
    "lowestEnemy",
    "ally",
  ].includes(skill.target);
  const target = autoTargetForSkill(battle, actor, skill, tactic);
  if (assumesTarget && !target) return null;
  return {
    skill,
    target,
    actorUid: actor.uid,
  };
}

function statusIsActive(unit, status) {
  return (unit.statuses?.[status] || 0) > 0;
}

function supportIsUseful(battle, actor, skill, role = null) {
  const livingAllies = battle.heroes.filter((unit) => unit.hp > 0);
  const statusActive = (status) =>
    livingAllies.every((unit) => statusIsActive(unit, status));
  const healsSomeone = livingAllies.some((unit) => unit.hp < unit.maxHp);
  if (Number(skill.heal || 0) > 0 && !healsSomeone) return false;
  if (
    hasEffect(skill, "teamStatus", "guard") ||
    (role === "guard" && hasEffect(skill, "teamStatus", "guard"))
  ) {
    if (statusActive("guard")) return false;
  }
  const currentStatusActive = (status) =>
    livingAllies.some((unit) => statusIsActive(unit, status));
  if (
    hasEffect(skill, "teamStatus", "inspiration") ||
    (role === "inspiration" &&
      hasEffect(skill, "teamStatus", "inspiration"))
  ) {
    if (role === "inspiration" && currentStatusActive("inspiration")) {
      return false;
    }
  }
  if (
    hasEffect(skill, "targetStatus", "guard") ||
    (role === "guard" && hasEffect(skill, "targetStatus", "guard"))
  ) {
    const target = autoTargetForSkill(battle, actor, skill, "guardian");
    if (target && statusIsActive(target, "guard")) return false;
  }
  if (
    hasEffect(skill, "targetStatus", "inspiration") ||
    (role === "inspiration" &&
      hasEffect(skill, "targetStatus", "inspiration"))
  ) {
    const target = autoTargetForSkill(battle, actor, skill, "guardian");
    if (target && statusIsActive(target, "inspiration")) return false;
  }
  const hasUsefulEffect =
    (skill.effects || []).some((effect) =>
      [
        "teamStatus",
        "targetStatus",
        "selfStatus",
        "teamCleanse",
        "targetCleanse",
        "selfHeal",
      ].includes(effect.type),
    ) ||
    ["targetYiqi", "teamYiqi", "lowestAllyYiqi"].some((type) =>
      hasEffect(skill, type),
    );
  if (!hasUsefulEffect && Number(skill.heal || 0) <= 0) return false;
  return true;
}

export function chooseAutoBattleAction(
  battle,
  actor,
  tacticValue = "balanced",
) {
  const tactic = normalizeAutoBattleTactic(tacticValue);
  const skills = heroSkillList(actor).filter((skill) =>
    skillUsable(actor, skill),
  );
  const readySkills = skills.filter(
    (skill) => validTargets(battle, actor.uid, skill).length,
  );
  if (!readySkills.length) return null;

  const livingHeroes = battle.heroes.filter((unit) => unit.hp > 0);
  const livingEnemies = battle.enemies.filter((unit) => unit.hp > 0);
  const wounded = [...livingHeroes].sort(
    (a, b) =>
      a.hp / Math.max(1, a.maxHp) -
        b.hp / Math.max(1, b.maxHp) ||
      a.uid.localeCompare(b.uid),
  );
  const lowestHero = wounded[0];
  const healThreshold =
    tactic === "guardian" ? 0.68 : tactic === "breaker" ? 0.4 : 0.55;
  const lowHealthCount = livingHeroes.filter(
    (unit) => unit.hp / unit.maxHp < Math.max(0.5, healThreshold - 0.05),
  ).length;
  const ultimates = readySkills.filter((skill) => skill.ultimate);
  const allHealthy = livingHeroes.every(
    (unit) => unit.hp >= unit.maxHp,
  );
  const usefulSupport = (skill, role = null) =>
    supportIsUseful(battle, actor, skill, role);
  const memory = battleMemory(battle);
  const stalled =
    memory.supportStreak > REPEATED_SUPPORT_LIMIT;
  const damageFirst =
    (skill) => skill.power > 0 || skill.target === "allEnemies";
  const damageSkills = readySkills.filter(
    (skill) => skill.power > 0 || skill.target === "allEnemies",
  );
  const bestDamageAction = () => {
    const scored = damageSkills
      .map((skill) => {
        const action = availableAction(battle, actor, skill, tactic);
        if (!action) return null;
        return {
          skill,
          action,
          score: damageSkillScore(
            actor,
            skill,
            action.target,
            tactic,
            battle,
          ),
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.skill.id.localeCompare(b.skill.id),
      );
    return scored[0]?.action || null;
  };
  if (lastHeroStanding(battle)) {
    const emergencyHeal = readySkills
      .filter((skill) => skill.heal > 0)
      .sort((a, b) => b.heal - a.heal)[0];
    if (
      emergencyHeal &&
      actor.hp / Math.max(1, actor.maxHp) <
        Math.min(0.8, healThreshold + 0.1) &&
      memory.supportStreak <= REPEATED_SUPPORT_LIMIT
    ) {
      const healAction = availableAction(
        battle,
        actor,
        emergencyHeal,
        tactic,
      );
      if (healAction) return healAction;
    }
    if (damageSkills.length) return bestDamageAction();
  }
  if (
    memory.lastActorUid === actor.uid &&
    memory.streak >= REPEATED_ACTION_LIMIT
  ) {
    const varied = bestDamageAction();
    if (varied) return varied;
  }
  if (
    stalled &&
    damageSkills.length &&
    livingHeroes.every(
      (unit) => unit.hp / Math.max(1, unit.maxHp) >= healThreshold,
    )
  ) {
    const damageAction = bestDamageAction();
    if (damageAction) return damageAction;
  }

  const urgentHeal = ultimates.find(
    (skill) =>
      skill.heal &&
      livingHeroes.some((unit) => unit.hp < unit.maxHp) &&
      (skill.target === "allAllies"
        ? lowHealthCount > 0
        : lowestHero &&
          lowestHero.hp < lowestHero.maxHp &&
          lowestHero.hp / lowestHero.maxHp < healThreshold),
  );
  if (urgentHeal) return availableAction(battle, actor, urgentHeal, tactic);

  const supportUltimate = readySkills.find(
    (skill) =>
      skill.ultimate &&
      defensiveSkillScore(skill) > 0 &&
      usefulSupport(skill),
  );

  if (tactic === "guardian") {
    const defensiveSkills = readySkills
      .filter((skill) => !skill.ultimate && defensiveSkillScore(skill) > 0)
      .sort(
        (a, b) =>
          defensiveSkillScore(b) - defensiveSkillScore(a),
      );
    const groupHeal = defensiveSkills.find(
      (skill) => skill.heal && skill.target === "allAllies",
    );
    if (groupHeal && lowHealthCount >= 2) {
      return availableAction(battle, actor, groupHeal, tactic);
    }
    const singleHeal = defensiveSkills.find(
      (skill) => skill.heal && skill.target === "ally",
    );
    if (
      singleHeal &&
      lowestHero &&
      lowestHero.hp < lowestHero.maxHp &&
      lowestHero.hp / lowestHero.maxHp < healThreshold
    ) {
      return availableAction(battle, actor, singleHeal, tactic);
    }
    const groupGuard = defensiveSkills.find((skill) =>
      hasEffect(skill, "teamStatus", "guard"),
    );
    if (
      groupGuard &&
      !stalled &&
      usefulSupport(groupGuard, "guard")
    ) {
      return availableAction(battle, actor, groupGuard, tactic);
    }
    const teamSupport = defensiveSkills.find(
      (skill) =>
        hasEffect(skill, "teamCleanse") ||
        hasEffect(skill, "teamYiqi") ||
        hasEffect(skill, "targetYiqi"),
    );
    if (
      teamSupport &&
      !stalled &&
      usefulSupport(
        teamSupport,
        livingHeroes.every((unit) => unit.hp >= unit.maxHp)
          ? "yiqi"
          : null,
      )
    ) {
      return availableAction(battle, actor, teamSupport, tactic);
    }
  }

  if (supportUltimate && !stalled) {
    const action = availableAction(battle, actor, supportUltimate, tactic);
    if (action) return action;
  }

  const yiqiUltimate = readySkills.find(
    (skill) =>
      skill.ultimate &&
      (skill.effects || []).some((effect) => effect.type === "teamYiqi") &&
      supportIsUseful(battle, actor, skill) &&
      validTargets(battle, actor.uid, skill).length > 0,
  );
  if (yiqiUltimate && !stalled) {
    const action = availableAction(battle, actor, yiqiUltimate, tactic);
    if (action) return action;
  }

  const damageUltimate = ultimates.find(
    (skill) => skill.power > 0 || skill.target === "allEnemies",
  );
  if (
    damageUltimate &&
    (tactic !== "guardian" ||
      battle.round >= 2 ||
      livingEnemies.length <= 1)
  ) {
    return availableAction(battle, actor, damageUltimate, tactic);
  }

  if (
    lowestHero &&
    lowestHero.hp < lowestHero.maxHp &&
    lowestHero.hp / lowestHero.maxHp < healThreshold
  ) {
    const groupHeal = readySkills
      .filter((skill) => skill.heal && skill.target === "allAllies")
      .sort((a, b) => b.heal - a.heal)[0];
    if (groupHeal && lowHealthCount >= 2) {
      return availableAction(battle, actor, groupHeal, tactic);
    }
    const singleHeal = readySkills
      .filter((skill) => skill.heal && skill.target === "ally")
      .sort((a, b) => b.heal - a.heal)[0];
    if (singleHeal) {
      return availableAction(battle, actor, singleHeal, tactic);
    }
    if (groupHeal) return availableAction(battle, actor, groupHeal, tactic);
  }

  const groupGuard = readySkills.find(
    (skill) =>
      skill.target === "allAllies" &&
      hasEffect(skill, "teamStatus", "guard"),
  );
  if (
    groupGuard &&
    !livingHeroes.every((unit) => unit.statuses.guard > 0) &&
    !stalled &&
    supportIsUseful(battle, actor, groupGuard, "guard")
  ) {
    return availableAction(battle, actor, groupGuard, tactic);
  }

  const supportSkill = readySkills.find(
    (skill) =>
      skill.target === "ally" &&
      hasEffect(skill, "targetYiqi") &&
      wounded.some(
        (unit) => unit.yiqi < (tactic === "guardian" ? 78 : 65),
      ),
  );
  if (supportSkill && usefulSupport(supportSkill, "yiqi")) {
    return availableAction(battle, actor, supportSkill, tactic);
  }

  const canUseDamageUltimate =
    tactic !== "guardian" ||
    battle.round >= 2 ||
    livingEnemies.length <= 1;
  const usableDamageSkills = readySkills.filter(
    (skill) =>
      (skill.power > 0 || skill.target === "allEnemies") &&
      (!skill.ultimate || canUseDamageUltimate),
  );
  const scored = usableDamageSkills
    .map((skill) => {
      const action = availableAction(battle, actor, skill, tactic);
      if (!action) return null;
      return {
        skill,
        action,
        score: damageSkillScore(
          actor,
          skill,
          action.target,
          tactic,
          battle,
        ),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.skill.id.localeCompare(b.skill.id),
    );
  if (scored[0]) {
    return scored[0].action;
  }

  const healingSkill = readySkills.find((skill) => skill.heal > 0);
  if (healingSkill) {
    const action = availableAction(battle, actor, healingSkill, tactic);
    if (action) return action;
  }

  return readySkills
    .map((skill) => availableAction(battle, actor, skill, tactic))
    .find(Boolean) || null;
}
