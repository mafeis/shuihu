import {
  ARENA_BOON_MASTERIES,
  ARENA_ENCOUNTERS,
  ARENA_MILESTONES,
  ARENA_RELICS,
  ARENA_SYNERGIES,
  CHAPTERS,
  CHAIN_FORMATIONS,
  ENDINGS,
  FACILITIES,
  HERO_BONDS,
  HERO_DOCTRINES,
  HERO_LEGENDS,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HERO_TRIALS,
  HEROES,
  HERO_ORDER,
} from "./data.js";
import {
  CHAPTER_TACTICS,
  chapterTacticArchiveCount,
  totalChapterTactics,
} from "./chapter-tactics.js";
import {
  chapterStatus,
  currentChapter,
  heroDoctrineUnlocked,
  heroLegendCompleted,
  heroLegendUnlocked,
  heroQuestUnlocked,
  heroRecruitmentCompleted,
  heroRecruitmentUnlocked,
  isHeroQuestComplete,
} from "./state.js";

const ALL_QUESTS = Object.entries(HERO_QUESTS).flatMap(
  ([heroId, quests]) => quests.map((quest) => ({ ...quest, heroId })),
);

function clampProgress(value, target) {
  const safeTarget = Math.max(1, Math.trunc(Number(target) || 1));
  const safeValue = Math.max(
    0,
    Math.min(safeTarget, Math.trunc(Number(value) || 0)),
  );
  return {
    current: safeValue,
    target: safeTarget,
    pct: Math.round((safeValue / safeTarget) * 100),
    complete: safeValue >= safeTarget,
  };
}

function validDoctrineCount(state) {
  return HERO_ORDER.filter((heroId) =>
    Boolean(HERO_DOCTRINES[heroId]?.paths?.[state?.doctrines?.[heroId]]),
  ).length;
}

function totalChapterMedals(state) {
  return Object.values(state?.chapterMedals || {}).reduce(
    (total, medals) =>
      total + (Array.isArray(medals) ? Math.min(medals.length, 3) : 0),
    0,
  );
}

function totalFacilityUpgrades(state) {
  return Object.values(FACILITIES).reduce(
    (total, facility) =>
      total +
      Math.max(
        0,
        Math.min(
          facility.maxLevel - 1,
          (state?.facilities?.[facility.id] || 1) - 1,
        ),
      ),
    0,
  );
}

function maxCompletedTrials(state) {
  return Math.max(
    0,
    ...HERO_ORDER.map(
      (heroId) => state?.heroMastery?.[heroId]?.trials?.length || 0,
    ),
  );
}

export function uniqueEndingIds(state) {
  return new Set([
    ...(state?.endingsUnlocked || []),
    ...(state?.ending ? [state.ending] : []),
  ]);
}

export function achievementProgress(state, achievementId) {
  const progressByAchievement = {
    first_blood: {
      current: state?.stats?.battlesWon || 0,
      target: 1,
      unit: "场胜利",
    },
    ten_stands: {
      current: state?.stats?.battlesWon || 0,
      target: 10,
      unit: "场胜利",
    },
    hundred_stands: {
      current: state?.stats?.battlesWon || 0,
      target: 100,
      unit: "场胜利",
    },
    all_sworn: {
      current: state?.recruited?.length || 0,
      target: HERO_ORDER.length,
      unit: "位好汉",
    },
    full_chronicle: {
      current: state?.completedChapters?.length || 0,
      target: CHAPTERS.length,
      unit: "回",
    },
    three_endings: {
      current: uniqueEndingIds(state).size,
      target: Object.keys(ENDINGS).length,
      unit: "种结局",
    },
    camp_complete: {
      current: totalFacilityUpgrades(state),
      target: Object.values(FACILITIES).reduce(
        (total, facility) => total + facility.maxLevel - 1,
        0,
      ),
      unit: "级营造",
    },
    arena_ten: {
      current: state?.arena?.bestWave || 0,
      target: 10,
      unit: "阵",
    },
    arena_twenty: {
      current: state?.arena?.bestWave || 0,
      target: 20,
      unit: "阵",
    },
    arena_thirty: {
      current: state?.arena?.bestWave || 0,
      target: 30,
      unit: "阵",
    },
    mastery_path: {
      current: maxCompletedTrials(state),
      target: HERO_TRIALS.length,
      unit: "项试炼",
    },
    doctrine_path: {
      current: validDoctrineCount(state),
      target: 1,
      unit: "条命途",
    },
    doctrine_all: {
      current: validDoctrineCount(state),
      target: HERO_ORDER.length,
      unit: "条命途",
    },
    new_cycle: {
      current: state?.newGamePlus || 0,
      target: 1,
      unit: "周目",
    },
    medal_three: {
      current: totalChapterMedals(state),
      target: 3,
      unit: "枚评鉴",
    },
    medal_all: {
      current: totalChapterMedals(state),
      target: CHAPTERS.length * 3,
      unit: "枚评鉴",
    },
    arena_masteries: {
      current: state?.arena?.discoveries?.masteries?.length || 0,
      target: Object.keys(ARENA_BOON_MASTERIES).length,
      unit: "种阵眼",
    },
    arena_synergies: {
      current: state?.arena?.discoveries?.synergies?.length || 0,
      target: Object.keys(ARENA_SYNERGIES).length,
      unit: "种阵法",
    },
    arena_encounters: {
      current: state?.arena?.discoveries?.encounters?.length || 0,
      target: Object.keys(ARENA_ENCOUNTERS).length,
      unit: "种军势",
    },
  };

  const progress = clampProgress(
    progressByAchievement[achievementId]?.current || 0,
    progressByAchievement[achievementId]?.target || 1,
  );
  const unit = progressByAchievement[achievementId]?.unit || "";
  return {
    ...progress,
    label: `${progress.current}/${progress.target} ${unit}`.trim(),
    remaining: Math.max(0, progress.target - progress.current),
  };
}

