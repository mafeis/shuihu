import {
  ACHIEVEMENTS,
  CHAIN_FORMATIONS,
  ENDINGS,
  HERO_BONDS,
  HERO_DOCTRINES,
  HERO_LEGENDS,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HERO_TRIALS,
  HEROES,
  HERO_ORDER,
  PATHS,
} from "../../data.js";
import {
  alignmentSummary,
  heroDoctrine,
  heroDoctrineUnlocked,
  heroLegendCompleted,
  heroLegendUnlocked,
  heroQuestProgress,
  heroQuestMasteryScale,
  heroQuestUnlocked,
  heroRecruitmentCompleted,
  heroRecruitmentUnlocked,
  isHeroQuestComplete,
} from "../../state.js";
import { achievementProgress } from "../../route-guide.js";
import {
  action,
  baseModel,
  heroBannerFromHero,
  modalModel,
} from "./common.js";

const QUEST_HERO_GROUPS = Object.freeze([
  { id: "all", name: "全部" },
  { id: "gang", name: "刚猛" },
  { id: "ling", name: "灵巧" },
  { id: "tao", name: "韬略" },
  { id: "shou", name: "守御" },
]);

export function buildQuestsModel(context) {
  const {
    state,
    selectedQuestHero,
    questPathFilter,
    modal,
  } = context;
  const selectedId = state.recruited.includes(selectedQuestHero)
    ? selectedQuestHero
    : state.recruited[0];
  const selectedHero = HEROES[selectedId];
  const pathFilter = QUEST_HERO_GROUPS.some(
    (group) => group.id === questPathFilter,
  )
    ? questPathFilter
    : "all";
  const allQuests = Object.values(HERO_QUESTS).flat();
  const claimable = allQuests.filter(
    (quest) =>
      heroQuestUnlocked(state, quest.id) &&
      isHeroQuestComplete(state, quest.id) &&
      !state.heroQuests?.claimed?.includes(quest.id),
  );
  const recruitmentCards = Object.values(HERO_RECRUITMENTS)
    .map((recruitment) => {
      const hero = HEROES[recruitment.heroId];
      const completed = heroRecruitmentCompleted(state, recruitment.heroId);
      const unlocked = heroRecruitmentUnlocked(state, recruitment.heroId);
      const chapterReady =
        state.currentChapter >= recruitment.requiredChapter;
      const prerequisite = recruitment.prerequisite
        ? HEROES[recruitment.prerequisite]
        : null;
      const status = completed
        ? "已结义"
        : unlocked
          ? "可接帖"
          : !chapterReady
            ? `第 ${recruitment.requiredChapter} 回开启`
            : prerequisite
              ? `需先结义${prerequisite.name}`
              : "尚未开放";
      return {
        id: `recruit-${recruitment.heroId}`,
        title: `${hero.name}${completed ? "已结义" : unlocked ? "来投" : "尚未开放"}`,
        meta: `${hero.nickname} · ${recruitment.location} · ${status}`,
        body: `${recruitment.rule.name} · ${recruitment.teaser}`,
        image: hero.cutout || hero.portrait,
        badge: completed ? "已录" : unlocked ? "接帖" : "未开",
        action: completed
          ? "quest-hero"
          : unlocked
            ? "start-hero-recruitment"
            : null,
        data: { hero: recruitment.heroId },
        disabled: !unlocked,
        tone: completed ? "primary" : unlocked ? "secondary" : "ghost",
      };
    });
  const questCards = (HERO_QUESTS[selectedId] || []).slice(0, 3).map((quest) => {
    const claimed = state.heroQuests?.claimed?.includes(quest.id);
    const unlocked = heroQuestUnlocked(state, quest.id);
    const complete = isHeroQuestComplete(state, quest.id);
    const progress = heroQuestProgress(state, quest.id);
    const target = Math.max(1, quest.objective.target);
    return {
      id: quest.id,
      title: quest.title,
      meta: `第${["一", "二", "三"][quest.stage - 1] || quest.stage}段 · ${quest.epithet}`,
      body: `${quest.objective.label} · ${claimed ? "已完成" : `${Math.min(progress, target)}/${target}`}`,
      icon: "scroll",
      badge: claimed ? "已录" : complete ? "领取" : `${progress}/${quest.objective.target}`,
      action:
        unlocked && complete && !claimed ? "claim-hero-quest" : null,
      data: unlocked && complete && !claimed ? { quest: quest.id } : {},
      progress: claimed ? 1 : Math.min(1, progress / target),
      tone: complete && !claimed ? "primary" : claimed ? "secondary" : "ghost",
    };
  });
  const legend = HERO_LEGENDS[selectedId];
  const legendUnlocked = heroLegendUnlocked(state, selectedId);
  const legendDone = heroLegendCompleted(state, selectedId);
  const legendCard = legend
    ? {
        id: `legend-${selectedId}`,
        title: legend.title,
        meta: `${legend.location} · ${legend.rule.name}`,
        body: legend.objective,
        objective: legend.objective,
        image: legend.bg,
        badge: legendDone ? "已录" : legendUnlocked ? "入阵" : "锁定",
        action:
          legendUnlocked && !legendDone ? "start-hero-legend" : null,
        data: legendUnlocked && !legendDone ? { hero: selectedId } : {},
        disabled: !legendUnlocked && !legendDone,
        tone: legendDone ? "primary" : legendUnlocked ? "secondary" : "ghost",
      }
    : null;
  const heroCards = HERO_ORDER.filter(
    (heroId) =>
      pathFilter === "all" || HEROES[heroId]?.path === pathFilter,
  ).map((heroId) => {
    const hero = HEROES[heroId];
    const unlocked = state.recruited.includes(heroId);
    const claimed = (HERO_QUESTS[heroId] || []).filter((quest) =>
      state.heroQuests?.claimed?.includes(quest.id),
    ).length;
    const latest = [...(HERO_QUESTS[heroId] || [])]
      .reverse()
      .find((quest) => state.heroQuests?.claimed?.includes(quest.id));
    return {
      id: `quest-hero-${heroId}`,
      title: unlocked ? hero.name : "未结义",
      meta: unlocked ? `${hero.star} · ${hero.nickname}` : "星位未明",
      body: unlocked ? `${claimed}/3 段 · ${latest?.epithet || hero.role}` : "继续推进战役",
      image: unlocked ? hero.cutout || hero.portrait : null,
      badge: unlocked ? (heroId === selectedId ? "当前" : `${claimed}/3`) : "锁定",
      action: unlocked ? "quest-hero" : "locked-hero",
      data: { hero: heroId },
      tone: heroId === selectedId ? "primary" : "ghost",
    };
  });
  const selectedClaimed = (HERO_QUESTS[selectedId] || []).filter((quest) =>
    state.heroQuests?.claimed?.includes(quest.id),
  ).length;
  const selectedScale = heroQuestMasteryScale(state, selectedId);
  return baseModel("quests", state, "quests", {
    hero: {
      ...heroBannerFromHero(state, selectedId, "江湖异闻"),
      subtitle: `${PATHS[selectedHero?.path]?.name || ""} · ${selectedClaimed}/3 段已录 · 全属性 +${((selectedScale - 1) * 100).toFixed(1)}%`,
    },
    actions: [
      action(
        "claim-all",
        `一键领取${claimable.length ? ` ${claimable.length}` : ""}`,
        "claim-all-hero-quests",
        {},
        {
          tone: "primary",
          icon: "scroll",
          disabled: !claimable.length,
        },
      ),
      action(
        "legend",
        legendDone ? "列传已录" : legend?.title || "群英列传",
        "start-hero-legend",
        { hero: selectedId },
        {
          tone: "secondary",
          icon: "swords",
          disabled: legendDone || !legend,
        },
      ),
      action("map", "行军图", "nav-map", {}, {
        tone: "ghost",
        icon: "map",
      }),
    ],
    tabs: QUEST_HERO_GROUPS.map((group) => ({
      id: group.id,
      label:
        group.id === "all"
          ? `全部 ${HERO_ORDER.length}`
          : `${group.name} ${
              HERO_ORDER.filter(
                (heroId) => HEROES[heroId]?.path === group.id,
              ).length
            }`,
      action: "filter-quest-path",
      data: { path: group.id },
      active: pathFilter === group.id,
    })),
    cards: [
      ...questCards,
      ...(legendCard ? [legendCard] : []),
      ...heroCards,
      ...recruitmentCards,
    ],
    columns: 3,
    detail: {
      selectedHeroId: selectedId,
      selectedHeroName: selectedHero?.name || "",
      pathFilter,
      claimable: claimable.length,
      claimed: selectedClaimed,
      totalClaimed: allQuests.filter((quest) =>
        state.heroQuests?.claimed?.includes(quest.id),
      ).length,
      totalQuests: allQuests.length,
      quests: questCards,
      heroCards,
      recruitments: recruitmentCards,
      legends: legendCard ? [legendCard] : [],
      legend: legendCard,
      legendUnlocked,
      legendCompleted: legendDone,
      masteryScale: selectedScale,
    },
    modal: modalModel(modal),
  });
}

