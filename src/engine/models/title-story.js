import titlePoster from "../../../assets/video/bianjing_snow_night_poster.webp";
import {
  ACHIEVEMENTS,
  CHAPTERS,
  ENDINGS,
  EQUIPMENT,
  HERO_BONDS,
  HEROES,
  HERO_LEGENDS,
  HERO_QUESTS,
  PATHS,
} from "../../data.js";
import {
  CHAPTER_MEDALS,
  alignmentSummary,
  chapterStatus,
  completionPercent,
  currentChapter,
} from "../../state.js";
import { getChapterTactic } from "../../chapter-tactics.js";
import { buildRoutePlan } from "../../route-guide.js";
import {
  action,
  baseModel,
  heroBannerFromHero,
  modalModel,
} from "./common.js";

export function buildTitleModel(context) {
  const { state, saved, selectedDifficulty, modal } = context;
  return {
    screen: "title",
    layout: "title",
    brand: "星命水浒",
    background: saved ? currentChapter(saved)?.bg || titlePoster : titlePoster,
    header: { stats: [] },
    nav: [],
    hero: {
      eyebrow: "北宋末年 · 梁山群像回合 RPG",
      title: "星命水浒",
      subtitle: "风雪山神庙",
      body: saved
        ? `上次行至 ${currentChapter(saved)?.title || "梁山"}。旧卷完成度 ${completionPercent(saved)}%。`
        : "从黄河夜渡到水泊聚义。聚义、招安或归隐，由你的选择写成终卷。",
    },
    actions: [
      ...(saved
        ? [
            action("continue", "续上旧卷", "continue-game", {}, {
              tone: "primary",
              icon: "play",
            }),
          ]
        : []),
      action("new", saved ? "另开新卷" : "踏入江湖", "new-game", {}, {
        tone: saved ? "secondary" : "primary",
        icon: "star",
      }),
      action("settings", "设置", "title-settings", {}, {
        tone: "ghost",
        icon: "settings",
      }),
    ],
    tabs: saved
      ? []
      : Object.values(context.difficulties || {}).map((difficulty) => ({
          id: difficulty.id,
          label: difficulty.name,
          action: "difficulty",
          data: { difficulty: difficulty.id },
          active: selectedDifficulty === difficulty.id,
        })),
    cards: [],
    modal: modalModel(modal),
  };
}