function firstClaimableQuest(state) {
  return ALL_QUESTS.find(
    (quest) =>
      heroQuestUnlocked(state, quest.id) &&
      isHeroQuestComplete(state, quest.id) &&
      !state?.heroQuests?.claimed?.includes(quest.id),
  );
}

function firstReadyRecruitment(state) {
  return Object.keys(HERO_RECRUITMENTS).find(
    (heroId) =>
      !heroRecruitmentCompleted(state, heroId) &&
      heroRecruitmentUnlocked(state, heroId),
  );
}

function firstReadyLegend(state) {
  return HERO_ORDER.find(
    (heroId) =>
      heroLegendUnlocked(state, heroId) &&
      !heroLegendCompleted(state, heroId),
  );
}

function firstIncompleteQuestHero(state) {
  return HERO_ORDER.find((heroId) => {
    if (!state?.recruited?.includes(heroId)) return false;
    return (HERO_QUESTS[heroId] || []).some(
      (quest) =>
        heroQuestUnlocked(state, quest.id) &&
        !state?.heroQuests?.claimed?.includes(quest.id),
    );
  });
}

function nextArenaMilestone(state) {
  const bestWave = state?.arena?.bestWave || 0;
  return ARENA_MILESTONES.find((milestone) => milestone.wave > bestWave) || null;
}

function nextChapterMedalGoal(state) {
  const candidates = CHAPTERS.map((chapter) => {
    const earned = Array.isArray(state?.chapterMedals?.[chapter.id])
      ? state.chapterMedals[chapter.id].length
      : 0;
    return { chapter, earned };
  }).filter(({ earned }) => earned < 3);
  if (!candidates.length) return null;
  candidates.sort(
    (left, right) =>
      left.earned - right.earned ||
      left.chapter.index - right.chapter.index,
  );
  const { chapter, earned } = candidates[0];
  return {
    id: `chapter-medal-${chapter.id}`,
    eyebrow: "战卷评鉴",
    title: `重游「${chapter.title}」`,
    description: `这一回还缺 ${3 - earned} 枚评鉴，换一种打法就能补上。`,
    action: "route-chapter",
    chapterId: chapter.id,
    icon: "medal",
    tone: "gold",
    progress: {
      current: earned,
      target: 3,
      pct: Math.round((earned / 3) * 100),
      label: `${earned}/3 枚`,
    },
  };
}

function nextChapterTacticGoal(state) {
  const archive = state?.tacticArchive || [];
  for (const chapter of CHAPTERS) {
    const tactics = CHAPTER_TACTICS[chapter.id] || [];
    const discovered = chapterTacticArchiveCount(archive, chapter.id);
    if (discovered >= tactics.length) continue;
    const optionIndex = tactics.findIndex(
      (tactic) => !archive.includes(tactic.id),
    );
    const option = chapter.choice.options[optionIndex];
    return {
      id: `chapter-tactic-${chapter.id}`,
      eyebrow: "临阵战意",
      title:
        discovered > 0
          ? `再走另一条「${chapter.title}」`
          : `试出「${chapter.title}」的新战法`,
      description: option
        ? `换一种抉择：${option.text}`
        : "重走这一回，把尚未收录的临阵战意写入战谱。",
      action: "route-chapter",
      chapterId: chapter.id,
      icon: "route",
      tone: "teal",
      progress: {
        current: archive.length,
        target: totalChapterTactics(),
        pct: Math.round((archive.length / totalChapterTactics()) * 100),
        label: `${archive.length}/${totalChapterTactics()} 种战意`,
      },
    };
  }
  return null;
}

