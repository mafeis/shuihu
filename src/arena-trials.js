export const ARENA_TRIAL_LIMIT = 3;

export const ARENA_TRIALS = {
  black_cloud: {
    id: "black_cloud",
    name: "黑云压城",
    icon: "cloud",
    tone: "blue",
    unlockWave: 0,
    desc: "官军披重甲列阵，敌军生命提高 18%。",
    risk: "敌军生命 +18%",
    reward: "军功 +18% · 铜钱 +12%",
    enemyModifiers: { hpPct: 0.18 },
    scorePct: 0.18,
    copperPct: 0.12,
  },
  iron_wall: {
    id: "iron_wall",
    name: "铁壁官阵",
    icon: "shield",
    tone: "gold",
    unlockWave: 4,
    desc: "都监亲镇中军，敌军护甲提高 18%，身法提高 6%。",
    risk: "敌军护甲 +18% · 身法 +6%",
    reward: "军功 +22% · 铜钱 +12%",
    enemyModifiers: { defPct: 0.18, spdPct: 0.06 },
    scorePct: 0.22,
    copperPct: 0.12,
  },
  evil_wind: {
    id: "evil_wind",
    name: "夺气妖风",
    icon: "wind",
    tone: "teal",
    unlockWave: 8,
    desc: "敌军以锣鼓扰乱气脉，全队义气获取降低 18%，敌军攻击提高 12%。",
    risk: "全队义气 -18% · 敌军攻击 +12%",
    reward: "军功 +24% · 历练 +15%",
    heroModifiers: { yiqiPct: -0.18 },
    enemyModifiers: { atkPct: 0.12 },
    scorePct: 0.24,
    xpPct: 0.15,
  },
  cut_supply: {
    id: "cut_supply",
    name: "断粮绝道",
    icon: "hourglass",
    tone: "cinnabar",
    unlockWave: 12,
    desc: "后路被截，阵后恢复降低 18%，敌军攻击再提高 10%。",
    risk: "波间恢复 -18% · 敌军攻击 +10%",
    reward: "军功 +28% · 铜钱 +15%",
    heroModifiers: { waveHealPct: -0.18 },
    enemyModifiers: { atkPct: 0.1 },
    scorePct: 0.28,
    copperPct: 0.15,
  },
  fire_raid: {
    id: "fire_raid",
    name: "星火劫营",
    icon: "flame",
    tone: "cinnabar",
    unlockWave: 16,
    desc: "官军趁夜火攻，敌军身法提高 16%，生命提高 8%。",
    risk: "敌军身法 +16% · 生命 +8%",
    reward: "军功 +30% · 历练 +18%",
    enemyModifiers: { spdPct: 0.16, hpPct: 0.08 },
    scorePct: 0.3,
    xpPct: 0.18,
  },
  ten_ambush: {
    id: "ten_ambush",
    name: "十面埋伏",
    icon: "crosshair",
    tone: "gold",
    unlockWave: 20,
    desc: "十路官军合围，敌军生命、攻击与护甲各提高 12%、12% 与 8%。",
    risk: "敌军生命 +12% · 攻击 +12% · 护甲 +8%",
    reward: "军功 +40% · 铜钱 +18% · 历练 +18%",
    enemyModifiers: { hpPct: 0.12, atkPct: 0.12, defPct: 0.08 },
    scorePct: 0.4,
    copperPct: 0.18,
    xpPct: 0.18,
  },
};

export function availableArenaTrials(bestWave = 0) {
  const safeWave = Math.max(0, Math.trunc(Number(bestWave) || 0));
  return Object.values(ARENA_TRIALS).filter(
    (trial) => trial.unlockWave <= safeWave,
  );
}

export function sanitizeArenaTrialIds(
  trialIds,
  { bestWave = Number.POSITIVE_INFINITY, limit = ARENA_TRIAL_LIMIT } = {},
) {
  if (!Array.isArray(trialIds)) return [];
  const safeWave = Math.max(0, Math.trunc(Number(bestWave) || 0));
  const safeLimit = Math.min(
    ARENA_TRIAL_LIMIT,
    Math.max(0, Math.trunc(Number(limit) || 0)),
  );
  return [
    ...new Set(
      trialIds.filter(
        (trialId) =>
          ARENA_TRIALS[trialId] &&
          ARENA_TRIALS[trialId].unlockWave <= safeWave,
      ),
    ),
  ].slice(0, safeLimit);
}

export function arenaTrialEffects(trialIds) {
  const selected = sanitizeArenaTrialIds(trialIds).map(
    (trialId) => ARENA_TRIALS[trialId],
  );
  const totals = {
    heroModifiers: {},
    enemyModifiers: {},
    scorePct: 0,
    copperPct: 0,
    xpPct: 0,
  };

  const merge = (target, effects = {}) => {
    for (const [key, value] of Object.entries(effects)) {
      target[key] = (target[key] || 0) + value;
    }
  };

  for (const trial of selected) {
    merge(totals.heroModifiers, trial.heroModifiers);
    merge(totals.enemyModifiers, trial.enemyModifiers);
    totals.scorePct += trial.scorePct || 0;
    totals.copperPct += trial.copperPct || 0;
    totals.xpPct += trial.xpPct || 0;
  }

  return {
    ...totals,
    trialIds: selected.map((trial) => trial.id),
    count: selected.length,
  };
}