export function buildStoryModel(context) {
  const { state, activeChapter, story, modal } = context;
  if (!activeChapter || !story) return buildFallbackModel(context);
  const lines =
    story.stage === "outro" ? activeChapter.outro || [] : activeChapter.intro || [];
  const line = lines[Math.min(story.line || 0, lines.length - 1)] || {};
  const isChoice = story.stage === "choice";
  const isResponse = story.stage === "choice-response";
  const isLegendReady = story.stage === "legend-ready";
  const choice = activeChapter.choice;
  const selectedOption =
    choice?.options?.[Math.max(0, Number(story.choiceIndex) || 0)];
  const tactic = choice
    ? getChapterTactic(activeChapter.id, Math.max(0, Number(story.choiceIndex) || 0))
    : null;
  const portraitHero =
    story.legendHeroId ||
    story.heroRecruitmentId ||
    (line.portrait && HEROES[line.portrait] ? line.portrait : null) ||
    state.team.find(Boolean) ||
    "linchong";
  const hero = HEROES[portraitHero] || HEROES.linchong;
  const heroBanner = {
    image: hero?.cutout || hero?.portrait,
    eyebrow: story.stage === "outro" ? "战后余音" : activeChapter.label,
    title: isChoice ? choice?.prompt || "抉择" : line.speaker || hero?.name || "",
    body: isLegendReady
      ? HERO_LEGENDS[story.legendHeroId]?.readyText || ""
      : isChoice
        ? "此笔会改变梁山倾向，并留下临阵战意。"
        : isResponse
          ? selectedOption?.response || ""
          : line.text || "",
  };
  const legend = story.legendHeroId
    ? HERO_LEGENDS[story.legendHeroId]
    : null;
  const storyDetail = {
    stage: story.stage,
    line: Math.max(0, Number(story.line) || 0),
    lineCount: lines.length,
    chapterId: activeChapter.id,
    chapterLabel: activeChapter.label,
    chapterTitle: activeChapter.title,
    chapterLocation: activeChapter.location,
    chapterBackground: activeChapter.bg,
    legend: legend
      ? {
          id: legend.id,
          heroId: story.legendHeroId,
          title: legend.title,
          location: legend.location,
          readyText: legend.readyText,
          objective: legend.objective,
          rule: legend.rule,
          deployed: state.team.includes(story.legendHeroId),
          reward: {
            ...legend.reward,
            itemName:
              EQUIPMENT[legend.reward.item]?.name ||
              "专属装备",
          },
        }
      : null,
  };
  const common = {
    modal: modalModel(modal),
    nav: [],
    header: {
      title: `${activeChapter.label} · ${activeChapter.title}`,
      stats: [],
      back: null,
    },
    hero: heroBanner,
    detail: storyDetail,
  };

  if (isChoice) {
    return {
      ...baseModel("story", state, "quests", {
        layout: "choice",
        background: activeChapter.bg,
        hideNav: true,
        hero: heroBanner,
        modal,
        detail: storyDetail,
      }),
      cards: (choice?.options || []).map((option, index) => ({
        id: `choice-${index}`,
        title: option.text,
        meta: Object.entries(option.effect || {})
          .map(([key, value]) => {
            const labels = {
              brotherhood: "聚义",
              order: "招安",
              freedom: "归隐",
            };
            return `${labels[key] || key} +${value}`;
          })
          .join(" · "),
        body: getChapterTactic(activeChapter.id, index)?.desc || "",
        badge: `0${index + 1}`,
        action: "story-choice",
        data: { option: index },
        icon: "scroll",
        tone: index === 0 ? "primary" : "ghost",
      })),
      actions: [
        action("menu", "暂离", "story-menu", {}, {
          tone: "ghost",
          icon: "back",
        }),
      ],
    };
  }

  const actions = [];
  if (isLegendReady || isResponse) {
    actions.push(
      action("battle", "拔刃迎战", "story-to-battle", {}, {
        tone: "primary",
        icon: "swords",
      }),
    );
  } else if (story.stage !== "outro") {
    actions.push(
      action("next", "继续", "story-next", {}, {
        tone: "primary",
        icon: "chevron",
      }),
      action("skip", "跳过回想", "story-skip", {}, {
        tone: "ghost",
        icon: "chevron",
      }),
    );
  } else {
    actions.push(
      action(
        "continue",
        story.stage === "outro" && story.line >= lines.length - 1
          ? "收卷"
          : "继续",
        "story-next",
        {},
        {
        tone: "primary",
        icon: "chevron",
        },
      ),
    );
  }
  actions.push(
    action("menu", "暂离", "story-menu", {}, {
      tone: "ghost",
      icon: "back",
    }),
  );
  return {
    ...common,
    screen: "story",
    layout: "story",
    brand: "星命水浒",
    background: activeChapter.bg,
    actions,
    cards: [],
    tabs: [],
  };
}

