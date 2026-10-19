import {
  ACHIEVEMENTS,
  AUTO_BATTLE_TACTICS,
  ARENA_BOONS,
  ARENA_BOON_MASTERIES,
  ARENA_BOUNTIES,
  ARENA_ENCOUNTERS,
  ARENA_EVENTS,
  ARENA_RELICS,
  ARENA_SYNERGIES,
  CHAPTERS,
  CHAIN_FORMATIONS,
  DIFFICULTIES,
  EQUIPMENT,
  FACILITIES,
  HERO_BONDS,
  HERO_DOCTRINES,
  HERO_LEGENDS,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HEROES,
  HERO_ORDER,
  HERO_TRIALS,
} from "./data.js";
import { ARENA_WEEK_MARKS, getIsoWeekKey } from "./arena-week.js";
import { sanitizeArenaTrialIds } from "./arena-trials.js";
import {
  CHAPTER_TACTIC_IDS,
  getChapterTactic,
} from "./chapter-tactics.js";

export const SAVE_KEY = "xingming-shuihu-save-v1";
export const SAVE_BACKUP_KEY = `${SAVE_KEY}-backup`;
export const SAVE_VERSION = 26;

const HERO_QUEST_LIST = Object.values(HERO_QUESTS).flat();
const HERO_QUEST_IDS = new Set(HERO_QUEST_LIST.map((quest) => quest.id));
const HERO_LEGEND_IDS = new Set(
  Object.values(HERO_LEGENDS).map((legend) => legend.id),
);

export const CHAPTER_MEDALS = [
  {
    id: "unbroken",
    name: "全阵而归",
    desc: "无人倒下",
    icon: "shield-check",
  },
  {
    id: "star_combo",
    name: "星命同辉",
    desc: "发动一次星命合击",
    icon: "sparkles",
  },
  {
    id: "swift",
    name: "兵贵神速",
    desc: "在限定回合内取胜",
    icon: "timer",
  },
];

const DEFAULT_EQUIPMENT = {
  linchong: {
    weapon: "worn_spear",
    armor: "lamellar_vest",
    token: "crimson_tassel",
  },
  luzhishen: {
    weapon: "iron_staff",
    armor: "monk_robe",
    token: "imperial_seal",
  },
  wusong: {
    weapon: "ring_saber",
    armor: "patrol_armor",
    token: "tiger_tooth",
  },
  daizong: {
    weapon: "dispatch_blade",
    armor: "scout_boots",
    token: "courier_token",
  },
  andaoquan: {
    weapon: "needle_case",
    armor: "physician_robe",
    token: "herb_satchel",
  },
  shiqian: {
    weapon: "climbing_hook",
    armor: "night_cloth",
    token: "lockpick_roll",
  },
  likui: {
    weapon: "black_axe_pair",
    armor: "blood_tunic",
    token: "ox_head_belt",
  },
  huarong: {
    weapon: "horn_bow",
    armor: "feather_scale",
    token: "hawk_tassel",
  },
  songjiang: {
    weapon: "righteous_polearm",
    armor: "timely_cloak",
    token: "liangshan_banner",
  },
  husanniang: {
    weapon: "sun_moon_blades",
    armor: "red_brocade_armor",
    token: "crimson_lasso",
  },
  wuyong: {
    weapon: "strategist_chain",
    armor: "crane_cloak",
    token: "wisdom_fan",
  },
  yanqing: {
    weapon: "wanderer_spear",
    armor: "swallow_armor",
    token: "wrestling_belt",
  },
  yangzhi: {
    weapon: "blueface_spear",
    armor: "convoy_armor",
    token: "convoy_seal",
  },
  gongsunsheng: {
    weapon: "pine_sword",
    armor: "cloud_robe",
    token: "thunder_seal",
  },
  lujunyi: {
    weapon: "qilin_spear",
    armor: "jade_lamellar",
    token: "hebei_jade",
  },
  zhangshun: {
    weapon: "water_trident",
    armor: "fish_scale_suit",
    token: "river_token",
  },
  shijin: {
    weapon: "nine_dragon_spear",
    armor: "embroidered_vest",
    token: "dragon_sash",
  },
  qinming: {
    weapon: "wolf_tooth_mace",
    armor: "black_iron_armor",
    token: "thunder_brace",
  },
  chaiin: {
    weapon: "folding_fan",
    armor: "noble_robe",
    token: "golden_leaf",
  },
  guansheng: {
    weapon: "green_dragon_blade",
    armor: "green_lamellar",
    token: "war_seal",
  },
  zhangqing: {
    weapon: "feishi_sling",
    armor: "qing_rider_armor",
    token: "stone_pouch",
  },
  xuning: {
    weapon: "hook_sickle_spear",
    armor: "goose_feather_armor",
    token: "imperial_drill_token",
  },
  lijun: {
    weapon: "river_dragon_fork",
    armor: "fish_scale_suit",
    token: "river_token",
  },
  ruanxiaoqi: {
    weapon: "reed_short_blades",
    armor: "night_cloth",
    token: "bamboo_token",
  },
  sunerniang: {
    weapon: "ogress_cleaver",
    armor: "physician_robe",
    token: "herb_satchel",
  },
  gudashao: {
    weapon: "tigress_door_bar",
    armor: "patrol_armor",
    token: "bamboo_token",
  },
  lingzhen: {
    weapon: "signal_rocket_tube",
    armor: "black_iron_armor",
    token: "thunder_brace",
  },
  huyanzhuo: {
    weapon: "chain_whip_pair",
    armor: "green_lamellar",
    token: "imperial_seal",
  },
  yangxiong: {
    weapon: "jizhou_falchion",
    armor: "prison_scale_armor",
    token: "warden_writ",
  },
  shixiu: {
    weapon: "desperate_saber",
    armor: "rooftop_jacket",
    token: "rope_dart",
  },
  sunli: {
    weapon: "sick_yuchi_polearm",
    armor: "dengzhou_lamellar",
    token: "garrison_whip",
  },
  yuehe: {
    weapon: "iron_flute",
    armor: "river_tune_coat",
    token: "dengzhou_bell_charm",
  },
  xiaorang: {
    weapon: "sacred_brush",
    armor: "ink_robe",
    token: "copy_seal",
  },
  jiangjing: {
    weapon: "iron_abacus",
    armor: "quartermaster_coat",
    token: "liangshan_grand_ledger",
  },
};

export function xpForNext(level) {
  return 90 + level * 70;
}

export function createRosterEntry(heroId) {
  return {
    level: 1,
    xp: 0,
    equipment: { ...DEFAULT_EQUIPMENT[heroId] },
  };
}