function doctrineGoal(state) {
  const heroId = HERO_ORDER.find(
    (candidate) =>
      state?.recruited?.includes(candidate) &&
      heroDoctrineUnlocked(state, candidate) &&
      !HERO_DOCTRINES[candidate]?.paths?.[state?.doctrines?.[candidate]],
  );
  if (!heroId) return null;
  return {
    id: `doctrine-${heroId}`,
    eyebrow: "星命命途",
    title: `${HEROES[heroId].name}等待择路`,
    description: "三试已经圆满，为这名好汉定下下一套实战规则。",
    action: "route-codex",
    heroId,
    icon: "route",
    tone: "teal",
  };
}

function trialGoal(state) {
  const ranked = HERO_ORDER.filter((heroId) =>
    state?.recruited?.includes(heroId),
  )
    .map((heroId) => {
      const mastery = state?.heroMastery?.[heroId] || {};
      const remaining = HERO_TRIALS.filter(
        (trial) => !(mastery.trials || []).includes(trial.id),
      );
      const nearest = [...remaining].sort(
        (left, right) =>
          (mastery[right.metric] || 0) / right.target -
          (mastery[left.metric] || 0) / left.target,
      )[0];
      return { heroId, remaining, nearest };
    })
    .filter(({ remaining }) => remaining.length > 0)
    .sort((left, right) => left.remaining.length - right.remaining.length);
  const selected = ranked[0];
  if (!selected) return null;
  const current = selected.nearest
    ? Math.min(
        selected.nearest.target,
        state?.heroMastery?.[selected.heroId]?.[selected.nearest.metric] || 0,
      )
    : 0;
  return {
    id: `trial-${selected.heroId}`,
    eyebrow: "星命试炼",
    title: `${HEROES[selected.heroId].name}再进一步`,
    description: selected.nearest
      ? `${selected.nearest.name}：${selected.nearest.desc}`
      : "继续携这名好汉出战，完成试炼后解锁命途。",
    action: "route-codex",
    heroId: selected.heroId,
    icon: "sparkles",
    tone: "blue",
    progress: selected.nearest
      ? clampProgress(current, selected.nearest.target)
      : null,
  };
}

function achievementRoute(achievementId) {
  if (
    achievementId.startsWith("arena_") ||
    ["ten_stands", "hundred_stands"].includes(achievementId)
  ) {
    return "nav-arena";
  }
  if (
    [
      "all_sworn",
      "mastery_path",
      "medal_three",
      "medal_all",
      "full_chronicle",
    ].includes(achievementId)
  ) {
    return "go-map";
  }
  if (
    ["doctrine_path", "doctrine_all"].includes(achievementId)
  ) {
    return "nav-codex";
  }
  if (achievementId === "camp_complete") return "nav-camp";
  if (
    ["three_endings", "new_cycle"].includes(achievementId)
  ) {
    return "route-new-cycle";
  }
  return "nav-quests";
}

function closestAchievementGoal(state) {
  const closest = [
    "first_blood",
    "ten_stands",
    "hundred_stands",
    "all_sworn",
    "full_chronicle",
    "three_endings",
    "camp_complete",
    "arena_ten",
    "arena_twenty",
    "arena_thirty",
    "mastery_path",
    "doctrine_path",
    "doctrine_all",
    "new_cycle",
    "medal_three",
    "medal_all",
    "arena_masteries",
    "arena_synergies",
    "arena_encounters",
  ]
    .filter((achievementId) => !state?.achievements?.includes(achievementId))
    .map((achievementId) => ({
      achievementId,
      progress: achievementProgress(state, achievementId),
    }))
    .filter(({ progress }) => !progress.complete)
    .sort(
      (left, right) =>
        right.progress.pct - left.progress.pct ||
        left.progress.remaining - right.progress.remaining,
    )[0];
  if (!closest) return null;
  return {
    id: `achievement-${closest.achievementId}`,
    eyebrow: "梁山功簿",
    title: "战功只差一步",
    description: closest.progress.label,
    action: achievementRoute(closest.achievementId),
    icon: "trophy",
    tone: "cinnabar",
    progress: closest.progress,
  };
}