export function buildRewardModel(context) {
  const { state, activeChapter, story, modal } = context;
  const reward = story?.reward;
  if (!activeChapter || !reward) return buildFallbackModel(context);
  const recruitedHero = reward.recruitment
    ? HEROES[reward.recruitment.heroId]
    : null;
  const medalCards = CHAPTER_MEDALS.filter((medal) =>
    (reward.medals?.newlyEarned || []).includes(medal.id),
  ).map((medal) => ({
    id: `medal-${medal.id}`,
    title: medal.name,
    meta: reward.medals?.completed ? "战卷评鉴 · 三星齐聚" : "战卷评鉴 · 新评",
    body: medal.desc,
    icon: medal.icon,
    tone: "primary",
  }));
  const tacticCard = reward.tactic?.tactic
    ? [
        {
          id: "tactic",
          title: reward.tactic.tactic.name,
          meta: reward.tactic.newlyDiscovered
            ? "临阵战意 · 初录"
            : "临阵战意 · 已录",
          body: reward.tactic.tactic.desc,
          icon: reward.tactic.tactic.icon,
          tone: reward.tactic.tactic.tone,
        },
      ]
    : [];
  const masteryCards = (context.lastMasteryUnlocks || []).map(
    ({ heroId, heroName, trial }) => ({
      id: `mastery-${heroId}-${trial.id}`,
      title: `${heroName} · ${trial.name}`,
      meta: "星命试炼 · 完成",
      body: `铜钱 +${trial.reward?.copper || 0} · 历练 +${trial.reward?.xp || 0} · 全属性 +2%`,
      icon: "trophy",
      tone: "primary",
    }),
  );
  const bondCards = (context.lastBondUnlocks || []).map((bond) => ({
    id: `bond-${bond.id}`,
    title: bond.name,
    meta: "兄弟契 · 新入阵谱",
    body: bond.desc,
    icon: bond.icon || "sparkles",
    tone: bond.tone || "secondary",
  }));
  const chainCards = (context.lastChainUnlocks || []).map((formation) => ({
    id: `chain-${formation.id}`,
    title: formation.name,
    meta: "星命合击 · 新入谱",
    body: `${formation.desc} · 铜钱 +${formation.reward?.copper || 0} · 历练 +${formation.reward?.xp || 0}`,
    icon: formation.icon || "sparkles",
    tone: formation.tone || "primary",
  }));
  const achievementCards = (context.lastAchievementUnlocks || []).map(
    (achievement) => ({
      id: `achievement-${achievement.id}`,
      title: achievement.name,
      meta: "战功入册",
      body: `铜钱 +${achievement.reward?.copper || 0} · 历练 +${achievement.reward?.xp || 0}`,
      icon: achievement.icon || "medal",
      tone: "primary",
    }),
  );
  const legendReward = reward.legend
    ? {
        heroId: reward.legend.heroId,
        title: reward.legend.title,
        objective: reward.legend.objective,
        completed: true,
      }
    : null;
  const legendCards = legendReward
    ? [
        {
          id: "legend-reward",
          title: legendReward.title,
          meta: "群英列传 · 已载入",
          body: legendReward.objective,
          icon: "swords",
          tone: "primary",
        },
      ]
    : [];
  const cards = [
    {
      id: "copper",
      title: `铜钱 +${reward.copper || 0}`,
      meta: "战利入账",
      body: `当前 ${state.inventory.copper} 贯`,
      icon: "star",
      tone: "primary",
    },
    {
      id: "xp",
      title: `历练 +${reward.xp || 0}`,
      meta: "全队成长",
      body: reward.levelUps?.length
        ? `${reward.levelUps.length} 位好汉提升`
        : "战阵历练已结算",
      icon: "star",
    },
    {
      id: "item",
      title: reward.item ? EQUIPMENT[reward.item]?.name || "获得装备" : "旧战重游",
      meta: reward.item ? EQUIPMENT[reward.item]?.rarity || "武备" : "无新增装备",
      body: reward.recruitment
        ? `${HEROES[reward.recruitment.heroId]?.name || "好汉"}入伙`
        : reward.legend
          ? reward.legend.title
          : "本章奖励已收入行囊",
      icon: "star",
    },
    ...medalCards,
    ...tacticCard,
    ...masteryCards,
    ...bondCards,
    ...chainCards,
    ...achievementCards,
    ...legendCards,
  ];
  return baseModel("reward", state, "map", {
    background: activeChapter.bg,
    hideNav: true,
    hero: {
      image: recruitedHero?.cutout || recruitedHero?.portrait || activeChapter.bg,
      eyebrow: recruitedHero
        ? `${activeChapter.label} · 新兄弟入伙`
        : `${activeChapter.label} · 战事已定`,
      title: recruitedHero?.name || activeChapter.title,
      subtitle: recruitedHero
        ? `${recruitedHero.star} · ${recruitedHero.nickname} · 已入聚义簿`
        : activeChapter.outro?.[0]?.text || "敌阵已破，水泊暂安。",
    },
    actions: [
      action("continue", reward.legend ? "继续列传" : reward.recruitment ? "继续聚义帖" : "继续本章", "story-outro", {}, {
        tone: "primary",
        icon: "chevron",
      }),
    ],
    cards,
    columns: 3,
    modal,
    detail: {
      masteryUnlocks: masteryCards,
      bondUnlocks: bondCards,
      chainUnlocks: chainCards,
      achievementUnlocks: achievementCards,
      legendReward,
    },
  });
}

