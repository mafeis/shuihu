import {
  ARENA_BOONS,
  ARENA_BOON_MASTERIES,
  ARENA_BOUNTIES,
  ARENA_ENCOUNTERS,
  ARENA_EVENTS,
  ARENA_MILESTONES,
  ARENA_RELICS,
  ARENA_SYNERGIES,
  HEROES,
  STAT_LABELS,
} from "../../data.js";
import {
  ARENA_TRIAL_LIMIT,
  ARENA_TRIALS,
  arenaTrialEffects,
  availableArenaTrials,
  sanitizeArenaTrialIds,
} from "../../arena-trials.js";
import { resolveArenaEncounter } from "../../arena-encounters.js";
import {
  arenaBuildSnapshot,
  nextArenaSynergy,
  planArenaAutoContinue,
  recommendArenaBoon,
} from "../../arena-run.js";
import {
  ARENA_WEEK_MARKS,
  getArenaWeekConfig,
} from "../../arena-week.js";
import { activeHeroes } from "../../state.js";
import {
  action,
  baseModel,
  modalModel,
} from "./common.js";

function resolveBoon(value) {
  const id = typeof value === "string" ? value : value?.id;
  return ARENA_BOONS[id] || null;
}

function boonIds(values = []) {
  return values
    .map(resolveBoon)
    .filter(Boolean)
    .map((boon) => boon.id);
}

function boonCard(value, actionName, options = {}) {
  const boon = resolveBoon(value);
  if (!boon) {
    return {
      id: "unknown-boon",
      title: "未识军令",
      meta: "演武军令",
      body: "这道军令已失效，请重新整军。",
      icon: "star",
      tone: "ghost",
      disabled: true,
    };
  }
  const count = options.counts?.[boon.id] || 0;
  const mastery = count >= 3 ? ARENA_BOON_MASTERIES[boon.id] : null;
  const remaining = Math.max(0, 3 - count);
  return {
    id: boon.id,
    title: boon.name,
    meta: `${boon.route}路 · ${
      count ? `已取 ${count} 重` : "初立此令"
    }${options.recommended ? " · 军师荐令" : ""}`,
    body: mastery
      ? `${boon.desc} 阵眼已成：${mastery.name}。`
      : count > 0
        ? `${boon.desc} 再取 ${remaining} 重，凝成${
            ARENA_BOON_MASTERIES[boon.id]?.name || "阵眼"
          }。`
        : boon.desc,
    action: actionName,
    data: { boon: boon.id },
    icon: boon.icon,
    tone: options.selected
      ? "primary"
      : options.recommended
        ? "secondary"
        : boon.tone === "cinnabar"
          ? "danger"
          : "ghost",
    disabled: Boolean(options.disabled),
    pressed: Boolean(options.selected),
    recommended: Boolean(options.recommended),
    badge: options.selected
      ? "已选"
      : options.recommended
        ? "军师荐令"
        : "",
  };
}

function encounterModel(encounter, wave, label) {
  if (!encounter) return null;
  return {
    id: encounter.id,
    name: encounter.name,
    label: label || `第 ${wave} 阵军势`,
    wave,
    tactic: encounter.tactic,
    description: encounter.desc,
    icon: encounter.icon,
    tone: encounter.tone,
    scorePct: encounter.scorePct || 0,
    scoreBonus: Math.round((encounter.scorePct || 0) * 100),
  };
}