export function buildRoutePlan(state, options = {}) {
  if (!state) return [];
  const limit = Math.max(1, Math.min(6, Number(options.limit) || 3));
  const goals = [];
  const endingIds = uniqueEndingIds(state);
  const campaignComplete =
    Boolean(state.ending) ||
    (state.completedChapters?.length || 0) >= CHAPTERS.length;

  if (state.flags?.finalBattleWon && !state.ending) {
    goals.push({
      id: "final-choice",
      eyebrow: "终回抉择",
      title: "梁山往何处去",
      description: "终战已胜，聚义、招安与归隐三条路都在等你落笔。",
      action: "route-final-choice",
      icon: "route",
      tone: "gold",
    });
  }

  const claimableQuest = firstClaimableQuest(state);
  if (claimableQuest) {
    goals.push({
      id: `claim-${claimableQuest.id}`,
      eyebrow: "异闻可领取",
      title: claimableQuest.title,
      description: `${HEROES[claimableQuest.heroId].name}的一段旧事已经完成，领取后会继续下一段。`,
      action: "route-quest",
      heroId: claimableQuest.heroId,
      icon: "scroll-text",
      tone: "teal",
    });
  }

  const readyRecruitment = firstReadyRecruitment(state);
  if (readyRecruitment) {
    const recruitment = HERO_RECRUITMENTS[readyRecruitment];
    goals.push({
      id: `recruit-${readyRecruitment}`,
      eyebrow: "聚义帖可接",
      title: `${HEROES[readyRecruitment].name}来投`,
      description: recruitment.teaser,
      action: "route-quest",
      heroId: readyRecruitment,
      icon: "user-round-plus",
      tone: "cinnabar",
    });
  }

  const readyLegend = firstReadyLegend(state);
  if (readyLegend) {
    goals.push({
      id: `legend-${readyLegend}`,
      eyebrow: "群英列传",
      title: HERO_LEGENDS[readyLegend].title,
      description: `${HEROES[readyLegend].name}的三段异闻已结，专属终章战已经开启。`,
      action: "route-quest",
      heroId: readyLegend,
      icon: "swords",
      tone: "gold",
    });
  }

  if (state.arena?.activeRun) {
    const run = state.arena.activeRun;
    goals.push({
      id: "arena-resume",
      eyebrow: run.mode === "weekly" ? "本周军令" : "演武续局",
      title: `续上第 ${run.wave} 阵`,
      description: run.pendingBoons?.length
        ? "上一阵的战报已经归档，下一道军令正等着选择。"
        : "当前生命、军令与悬赏都已存档，可以立即续战。",
      action: "route-arena",
      icon: "flame",
      tone: "cinnabar",
      progress: clampProgress(run.wave - 1, Math.max(1, run.wave)),
    });
  }

  if (!campaignComplete) {
    const chapter = currentChapter(state);
    if (chapter && chapterStatus(state, chapter) !== "completed") {
      goals.push({
        id: `story-${chapter.id}`,
        eyebrow: "当前主线",
        title: `赴「${chapter.title}」`,
        description: chapter.objective,
        action: "route-chapter",
        chapterId: chapter.id,
        icon: "map",
        tone: "paper",
        progress: {
          current: state.completedChapters?.length || 0,
          target: CHAPTERS.length,
          pct: Math.round(
            ((state.completedChapters?.length || 0) / CHAPTERS.length) * 100,
          ),
          label: `${state.completedChapters?.length || 0}/${CHAPTERS.length} 回`,
        },
      });
    }
  } else if (endingIds.size < Object.keys(ENDINGS).length) {
    const nextEnding = Object.values(ENDINGS).find(
      (ending) => !endingIds.has(ending.id),
    );
    goals.push({
      id: `ending-${nextEnding.id}`,
      eyebrow: "另一条梁山路",
      title: `再启一卷 · ${nextEnding.title}`,
      description: `这次尚未抵达「${nextEnding.subtitle}」。新卷会保留功簿、命途、异闻与演武纪录。`,
      action: "route-new-cycle",
      icon: "rotate-ccw",
      tone: "gold",
      progress: {
        current: endingIds.size,
        target: Object.keys(ENDINGS).length,
        pct: Math.round(
          (endingIds.size / Object.keys(ENDINGS).length) * 100,
        ),
        label: `${endingIds.size}/${Object.keys(ENDINGS).length} 种结局`,
      },
    });
  }

  const canEnterArena =
    (state.team || []).filter((heroId) =>
      state.recruited?.includes(heroId),
    ).length >= 2;
  const nextMilestone = nextArenaMilestone(state);
  if (nextMilestone && canEnterArena) {
    const relic = ARENA_RELICS[nextMilestone.relicId];
    goals.push({
      id: `arena-relic-${nextMilestone.relicId}`,
      eyebrow: "演武永久奖励",
      title: `破第 ${nextMilestone.wave} 阵`,
      description: relic
        ? `下一件星命遗物「${relic.name}」将永久收入演武簿。`
        : "继续刷新演武最高波次。",
      action: "route-arena",
      icon: "trophy",
      tone: "gold",
      progress: {
        current: Math.min(
          state.arena?.bestWave || 0,
          nextMilestone.wave,
        ),
        target: nextMilestone.wave,
        pct: Math.round(
          (Math.min(state.arena?.bestWave || 0, nextMilestone.wave) /
            nextMilestone.wave) *
            100,
        ),
        label: `最高第 ${state.arena?.bestWave || 0} 阵`,
      },
    });
  }

  const medalGoal = nextChapterMedalGoal(state);
  if (medalGoal) goals.push(medalGoal);

  const tacticGoal = nextChapterTacticGoal(state);
  if (tacticGoal) goals.push(tacticGoal);

  const nextDoctrineGoal = doctrineGoal(state);
  if (nextDoctrineGoal) goals.push(nextDoctrineGoal);

  const nextTrialGoal = trialGoal(state);
  if (nextTrialGoal) goals.push(nextTrialGoal);

  const questHero = firstIncompleteQuestHero(state);
  if (questHero) {
    const pendingQuest = (HERO_QUESTS[questHero] || []).find(
      (quest) =>
        heroQuestUnlocked(state, quest.id) &&
        !state?.heroQuests?.claimed?.includes(quest.id),
    );
    if (pendingQuest) {
      goals.push({
        id: `quest-${pendingQuest.id}`,
        eyebrow: "人物异闻",
        title: pendingQuest.title,
        description: `${HEROES[questHero].name}：${pendingQuest.objective.label}`,
        action: "route-quest",
        heroId: questHero,
        icon: "scroll-text",
        tone: "teal",
      });
    }
  }

  const archivedBonds = new Set(state.bondArchive || []);
  if (archivedBonds.size < Object.keys(HERO_BONDS).length) {
    goals.push({
      id: "bond-archive",
      eyebrow: "阵谱收集",
      title: "试出一组新兄弟契",
      description: "换一组三人编成，让尚未记录的合阵规则在实战中触发。",
      action: "nav-roster",
      icon: "users",
      tone: "blue",
      progress: {
        current: archivedBonds.size,
        target: Object.keys(HERO_BONDS).length,
        pct: Math.round(
          (archivedBonds.size / Object.keys(HERO_BONDS).length) * 100,
        ),
        label: `${archivedBonds.size}/${Object.keys(HERO_BONDS).length} 契`,
      },
    });
  }

  const archivedChains = new Set(state.chainArchive || []);
  if (
    archivedChains.size < Object.keys(CHAIN_FORMATIONS).length &&
    (state.recruited?.length || 0) >= 3
  ) {
    goals.push({
      id: "chain-archive",
      eyebrow: "星命合击谱",
      title: "试出一种新的三路合击",
      description:
        "让三名路数不同的好汉依次出手，下一次我方行动即可结成新的合击阵。",
      action: "nav-codex",
      icon: "sparkles",
      tone: "cinnabar",
      progress: {
        current: archivedChains.size,
        target: Object.keys(CHAIN_FORMATIONS).length,
        pct: Math.round(
          (archivedChains.size / Object.keys(CHAIN_FORMATIONS).length) * 100,
        ),
        label: `${archivedChains.size}/${Object.keys(CHAIN_FORMATIONS).length} 阵`,
      },
    });
  }

  const achievementGoal = closestAchievementGoal(state);
  if (achievementGoal) goals.push(achievementGoal);

  if (!goals.length) {
    goals.push({
      id: "arena-freeplay",
      eyebrow: "星命无尽",
      title: "再试一种军令成阵",
      description: "所有长期目标都已收录，演武仍可用不同军令路线刷新纪录。",
      action: "route-arena",
      icon: "flame",
      tone: "cinnabar",
    });
  }

  const seen = new Set();
  return goals
    .filter((goal) => {
      const key = `${goal.action}:${goal.heroId || ""}:${goal.chapterId || ""}:${goal.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