export function buildFinalChoiceModel(context) {
  const { state, modal } = context;
  const summary = alignmentSummary(state);
  const endingAlignment = {
    brotherhood: state.alignment.brotherhood,
    order: state.alignment.order,
    freedom: state.alignment.freedom,
  };
  return baseModel("final-choice", state, "codex", {
    layout: "choice",
    background: "/assets/environments/liangshan_water_fort.png",
    hideNav: true,
    hero: {
      image: "/assets/environments/liangshan_water_fort.png",
      eyebrow: "终回 · 水泊聚义",
      title: "梁山往何处去",
      subtitle: `当下主势「${summary}」。落笔之后，本篇终卷。`,
    },
    actions: [],
    cards: Object.values(ENDINGS).map((ending) => ({
      id: ending.id,
      title: ending.title,
      meta: `${ending.subtitle} · ${endingAlignment[ending.id]} 点命途`,
      body: ending.text.slice(0, 44),
      badge: "落定此卷",
      action: "choose-ending",
      data: { ending: ending.id },
      icon:
        ending.id === "brotherhood"
          ? "users"
          : ending.id === "order"
            ? "camp"
            : "star",
      tone:
        ending.id ===
        { 聚义: "brotherhood", 招安: "order", 归隐: "freedom" }[summary]
          ? "primary"
          : "ghost",
    })),
    modal,
  });
}

