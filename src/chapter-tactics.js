export const CHAPTER_TACTICS = {
  ferry: [
    {
      id: "ferry_rescue",
      name: "回身护民",
      icon: "shield-check",
      tone: "blue",
      desc: "全队开场获得 1 层护御，受到的伤害降低 6%。",
      effects: {
        teamModifiers: {
          damageReductionPct: 0.06,
        },
        heroOpeningStatuses: [
          { status: "guard", duration: 1 },
        ],
      },
    },
    {
      id: "ferry_boat",
      name: "借船横江",
      icon: "wind",
      tone: "teal",
      desc: "全队身法提高 10%，开场额外获得 15 义气。",
      effects: {
        teamModifiers: {
          spdPct: 0.1,
          startYiqi: 15,
        },
      },
    },
  ],
  bianjing: [
    {
      id: "bianjing_evidence",
      name: "留证对簿",
      icon: "file-text",
      tone: "gold",
      desc: "全队破势提高 18%，敌军开场损失 12% 护势。",
      effects: {
        teamModifiers: {
          poisePct: 0.18,
          enemyStartPoisePct: 0.12,
        },
      },
    },
    {
      id: "bianjing_ashes",
      name: "焚卷出城",
      icon: "wind",
      tone: "teal",
      desc: "全队身法提高 12%，受到的伤害降低 6%。",
      effects: {
        teamModifiers: {
          spdPct: 0.12,
          damageReductionPct: 0.06,
        },
      },
    },
  ],
  boar_forest: [
    {
      id: "boar_front",
      name: "正面挡锋",
      icon: "shield",
      tone: "blue",
      desc: "前阵开场获得 2 层护御，全队反击伤害提高 15%。",
      effects: {
        teamModifiers: {
          counterBonus: 0.15,
        },
        heroOpeningStatuses: [
          { status: "guard", duration: 2, row: 0 },
        ],
      },
    },
    {
      id: "boar_ambush",
      name: "诱敌包抄",
      icon: "crosshair",
      tone: "cinnabar",
      desc: "全队暴击率提高 10%，破势提高 16%，开场获得 10 义气。",
      effects: {
        teamModifiers: {
          critPct: 0.1,
          poisePct: 0.16,
          startYiqi: 10,
        },
      },
    },
  ],
  cangzhou: [
    {
      id: "cangzhou_rescue",
      name: "破门救人",
      icon: "heart-pulse",
      tone: "teal",
      desc: "全队治疗提高 18%，受到的伤害降低 6%。",
      effects: {
        teamModifiers: {
          healPct: 0.18,
          damageReductionPct: 0.06,
        },
      },
    },
    {
      id: "cangzhou_smoke",
      name: "药烟迷阵",
      icon: "sparkles",
      tone: "gold",
      desc: "敌军开场眩晕 1 回合，并损失 10% 护势。",
      effects: {
        teamModifiers: {
          enemyStartPoisePct: 0.1,
        },
        enemyOpeningStatuses: [
          { status: "stun", duration: 1 },
        ],
      },
    },
  ],
  qingfeng: [
    {
      id: "qingfeng_oath",
      name: "寨门共誓",
      icon: "zap",
      tone: "gold",
      desc: "全队开场获得鼓舞，义气获取提高 15%。",
      effects: {
        teamModifiers: {
          yiqiPct: 0.15,
        },
        teamOpeningInspiration: 1,
      },
    },
    {
      id: "qingfeng_arrow",
      name: "焚信冷箭",
      icon: "crosshair",
      tone: "cinnabar",
      desc: "全队暴击率提高 10%，身法提高 10%。",
      effects: {
        teamModifiers: {
          critPct: 0.1,
          spdPct: 0.1,
        },
      },
    },
  ],
  jiangzhou: [
    {
      id: "jiangzhou_order",
      name: "夺台撤令",
      icon: "target",
      tone: "gold",
      desc: "敌军开场损失 18% 护势，全队破势提高 15% 并获得鼓舞。",
      effects: {
        teamModifiers: {
          poisePct: 0.15,
          enemyStartPoisePct: 0.18,
        },
        teamOpeningInspiration: 1,
      },
    },
    {
      id: "jiangzhou_prison",
      name: "先开囚笼",
      icon: "users",
      tone: "teal",
      desc: "全队开场获得 25 义气，治疗提高 12%。",
      effects: {
        teamModifiers: {
          startYiqi: 25,
          healPct: 0.12,
        },
      },
    },
  ],
  zhujiazhuang: [
    {
      id: "zhujiazhuang_granary",
      name: "开仓救民",
      icon: "heart-pulse",
      tone: "blue",
      desc: "全队开场获得 1 层护御，治疗提高 20%。",
      effects: {
        teamModifiers: {
          healPct: 0.2,
        },
        heroOpeningStatuses: [
          { status: "guard", duration: 1 },
        ],
      },
    },
    {
      id: "zhujiazhuang_cannon",
      name: "绕后夺炮",
      icon: "crosshair",
      tone: "cinnabar",
      desc: "全队身法提高 12%，暴击提高 8%；敌军开场破甲 2 回合。",
      effects: {
        teamModifiers: {
          spdPct: 0.12,
          critPct: 0.08,
        },
        enemyOpeningStatuses: [
          { status: "armorBreak", duration: 2 },
        ],
      },
    },
  ],
  damingfu: [
    {
      id: "damingfu_list",
      name: "名册散城",
      icon: "scroll-text",
      tone: "cinnabar",
      desc: "全队开场获得 20 义气，暴击率提高 12%。",
      effects: {
        teamModifiers: {
          startYiqi: 20,
          critPct: 0.12,
        },
      },
    },
    {
      id: "damingfu_seal",
      name: "挟印开城",
      icon: "shield-check",
      tone: "blue",
      desc: "全队开场获得 2 层护御，反击提高 20%，受到伤害降低 8%。",
      effects: {
        teamModifiers: {
          counterBonus: 0.2,
          damageReductionPct: 0.08,
        },
        heroOpeningStatuses: [
          { status: "guard", duration: 2 },
        ],
      },
    },
  ],
  liangshan: [
    {
      id: "liangshan_justice",
      name: "替天行道",
      icon: "flame",
      tone: "cinnabar",
      desc: "全队攻击提高 12%，破势提高 12%，开场获得 15 义气。",
      effects: {
        teamModifiers: {
          atkPct: 0.12,
          poisePct: 0.12,
          startYiqi: 15,
        },
      },
    },
    {
      id: "liangshan_home",
      name: "守土保民",
      icon: "castle",
      tone: "blue",
      desc: "全队生命提高 14%，防御提高 12%，开场获得 1 层护御。",
      effects: {
        teamModifiers: {
          hpPct: 0.14,
          defPct: 0.12,
        },
        heroOpeningStatuses: [
          { status: "guard", duration: 1 },
        ],
      },
    },
    {
      id: "liangshan_letter",
      name: "受书惩奸",
      icon: "gavel",
      tone: "gold",
      desc: "全队受到伤害降低 10%，反击提高 22%；敌军开场损失 10% 护势。",
      effects: {
        teamModifiers: {
          damageReductionPct: 0.1,
          counterBonus: 0.22,
          enemyStartPoisePct: 0.1,
        },
      },
    },
  ],
};

export const CHAPTER_TACTIC_IDS = new Set(
  Object.values(CHAPTER_TACTICS)
    .flat()
    .map((tactic) => tactic.id),
);

export function getChapterTactics(chapterId) {
  return CHAPTER_TACTICS[chapterId] || [];
}

export function getChapterTactic(chapterId, optionIndex) {
  const index = Math.trunc(Number(optionIndex));
  if (!Number.isFinite(index) || index < 0) return null;
  return getChapterTactics(chapterId)[index] || null;
}

export function chapterTacticArchiveCount(archive = [], chapterId) {
  const discovered = new Set(Array.isArray(archive) ? archive : []);
  return getChapterTactics(chapterId).filter((tactic) =>
    discovered.has(tactic.id),
  ).length;
}

export function totalChapterTactics() {
  return CHAPTER_TACTIC_IDS.size;
}