function sanitizeArenaRun(run) {
  if (!run || typeof run !== "object") return null;
  const boons = Array.isArray(run.boons)
    ? run.boons.filter((boonId) => ARENA_BOONS[boonId])
    : [];
  if (!boons.length) return null;
  const wave = Math.max(1, Math.trunc(Number(run.wave) || 1));
  const healthRatios =
    run.healthRatios && typeof run.healthRatios === "object"
      ? Object.fromEntries(
          Object.entries(run.healthRatios)
            .map(([heroId, ratio]) => [heroId, Number(ratio)])
            .filter(([, ratio]) => Number.isFinite(ratio))
            .map(([heroId, ratio]) => [heroId, Math.max(0, Math.min(1, ratio))]),
        )
      : {};
  const currentBounty = ARENA_BOUNTIES.some(
    (bounty) => bounty.id === run.currentBounty,
  )
    ? run.currentBounty
    : null;
  const lastBounty = ARENA_BOUNTIES.some(
    (bounty) => bounty.id === run.lastBounty?.id,
  )
    ? {
        id: run.lastBounty.id,
        cleared: Boolean(run.lastBounty.cleared),
        copper: Math.max(0, Math.trunc(Number(run.lastBounty.copper) || 0)),
        score: Math.max(0, Math.trunc(Number(run.lastBounty.score) || 0)),
      }
    : null;
  const pendingBoons = Array.isArray(run.pendingBoons)
    ? run.pendingBoons.filter((boonId) => ARENA_BOONS[boonId])
    : [];
  const eventOffer = Array.isArray(run.eventOffer)
    ? [...new Set(run.eventOffer.filter((eventId) => ARENA_EVENTS[eventId]))]
    : [];
  const selectedEvent = eventOffer.includes(run.selectedEvent)
    ? run.selectedEvent
    : null;
  const lastEvent = ARENA_EVENTS[run.lastEvent] ? run.lastEvent : null;
  const lastUnlocks = Array.isArray(run.lastUnlocks)
    ? run.lastUnlocks
        .filter(
          (entry) =>
            entry &&
            ARENA_RELICS[entry.relicId] &&
            Number.isFinite(Number(entry.wave)),
        )
        .map((entry) => ({
          relicId: entry.relicId,
          wave: Math.max(1, Math.trunc(Number(entry.wave))),
        }))
    : [];
  const lastDiscoveries = {
    masteries: Array.isArray(run.lastDiscoveries?.masteries)
      ? run.lastDiscoveries.masteries.filter(
          (boonId) => ARENA_BOON_MASTERIES[boonId],
        )
      : [],
    synergies: Array.isArray(run.lastDiscoveries?.synergies)
      ? run.lastDiscoveries.synergies.filter(
          (synergyId) => ARENA_SYNERGIES[synergyId],
        )
      : [],
    encounters: Array.isArray(run.lastDiscoveries?.encounters)
      ? run.lastDiscoveries.encounters.filter(
          (encounterId) => ARENA_ENCOUNTERS[encounterId],
        )
      : [],
  };
  const lastWeeklyMarks = Array.isArray(run.lastWeeklyMarks)
    ? run.lastWeeklyMarks.filter((markId) =>
        ARENA_WEEK_MARKS.some((mark) => mark.id === markId),
      )
    : [];
  const lastPerformance =
    run.lastPerformance && typeof run.lastPerformance === "object"
      ? {
          grade: ["S", "A", "B"].includes(run.lastPerformance.grade)
            ? run.lastPerformance.grade
            : "B",
          bonusScore: Math.max(
            0,
            Math.trunc(Number(run.lastPerformance.bonusScore) || 0),
          ),
          rounds: Math.max(
            1,
            Math.trunc(Number(run.lastPerformance.rounds) || 1),
          ),
          survivors: Math.max(
            0,
            Math.trunc(Number(run.lastPerformance.survivors) || 0),
          ),
          heroCount: Math.max(
            0,
            Math.trunc(Number(run.lastPerformance.heroCount) || 0),
          ),
          mvpHeroId: HEROES[run.lastPerformance.mvpHeroId]
            ? run.lastPerformance.mvpHeroId
            : null,
          mvpDamage: Math.max(
            0,
            Math.trunc(Number(run.lastPerformance.mvpDamage) || 0),
          ),
          mvpKills: Math.max(
            0,
            Math.trunc(Number(run.lastPerformance.mvpKills) || 0),
          ),
          mvpUltimates: Math.max(
            0,
            Math.trunc(Number(run.lastPerformance.mvpUltimates) || 0),
          ),
          objectives: Array.isArray(run.lastPerformance.objectives)
            ? run.lastPerformance.objectives
                .filter(
                  (objective) =>
                    objective &&
                    ["unbroken", "swift", "bounty", "chain"].includes(
                      objective.id,
                    ),
                )
                .map((objective) => ({
                  id: objective.id,
                  label: String(objective.label || ""),
                  met: Boolean(objective.met),
                }))
            : [],
        }
      : null;
  const trialIds = sanitizeArenaTrialIds(run.trialIds);
  return {
    mode: run.mode === "weekly" ? "weekly" : "endless",
    weekKey:
      run.mode === "weekly" && /^\d{4}-W\d{2}$/.test(run.weekKey || "")
        ? run.weekKey
        : null,
    seed: Number.isFinite(Number(run.seed))
      ? Math.max(0, Math.trunc(Number(run.seed)))
      : null,
    encounterId: ARENA_ENCOUNTERS[run.encounterId]
      ? run.encounterId
      : null,
    wave,
    boons,
    pendingBoons,
    rerollUsed: Boolean(run.rerollUsed),
    eventOffer,
    selectedEvent,
    lastEvent,
    healthRatios,
    completedWave: Math.max(
      0,
      Math.trunc(Number(run.completedWave) || Math.max(0, wave - 1)),
    ),
    lastReward:
      run.lastReward && typeof run.lastReward === "object"
        ? {
            copper: Math.max(0, Math.trunc(Number(run.lastReward.copper) || 0)),
            xp: Math.max(0, Math.trunc(Number(run.lastReward.xp) || 0)),
            score: Math.max(0, Math.trunc(Number(run.lastReward.score) || 0)),
          }
        : null,
    score: Math.max(0, Math.trunc(Number(run.score) || 0)),
    bountiesCleared: Math.max(
      0,
      Math.trunc(Number(run.bountiesCleared) || 0),
    ),
    currentBounty,
    lastBounty,
    defeated: Boolean(run.defeated),
    lastUnlocks,
    lastDiscoveries,
    lastWeeklyMarks,
    lastPerformance,
    trialIds,
  };
}