export function buildEndingModel(context) {
  const { state, modal } = context;
  const ending = ENDINGS[state.ending] || ENDINGS.brotherhood;
  const totalQuests = Object.values(HERO_QUESTS).flat().length;
  const claimedQuests = Object.values(HERO_QUESTS)
    .flat()
    .filter((quest) =>
      state.heroQuests?.claimed?.includes(quest.id),
    ).length;
  const completedLegends = Object.values(HERO_LEGENDS).filter(
    (legend) => state.heroLegends?.completed?.includes(legend.id),
  ).length;
  const endingIds = new Set([
    ...(state.endingsUnlocked || []),
    ...(state.ending ? [state.ending] : []),
  ]);
  const routeGoals = buildRoutePlan(state, { limit: 3 });
  const routeCards = routeGoals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    meta: goal.eyebrow,
    body: goal.description,
    icon: goal.icon,
    tone: goal.tone || "ghost",
    badge: goal.progress?.label || "现在可追",
    action: goal.action,
    data: {
      hero: goal.heroId,
      chapter: goal.chapterId,
      routeGoal: goal.id,
    },
    progress: goal.progress
      ? Math.max(0, Math.min(1, goal.progress.pct / 100))
      : undefined,
  }));
  const collectionRows = [
    {
      id: "quests",
      label: "人物异闻",
      value: `${claimedQuests}/${totalQuests}`,
      current: claimedQuests,
      target: totalQuests,
    },
    {
      id: "legends",
      label: "群英列传",
      value: `${completedLegends}/${Object.keys(HERO_LEGENDS).length}`,
      current: completedLegends,
      target: Object.keys(HERO_LEGENDS).length,
    },
    {
      id: "bonds",
      label: "兄弟契",
      value: `${state.bondArchive?.length || 0}/${
        Object.keys(HERO_BONDS).length
      }`,
      current: state.bondArchive?.length || 0,
      target: Object.keys(HERO_BONDS).length,
    },
    {
      id: "arena",
      label: "演武纪录",
      value: `第 ${state.arena?.bestWave || 0} 阵`,
      current: state.arena?.bestWave || 0,
      target: Math.max(1, state.arena?.bestWave || 0),
    },
    {
      id: "achievements",
      label: "梁山功簿",
      value: `${state.achievements?.length || 0}/${ACHIEVEMENTS.length}`,
      current: state.achievements?.length || 0,
      target: ACHIEVEMENTS.length,
    },
    {
      id: "endings",
      label: "结局收录",
      value: `${endingIds.size}/${Object.keys(ENDINGS).length}`,
      current: endingIds.size,
      target: Object.keys(ENDINGS).length,
    },
  ];
  return baseModel("ending", state, "codex", {
    background: context.endingBackground,
    hideNav: true,
    hero: {
      image: context.endingBackground,
      eyebrow: "星命水浒 · 全篇终",
      title: ending.title,
      subtitle: ending.epilogue,
    },
    actions: [
      action("codex", "再览星图", "continue-after-ending", {}, {
        tone: "primary",
        icon: "codex",
      }),
      action("new-plus", "携星图重开", "new-game-plus", {}, {
        tone: "secondary",
        icon: "star",
      }),
      action("title", "返回标题", "back-to-title", {}, {
        tone: "ghost",
        icon: "back",
      }),
    ],
    cards: [
      {
        id: "battles",
        title: `${state.stats.battlesWon} 胜`,
        meta: "战斗胜利",
        body: `完成度 ${completionPercent(state)}%`,
        icon: "swords",
      },
      {
        id: "heroes",
        title: `${state.recruited.length} 人`,
        meta: "梁山结义",
        body: `${state.bondArchive?.length || 0} 条兄弟契入谱`,
        icon: "users",
      },
      {
        id: "archive",
        title: `${claimedQuests}/${totalQuests}`,
        meta: "人物异闻",
        body: `${state.arena?.bestWave || 0} 阵演武纪录`,
        icon: "scroll",
      },
      ...routeCards,
    ],
    columns: 3,
    modal,
    detail: {
      endingId: ending.id,
      routeGoals,
      routeCards,
      collectionRows,
      collections: {
        quests: claimedQuests,
        legends: completedLegends,
        bonds: state.bondArchive?.length || 0,
        arenaWave: state.arena?.bestWave || 0,
        achievements: state.achievements?.length || 0,
        endings: endingIds.size,
      },
      stats: {
        battlesWon: state.stats.battlesWon,
        recruited: state.recruited.length,
        completion: completionPercent(state),
      },
      newGamePlus: state.newGamePlus || 0,
    },
  });
}

function buildFallbackModel(context) {
  const chapter = currentChapter(context.state) || CHAPTERS[0];
  return baseModel("map", context.state, "map", {
    background: chapter.bg,
    hero: {
      image: chapter.bg,
      eyebrow: chapter.label,
      title: chapter.title,
      subtitle: chapter.objective,
    },
    actions: [
      action("map", "回到江湖", "nav-map", {}, {
        tone: "primary",
        icon: "map",
      }),
    ],
    cards: [],
    modal: modalModel(context.modal),
  });
}

export function storyChoiceTacticLabel(activeChapter, index) {
  const tactic = getChapterTactic(activeChapter?.id, index);
  return tactic ? `${tactic.name} · ${PATHS[tactic.path]?.name || "临阵战意"}` : "";
}