function trialModel(state, selection) {
  const bestWave = state.arena?.bestWave || 0;
  const availableIds = new Set(
    availableArenaTrials(bestWave).map((trial) => trial.id),
  );
  const selectedIds = sanitizeArenaTrialIds(selection, {
    bestWave,
    limit: ARENA_TRIAL_LIMIT,
  });
  const effects = arenaTrialEffects(selectedIds);
  const cards = Object.values(ARENA_TRIALS).map((trial) => {
    const unlocked = availableIds.has(trial.id);
    const selected = selectedIds.includes(trial.id);
    const limitReached =
      selectedIds.length >= ARENA_TRIAL_LIMIT && !selected;
    return {
      id: `trial-${trial.id}`,
      title: trial.name,
      meta: unlocked
        ? `星劫 · ${selected ? "已启用" : "待启用"} · ${trial.reward}`
        : `最高第 ${trial.unlockWave} 阵解锁`,
      body: `${trial.risk}。${trial.desc}`,
      icon: unlocked ? trial.icon : "lock-keyhole",
      tone: selected ? "primary" : trial.tone,
      action:
        unlocked && !limitReached ? "toggle-arena-trial" : null,
      data: { trial: trial.id },
      disabled: !unlocked || limitReached,
      pressed: selected,
      selected,
      unlocked,
      limitReached,
      risk: trial.risk,
      reward: trial.reward,
      description: trial.desc,
      badge: selected ? "已启用" : unlocked ? "可选" : "未解锁",
    };
  });
  return {
    bestWave,
    limit: ARENA_TRIAL_LIMIT,
    available: availableIds.size,
    selectedCount: selectedIds.length,
    selectedIds,
    cards,
    unlocked: cards.filter((trial) => trial.unlocked).length,
    selected: cards.filter((trial) => trial.selected).length,
    capped:
      selectedIds.length >= ARENA_TRIAL_LIMIT
        ? cards.find(
            (trial) => trial.unlocked && !trial.selected,
          )?.id || null
        : null,
    effects: {
      count: effects.count,
      scorePct: effects.scorePct,
      copperPct: effects.copperPct,
      xpPct: effects.xpPct,
      scoreBonus: Math.round(effects.scorePct * 100),
      copperBonus: Math.round(effects.copperPct * 100),
      xpBonus: Math.round(effects.xpPct * 100),
    },
    record: {
      bestWave: state.arena?.starTrials?.bestWave || 0,
      bestScore: state.arena?.starTrials?.bestScore || 0,
      maxSelected: state.arena?.starTrials?.maxSelected || 0,
      runs: state.arena?.starTrials?.runs || 0,
    },
  };
}

function weeklyModel(state, mode) {
  const weekly = state.arena?.weekly || {};
  const weekKey = weekly.weekKey || getArenaWeekConfig().key;
  const config = getArenaWeekConfig(weekKey);
  const marks = ARENA_WEEK_MARKS.map((mark) => ({
    ...mark,
    reached: Boolean(weekly.marks?.includes(mark.id)),
  }));
  const nextMark = marks.find((mark) => !mark.reached) || null;
  return {
    mode,
    active: mode === "weekly",
    key: config.key,
    range: config.label,
    rule: {
      id: config.rule.id,
      name: config.rule.name,
      description: config.rule.desc,
      icon: config.rule.icon,
      tone: config.rule.tone,
    },
    boonPool: config.boonPool
      .map((id) => ARENA_BOONS[id])
      .filter(Boolean),
    bountyPool: config.bountyPool
      .map((id) => ARENA_BOUNTIES.find((bounty) => bounty.id === id))
      .filter(Boolean),
    bestScore: weekly.bestScore || 0,
    bestWave: weekly.bestWave || 0,
    runs: weekly.runs || 0,
    marks,
    nextMark,
    progress: nextMark
      ? Math.min(1, (weekly.bestScore || 0) / nextMark.score)
      : 1,
    history: Array.isArray(weekly.history) ? weekly.history : [],
  };
}

function trialStrip(trialState) {
  return {
    count: trialState.selectedCount,
    label:
      trialState.selectedCount > 0
        ? `星劫 ${trialState.selectedCount} 道`
        : "未携星劫",
    trials: trialState.cards.filter((trial) => trial.selected),
    text: trialState.selectedCount
      ? `星劫 ${trialState.selectedCount} 道 · 军功 +${trialState.effects.scoreBonus}% · 铜钱 +${trialState.effects.copperBonus}% · 历练 +${trialState.effects.xpBonus}%`
      : "",
  };
}