function sanitizeArenaWeek(weekly) {
  const source = weekly && typeof weekly === "object" ? weekly : {};
  const marks = Array.isArray(source.marks)
    ? source.marks.filter((markId) =>
        ARENA_WEEK_MARKS.some((mark) => mark.id === markId),
      )
    : [];
  const history = Array.isArray(source.history)
    ? source.history
        .filter(
          (entry) =>
            entry &&
            /^\d{4}-W\d{2}$/.test(entry.weekKey || entry.key || ""),
        )
        .map((entry) => ({
          weekKey: entry.weekKey || entry.key,
          bestScore: Math.max(0, Math.trunc(Number(entry.bestScore) || 0)),
          bestWave: Math.max(0, Math.trunc(Number(entry.bestWave) || 0)),
          runs: Math.max(0, Math.trunc(Number(entry.runs) || 0)),
          marks: Array.isArray(entry.marks)
            ? entry.marks.filter((markId) =>
                ARENA_WEEK_MARKS.some((mark) => mark.id === markId),
              )
            : [],
        }))
        .slice(-12)
    : [];
  return {
    weekKey: /^\d{4}-W\d{2}$/.test(source.weekKey || "")
      ? source.weekKey
      : null,
    bestScore: Math.max(0, Math.trunc(Number(source.bestScore) || 0)),
    bestWave: Math.max(0, Math.trunc(Number(source.bestWave) || 0)),
    runs: Math.max(0, Math.trunc(Number(source.runs) || 0)),
    marks: [...new Set(marks)],
    history,
  };
}

export function syncArenaWeek(state, now = new Date()) {
  if (!state?.arena) return null;
  const weekKey = getIsoWeekKey(now);
  const previous = sanitizeArenaWeek(state.arena.weekly);
  state.arena.weekly = previous;
  if (previous.weekKey === weekKey) {
    return { weekKey, changed: false, previous: null };
  }
  const archived =
    previous.weekKey &&
    (previous.bestScore > 0 || previous.bestWave > 0 || previous.runs > 0)
      ? {
          weekKey: previous.weekKey,
          bestScore: previous.bestScore,
          bestWave: previous.bestWave,
          runs: previous.runs,
          marks: previous.marks,
        }
      : null;
  const history = archived
    ? [...previous.history, archived].slice(-12)
    : previous.history;
  state.arena.weekly = {
    weekKey,
    bestScore: 0,
    bestWave: 0,
    runs: 0,
    marks: [],
    history,
  };
  if (state.arena.activeRun?.mode === "weekly") {
    state.arena.activeRun = null;
  }
  return { weekKey, changed: true, previous: archived };
}

export function createInitialState(options = {}) {
  const difficulty = options.difficulty || "normal";
  return {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    difficulty,
    currentChapter: 0,
    completedChapters: [],
    chapterMedals: {},
    recruited: ["linchong"],
    roster: {
      linchong: createRosterEntry("linchong"),
    },
    team: ["linchong", null, null],
    inventory: {
      copper: 160,
      patrol_armor: 1,
      bamboo_token: 1,
    },
    facilities: {
      hall: 1,
      arena: 1,
      tower: 1,
    },
    alignment: {
      brotherhood: 1,
      order: 1,
      freedom: 1,
    },
    choices: {},
    flags: {
      tutorialSeen: false,
      finalBattleWon: false,
    },
    stats: {
      battlesWon: 0,
      enemiesDefeated: 0,
      heroesRecruited: 1,
      itemsFound: 0,
      damageDealt: 0,
    },
    settings: {
      sound: true,
      musicVolume: 65,
      sfxVolume: 80,
      autoBattle: true,
      autoTactic: "balanced",
      autoArena: false,
      battleSpeed: 1,
      reducedMotion: false,
      textSpeed: "normal",
      uiScale: "normal",
      highContrast: false,
    },
    arena: {
      bestWave: 0,
      bestScore: 0,
      lastScore: 0,
      lastWave: 0,
      totalRuns: 0,
      totalWavesCleared: 0,
      totalBounties: 0,
      relics: [],
      activeRun: null,
      starTrials: {
        bestScore: 0,
        bestWave: 0,
        maxSelected: 0,
        runs: 0,
      },
      discoveries: {
        masteries: [],
        synergies: [],
        encounters: [],
      },
      weekly: {
        weekKey: getIsoWeekKey(),
        bestScore: 0,
        bestWave: 0,
        runs: 0,
        marks: [],
        history: [],
      },
    },
    ending: null,
    endingsUnlocked: [],
    achievements: [],
    bondArchive: [],
    chainArchive: [],
    tacticArchive: [],
    doctrines: {},
    heroQuests: {
      claimed: [],
    },
    heroLegends: {
      completed: [],
    },
    heroRecruitments: {
      completed: [],
    },
    heroMastery: Object.fromEntries(
      HERO_ORDER.map((heroId) => [
        heroId,
        {
          wins: 0,
          kills: 0,
          damage: 0,
          ultimates: 0,
          trials: [],
        },
      ]),
    ),
    newGamePlus: options.newGamePlus || 0,
    lastSavedAt: new Date().toISOString(),
  };
}

export function hasSavedGame() {
  try {
    return Boolean(
      window.localStorage.getItem(SAVE_KEY) ||
        window.localStorage.getItem(SAVE_BACKUP_KEY),
    );
  } catch {
    return false;
  }
}

function parseStoredSave(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Number.isInteger(parsed.version) ||
      parsed.version > SAVE_VERSION
    ) {
      return null;
    }
    return migrateSave(parsed);
  } catch {
    return null;
  }
}

