import { AUTO_BATTLE_TACTICS, PATHS } from "./data.js";
import { heroSkillList, skillUsable } from "./battle.js";

export function normalizeAutoBattleTactic(value) {
  return AUTO_BATTLE_TACTICS[value] ? value : "balanced";
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
    const enemyAtk = Math.max(
      1,
      ...livingEnemies.map((enemy) => enemy.atk),
    );
    score =
      (unit.atk / enemyAtk) * 58 +
      hpRatio * 16 +
      (unit.row === 2 ? 12 : 0);
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

export function autoTargetForSkill(
  battle,
  actor,
  skill,
  tacticValue = "balanced",
) {
  const tactic = normalizeAutoBattleTactic(tacticValue);
  const livingHeroes = battle.heroes.filter((unit) => unit.hp > 0);
  const livingEnemies = battle.enemies.filter((unit) => unit.hp > 0);
  if (!livingEnemies.length) return null;

  if (skill.target === "ally") {
    const wantsYiqi = hasEffect(skill, "targetYiqi");
    return [...livingHeroes].sort((a, b) => {
      if (wantsYiqi && b.yiqi !== a.yiqi) return a.yiqi - b.yiqi;
      if (tactic === "guardian") {
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
    })[0];
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
    (a, b) =>
      targetScore(actor, b, tactic, livingEnemies) -
        targetScore(actor, a, tactic, livingEnemies) ||
      a.uid.localeCompare(b.uid),
  )[0];
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

function damageSkillScore(actor, skill, target, livingEnemies, tactic) {
  const targetFactor =
    skill.target === "allEnemies"
      ? Math.min(2.6, Math.max(1, livingEnemies.length * 0.82))
      : 1;
  let score =
    Math.max(0.1, skill.power || 0.1) *
    hitCount(skill) *
    targetFactor *
    (1 + (skill.poise || 0) / 90);

  if (target && PATHS[actor.path]?.beats === target.path) score *= 1.24;
  if (target && target.hp / target.maxHp < 0.38) {
    if (skill.executeBonus || skill.executeCrit) {
      score *= skill.executeBonus || 1.35;
    }
    if (tactic === "hunter") score *= 1.26;
  }
  if (target && target.statuses.bleeding > 0 && skill.bleedBonus) {
    score *= skill.bleedBonus;
  }
  if (skill.bomb) {
    score *= 1.14 + Math.max(0, skill.poise || 0) / 240;
  }
  if (
    actor.refId === "ruanxiaoqi" &&
    actor.hp / Math.max(1, actor.maxHp) < 0.5
  ) {
    score *= 1.12;
  }
  if (tactic === "breaker") {
    score *= 1 + (skill.poise || 0) / 42;
    if (hasEffect(skill, "status", "armorBreak")) score *= 1.28;
    if (skill.target === "allEnemies") score *= 1.16;
  }
  if (tactic === "guardian") {
    score *= 0.92;
    if (target?.boss) score *= 1.08;
  }
  if (tactic === "hunter" && skill.target !== "allEnemies") {
    score *= 1.12;
  }
  return score;
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
  if (!skills.length) return null;

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
  const ultimates = skills.filter((skill) => skill.ultimate);

  const urgentHeal = ultimates.find(
    (skill) =>
      skill.heal &&
      (skill.target === "allAllies"
        ? lowHealthCount > 0
        : lowestHero &&
          lowestHero.hp / lowestHero.maxHp < healThreshold),
  );
  if (urgentHeal) {
    return {
      skill: urgentHeal,
      target: autoTargetForSkill(battle, actor, urgentHeal, tactic),
    };
  }

  if (tactic === "guardian") {
    const defensiveSkills = skills
      .filter((skill) => !skill.ultimate && defensiveSkillScore(skill) > 0)
      .sort(
        (a, b) =>
          defensiveSkillScore(b) - defensiveSkillScore(a),
      );
    const groupHeal = defensiveSkills.find(
      (skill) => skill.heal && skill.target === "allAllies",
    );
    if (groupHeal && lowHealthCount >= 2) {
      return { skill: groupHeal, target: null };
    }
    const singleHeal = defensiveSkills.find(
      (skill) => skill.heal && skill.target === "ally",
    );
    if (
      singleHeal &&
      lowestHero &&
      lowestHero.hp / lowestHero.maxHp < healThreshold
    ) {
      return {
        skill: singleHeal,
        target: autoTargetForSkill(battle, actor, singleHeal, tactic),
      };
    }
    const groupGuard = defensiveSkills.find((skill) =>
      hasEffect(skill, "teamStatus", "guard"),
    );
    if (groupGuard) return { skill: groupGuard, target: null };
    const teamSupport = defensiveSkills.find(
      (skill) =>
        hasEffect(skill, "teamCleanse") ||
        hasEffect(skill, "teamYiqi") ||
        hasEffect(skill, "targetYiqi"),
    );
    if (teamSupport) {
      return {
        skill: teamSupport,
        target: autoTargetForSkill(battle, actor, teamSupport, tactic),
      };
    }
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
    return {
      skill: damageUltimate,
      target: autoTargetForSkill(battle, actor, damageUltimate, tactic),
    };
  }

  if (lowestHero && lowestHero.hp / lowestHero.maxHp < healThreshold) {
    const groupHeal = skills
      .filter((skill) => skill.heal && skill.target === "allAllies")
      .sort((a, b) => b.heal - a.heal)[0];
    if (groupHeal && lowHealthCount >= 2) {
      return { skill: groupHeal, target: null };
    }
    const singleHeal = skills
      .filter((skill) => skill.heal && skill.target === "ally")
      .sort((a, b) => b.heal - a.heal)[0];
    if (singleHeal) {
      return {
        skill: singleHeal,
        target: autoTargetForSkill(battle, actor, singleHeal, tactic),
      };
    }
    if (groupHeal) return { skill: groupHeal, target: null };
  }

  const groupGuard = skills.find(
    (skill) =>
      skill.target === "allAllies" &&
      hasEffect(skill, "teamStatus", "guard"),
  );
  if (
    groupGuard &&
    !livingHeroes.every((unit) => unit.statuses.guard > 0)
  ) {
    return { skill: groupGuard, target: null };
  }

  const supportSkill = skills.find(
    (skill) =>
      skill.target === "ally" &&
      hasEffect(skill, "targetYiqi") &&
      wounded.some(
        (unit) => unit.yiqi < (tactic === "guardian" ? 78 : 65),
      ),
  );
  if (supportSkill) {
    return {
      skill: supportSkill,
      target: autoTargetForSkill(battle, actor, supportSkill, tactic),
    };
  }

  const supportUltimate = ultimates.find((skill) => skill !== damageUltimate);
  if (supportUltimate) {
    return {
      skill: supportUltimate,
      target: autoTargetForSkill(battle, actor, supportUltimate, tactic),
    };
  }

  const canUseDamageUltimate =
    tactic !== "guardian" ||
    battle.round >= 2 ||
    livingEnemies.length <= 1;
  const damageSkills = skills.filter(
    (skill) =>
      (skill.power > 0 || skill.target === "allEnemies") &&
      (!skill.ultimate || canUseDamageUltimate),
  );
  const scored = damageSkills
    .map((skill) => {
      const target = autoTargetForSkill(battle, actor, skill, tactic);
      return {
        skill,
        target,
        score: damageSkillScore(
          actor,
          skill,
          target,
          livingEnemies,
          tactic,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.skill.id.localeCompare(b.skill.id),
    );
  if (scored[0]) {
    return { skill: scored[0].skill, target: scored[0].target };
  }

  const fallback = skills[0];
  return {
    skill: fallback,
    target: autoTargetForSkill(battle, actor, fallback, tactic),
  };
}