function buildModel(boons = []) {
  const ids = boonIds(boons);
  const build = arenaBuildSnapshot(ids);
  const next = nextArenaSynergy(ids);
  return {
    boons: ids,
    counts: build.counts,
    masteries: build.masteries.map(({ boonId, count, mastery }) => ({
      boonId,
      count,
      name: mastery.name,
      description: mastery.desc,
      icon: mastery.icon,
      tone: mastery.tone,
    })),
    synergies: build.synergies.map((synergy) => ({
      id: synergy.id,
      name: synergy.name,
      description: synergy.desc,
      icon: synergy.icon,
      tone: synergy.tone,
      requirements: synergy.requires,
    })),
    activeCount: build.masteries.length + build.synergies.length,
    nextFormation: next
      ? {
          id: next.synergy.id,
          label: "下一阵",
          name: next.synergy.name,
          description: next.synergy.desc,
          missing: next.missingTotal,
          requirements: next.requirements.map((requirement) => ({
            ...requirement,
            name:
              ARENA_BOONS[requirement.boonId]?.name ||
              requirement.boonId,
          })),
        }
      : null,
  };
}

function bountyModel(bounty) {
  if (!bounty) return null;
  return {
    id: bounty.id,
    name: bounty.name,
    description: bounty.desc,
    icon: bounty.icon,
    tone: bounty.tone,
    copper: bounty.copper,
    score: bounty.score,
  };
}

function relicsModel(state) {
  const activeIds = new Set(state.arena?.relics || []);
  const active = [...activeIds]
    .map((id) => ARENA_RELICS[id])
    .filter(Boolean);
  const milestones = ARENA_MILESTONES.map((milestone) => {
    const relic = ARENA_RELICS[milestone.relicId];
    return {
      ...milestone,
      name: relic?.name || "",
      description: relic?.desc || "",
      icon: relic?.icon || "lock-keyhole",
      tone: relic?.tone || "ghost",
      active: activeIds.has(milestone.relicId),
      reached: (state.arena?.bestWave || 0) >= milestone.wave,
    };
  });
  return {
    active,
    activeIds: active.map((relic) => relic.id),
    milestones,
    next: milestones.find((milestone) => !milestone.active) || null,
  };
}

function discoveriesModel(state) {
  const discoveries = state.arena?.discoveries || {};
  const masteryIds = new Set(discoveries.masteries || []);
  const synergyIds = new Set(discoveries.synergies || []);
  const encounterIds = new Set(discoveries.encounters || []);
  const masteries = Object.values(ARENA_BOON_MASTERIES).map((mastery) => ({
    id: mastery.id,
    title: mastery.name,
    description: mastery.desc,
    icon: mastery.icon,
    tone: mastery.tone,
    found: masteryIds.has(mastery.id),
  }));
  const synergies = Object.values(ARENA_SYNERGIES).map((synergy) => ({
    id: synergy.id,
    title: synergy.name,
    description: synergy.desc,
    icon: synergy.icon,
    tone: synergy.tone,
    found: synergyIds.has(synergy.id),
  }));
  const encounters = Object.values(ARENA_ENCOUNTERS).map((encounter) => ({
    id: encounter.id,
    title: encounter.name,
    description: encounter.desc,
    tactic: encounter.tactic,
    icon: encounter.icon,
    tone: encounter.tone,
    found: encounterIds.has(encounter.id),
  }));
  return {
    masteries,
    synergies,
    encounters,
    total: masteries.length + synergies.length + encounters.length,
    found:
      masteries.filter((entry) => entry.found).length +
      synergies.filter((entry) => entry.found).length +
      encounters.filter((entry) => entry.found).length,
  };
}

function battleReportModel(arenaRun, state) {
  const report = arenaRun?.lastPerformance;
  if (!report) return null;
  const mvp = HEROES[report.mvpHeroId] || null;
  return {
    grade: report.grade,
    bonusScore: report.bonusScore,
    rounds: report.rounds,
    survivors: report.survivors,
    heroCount: report.heroCount,
    mvpHeroId: report.mvpHeroId,
    mvpName: mvp?.name || "全阵同心",
    mvpDamage: report.mvpDamage,
    mvpKills: report.mvpKills,
    mvpUltimates: report.mvpUltimates,
    objectives: report.objectives || [],
    wave: arenaRun.completedWave,
    label: `第 ${arenaRun.completedWave} 阵战报 · ${report.rounds} 回合`,
    copy: `${report.survivors}/${report.heroCount} 人尚立阵中 · ${report.mvpKills} 次破敌 · 星命绝技 ${report.mvpUltimates} 次`,
    bestScore: state.arena?.bestScore || 0,
  };
}

