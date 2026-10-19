import { ARENA_BOONS, ARENA_BOUNTIES, ARENA_EVENTS } from "./data.js";

export const ARENA_WEEK_RULES = [
  {
    id: "snow",
    name: "风雪压营",
    icon: "snowflake",
    tone: "blue",
    desc: "敌军身法提高 12%，本周军功收益提高 12%。",
    heroMods: {},
    enemyMods: { spdPct: 0.12 },
    scorePct: 0.12,
  },
  {
    id: "encirclement",
    name: "重围死战",
    icon: "orbit",
    tone: "cinnabar",
    desc: "敌军生命提高 14%，全队开局获得 15 义气，军功收益提高 12%。",
    heroMods: { startYiqi: 15 },
    enemyMods: { hpPct: 0.14 },
    scorePct: 0.12,
  },
  {
    id: "ration",
    name: "断粮急行",
    icon: "timer",
    tone: "gold",
    desc: "波间恢复降低 8%，敌军攻击提高 8%，本周军功收益提高 15%。",
    heroMods: { waveHealPct: -0.08 },
    enemyMods: { atkPct: 0.08 },
    scorePct: 0.15,
  },
  {
    id: "starfire",
    name: "星火夜袭",
    icon: "sparkles",
    tone: "teal",
    desc: "全队暴击率提高 8%，敌军生命提高 10%，本周军功收益提高 14%。",
    heroMods: { critPct: 0.08 },
    enemyMods: { hpPct: 0.1 },
    scorePct: 0.14,
  },
];

export const ARENA_WEEK_MARKS = [
  {
    id: "first",
    name: "破阵周印",
    desc: "本周演武军功达到 900。",
    score: 900,
    icon: "stamp",
    tone: "teal",
    reward: { copper: 120, xp: 80 },
  },
  {
    id: "second",
    name: "扬威周印",
    desc: "本周演武军功达到 2400。",
    score: 2400,
    icon: "badge-check",
    tone: "gold",
    reward: { copper: 360, xp: 200 },
  },
  {
    id: "third",
    name: "天罡周印",
    desc: "本周演武军功达到 5200。",
    score: 5200,
    icon: "crown",
    tone: "cinnabar",
    reward: { copper: 900, xp: 480 },
  },
];

const BOON_IDS = Object.keys(ARENA_BOONS);
const BOUNTY_IDS = ARENA_BOUNTIES.map((bounty) => bounty.id);
const EVENT_IDS = Object.keys(ARENA_EVENTS);
const WEEK_KEY_PATTERN = /^(\d{4})-W(\d{2})$/;

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function isoWeekStart(year, week) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const mondayOffset = (januaryFourth.getUTCDay() + 6) % 7;
  const firstMonday = new Date(
    Date.UTC(year, 0, 4 - mondayOffset + (week - 1) * 7),
  );
  return firstMonday;
}

export function getIsoWeekKey(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required for the weekly challenge.");
  }
  const thursday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
  const dayOffset = (thursday.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - dayOffset + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstOffset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstOffset + 3);
  const week = 1 + Math.round((thursday - firstThursday) / 604800000);
  return `${weekYear}-W${pad(week)}`;
}

export function getIsoWeekRange(weekKey) {
  const match = WEEK_KEY_PATTERN.exec(weekKey);
  if (!match) return "";
  const year = Number(match[1]);
  const week = Number(match[2]);
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const format = (date) =>
    `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  return `${format(start)} - ${format(end)}`;
}

export function getArenaWeekConfig(weekKey = getIsoWeekKey()) {
  const seed = hashString(weekKey);
  const boonPool = shuffle(BOON_IDS, seededRandom(seed)).slice(0, 4);
  const bountyPool = shuffle(
    BOUNTY_IDS,
    seededRandom(seed ^ 0x9e3779b9),
  ).slice(0, 3);
  const rule = ARENA_WEEK_RULES[seed % ARENA_WEEK_RULES.length];
  return {
    key: weekKey,
    seed,
    label: getIsoWeekRange(weekKey),
    rule,
    boonPool,
    bountyPool,
  };
}

export function getArenaWeekBoonOffer(
  config,
  wave = 0,
  count = 3,
  revision = 0,
) {
  const revisionKey =
    revision > 0 ? `:revision:${Math.trunc(revision)}` : "";
  const random = seededRandom(
    hashString(
      `${config.key}:boons:${Math.max(0, wave)}${revisionKey}`,
    ),
  );
  return shuffle(config.boonPool, random)
    .slice(0, Math.min(count, config.boonPool.length))
    .map((boonId) => ARENA_BOONS[boonId])
    .filter(Boolean);
}

export function getArenaWeekBounty(config, wave = 1, previousId = "") {
  const pool = config.bountyPool.filter((bountyId) => bountyId !== previousId);
  const candidates = pool.length ? pool : config.bountyPool;
  if (!candidates.length) return null;
  const random = seededRandom(
    hashString(`${config.key}:bounty:${Math.max(1, wave)}`),
  );
  const bountyId = candidates[Math.floor(random() * candidates.length)];
  return ARENA_BOUNTIES.find((bounty) => bounty.id === bountyId) || null;
}

export function getArenaWeekEventOffer(config, wave = 1, count = 3) {
  const random = seededRandom(
    hashString(`${config.key}:events:${Math.max(1, wave)}`),
  );
  return shuffle(EVENT_IDS, random).slice(0, Math.min(count, EVENT_IDS.length));
}