export function buildCodexModel(context) {
  const {
    state,
    selectedCodexHero,
    codexArchives,
    modal,
  } = context;
  const selectedId = state.recruited.includes(selectedCodexHero)
    ? selectedCodexHero
    : state.recruited[0];
  const alignment = state.alignment || {};
  const totalAlignment = Math.max(
    1,
    Number(alignment.brotherhood || 0) +
      Number(alignment.order || 0) +
      Number(alignment.freedom || 0),
  );
  const unlockedEndings = new Set([
    ...(state.endingsUnlocked || []),
    ...(state.ending ? [state.ending] : []),
  ]);
  const mastery = state.heroMastery?.[selectedId] || { trials: [] };
  const doctrine = heroDoctrine(state, selectedId);
  const doctrineUnlocked = heroDoctrineUnlocked(state, selectedId);
  const archivedBonds = new Set(state.bondArchive || []);
  const archivedChains = new Set(state.chainArchive || []);
  const heroCards = HERO_ORDER.slice(0, 6).map((heroId) => {
    const hero = HEROES[heroId];
    const unlocked = state.recruited.includes(heroId);
    return {
      id: heroId,
      title: unlocked ? hero.name : "未结义",
      meta: unlocked ? `${hero.star} · ${hero.nickname}` : "星位未明",
      body: unlocked ? `${PATHS[hero.path]?.name || ""} · ${hero.role}` : "推进聚义后点亮",
      image: unlocked ? hero.cutout || hero.portrait : null,
      badge: unlocked ? (heroId === selectedId ? "当前" : "查看") : "锁定",
      action: unlocked ? "codex-hero" : "locked-hero",
      data: { hero: heroId },
      disabled: !unlocked,
      tone: heroId === selectedId ? "primary" : "ghost",
    };
  });
  const archiveCards = [
    {
      id: "alignment",
      title: alignmentSummary(state),
      meta: "梁山主势",
      body: `聚义 ${Math.round((alignment.brotherhood / totalAlignment) * 100)}% · 招安 ${Math.round((alignment.order / totalAlignment) * 100)}% · 归隐 ${Math.round((alignment.freedom / totalAlignment) * 100)}%`,
      icon: "star",
    },
    {
      id: "trials",
      title: `${mastery.trials?.length || 0}/${HERO_TRIALS.length} 星命试炼`,
      meta: HEROES[selectedId]?.name || "好汉",
      body: "每完成一项，全属性 +2%",
      icon: "star",
    },
    {
      id: "endings",
      title: `${unlockedEndings.size}/${Object.keys(ENDINGS).length} 结局`,
      meta: "终卷收录",
      body: `${state.bondArchive?.length || 0}/${Object.keys(HERO_BONDS).length} 兄弟契 · ${state.chainArchive?.length || 0}/${Object.keys(CHAIN_FORMATIONS).length} 合击`,
      icon: "scroll",
    },
    {
      id: "achievements",
      title: `${state.achievements?.length || 0}/${ACHIEVEMENTS.length} 战功`,
      meta: "梁山功簿",
      body: `演武最高第 ${state.arena?.bestWave || 0} 阵`,
      icon: "star",
    },
  ];
  const doctrineCards = Object.values(
    HERO_DOCTRINES[selectedId]?.paths || {},
  ).map((path) => ({
    id: `doctrine-${path.id}`,
    title: path.name,
    meta: doctrine?.id === path.id ? "当前命途" : "可切换",
    body: path.desc,
    badge: doctrineUnlocked ? "选定" : "试炼未满",
    action: "choose-doctrine",
    data: { hero: selectedId, doctrine: path.id },
    disabled: !doctrineUnlocked,
    tone: doctrine?.id === path.id ? "primary" : "ghost",
  }));
  const bondCards = Object.values(HERO_BONDS)
    .filter((bond) => !codexArchives || codexArchives.bonds)
    .map((bond) => ({
      id: `bond-${bond.id}`,
      title: bond.name,
      meta: `${bond.heroIds.map((heroId) => HEROES[heroId]?.name || "").join(" · ")}`,
      body: bond.desc,
      badge: archivedBonds.has(bond.id) ? "已录" : "未录",
      icon: bond.icon,
      tone: archivedBonds.has(bond.id) ? bond.tone : "ghost",
    }));
  const chainCards = Object.values(CHAIN_FORMATIONS)
    .filter((formation) => !codexArchives || codexArchives.chains)
    .map((formation) => ({
      id: `chain-${formation.id}`,
      title: formation.name,
      meta: `${formation.paths.join(" · ")}`,
      body: formation.desc,
      badge: archivedChains.has(formation.id) ? "已录" : "未录",
      icon: formation.icon,
      tone: archivedChains.has(formation.id) ? formation.tone : "ghost",
    }));
  return baseModel("codex", state, "codex", {
    hero: heroBannerFromHero(state, selectedId, "星命图谱"),
    actions: [
      action("chronicle", "翻阅列传", "open-hero-chronicle", { hero: selectedId }, {
        tone: "primary",
        icon: "scroll",
      }),
      action(
        "bonds",
        `兄弟契 ${archivedBonds.size}/${Object.keys(HERO_BONDS).length}`,
        "toggle-codex-archive",
        { archive: "bonds" },
        {
          tone: codexArchives?.bonds ? "primary" : "secondary",
          icon: "users",
        },
      ),
      action(
        "chains",
        `星命合击 ${archivedChains.size}/${Object.keys(CHAIN_FORMATIONS).length}`,
        "toggle-codex-archive",
        { archive: "chains" },
        {
          tone: codexArchives?.chains ? "primary" : "secondary",
          icon: "sparkles",
        },
      ),
      action("roster", "好汉名册", "nav-roster", {}, {
        tone: "secondary",
        icon: "roster",
      }),
    ],
    cards: [
      ...heroCards,
      ...archiveCards,
      ...doctrineCards,
      ...(codexArchives?.bonds ? bondCards : []),
      ...(codexArchives?.chains ? chainCards : []),
    ],
    columns: 3,
    detail: {
      selectedHeroId: selectedId,
      doctrineUnlocked,
      activeDoctrineId: doctrine?.id || null,
      doctrines: doctrineCards,
      archivedBondIds: [...archivedBonds],
      archivedChainIds: [...archivedChains],
      bonds: bondCards,
      chains: chainCards,
      achievements: ACHIEVEMENTS.map((achievement) => ({
        id: achievement.id,
        unlocked: state.achievements?.includes(achievement.id),
        progress: achievementProgress(state, achievement.id),
      })),
    },
    modal: modalModel(modal),
  });
}