function eventCard(event, selected) {
  return {
    id: event.id,
    title: event.name,
    meta: "军中奇遇",
    body: event.desc,
    icon: event.icon,
    tone: selected ? "primary" : event.tone,
    badge: selected ? "已定" : "定下此策",
    action: "choose-arena-event",
    data: { event: event.id },
    selected,
    pressed: selected,
  };
}

export function buildArenaModel(context) {
  const {
    state,
    arenaRun,
    arenaMode,
    arenaDraftBoons,
    arenaDraftSeed,
    selectedArenaBoon,
    arenaTrialSelection,
    modal,
  } = context;
  const unlocked = state.recruited.length >= 2;
  const active = Boolean(arenaRun);
  const mode = arenaRun?.mode || arenaMode || "endless";
  const boons = active ? arenaRun.boons || [] : arenaDraftBoons || [];
  const build = buildModel(boons);
  const trialState = trialModel(state, arenaTrialSelection);
  const week = weeklyModel(state, mode);
  const recommendation = active
    ? null
    : recommendArenaBoon([], boonIds(arenaDraftBoons));
  const encounter = active
    ? resolveArenaEncounter(
        arenaRun,
        arenaRun.wave,
        arenaRun.encounterId,
      )
    : resolveArenaEncounter(
        {
          mode,
          seed:
            mode === "weekly" ? week.key : arenaDraftSeed || 0,
          encounterId: "",
        },
        1,
        "",
      );
  const currentBounty = bountyModel(
    ARENA_BOUNTIES.find(
      (bounty) => bounty.id === arenaRun?.currentBounty,
    ),
  );
  const openingBoonCards = boonIds(arenaDraftBoons).map((boonId) =>
    boonCard(boonId, "select-arena-boon", {
      selected: selectedArenaBoon === boonId,
      recommended: recommendation?.boonId === boonId,
      counts: build.counts,
    }),
  );
  const activeBoonCards = boonIds(boons).map((boonId) =>
    boonCard(boonId, "resume-arena", { counts: build.counts }),
  );
  let cards;
  if (!unlocked) {
    cards = [
      {
        id: "locked",
        title: "尚缺同行之人",
        meta: "至少两位好汉结义",
        body: "完成前回并接纳新兄弟后开启演武。",
        icon: "roster",
        action: "nav-map",
        data: {},
        tone: "secondary",
      },
    ];
  } else if (active) {
    cards = [
      {
        id: "run",
        title: `${mode === "weekly" ? "周令" : "演武"} · 第 ${arenaRun.wave} 阵`,
        meta: `军功 ${arenaRun.score || 0} · ${
          boonIds(boons).length
        } 重军令`,
        body: arenaRun.pendingBoons?.length
          ? "上一阵已破，先择下一道军令。"
          : "生命、军令与悬赏均已写入存档。",
        icon: "swords",
        tone: "primary",
        action: "resume-arena",
        data: {},
      },
      ...activeBoonCards,
    ];
  } else {
    cards = [
      ...trialState.cards,
      ...openingBoonCards,
      {
        id: "roster",
        title: "调整三阵",
        meta: "先编成，再出阵",
        body: "阵位决定受击权重与义气节奏。",
        icon: "roster",
        action: "nav-roster",
        data: {},
      },
    ];
  }
  const startDisabled = active || !selectedArenaBoon || !unlocked;
  const actions = [
    active
      ? action(
          "resume",
          arenaRun.pendingBoons?.length ? "择取军令" : "再入战阵",
          "resume-arena",
          {},
          { tone: "primary", icon: "play" },
        )
      : action("start", "立令出阵", "start-arena", {}, {
          tone: "primary",
          icon: "swords",
          disabled: startDisabled,
        }),
    active
      ? action("retire", "收束本轮", "retire-arena", {}, {
          tone: "ghost",
          icon: "back",
        })
      : action(
          "auto",
          state.settings.autoArena ? "自动续阵中" : "自动续阵",
          "toggle-arena-auto",
          {},
          {
            tone: state.settings.autoArena
              ? "secondary"
              : "ghost",
            icon: "play",
          },
        ),
    action("roster", "调整三阵", "nav-roster", {}, {
      tone: "ghost",
      icon: "roster",
    }),
    action("map", "行军图", "nav-map", {}, {
      tone: "ghost",
      icon: "map",
    }),
  ];
  if (!active) {
    actions[1].pressed = Boolean(state.settings.autoArena);
  }
  return baseModel("arena", state, "arena", {
    background: "/assets/environments/liangshan_water_fort.png",
    hero: {
      image: "/assets/environments/liangshan_water_fort.png",
      eyebrow: "无尽围剿 · 星命演武",
      title: active
        ? `${mode === "weekly" ? "本周军令" : "演武"} · 第 ${
            arenaRun.wave
          } 阵`
        : "梁山演武",
      subtitle: active
        ? `军功 ${arenaRun.score || 0} · ${
            boonIds(boons).length
          } 重军令`
        : `最高第 ${state.arena?.bestWave || 0} 阵 · 最高军功 ${
            state.arena?.bestScore || 0
          }`,
      body: active
        ? "当前阵、生命、军令与悬赏均已写入存档。"
        : "自由构筑冲击最高波次，或按本周固定军令与悬赏争夺周印。",
    },
    actions,
    tabs: [
      {
        id: "endless",
        label: "无尽演武",
        action: "select-arena-mode",
        data: { mode: "endless" },
        active: mode === "endless",
        pressed: mode === "endless",
      },
      {
        id: "weekly",
        label: "本周军令",
        action: "select-arena-mode",
        data: { mode: "weekly" },
        active: mode === "weekly",
        pressed: mode === "weekly",
      },
    ],
    cards,
    columns: 2,
    modal: modalModel(modal),
    detail: {
      unlocked,
      active,
      mode,
      modes: [
        {
          id: "endless",
          title: "无尽演武",
          description: "自由构筑，冲击最高波次。",
          active: mode === "endless",
        },
        {
          id: "weekly",
          title: "本周军令",
          description: "固定牌池与周印，周一 UTC 换令。",
          active: mode === "weekly",
        },
      ],
      trials: {
        ...trialState,
        selectedCards: trialState.cards.filter(
          (trial) => trial.selected,
        ),
      },
      trialStrip: trialStrip(trialState),
      week,
      encounter,
      encounterPreview: encounterModel(
        encounter,
        active ? arenaRun.wave : 1,
        active ? "本阵军势" : "首阵军势",
      ),
      record: {
        bestWave: state.arena?.bestWave || 0,
        bestScore: state.arena?.bestScore || 0,
        totalBounties: state.arena?.totalBounties || 0,
        totalRuns: state.arena?.totalRuns || 0,
      },
      team: activeHeroes(state).map(({ heroId, entry, row, stats }) => ({
        heroId,
        name: HEROES[heroId]?.name || heroId,
        level: entry?.level || 1,
        row,
        image:
          HEROES[heroId]?.cutout ||
          HEROES[heroId]?.portrait ||
          null,
        stats: Object.entries(stats || {})
          .slice(0, 2)
          .map(([key, value]) => ({
            id: key,
            label: STAT_LABELS[key] || key,
            value,
          })),
      })),
      openingBoons: openingBoonCards,
      recommendation,
      build,
      currentBounty,
      relics: relicsModel(state),
      discoveries: discoveriesModel(state),
      settings: {
        autoArena: Boolean(state.settings.autoArena),
      },
      start: {
        disabled: startDisabled,
        label: trialState.selectedCount
          ? `携 ${trialState.selectedCount} 道星劫出阵`
          : mode === "weekly"
            ? "接下本周军令，迎第一阵"
            : "立下军令，迎第一阵",
      },
    },
  });
}