function readSaveSlot(key) {
  try {
    return parseStoredSave(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function loadGame() {
  return readSaveSlot(SAVE_KEY) || readSaveSlot(SAVE_BACKUP_KEY);
}

export function saveGame(state) {
  try {
    const previous = window.localStorage.getItem(SAVE_KEY);
    if (previous && parseStoredSave(previous)) {
      window.localStorage.setItem(SAVE_BACKUP_KEY, previous);
    }
    state.version = SAVE_VERSION;
    state.lastSavedAt = new Date().toISOString();
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function validateSaveText(raw) {
  return parseStoredSave(raw);
}

export function chooseNewestSaveText(localRaw, cloudRaw) {
  const local = parseStoredSave(localRaw);
  const cloud = parseStoredSave(cloudRaw);
  if (!local && !cloud) return null;
  if (!local) {
    return {
      source: "cloud",
      text: JSON.stringify(cloud),
      savedAt: cloud.lastSavedAt || null,
    };
  }
  if (!cloud) {
    return {
      source: "local",
      text: JSON.stringify(local),
      savedAt: local.lastSavedAt || null,
    };
  }
  const localTime = Date.parse(local.lastSavedAt || "") || 0;
  const cloudTime = Date.parse(cloud.lastSavedAt || "") || 0;
  const selected = cloudTime > localTime ? cloud : local;
  return {
    source: cloudTime > localTime ? "cloud" : "local",
    text: JSON.stringify(selected),
    savedAt: selected.lastSavedAt || null,
  };
}

export function deleteSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    window.localStorage.removeItem(SAVE_BACKUP_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function migrateSave(saved) {
  const base = createInitialState({ difficulty: saved.difficulty });
  const hadHeroMastery = Boolean(
    saved.heroMastery && typeof saved.heroMastery === "object",
  );
  const merged = {
    ...base,
    ...saved,
    version: SAVE_VERSION,
    settings: { ...base.settings, ...(saved.settings || {}) },
    alignment: { ...base.alignment, ...(saved.alignment || {}) },
    flags: { ...base.flags, ...(saved.flags || {}) },
    stats: { ...base.stats, ...(saved.stats || {}) },
    facilities: { ...base.facilities, ...(saved.facilities || {}) },
    arena: { ...base.arena, ...(saved.arena || {}) },
    chapterMedals:
      saved.chapterMedals && typeof saved.chapterMedals === "object"
        ? { ...saved.chapterMedals }
        : {},
    heroMastery: { ...base.heroMastery },
  };
  merged.recruited = [
    ...new Set(
      (Array.isArray(saved.recruited) ? saved.recruited : base.recruited).filter(
        (heroId) => HERO_ORDER.includes(heroId),
      ),
    ),
  ];
  if (!merged.recruited.includes("linchong")) {
    merged.recruited.unshift("linchong");
  }
  merged.roster =
    saved.roster && typeof saved.roster === "object" ? { ...saved.roster } : {};
  for (const chapter of CHAPTERS) {
    merged.chapterMedals[chapter.id] = Array.isArray(
      merged.chapterMedals[chapter.id],
    )
      ? [...new Set(merged.chapterMedals[chapter.id])].filter((medalId) =>
          CHAPTER_MEDALS.some((medal) => medal.id === medalId),
        )
      : [];
  }
  for (const heroId of HERO_ORDER) {
    merged.heroMastery[heroId] = {
      ...base.heroMastery[heroId],
      ...(saved.heroMastery?.[heroId] || {}),
      trials: Array.isArray(saved.heroMastery?.[heroId]?.trials)
        ? saved.heroMastery[heroId].trials
        : [],
    };
  }
  if (!Array.isArray(merged.endingsUnlocked)) {
    merged.endingsUnlocked = [];
  }
  if (!Array.isArray(merged.achievements)) {
    merged.achievements = [];
  }
  merged.bondArchive = Array.isArray(merged.bondArchive)
    ? [
        ...new Set(
          merged.bondArchive.filter((bondId) => HERO_BONDS[bondId]),
        ),
      ]
    : [];
  merged.chainArchive = Array.isArray(merged.chainArchive)
    ? [
        ...new Set(
          merged.chainArchive.filter(
            (formationId) => CHAIN_FORMATIONS[formationId],
          ),
        ),
      ]
    : [];
  merged.tacticArchive = Array.isArray(merged.tacticArchive)
    ? [
        ...new Set(
          merged.tacticArchive.filter((tacticId) =>
            CHAPTER_TACTIC_IDS.has(tacticId),
          ),
        ),
      ]
    : [];
  merged.doctrines =
    saved.doctrines && typeof saved.doctrines === "object"
      ? Object.fromEntries(
          Object.entries(saved.doctrines).filter(
            ([heroId, doctrineId]) =>
              Boolean(HERO_DOCTRINES[heroId]?.paths?.[doctrineId]),
          ),
        )
      : {};
  merged.heroQuests = {
    claimed: Array.isArray(saved.heroQuests?.claimed)
      ? [
          ...new Set(
            saved.heroQuests.claimed.filter((questId) =>
              HERO_QUEST_IDS.has(questId),
            ),
          ),
        ]
      : [],
  };
  merged.heroLegends = {
    completed: Array.isArray(saved.heroLegends?.completed)
      ? [
          ...new Set(
            saved.heroLegends.completed.filter((legendId) =>
              HERO_LEGEND_IDS.has(legendId),
            ),
          ),
        ]
      : [],
  };
  merged.heroRecruitments = {
    completed: Array.isArray(saved.heroRecruitments?.completed)
      ? [
          ...new Set(
            saved.heroRecruitments.completed.filter(
              (heroId) =>
                HERO_RECRUITMENTS[heroId] &&
                merged.recruited.includes(heroId),
            ),
          ),
        ]
      : [],
  };
  merged.flags.tutorialSeen = Boolean(merged.flags.tutorialSeen);
  if (!Array.isArray(merged.arena.relics)) {
    merged.arena.relics = [];
  }
  const savedStarTrials =
    merged.arena.starTrials && typeof merged.arena.starTrials === "object"
      ? merged.arena.starTrials
      : {};
  merged.arena.starTrials = {
    bestScore: Math.max(
      0,
      Math.trunc(Number(savedStarTrials.bestScore) || 0),
    ),
    bestWave: Math.max(
      0,
      Math.trunc(Number(savedStarTrials.bestWave) || 0),
    ),
    maxSelected: Math.max(
      0,
      Math.min(3, Math.trunc(Number(savedStarTrials.maxSelected) || 0)),
    ),
    runs: Math.max(0, Math.trunc(Number(savedStarTrials.runs) || 0)),
  };
  const arenaDiscoveries =
    merged.arena.discoveries && typeof merged.arena.discoveries === "object"
      ? merged.arena.discoveries
      : {};
  merged.arena.discoveries = {
    masteries: Array.isArray(arenaDiscoveries.masteries)
      ? [
          ...new Set(
            arenaDiscoveries.masteries.filter(
              (boonId) => ARENA_BOON_MASTERIES[boonId],
            ),
          ),
        ]
      : [],
    synergies: Array.isArray(arenaDiscoveries.synergies)
      ? [
          ...new Set(
            arenaDiscoveries.synergies.filter(
              (synergyId) => ARENA_SYNERGIES[synergyId],
            ),
          ),
        ]
      : [],
    encounters: Array.isArray(arenaDiscoveries.encounters)
      ? [
          ...new Set(
            arenaDiscoveries.encounters.filter(
              (encounterId) => ARENA_ENCOUNTERS[encounterId],
            ),
          ),
        ]
      : [],
  };
  merged.arena.activeRun = sanitizeArenaRun(merged.arena.activeRun);
  syncArenaWeek(merged);
  if (merged.ending && !merged.endingsUnlocked.includes(merged.ending)) {
    merged.endingsUnlocked.push(merged.ending);
  }
  if (![1, 2, 4].includes(merged.settings.battleSpeed)) {
    merged.settings.battleSpeed = 1;
  }
  if (!["normal", "large", "largest"].includes(merged.settings.uiScale)) {
    merged.settings.uiScale = "normal";
  }
  merged.settings.highContrast = Boolean(merged.settings.highContrast);
  merged.settings.autoArena = Boolean(merged.settings.autoArena);
  if (!AUTO_BATTLE_TACTICS[merged.settings.autoTactic]) {
    merged.settings.autoTactic = "balanced";
  }
  merged.settings.musicVolume = Math.max(
    0,
    Math.min(100, Number(merged.settings.musicVolume) || 0),
  );
  merged.settings.sfxVolume = Math.max(
    0,
    Math.min(100, Number(merged.settings.sfxVolume) || 0),
  );
  for (const heroId of merged.recruited || []) {
    const savedRoster = merged.roster[heroId] || {};
    merged.roster[heroId] = {
      ...createRosterEntry(heroId),
      ...savedRoster,
      equipment: {
        ...DEFAULT_EQUIPMENT[heroId],
        ...(savedRoster.equipment || {}),
      },
    };
  }
  if (!hadHeroMastery) {
    const recruitedCount = Math.max(1, merged.recruited.length);
    for (const heroId of merged.recruited) {
      const mastery = merged.heroMastery[heroId];
      mastery.wins = merged.stats.battlesWon;
      mastery.kills = Math.round(merged.stats.enemiesDefeated / recruitedCount);
      mastery.damage = Math.round(merged.stats.damageDealt / recruitedCount);
      mastery.ultimates = Math.min(merged.stats.battlesWon, 3);
      for (const trial of HERO_TRIALS) {
        if ((mastery[trial.metric] || 0) < trial.target) continue;
        mastery.trials.push(trial.id);
        merged.inventory.copper += trial.reward.copper;
        grantExperience(merged, heroId, trial.reward.xp);
      }
    }
  }
  if (merged.completedChapters.includes("liangshan")) {
    merged.currentChapter = CHAPTERS.length;
  }
  if (!Array.isArray(merged.team) || merged.team.length !== 3) {
    merged.team = fillTeam(merged, merged.team || []);
  }
  return merged;
}

export function difficultyConfig(state) {
  return DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
}

export function facilityMultiplier(state, facilityId) {
  const level = state.facilities[facilityId] || 1;
  return 1 + (level - 1) * 0.05;
}

export function yiqiMultiplier(state) {
  return 1 + ((state.facilities.tower || 1) - 1) * 0.1;
}

export function equipmentStats(equipment) {
  const totals = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const itemId of Object.values(equipment || {})) {
    const item = EQUIPMENT[itemId];
    if (!item) continue;
    for (const [stat, value] of Object.entries(item.stats || {})) {
      totals[stat] = (totals[stat] || 0) + value;
    }
  }
  return totals;
}

export function deriveHeroStats(state, heroId) {
  const hero = HEROES[heroId];
  const entry = state.roster[heroId] || createRosterEntry(heroId);
  const levelScale = 1 + (entry.level - 1) * 0.13;
  const masteryScale =
    1 + (state.heroMastery?.[heroId]?.trials?.length || 0) * 0.02;
  const questScale = heroQuestMasteryScale(state, heroId);
  const gear = equipmentStats(entry.equipment);
  const hall = facilityMultiplier(state, "hall");
  const arena = facilityMultiplier(state, "arena");
  return {
    maxHp: Math.round(
      hero.base.hp * levelScale * hall * masteryScale * questScale + gear.hp,
    ),
    atk: Math.round(
      hero.base.atk * levelScale * arena * masteryScale * questScale + gear.atk,
    ),
    def: Math.round(
      hero.base.def * levelScale * masteryScale * questScale + gear.def,
    ),
    spd: Math.round(
      hero.base.spd * levelScale * masteryScale * questScale + gear.spd,
    ),
  };
}

export function deriveEnemyStats(enemy, level) {
  const levelScale = 1 + Math.max(0, level - 1) * 0.11;
  return {
    level,
    maxHp: Math.round(enemy.base.hp * levelScale),
    atk: Math.round(enemy.base.atk * levelScale),
    def: Math.round(enemy.base.def * levelScale),
    spd: Math.round(enemy.base.spd * levelScale),
    poiseMax: Math.round((enemy.poise || 80) * (1 + (level - 1) * 0.08)),
  };
}

export function activeHeroes(state) {
  return state.team
    .map((heroId, row) => (heroId ? { heroId, row } : null))
    .filter(Boolean)
    .filter(({ heroId }) => state.recruited.includes(heroId))
    .map(({ heroId, row }) => ({
      heroId,
      row,
      hero: HEROES[heroId],
      entry: state.roster[heroId],
      stats: deriveHeroStats(state, heroId),
    }));
}

export function activeHeroBonds(state) {
  const active = new Set(activeHeroes(state).map(({ heroId }) => heroId));
  return Object.values(HERO_BONDS).filter((bond) =>
    bond.heroIds.every((heroId) => active.has(heroId)),
  );
}

export function recommendTeam(state) {
  const available = [...new Set(state.recruited)].filter(
    (heroId) => HEROES[heroId] && state.roster[heroId],
  );
  if (available.length < 3) {
    return {
      team: fillTeam(state, available),
      bonds: [],
      score: 0,
    };
  }

  const heroRank = new Map(HERO_ORDER.map((heroId, index) => [heroId, index]));
  let best = null;
  for (let first = 0; first < available.length - 2; first += 1) {
    for (let second = first + 1; second < available.length - 1; second += 1) {
      for (let third = second + 1; third < available.length; third += 1) {
        const heroIds = [available[first], available[second], available[third]];
        const members = new Set(heroIds);
        const bonds = Object.values(HERO_BONDS).filter((bond) =>
          bond.heroIds.every((heroId) => members.has(heroId)),
        );
        const pathCount = new Set(heroIds.map((heroId) => HEROES[heroId].path))
          .size;
        const statPower = heroIds.reduce((total, heroId) => {
          const stats = deriveHeroStats(state, heroId);
          return (
            total +
            stats.maxHp * 0.12 +
            stats.atk * 2.4 +
            stats.def * 1.5 +
            stats.spd * 1.5
          );
        }, 0);
        const rowOrders = [
          [0, 1, 2],
          [0, 2, 1],
          [1, 0, 2],
          [1, 2, 0],
          [2, 0, 1],
          [2, 1, 0],
        ];
        for (const order of rowOrders) {
          const team = order.map((index) => heroIds[index]);
          const preferredRows = team.filter(
            (heroId, row) => HEROES[heroId].preferredRow === row,
          ).length;
          const chainFormationBonus = pathCount === 3 ? 25000 : 0;
          const score =
            bonds.length * 10000 +
            chainFormationBonus +
            pathCount * 120 +
            preferredRows * 80 +
            statPower;
          const tieBreak = heroIds.reduce(
            (total, heroId) => total + (heroRank.get(heroId) || 0),
            0,
          );
          if (
            !best ||
            score > best.score + 0.001 ||
            (Math.abs(score - best.score) <= 0.001 &&
              tieBreak < best.tieBreak)
          ) {
            best = { team, bonds, score, tieBreak };
          }
        }
      }
    }
  }

  return best
    ? { team: best.team, bonds: best.bonds, score: best.score }
    : { team: fillTeam(state, []), bonds: [], score: 0 };
}

export function heroDoctrineUnlocked(state, heroId) {
  const config = HERO_DOCTRINES[heroId];
  if (!config || !state?.heroMastery?.[heroId]) return false;
  return (
    (state.heroMastery[heroId].trials?.length || 0) >=
    (config.unlockTrials || HERO_TRIALS.length)
  );
}

export function heroDoctrine(state, heroId) {
  const doctrineId = state?.doctrines?.[heroId];
  return HERO_DOCTRINES[heroId]?.paths?.[doctrineId] || null;
}

export function setHeroDoctrine(state, heroId, doctrineId) {
  const path = HERO_DOCTRINES[heroId]?.paths?.[doctrineId];
  if (!path || !heroDoctrineUnlocked(state, heroId)) return false;
  state.doctrines ||= {};
  state.doctrines[heroId] = doctrineId;
  return true;
}

export function findHeroQuest(questId) {
  for (const [heroId, quests] of Object.entries(HERO_QUESTS)) {
    const quest = quests.find((entry) => entry.id === questId);
    if (quest) return { ...quest, heroId };
  }
  return null;
}

export function heroQuestClaimed(state, questId) {
  return Boolean(state?.heroQuests?.claimed?.includes(questId));
}

export function heroQuestUnlocked(state, questId) {
  const quest = findHeroQuest(questId);
  if (!quest || !state?.recruited?.includes(quest.heroId)) return false;
  if ((state.currentChapter || 0) < quest.requiredChapter) return false;
  if (quest.stage <= 1) return true;
  const previous = HERO_QUESTS[quest.heroId]?.find(
    (entry) => entry.stage === quest.stage - 1,
  );
  return Boolean(previous && heroQuestClaimed(state, previous.id));
}

export function heroQuestProgress(state, questId) {
  const quest = findHeroQuest(questId);
  if (!quest) return 0;
  const value = state?.heroMastery?.[quest.heroId]?.[quest.objective.metric];
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function isHeroQuestComplete(state, questId) {
  const quest = findHeroQuest(questId);
  return Boolean(
    quest && heroQuestProgress(state, questId) >= quest.objective.target,
  );
}

export function heroQuestMasteryScale(state, heroId) {
  const quests = HERO_QUESTS[heroId] || [];
  const claimed = quests.filter((quest) =>
    heroQuestClaimed(state, quest.id),
  ).length;
  return 1 + claimed * 0.005;
}

export function heroLegendUnlocked(state, heroId) {
  const legend = HERO_LEGENDS[heroId];
  if (!legend || !state?.recruited?.includes(heroId)) return false;
  if ((state.currentChapter || 0) < legend.requiredChapter) return false;
  const quests = HERO_QUESTS[heroId] || [];
  return (
    quests.length > 0 &&
    quests.every((quest) => heroQuestClaimed(state, quest.id))
  );
}

export function heroLegendCompleted(state, heroId) {
  const legend = HERO_LEGENDS[heroId];
  return Boolean(
    legend && state?.heroLegends?.completed?.includes(legend.id),
  );
}

export function heroRecruitmentCompleted(state, heroId) {
  if (!state || !HERO_RECRUITMENTS[heroId]) return false;
  return Boolean(
    state.recruited?.includes(heroId) ||
      state.heroRecruitments?.completed?.includes(heroId),
  );
}

export function heroRecruitmentUnlocked(state, heroId) {
  const recruitment = HERO_RECRUITMENTS[heroId];
  if (!recruitment || heroRecruitmentCompleted(state, heroId)) return false;
  if ((state.currentChapter || 0) < recruitment.requiredChapter) return false;
  return (
    !recruitment.prerequisite ||
    heroRecruitmentCompleted(state, recruitment.prerequisite)
  );
}

export function applyHeroRecruitmentRewards(state, heroId, battle = null) {
  const recruitment = HERO_RECRUITMENTS[heroId];
  if (!recruitment || !state) {
    return {
      ok: false,
      reason: "unknown",
      copper: 0,
      xp: 0,
      item: null,
      levelUps: [],
      recruits: [],
    };
  }
  if (heroRecruitmentCompleted(state, heroId)) {
    return {
      ok: false,
      reason: "completed",
      copper: 0,
      xp: 0,
      item: null,
      levelUps: [],
      recruits: [],
    };
  }
  state.heroRecruitments ||= { completed: [] };
  if (!Array.isArray(state.heroRecruitments.completed)) {
    state.heroRecruitments.completed = [];
  }
  if (!state.heroRecruitments.completed.includes(heroId)) {
    state.heroRecruitments.completed.push(heroId);
  }
  recruitHero(state, heroId);
  state.inventory.copper += recruitment.reward.copper;
  addItem(state, recruitment.reward.item, 1);
  state.stats.battlesWon += 1;
  if (battle) {
    state.stats.enemiesDefeated += battle.enemies.length;
    state.stats.damageDealt += battle.damageDealt;
  }
  const levelUps = [];
  const rewardedHeroes = new Set([
    heroId,
    ...(battle?.heroes || []).map((unit) => unit.refId),
  ]);
  for (const rewardedHeroId of rewardedHeroes) {
    if (!state.roster[rewardedHeroId]) continue;
    const experience = grantExperience(
      state,
      rewardedHeroId,
      recruitment.reward.xp,
    );
    if (experience.levels > 0) {
      levelUps.push({
        heroId: rewardedHeroId,
        levels: experience.levels,
      });
    }
  }
  return {
    ok: true,
    copper: recruitment.reward.copper,
    xp: recruitment.reward.xp,
    item: recruitment.reward.item,
    levelUps,
    recruits: [heroId],
  };
}

export function claimHeroQuest(state, questId) {
  const quest = findHeroQuest(questId);
  const failure = (reason) => ({
    ok: false,
    reason,
    quest,
    copper: 0,
    xp: 0,
    levels: 0,
  });
  if (!quest) return failure("unknown");
  if (heroQuestClaimed(state, questId)) return failure("claimed");
  if (!heroQuestUnlocked(state, questId)) return failure("locked");
  if (!isHeroQuestComplete(state, questId)) return failure("incomplete");

  state.heroQuests ||= { claimed: [] };
  if (!Array.isArray(state.heroQuests.claimed)) {
    state.heroQuests.claimed = [];
  }
  state.heroQuests.claimed.push(questId);
  state.inventory.copper += quest.reward.copper;
  const experience = grantExperience(state, quest.heroId, quest.reward.xp);
  return {
    ok: true,
    reason: null,
    quest,
    copper: quest.reward.copper,
    xp: quest.reward.xp,
    levels: experience.levels,
  };
}

export function discoverHeroBonds(state, battle) {
  if (!state || !battle) {
    return { bonds: [], copper: 0, xp: 0 };
  }
  if (!Array.isArray(state.bondArchive)) state.bondArchive = [];
  const activeHeroIds = new Set(
    (battle.heroes || activeHeroes(state)).map(
      (unit) => unit.refId || unit.heroId,
    ),
  );
  const newlyDiscovered = (battle.bondIds || [])
    .map((bondId) => HERO_BONDS[bondId])
    .filter(
      (bond) =>
        bond &&
        !state.bondArchive.includes(bond.id) &&
        bond.heroIds.every((heroId) => activeHeroIds.has(heroId)),
    );
  let copper = 0;
  let xp = 0;
  for (const bond of newlyDiscovered) {
    state.bondArchive.push(bond.id);
    copper += bond.reward?.copper || 0;
    xp += bond.reward?.xp || 0;
  }
  if (copper) state.inventory.copper += copper;
  if (xp) {
    for (const heroId of activeHeroIds) {
      if (state.roster[heroId]) grantExperience(state, heroId, xp);
    }
  }
  return { bonds: newlyDiscovered, copper, xp };
}

export function discoverChainFormations(state, battle) {
  if (!state || !battle) {
    return { formations: [], copper: 0, xp: 0 };
  }
  if (!Array.isArray(state.chainArchive)) state.chainArchive = [];
  const activeHeroIds = new Set(
    (battle.heroes || activeHeroes(state)).map(
      (unit) => unit.refId || unit.heroId,
    ),
  );
  const newlyDiscovered = [
    ...new Set(
      (battle.chainFormationIds || [])
        .map((formationId) => CHAIN_FORMATIONS[formationId])
        .filter(
          (formation) =>
            formation && !state.chainArchive.includes(formation.id),
        )
        .map((formation) => formation.id),
    ),
  ].map((formationId) => CHAIN_FORMATIONS[formationId]);
  let copper = 0;
  let xp = 0;
  for (const formation of newlyDiscovered) {
    state.chainArchive.push(formation.id);
    copper += formation.reward?.copper || 0;
    xp += formation.reward?.xp || 0;
  }
  if (copper) state.inventory.copper += copper;
  if (xp) {
    for (const heroId of activeHeroIds) {
      if (state.roster[heroId]) grantExperience(state, heroId, xp);
    }
  }
  return { formations: newlyDiscovered, copper, xp };
}

export function recordChapterTactic(state, chapterId, optionIndex) {
  const chapter = CHAPTERS.find((entry) => entry.id === chapterId);
  const tactic = getChapterTactic(chapterId, optionIndex);
  if (!chapter || !tactic) {
    return {
      tactic: null,
      newlyDiscovered: false,
      copper: 0,
      xp: 0,
      levelUps: [],
    };
  }
  if (!Array.isArray(state.tacticArchive)) state.tacticArchive = [];
  const newlyDiscovered = !state.tacticArchive.includes(tactic.id);
  const copper = newlyDiscovered ? 60 + chapter.index * 20 : 0;
  const xp = newlyDiscovered ? 45 + chapter.index * 15 : 0;
  const levelUps = [];
  if (newlyDiscovered) {
    state.tacticArchive.push(tactic.id);
    state.inventory.copper += copper;
    for (const { heroId } of activeHeroes(state)) {
      const result = grantExperience(state, heroId, xp);
      if (result.levels > 0) {
        levelUps.push({ heroId, levels: result.levels });
      }
    }
  }
  return {
    tactic,
    newlyDiscovered,
    copper,
    xp,
    levelUps,
  };
}

export function setTeamSlot(state, row, heroId) {
  if (!state.recruited.includes(heroId)) return false;
  const existingRow = state.team.indexOf(heroId);
  const oldHero = state.team[row];
  if (existingRow >= 0 && existingRow !== row) {
    state.team[existingRow] = oldHero;
  }
  state.team[row] = heroId;
  return true;
}

export function fillTeam(state, seed = []) {
  const next = [0, 1, 2].map((row) => seed[row] || null);
  for (const heroId of state.recruited) {
    if (next.includes(heroId)) continue;
    const empty = next.findIndex((slot, index) => !slot && index <= heroIdRow(heroId));
    const fallback = next.findIndex((slot) => !slot);
    const target = empty >= 0 ? empty : fallback;
    if (target >= 0) next[target] = heroId;
    if (next.every(Boolean)) break;
  }
  return next;
}

function heroIdRow(heroId) {
  return HEROES[heroId]?.preferredRow ?? 2;
}

export function recruitHero(state, heroId) {
  if (!HEROES[heroId] || state.recruited.includes(heroId)) return false;
  state.recruited.push(heroId);
  state.roster[heroId] = createRosterEntry(heroId);
  state.stats.heroesRecruited = state.recruited.length;
  const emptySlot = state.team.findIndex((slot) => !slot);
  if (emptySlot >= 0) {
    state.team[emptySlot] = heroId;
  }
  return true;
}

export function addItem(state, itemId, amount = 1) {
  if (!itemId) return;
  if (itemId === "copper") {
    state.inventory.copper = (state.inventory.copper || 0) + amount;
    return;
  }
  if (!EQUIPMENT[itemId]) return;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + amount;
  state.stats.itemsFound += amount;
}

export function inventoryItems(state) {
  return Object.entries(state.inventory)
    .filter(([itemId, amount]) => itemId !== "copper" && amount > 0 && EQUIPMENT[itemId])
    .map(([itemId, amount]) => ({ item: EQUIPMENT[itemId], amount }));
}

export function equipItem(state, heroId, itemId) {
  const hero = HEROES[heroId];
  const item = EQUIPMENT[itemId];
  if (!hero || !item || !state.roster[heroId]) return false;
  if ((state.inventory[itemId] || 0) <= 0) return false;
  const entry = state.roster[heroId];
  const current = entry.equipment[item.slot];
  if (current) addItem(state, current, 1);
  state.inventory[itemId] -= 1;
  entry.equipment[item.slot] = itemId;
  return true;
}

export function unequipItem(state, heroId, slot) {
  const entry = state.roster[heroId];
  if (!entry) return false;
  const itemId = entry.equipment[slot];
  if (!itemId) return false;
  addItem(state, itemId, 1);
  entry.equipment[slot] = null;
  return true;
}

export function grantExperience(state, heroId, amount) {
  const entry = state.roster[heroId];
  if (!entry) return { levels: 0 };
  entry.xp += amount;
  let levels = 0;
  while (entry.xp >= xpForNext(entry.level)) {
    entry.xp -= xpForNext(entry.level);
    entry.level += 1;
    levels += 1;
  }
  return { levels };
}

export function checkAchievements(state) {
  if (!state || !Array.isArray(state.achievements)) {
    if (state) state.achievements = [];
    return [];
  }
  const unlocked = ACHIEVEMENTS.filter(
    (achievement) =>
      !state.achievements.includes(achievement.id) &&
      achievement.check(state),
  );
  for (const achievement of unlocked) {
    state.achievements.push(achievement.id);
    state.inventory.copper += achievement.reward.copper;
    for (const heroId of state.recruited || []) {
      grantExperience(state, heroId, achievement.reward.xp);
    }
  }
  return unlocked;
}

export function applyBattleRewards(state, chapter, replay = false) {
  const config = difficultyConfig(state);
  const multiplier = (config.rewardMultiplier || 1) * (replay ? 0.55 : 1);
  const copper = Math.round(chapter.battle.reward.copper * multiplier);
  const xp = Math.round(chapter.battle.reward.xp * multiplier);
  state.inventory.copper += copper;
  const levelUps = [];
  const active = activeHeroes(state);
  for (const { heroId } of active) {
    const result = grantExperience(state, heroId, xp);
    if (result.levels > 0) levelUps.push({ heroId, levels: result.levels });
  }
  if (chapter.battle.reward.item && !replay) {
    addItem(state, chapter.battle.reward.item, 1);
  }
  for (const heroId of chapter.battle.recruit || []) {
    recruitHero(state, heroId);
  }
  if (!replay && !state.completedChapters.includes(chapter.id)) {
    state.completedChapters.push(chapter.id);
    state.currentChapter = Math.min(CHAPTERS.length, state.currentChapter + 1);
  }
  state.stats.battlesWon += 1;
  return {
    copper,
    xp,
    item: replay ? null : chapter.battle.reward.item,
    levelUps,
    recruits: chapter.battle.recruit || [],
  };
}

export function evaluateChapterMedals(state, chapter, battle, replay = false) {
  if (!state.chapterMedals || typeof state.chapterMedals !== "object") {
    state.chapterMedals = {};
  }
  const previous = Array.isArray(state.chapterMedals[chapter.id])
    ? state.chapterMedals[chapter.id]
    : [];
  const earnedNow = new Set(previous);
  const heroes = battle?.heroes || [];
  const conditions = {
    unbroken: heroes.length > 0 && heroes.every((hero) => hero.hp > 0),
    star_combo: (battle?.chainAttacks || 0) > 0,
    swift: (battle?.round || Infinity) <= chapter.parRounds,
  };
  for (const medal of CHAPTER_MEDALS) {
    if (conditions[medal.id]) earnedNow.add(medal.id);
  }

  const newlyEarned = [...earnedNow].filter(
    (medalId) => !previous.includes(medalId),
  );
  const previousComplete = previous.length >= CHAPTER_MEDALS.length;
  const nowComplete = earnedNow.size >= CHAPTER_MEDALS.length;
  const rewardMultiplier = replay ? 0.55 : 1;
  let copper = newlyEarned.length * (40 + chapter.index * 25);
  let xp = newlyEarned.length * (30 + chapter.index * 20);
  if (!previousComplete && nowComplete) {
    copper += 120 + chapter.index * 40;
    xp += 80 + chapter.index * 25;
  }
  copper = Math.round(copper * rewardMultiplier);
  xp = Math.round(xp * rewardMultiplier);

  const levelUps = [];
  if (newlyEarned.length) {
    state.chapterMedals[chapter.id] = CHAPTER_MEDALS.filter((medal) =>
      earnedNow.has(medal.id),
    ).map((medal) => medal.id);
    state.inventory.copper += copper;
    for (const { heroId } of activeHeroes(state)) {
      const result = grantExperience(state, heroId, xp);
      if (result.levels > 0) levelUps.push({ heroId, levels: result.levels });
    }
  }

  return {
    earned: state.chapterMedals[chapter.id] || [],
    newlyEarned,
    copper,
    xp,
    levelUps,
    completed: nowComplete && newlyEarned.length > 0,
  };
}

export function chapterStatus(state, chapter) {
  if (state.completedChapters.includes(chapter.id)) return "completed";
  if (chapter.index === state.currentChapter) return "active";
  if (chapter.index < state.currentChapter) return "available";
  return "locked";
}

export function currentChapter(state) {
  return CHAPTERS[Math.min(state.currentChapter, CHAPTERS.length - 1)];
}

export function recordChoice(state, chapterId, optionIndex, effect) {
  state.choices[chapterId] = optionIndex;
  for (const [key, value] of Object.entries(effect || {})) {
    state.alignment[key] = (state.alignment[key] || 0) + value;
  }
}

export function alignmentSummary(state) {
  const entries = Object.entries(state.alignment).sort((a, b) => b[1] - a[1]);
  const labels = {
    brotherhood: "聚义",
    order: "招安",
    freedom: "归隐",
  };
  return labels[entries[0][0]] || "聚义";
}

export function upgradeCost(state, facilityId) {
  const level = state.facilities[facilityId] || 1;
  const facility = FACILITIES[facilityId];
  if (level >= facility.maxLevel) return null;
  return facility.costs[level + 1];
}

export function upgradeFacility(state, facilityId) {
  const cost = upgradeCost(state, facilityId);
  if (!cost || state.inventory.copper < cost) return false;
  state.inventory.copper -= cost;
  state.facilities[facilityId] += 1;
  return true;
}

export function campRestCost(state) {
  return Math.max(40, 28 + state.recruited.length * 12 + state.currentChapter * 14);
}

export function campRest(state) {
  const cost = campRestCost(state);
  if (state.inventory.copper < cost) return false;
  state.inventory.copper -= cost;
  // Rest represents preparation rather than persistent HP loss.
  for (const heroId of state.recruited) {
    const entry = state.roster[heroId];
    entry.xp += 18 + (state.facilities.tower || 1) * 6;
    while (entry.xp >= xpForNext(entry.level)) {
      entry.xp -= xpForNext(entry.level);
      entry.level += 1;
    }
  }
  return true;
}

export function totalPower(state) {
  return state.recruited.reduce((sum, heroId) => {
    const stats = deriveHeroStats(state, heroId);
    return sum + stats.maxHp * 0.15 + stats.atk * 3 + stats.def * 2 + stats.spd * 2;
  }, 0);
}

export function completionPercent(state) {
  const chapterPart = (state.completedChapters.length / CHAPTERS.length) * 70;
  const recruitPart = (state.recruited.length / HERO_ORDER.length) * 20;
  const facilityPart =
    (Object.values(state.facilities).reduce((sum, value) => sum + value - 1, 0) /
      (Object.values(FACILITIES).reduce((sum, f) => sum + f.maxLevel - 1, 0))) *
    10;
  return Math.min(100, Math.round(chapterPart + recruitPart + facilityPart));
}