export function buildArenaRewardModel(context) {
  const {
    state,
    arenaRun,
    arenaRewardChoices,
    lastMasteryUnlocks,
    lastBondUnlocks,
    lastChainUnlocks,
    lastAchievementUnlocks,
    modal,
  } = context;
  if (!arenaRun) {
    return baseModel("arena", state, "arena", {
      modal: modalModel(modal),
    });
  }
  const trialState = trialModel(state, arenaRun.trialIds);
  const build = buildModel(arenaRun.boons || []);
  const eventOffers = (arenaRun.eventOffer || [])
    .map((eventId) => ARENA_EVENTS[eventId])
    .filter(Boolean);
  const eventPending =
    eventOffers.length > 0 && !arenaRun.selectedEvent;
  const recommendation = recommendArenaBoon(
    arenaRun.boons || [],
    boonIds(arenaRewardChoices),
  );
  const autoPlan = planArenaAutoContinue(
    arenaRun,
    arenaRewardChoices,
  );
  const autoPaused =
    state.settings.autoArena && autoPlan.action === "pause";
  const canReroll =
    !eventPending &&
    !arenaRun.rerollUsed &&
    arenaRewardChoices.length > 0;
  const lastEncounterDefinition =
    ARENA_ENCOUNTERS[arenaRun.encounterId];
  const nextEncounter = resolveArenaEncounter(
    arenaRun,
    arenaRun.wave,
    arenaRun.encounterId,
  );
  const rewardBoonCards = arenaRewardChoices.map((boon) => {
    const id = typeof boon === "string" ? boon : boon?.id;
    return boonCard(id, "choose-arena-reward", {
      disabled: eventPending,
      recommended: recommendation?.boonId === id,
      selected: false,
      counts: build.counts,
    });
  });
  const eventCards = eventOffers.map((event) =>
    eventCard(event, arenaRun.selectedEvent === event.id),
  );
  const lastBountyDefinition = ARENA_BOUNTIES.find(
    (bounty) => bounty.id === arenaRun.lastBounty?.id,
  );
  const lastBounty = bountyModel(lastBountyDefinition);
  if (lastBounty) {
    lastBounty.cleared = Boolean(arenaRun.lastBounty?.cleared);
    lastBounty.copper = arenaRun.lastBounty?.copper || 0;
    lastBounty.score = arenaRun.lastBounty?.score || 0;
  }
  const lastEncounter = encounterModel(
    lastEncounterDefinition,
    arenaRun.completedWave || arenaRun.wave,
    "本阵军势",
  );
  const nextEncounterModel = encounterModel(
    nextEncounter,
    arenaRun.wave,
    "下一阵军势",
  );
  const report = battleReportModel(arenaRun, state);
  const week = weeklyModel(state, arenaRun.mode);
  const lastWeeklyMarks = (arenaRun.lastWeeklyMarks || [])
    .map((markId) =>
      week.marks.find((mark) => mark.id === markId),
    )
    .filter(Boolean);
  const relicUnlocks = (arenaRun.lastUnlocks || [])
    .map(({ relicId, wave }) => {
      const relic = ARENA_RELICS[relicId];
      return relic
        ? {
            id: relic.id,
            title: relic.name,
            description: relic.desc,
            icon: relic.icon,
            tone: relic.tone,
            wave,
          }
        : null;
    })
    .filter(Boolean);
  const lastDiscoveries = {
    masteries: (arenaRun.lastDiscoveries?.masteries || [])
      .map((id) => ARENA_BOON_MASTERIES[id])
      .filter(Boolean),
    synergies: (arenaRun.lastDiscoveries?.synergies || [])
      .map((id) => ARENA_SYNERGIES[id])
      .filter(Boolean),
    encounters: (arenaRun.lastDiscoveries?.encounters || [])
      .map((id) => ARENA_ENCOUNTERS[id])
      .filter(Boolean),
  };
  const summary = [
    { label: "当前波次", value: arenaRun.wave },
    { label: "本轮军功", value: arenaRun.score || 0 },
    {
      label: "已得军令",
      value: (arenaRun.boons || []).length,
    },
    { label: "最高军功", value: state.arena?.bestScore || 0 },
  ];
  const actions = [
    action(
      "advice",
      "采纳军师建议",
      "follow-arena-advice",
      { boon: recommendation?.boonId || "" },
      {
        tone: "primary",
        icon: "star",
        disabled: eventPending || !recommendation,
      },
    ),
    action(
      "reroll",
      arenaRun.rerollUsed ? "已变阵" : "军师变阵",
      "reroll-arena-boons",
      {},
      {
        tone: "ghost",
        icon: "star",
        disabled: !canReroll,
      },
    ),
    action(
      "auto",
      autoPaused
        ? "奇遇待决"
        : state.settings.autoArena
          ? "自动续阵中"
          : "自动续阵",
      "toggle-arena-auto",
      {},
      {
        tone: state.settings.autoArena
          ? "secondary"
          : "ghost",
        icon: "play",
      },
    ),
    action("retire", "收束本轮", "retire-arena", {}, {
      tone: "ghost",
      icon: "back",
    }),
  ];
  actions[2].pressed = Boolean(state.settings.autoArena);
  return baseModel("arena-reward", state, "arena", {
    background: "/assets/environments/liangshan_water_fort.png",
    header: {
      title: `演武 · 第 ${arenaRun.wave} 阵`,
      back: action("back-arena", "返回演武", "nav-arena", {}, {
        tone: "ghost",
        icon: "back",
      }),
      stats: [
        { label: "本阵", value: arenaRun.completedWave || 0 },
        { label: "军功", value: arenaRun.score || 0 },
        {
          label: "军令",
          value: (arenaRun.boons || []).length,
        },
        {
          label: "悬赏",
          value: arenaRun.lastBounty?.cleared ? "达成" : "未成",
        },
      ],
    },
    hero: {
      image: "/assets/environments/liangshan_water_fort.png",
      eyebrow: `第 ${
        arenaRun.completedWave || arenaRun.wave
      } 阵已破`,
      title: eventOffers.length ? "阵后整军" : "再择一道军令",
      subtitle: `铜钱 +${arenaRun.lastReward?.copper || 0} · 历练 +${
        arenaRun.lastReward?.xp || 0
      } · 军功 +${arenaRun.lastReward?.score || 0}`,
      body:
        "阵后收益已经入账。选择军令或处理军中奇遇后，再入下一阵。",
    },
    actions,
    cards: eventPending ? eventCards : rewardBoonCards,
    columns: 2,
    modal: modalModel(modal),
    detail: {
      wave: arenaRun.wave,
      completedWave: arenaRun.completedWave || 0,
      isWeekly: arenaRun.mode === "weekly",
      summary,
      reward: arenaRun.lastReward || {
        copper: 0,
        xp: 0,
        score: 0,
      },
      trialStrip: trialStrip(trialState),
      trials: trialState,
      battleReport: report,
      lastEncounter,
      nextEncounter: nextEncounterModel,
      bounty: lastBounty,
      week,
      lastWeeklyMarks,
      build,
      relics: relicUnlocks,
      masteryUnlocks: lastMasteryUnlocks || [],
      bondUnlocks: lastBondUnlocks || [],
      chainUnlocks: lastChainUnlocks || [],
      achievementUnlocks: lastAchievementUnlocks || [],
      discoveries: lastDiscoveries,
      archiveDiscoveries: discoveriesModel(state),
      recommendation,
      recommendationCount: recommendation ? 1 : 0,
      auto: {
        enabled: Boolean(state.settings.autoArena),
        paused: autoPaused,
        action: autoPlan.action,
        reason: autoPlan.reason,
        boonId: autoPlan.boonId || null,
        label: autoPaused
          ? "奇遇待决"
          : state.settings.autoArena
            ? "自动续阵中"
            : "自动续阵",
      },
      reroll: {
        used: Boolean(arenaRun.rerollUsed),
        canReroll,
      },
      eventPending,
      eventChoices: eventCards,
      rewardChoices: rewardBoonCards,
    },
  });
}
