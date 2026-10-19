import { createIcons } from "lucide";
import "./styles.css";
import { ICON_COMPONENTS } from "./icons.js";
import titlePosterUrl from "../assets/video/bianjing_snow_night_poster.webp";
import titleVideoUrl from "../assets/video/bianjing_snow_night_5s.mp4";
import gangVfxAlphaUrl from "../assets/vfx/gang-alpha.webm";
import gangVfxPosterUrl from "../assets/vfx/gang-poster.png";
import gangVfxVideoUrl from "../assets/vfx/gang.mp4";
import lingVfxAlphaUrl from "../assets/vfx/ling-alpha.webm";
import lingVfxPosterUrl from "../assets/vfx/ling-poster.png";
import lingVfxVideoUrl from "../assets/vfx/ling.mp4";
import shouVfxAlphaUrl from "../assets/vfx/shou-alpha.webm";
import shouVfxPosterUrl from "../assets/vfx/shou-poster.png";
import shouVfxVideoUrl from "../assets/vfx/shou.mp4";
import taoVfxAlphaUrl from "../assets/vfx/tao-alpha.webm";
import taoVfxPosterUrl from "../assets/vfx/tao-poster.png";
import taoVfxVideoUrl from "../assets/vfx/tao.mp4";

import {
  ACHIEVEMENTS,
  AUTO_BATTLE_TACTICS,
  ARENA_BOONS,
  ARENA_BOON_MASTERIES,
  ARENA_BOUNTIES,
  ARENA_ENCOUNTERS,
  ARENA_EVENTS,
  ARENA_MILESTONES,
  ARENA_RELICS,
  ARENA_SYNERGIES,
  CAMP_BUILDINGS,
  CAMP_PRODUCTS,
  CAMP_RECIPES,
  CHAPTERS,
  CHAIN_FORMATIONS,
  DIFFICULTIES,
  ENDINGS,
  ENEMIES,
  EQUIPMENT,
  FACILITIES,
  HERO_BONDS,
  HERO_CHRONICLES,
  HERO_DOCTRINES,
  HERO_LEGENDS,
  HERO_QUESTS,
  HERO_RECRUITMENTS,
  HEROES,
  HERO_ORDER,
  HERO_TRIALS,
  PATHS,
  ROWS,
  STAT_LABELS,
  STATUS_DEFS,
} from "./data.js";
import {
  ARENA_WEEK_MARKS,
  getArenaWeekBoonOffer,
  getArenaWeekBounty,
  getArenaWeekConfig,
  getArenaWeekEventOffer,
} from "./arena-week.js";

const TITLE_FEATURED_HEROES = [
  "linchong",
  "luzhishen",
  "wusong",
  "huarong",
  "songjiang",
  "husanniang",
  "wuyong",
  "yanqing",
];
import {
  ARENA_TRIAL_LIMIT,
  ARENA_TRIALS,
  arenaTrialEffects,
  availableArenaTrials,
  sanitizeArenaTrialIds,
} from "./arena-trials.js";
import {
  resolveArenaEncounter,
} from "./arena-encounters.js";
import {
  chapterTacticArchiveCount,
  getChapterTactic,
  getChapterTactics,
  totalChapterTactics,
} from "./chapter-tactics.js";
import {
  evaluateArenaPerformance,
  nextArenaSynergy,
  planArenaAutoContinue,
  recommendArenaBoon,
} from "./arena-run.js";
import {
  achievementProgress,
  buildRoutePlan,
} from "./route-guide.js";
import {
  activeHeroBonds,
  activeHeroes,
  alignmentSummary,
  applyHeroRecruitmentRewards,
  applyBattleRewards,
  battleEnemyScale,
  buildCampBuilding,
  campAreaLevel,
  campAreaRequirement,
  campAreaSize,
  campBuildingStatus,
  campRest,
  campRestCost,
  campRecipeStatus,
  CHAPTER_MEDALS,
  chapterStatus,
  checkAchievements,
  chooseNewestSaveText,
  claimHeroQuest,
  completionPercent,
  createInitialState,
  currentChapter,
  deleteSave,
  deriveHeroStats,
  discoverHeroBonds,
  discoverChainFormations,
  collectCampResource,
  craftCampItem,
  equipItem,
  equipmentMatchesCategory,
  expandCampArea,
  evaluateChapterMedals,
  grantExperience,
  hasSavedGame,
  heroDoctrine,
  heroDoctrineUnlocked,
  heroLegendCompleted,
  heroLegendUnlocked,
  heroRecruitmentCompleted,
  heroRecruitmentUnlocked,
  heroQuestMasteryScale,
  heroQuestProgress,
  heroQuestUnlocked,
  inventoryItems,
  isHeroQuestComplete,
  loadGame,
  recommendTeam,
  recommendTeams,
  recordChapterTactic,
  recordChoice,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  saveGame,
  setHeroDoctrine,
  setTeamSlot,
  syncArenaWeek,
  totalPower,
  unequipItem,
  upgradeCost,
  upgradeFacility,
  validateSaveText,
  xpForNext,
} from "./state.js";
import {
  chainAttackReady,
  chainFormationForBattle,
  chainPathsForBattle,
  chooseEnemyAction,
  combatantById,
  createBattle,
  currentCombatant,
  finishResolutionAndAdvance,
  heroSkillList,
  performAction,
  performChainAttack,
  setBattleFacilityContext,
  skillUsable,
  turnPreview,
  validTargets,
} from "./battle.js";
import {
  chooseAutoBattleAction,
  normalizeAutoBattleTactic,
  recordAutoBattleChoice,
} from "./auto-battle.js";
import { battleVfxProfile } from "./battle-vfx.js";
import {
  cinematicImageFit,
  endingCinematicProfile,
  openingCinematicProfile,
} from "./cinematic.js";
import {
  clickFeedbackOrigin,
  currencyFeedback,
} from "./ui-feedback.js";
import { recommendEquipment } from "./equipment-recommendation.js";
import { combatSfxCue, sound } from "./audio.js";

const app = document.querySelector("#app");
const gameShell = window.gameShell || null;
const steamBridge = window.gameSteam || null;
const diagnosticsBridge = window.gameDiagnostics || null;
const BATTLE_VFX_ASSETS = Object.freeze({
  gang: {
    alpha: gangVfxAlphaUrl,
    video: gangVfxVideoUrl,
    poster: gangVfxPosterUrl,
  },
  ling: {
    alpha: lingVfxAlphaUrl,
    video: lingVfxVideoUrl,
    poster: lingVfxPosterUrl,
  },
  tao: {
    alpha: taoVfxAlphaUrl,
    video: taoVfxVideoUrl,
    poster: taoVfxPosterUrl,
  },
  shou: {
    alpha: shouVfxAlphaUrl,
    video: shouVfxVideoUrl,
    poster: shouVfxPosterUrl,
  },
});

let state = null;
let screen = "title";
let selectedDifficulty = "normal";
let focusedChapterId = CHAPTERS[0].id;
let activeChapter = null;
let story = null;
let battle = null;
let battleUi = createBattleUi();
let battleTimer = null;
let battleFeedbackTimer = null;
let battleActorSide = null;
let arenaAutoTimer = null;
let titleVideoCleanup = null;
let titleProloguePlayed = false;
let endingCinematicActive = false;
let endingCinematicTimer = null;
let modal = null;
let pendingRecruitment = null;
let toastTimer = null;
let settingsOrigin = "nav";
let arenaRun = null;
let arenaMode = "endless";
let arenaDraftSeed = null;
let arenaDraftBoons = [];
let arenaRewardChoices = [];
let arenaTrialSelection = [];
let selectedArenaBoon = null;
let pendingImportedState = null;
let lastMasteryUnlocks = [];
let lastAchievementUnlocks = [];
let lastBondUnlocks = [];
let lastChainUnlocks = [];
let lastBattleScreenOpenedAt = 0;
let desktopStatus = {
  desktop: Boolean(gameShell?.isDesktop),
  platform: gameShell?.platform || "web",
  fullscreen: false,
};
let steamStatus = {
  available: false,
  reason: steamBridge ? "not-initialized" : "web",
  cloudEnabled: false,
};
let steamCloudTimer = null;
let steamCloudSyncing = false;
let lastSteamCloudSyncAt = null;
let lastSaveFailureAt = 0;
let pendingInputRestore = null;

let selectedFormationRow = 0;
let selectedEquipmentHero = "linchong";
let selectedCodexHero = "linchong";
let selectedQuestHero = "linchong";
let codexArchives = { bonds: false, chains: false };
let equipmentCategory = "all";
let equipmentPathFilter = "all";
let equipmentPage = 0;
let rosterPathFilter = "all";
let rosterPage = 0;
let rosterDetailOpen = false;
let rosterGalleryScrollTop = 0;
let rosterResetScroll = false;

const EQUIPMENT_CATEGORIES = [
  { id: "all", name: "全部", icon: "layout-grid" },
  { id: "weapon", name: "兵刃", icon: "swords" },
  { id: "armor", name: "护甲", icon: "shield" },
  { id: "token", name: "随身物", icon: "gem" },
];

const EQUIPMENT_STYLE_LABELS = {
  offense: "锋刃",
  guard: "坚壁",
  mobility: "疾行",
  balanced: "均衡",
};

const CAMP_BUILDING_ZONES = {
  hall: "寨务",
  arena: "寨务",
  tower: "寨务",
  farmland: "产出",
  mine: "产出",
  woodland: "产出",
  fishery: "产出",
  mill: "工坊",
  kitchen: "工坊",
};

const HERO_GROUPS = [
  { id: "all", name: "全路数" },
  ...Object.values(PATHS).map((path) => ({
    id: path.id,
    name: path.name,
    color: path.color,
  })),
];

function pageItems(items, page, pageSize) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  return {
    current,
    pages,
    items: items.slice(current * pageSize, (current + 1) * pageSize),
  };
}

function renderPagination(page, directionAction, label) {
  if (page.pages <= 1) return "";
  return `
    <div class="list-pagination" aria-label="${label}">
      <button class="icon-button" data-action="${directionAction}" data-direction="-1" aria-label="上一页" ${page.current === 0 ? "disabled" : ""}>${icon("chevron-left", 17)}</button>
      <span>第 ${page.current + 1} / ${page.pages} 页</span>
      <button class="icon-button" data-action="${directionAction}" data-direction="1" aria-label="下一页" ${page.current >= page.pages - 1 ? "disabled" : ""}>${icon("chevron-right", 17)}</button>
    </div>
  `;
}

function createBattleUi() {
  return {
    selectedSkillId: null,
    processing: false,
    result: null,
    resultTone: "",
    feedback: [],
    vfx: null,
  };
}

function presentBattleResult(result, vfx = null) {
  battleUi.result = result;
  battleUi.vfx = vfx;
  battleUi.feedback = [];
  if (!result?.ok || !Array.isArray(result.events)) return;
  result.events.forEach((event, index) => {
    if (!event.targetUid) return;
    battleUi.feedback.push({
      ...event,
      key: `${Date.now()}-${index}`,
    });
  });
}

function clearBattleFeedback() {
  battleUi.feedback = [];
  battleUi.vfx = null;
}

function clearBattleFeedbackTimer() {
  if (!battleFeedbackTimer) return;
  window.clearTimeout(battleFeedbackTimer);
  battleFeedbackTimer = null;
}

function takeBattleFeedback(unitUid, type) {
  const feedback = battleUi.feedback || [];
  const index = feedback.findIndex(
    (event) =>
      event.targetUid === unitUid &&
      (event.type === type || (type === "damage" && event.type === "combo")),
  );
  if (index < 0) return null;
  return feedback.splice(index, 1)[0];
}

const BATTLE_ROW_X = { 0: 0, 1: -1, 2: 1 };

function battleUnitSpatialStyle(unitUid) {
  const vfx = battleUi.vfx;
  if (!battle || !vfx) return "";
  const units = [...battle.heroes, ...battle.enemies];
  const actor = units.find((unit) => unit.uid === vfx.actorUid);
  const targetUids = vfx.targetUids || [];
  const firstTarget = units.find((unit) => unit.uid === targetUids[0]);
  const current = units.find((unit) => unit.uid === unitUid);
  if (!actor || !current || !firstTarget) return "";
  const isActor = current.uid === actor.uid;
  const isTarget = targetUids.includes(current.uid);
  if (!isActor && !isTarget) return "";

  const relationTarget = isActor ? firstTarget : current;
  const horizontal =
    (BATTLE_ROW_X[relationTarget.row] || 0) -
    (BATTLE_ROW_X[actor.row] || 0);
  const depth =
    (actor.row === 0 ? 0 : 1) + (relationTarget.row === 0 ? 0 : 1);
  if (isActor) {
    const rushY = 22 + depth * 4;
    return [
      `--strike-x:${horizontal * 9}vw`,
      `--rush-up:-${rushY}vh`,
      `--rush-down:${rushY}vh`,
      `--strike-rotate:${horizontal * 2}deg`,
    ].join(";");
  }
  return [
    `--hit-x:${horizontal * 22}px`,
    `--hit-x-mid:${horizontal * 9}px`,
    `--hit-x-return:${horizontal * -3}px`,
    `--hit-rotate:${horizontal * 2.2}deg`,
    `--hit-rotate-mid:${horizontal * -1.2}deg`,
    `--hit-depth:${depth}`,
  ].join(";");
}

function renderBattleMotion(event, label, tone = "") {
  if (!event) return "";
  const collision = event.type === "damage" || event.type === "combo";
  return `
    <span class="battle-motion ${tone} ${collision ? "is-collision" : ""}" data-feedback-key="${event.key}" aria-hidden="true">
      <span class="battle-motion-flash"></span>
      ${
        collision
          ? `<span class="collision-burst">
              <em></em>
              ${Array.from({ length: 8 }, (_, index) => `<i style="--collision-index:${index};--collision-angle:${index * 45}deg;--collision-angle-end:${index * 45 + 22}deg"></i>`).join("")}
            </span>`
          : ""
      }
      <b>${escapeHtml(label)}</b>
    </span>
  `;
}

function renderBattleSkillImpact(vfx, withVideo = false) {
  if (!vfx) return "";
  const media = withVideo ? BATTLE_VFX_ASSETS[vfx.videoKey] : null;
  const motionReduced = reducedMotionFor(state);
  const videoMarkup = media
    ? motionReduced
      ? `<img class="skill-video-poster" src="${media.poster}" alt="" draggable="false" />`
      : `
        <video class="skill-video-media" autoplay muted playsinline preload="auto" poster="${media.poster}" aria-hidden="true">
          <source src="${media.alpha}" type='video/webm; codecs="vp9"' />
          <source src="${media.video}" type="video/mp4" />
        </video>
      `
    : "";
  return `
    <span class="skill-impact is-${vfx.kind} tone-${vfx.tone} is-from-${vfx.actorSide || "hero"} ${vfx.heavy ? "is-heavy" : ""} ${media ? "has-video" : ""}" aria-hidden="true">
      ${
        media
          ? `<span class="skill-video" data-vfx-video="${vfx.videoKey}">${videoMarkup}</span>`
          : ""
      }
      <span class="impact-core"></span>
      <span class="impact-shockwave"></span>
      ${Array.from({ length: 7 }, (_, index) => `<i style="--vfx-index:${index}"></i>`).join("")}
      <em></em>
    </span>
  `;
}

function renderBattleSkillCallout() {
  const vfx = battleUi.vfx;
  if (!vfx) return "";
  return `
    <div class="battle-skill-callout is-${vfx.kind} tone-${vfx.tone}" aria-live="polite">
      <span>${icon(vfx.icon, 18)}</span>
      <div><small>${vfx.pathId ? PATHS[vfx.pathId]?.name || "星命" : "星命"}</small><b>${escapeHtml(vfx.skillName)}</b></div>
      ${vfx.critical ? "<em>会心</em>" : vfx.pathAdvantage ? "<em>克制</em>" : ""}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textInputFrom(target) {
  if (!target?.matches?.("input, textarea")) return null;
  if (target.matches("textarea")) return target;
  return ["text", "search", "email", "url", "tel", "password", "number"].includes(
    target.type,
  )
    ? target
    : null;
}

function textInputSelector(input) {
  if (input.id) return `#${CSS.escape(input.id)}`;
  for (const [name, value] of Object.entries(input.dataset)) {
    if (value) return `[data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${CSS.escape(value)}"]`;
  }
  return null;
}

function isTextEditable(target) {
  return Boolean(
    textInputFrom(target) ||
      target?.isContentEditable ||
      target?.closest?.("[contenteditable='true']"),
  );
}

function isGameShortcut(event) {
  return (
    event.key === "Escape" ||
    (screen === "story" && (event.key === " " || event.key === "Enter")) ||
    (screen === "battle" &&
      ["a", "t", "c", "1", "2", "4"].includes(event.key.toLowerCase()))
  );
}

function captureInputRestore(target) {
  const input = textInputFrom(target);
  if (!input || !input.closest("#app")) return null;
  const selector = textInputSelector(input);
  if (!selector) return null;
  let selectionStart = null;
  let selectionEnd = null;
  try {
    selectionStart = input.selectionStart;
    selectionEnd = input.selectionEnd;
  } catch {
    // Some input types expose no selection API.
  }
  return {
    selector,
    selectionStart,
    selectionEnd,
    selectionDirection: input.selectionDirection,
  };
}

function icon(name, size = 18) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px" aria-hidden="true"></i>`;
}

function pct(value, max) {
  return `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
}

function chapterById(chapterId) {
  return CHAPTERS.find((chapter) => chapter.id === chapterId) || CHAPTERS[0];
}

function chapterMedalIds(stateValue, chapter) {
  const ids = stateValue?.chapterMedals?.[chapter.id];
  return Array.isArray(ids) ? ids : [];
}

function chapterTacticNames(stateValue, chapter) {
  const discovered = new Set(stateValue?.tacticArchive || []);
  return getChapterTactics(chapter.id).filter((tactic) =>
    discovered.has(tactic.id),
  );
}

function renderChapterMedals(stateValue, chapter) {
  const earned = new Set(chapterMedalIds(stateValue, chapter));
  const discoveredTactics = chapterTacticNames(stateValue, chapter);
  const tacticCount = getChapterTactics(chapter.id).length;
  return `
    <div class="chapter-medals" aria-label="战卷评鉴 ${earned.size}/${CHAPTER_MEDALS.length}">
      <div class="chapter-medals-head">
        <span>${icon("medal", 15)} 战卷评鉴</span>
        <b>${earned.size}/${CHAPTER_MEDALS.length}</b>
      </div>
      <div class="chapter-medal-list">
        ${CHAPTER_MEDALS.map((medal) => {
          const done = earned.has(medal.id);
          const desc =
            medal.id === "swift"
              ? `${chapter.parRounds} 回合内取胜`
              : medal.desc;
          return `
            <span class="${done ? "is-earned" : ""}" title="${medal.name}：${desc}">
              ${icon(done ? medal.icon : "circle", 14)}
              <b>${medal.name}</b>
              <small>${desc}</small>
            </span>
          `;
        }).join("")}
      </div>
      <div class="chapter-tactic-line">
        <span>${icon("route", 13)} 临阵战意 <b>${chapterTacticArchiveCount(stateValue?.tacticArchive, chapter.id)}/${tacticCount}</b></span>
        <div>
          ${
            discoveredTactics.length
              ? discoveredTactics
                  .map(
                    (tactic) =>
                      `<b class="tone-${tactic.tone}">${icon(tactic.icon, 11)}${tactic.name}</b>`,
                  )
                  .join("")
              : "<small>胜利后收录这一战的选择</small>"
          }
        </div>
      </div>
    </div>
  `;
}

function renderRouteGoal(goal, index, context = "map") {
  const attributes = [
    `data-action="${goal.action}"`,
    goal.heroId ? `data-hero="${goal.heroId}"` : "",
    goal.chapterId ? `data-chapter="${goal.chapterId}"` : "",
    `data-route-goal="${goal.id}"`,
  ]
    .filter(Boolean)
    .join(" ");
  const progress = goal.progress
    ? `
      <span class="route-goal-progress">
        <i><span style="width:${goal.progress.pct}%"></span></i>
        <em>${goal.progress.label || `${goal.progress.current}/${goal.progress.target}`}</em>
      </span>
    `
    : "";
  return `
    <button class="route-goal tone-${goal.tone || "paper"} ${index === 0 ? "is-primary" : ""}" ${attributes}>
      <span class="route-goal-icon">${icon(goal.icon, 18)}</span>
      <span class="route-goal-copy">
        <small>${index === 0 && context !== "ending" ? "现在可做" : goal.eyebrow}${index === 0 && context !== "ending" ? ` · ${goal.eyebrow}` : ""}</small>
        <b>${goal.title}</b>
        <p>${goal.description}</p>
        ${progress}
      </span>
      <span class="route-goal-open">${icon("arrow-up-right", 16)}</span>
    </button>
  `;
}

function renderRouteGuide(options = {}) {
  const context = options.context || "map";
  const goals = buildRoutePlan(state, {
    limit: options.limit || (context === "ending" ? 3 : 2),
  });
  if (!goals.length) return "";
  return `
    <section class="route-guide is-${context}" aria-label="星命路标">
      <header>
        <div>
          <p class="eyebrow">${icon("compass", 14)} 星命路标</p>
          <h3>${context === "ending" ? "水泊之后，星命未尽" : "下一步，不必猜"}</h3>
        </div>
        <span>${goals.length} 条可追</span>
      </header>
      <div class="route-goal-list">
        ${goals.map((goal, index) => renderRouteGoal(goal, index, context)).join("")}
      </div>
    </section>
  `;
}

function heroPortrait(heroId, className = "") {
  const hero = HEROES[heroId];
  if (!hero) return "";
  return `<img class="${className}" src="${hero.cutout}" alt="${hero.name}" draggable="false" />`;
}

function heroThumb(heroId, className = "") {
  const hero = HEROES[heroId];
  if (!hero) return "";
  const thumb = hero.cutout.replace(/\/cutout\.png$/, "/thumb.webp");
  return `<img class="${className}" src="${thumb}" alt="${hero.name}" draggable="false" decoding="async" />`;
}

function heroKeyart(heroId, className = "") {
  const hero = HEROES[heroId];
  if (!hero) return "";
  return `<img class="${className}" src="${hero.keyart}" alt="${hero.name}" draggable="false" />`;
}

function pathBadge(pathId, compact = false) {
  const path = PATHS[pathId];
  if (!path) return "";
  return `
    <span class="path-badge ${compact ? "is-compact" : ""}" style="--path-color:${path.color}">
      <img src="${path.icon}" alt="" />
      <span>${path.name}</span>
    </span>
  `;
}

function chainPathMark(pathId = null, className = "") {
  const path = PATHS[pathId];
  if (!path) {
    return `<span class="chain-path-mark is-empty ${className}" aria-hidden="true"></span>`;
  }
  return `
    <span class="chain-path-mark ${className}" style="--path-color:${path.color}" title="${path.name}" aria-label="${path.name}">
      <b>${path.short}</b>
    </span>
  `;
}

function teamChainPreview() {
  const heroIds = state.team.filter(
    (heroId) => heroId && state.roster[heroId],
  );
  const pathIds = [...new Set(heroIds.map((heroId) => HEROES[heroId].path))];
  const formation =
    Object.values(CHAIN_FORMATIONS).find(
      (entry) =>
        entry.paths.length === pathIds.length &&
        entry.paths.every((pathId) => pathIds.includes(pathId)),
    ) || null;
  const missingPathIds = Object.keys(PATHS).filter(
    (pathId) => !pathIds.includes(pathId),
  );
  const replacementHeroId = state.recruited.find(
    (heroId) =>
      !heroIds.includes(heroId) &&
      missingPathIds.includes(HEROES[heroId]?.path),
  );
  return { heroIds, pathIds, formation, missingPathIds, replacementHeroId };
}

function currentAutoTactic() {
  return (
    AUTO_BATTLE_TACTICS[
      normalizeAutoBattleTactic(state?.settings?.autoTactic)
    ] || AUTO_BATTLE_TACTICS.balanced
  );
}

function statLine(stats, className = "") {
  return `
    <div class="stat-line ${className}">
      <span>${icon("heart", 14)}${stats.maxHp}</span>
      <span>${icon("swords", 14)}${stats.atk}</span>
      <span>${icon("shield", 14)}${stats.def}</span>
      <span>${icon("wind", 14)}${stats.spd}</span>
    </div>
  `;
}

function bondHeroNames(bond) {
  return bond.heroIds.map((heroId) => HEROES[heroId]?.name).filter(Boolean);
}

function renderBondCard(bond, options = {}) {
  const active = Boolean(options.active);
  const discovered = Boolean(options.discovered);
  const compact = Boolean(options.compact);
  return `
    <article class="bond-card tone-${bond.tone} ${active ? "is-active" : ""} ${discovered ? "is-discovered" : ""} ${compact ? "is-compact" : ""}">
      <span class="bond-mark">${icon(bond.icon, compact ? 16 : 20)}</span>
      <div class="bond-copy">
        <small>${bond.kind === "trio" ? "三人聚义" : "双雄相契"} · ${bondHeroNames(bond).join(" · ")}</small>
        <b>${bond.name}</b>
        <p>${bond.desc}</p>
      </div>
      <em>${active ? "临阵生效" : discovered ? "已录阵谱" : "尚未结成"}</em>
      ${
        compact
          ? ""
          : `<div class="bond-figures">
              ${bond.heroIds
                .map((heroId) => heroPortrait(heroId, ""))
                .join("")}
            </div>`
      }
    </article>
  `;
}

function renderBondUnlocks() {
  if (!lastBondUnlocks.length) return "";
  const copper = lastBondUnlocks.reduce(
    (total, bond) => total + (bond.reward?.copper || 0),
    0,
  );
  const xp = lastBondUnlocks.reduce(
    (total, bond) => total + (bond.reward?.xp || 0),
    0,
  );
  return `
    <div class="bond-unlock-strip">
      <span>${icon("sparkles", 17)} 新兄弟契入册</span>
      ${lastBondUnlocks
        .map(
          (bond) => `
            <b>${icon(bond.icon, 14)}${bond.name}<small>${bondHeroNames(bond).join("、")}</small></b>
          `,
        )
        .join("")}
      <em>铜钱 +${copper} · 历练 +${xp}</em>
    </div>
  `;
}

function renderChainUnlocks() {
  if (!lastChainUnlocks.length) return "";
  const copper = lastChainUnlocks.reduce(
    (total, formation) => total + (formation.reward?.copper || 0),
    0,
  );
  const xp = lastChainUnlocks.reduce(
    (total, formation) => total + (formation.reward?.xp || 0),
    0,
  );
  return `
    <div class="chain-unlock-strip">
      <span>${icon("sparkles", 17)} 星命合击入谱</span>
      ${lastChainUnlocks
        .map(
          (formation) => `
            <b class="tone-${formation.tone}">${icon(formation.icon, 14)}${formation.name}<small>${formation.desc}</small></b>
          `,
        )
        .join("")}
      <em>铜钱 +${copper} · 历练 +${xp}</em>
    </div>
  `;
}

function statusList(unit) {
  return Object.entries(unit.statuses || {})
    .filter(([status, duration]) => duration > 0 && STATUS_DEFS[status])
    .map(
      ([status, duration]) => `
        <span class="status-chip status-${STATUS_DEFS[status]?.tone || "neutral"}" title="${STATUS_DEFS[status]?.name || status}">
          <img src="${STATUS_DEFS[status]?.icon || ""}" alt="" />
          <b>${duration}</b>
        </span>
      `,
    )
    .join("");
}

function renderGame() {
  const currentRosterGallery = document.querySelector(
    ".roster-screen .hero-gallery",
  );
  if (screen === "roster" && currentRosterGallery && !rosterResetScroll) {
    rosterGalleryScrollTop = currentRosterGallery.scrollTop;
  }
  pendingInputRestore ||= captureInputRestore(document.activeElement);
  clearBattleTimerIfLeavingBattle();
  titleVideoCleanup?.();
  titleVideoCleanup = null;
  let content = "";
  if (screen === "title") content = renderTitle();
  if (screen === "map") content = renderMap();
  if (screen === "camp") content = renderCamp();
  if (screen === "roster") content = renderRoster();
  if (screen === "quests") content = renderQuestBoard();
  if (screen === "formation") content = renderFormation();
  if (screen === "equipment") content = renderEquipment();
  if (screen === "codex") content = renderCodex();
  if (screen === "settings") content = renderSettings();
  if (screen === "arena") content = renderArena();
  if (screen === "arena-reward") content = renderArenaReward();
  if (screen === "story") content = renderStory();
  if (screen === "battle") content = renderBattle();
  if (screen === "reward") content = renderReward();
  if (screen === "final-choice") content = renderFinalChoice();
  if (screen === "ending") content = renderEnding();

  app.innerHTML = `
    <div class="game-frame screen-${screen}" style="--screen-bg:url('${
      activeChapter?.bg || currentChapterBg()
    }')">
      ${content}
      <div class="toast-layer" id="toast-layer" aria-live="polite"></div>
      ${renderModal()}
    </div>
  `;
  applyPreferences();
  createIcons({
    icons: ICON_COMPONENTS,
    attrs: {
      "stroke-width": 1.7,
      "aria-hidden": "true",
    },
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  if (screen === "roster") {
    const gallery = document.querySelector(".roster-screen .hero-gallery");
    if (gallery) {
      gallery.scrollTop = rosterResetScroll ? 0 : rosterGalleryScrollTop;
    }
  }
  rosterResetScroll = false;
  restoreInputFocus();
  if (screen === "title") bindTitleVideo();
  if (screen === "battle") {
    syncBattleVfxVideo();
    runBattleAutomation();
  }
  if (screen === "arena-reward") queueArenaAutoContinue();
  else clearArenaAutoTimer();
}

function syncBattleVfxVideo() {
  const container = document.querySelector(".skill-video");
  const video = container?.querySelector("video");
  if (!video) return;
  const speed = [1, 2, 4].includes(state?.settings?.battleSpeed)
    ? state.settings.battleSpeed
    : 1;
  video.playbackRate = speed;
  const markAlphaSource = () => {
    container.classList.toggle("has-alpha", video.currentSrc.endsWith(".webm"));
  };
  markAlphaSource();
  video.addEventListener("loadedmetadata", markAlphaSource, { once: true });
  video.addEventListener(
    "ended",
    () => container.classList.add("is-ended"),
    { once: true },
  );
  video.play()?.catch(() => {
    container.classList.add("is-poster-only");
  });
}

function restoreInputFocus() {
  const restore = pendingInputRestore;
  pendingInputRestore = null;
  if (!restore) return;
  const input = document.querySelector(restore.selector);
  if (!textInputFrom(input)) return;
  input.focus({ preventScroll: true });
  if (restore.selectionStart === null) return;
  try {
    input.setSelectionRange(
      restore.selectionStart,
      restore.selectionEnd,
      restore.selectionDirection || "none",
    );
  } catch {
    // Some input types expose no selection API.
  }
}

function render() {
  try {
    renderGame();
  } catch (error) {
    reportDiagnostic("error", "render-failed", {
      screen,
      error: String(error?.stack || error),
    });
    showFatalError(error);
  }
}

function showFatalError(error) {
  if (document.querySelector("#fatal-error")) return;
  app.innerHTML = `
    <main id="fatal-error" class="fatal-error-screen" role="alert">
      <section>
        <p class="eyebrow">运行故障</p>
        <h1>页面未能完成绘卷</h1>
        <p>当前画面发生异常，进度会尽量保留。请重载游戏；如果问题重复出现，可打开本地诊断日志。</p>
        <pre>${escapeHtml(String(error?.message || error || "未知错误"))}</pre>
        <div>
          <button class="button primary" type="button" data-fatal-reload>重新载入</button>
          ${
            diagnosticsBridge
              ? '<button class="button ghost" type="button" data-fatal-open-logs>打开诊断日志</button>'
              : ""
          }
        </div>
      </section>
    </main>
  `;
  document.querySelector("[data-fatal-reload]")?.addEventListener("click", () => {
    window.location.reload();
  });
  document.querySelector("[data-fatal-open-logs]")?.addEventListener("click", () => {
    diagnosticsBridge?.openLogFolder?.().catch?.(() => {});
  });
}

function bindTitleVideo() {
  const video = document.querySelector(".title-video");
  if (!video) return;

  const reducedMotion = reducedMotionFor(state);
  const showFallback = () => video.classList.remove("is-playing");
  const play = () => {
    if (reducedMotion) {
      video.pause();
      showFallback();
      return;
    }
    const playback = video.play();
    playback?.catch(showFallback);
  };
  const handleVisibility = () => {
    if (document.hidden) showFallback();
    else play();
  };

  video.addEventListener("playing", () => video.classList.add("is-playing"));
  video.addEventListener("pause", showFallback);
  video.addEventListener("waiting", showFallback);
  video.addEventListener("stalled", showFallback);
  video.addEventListener("error", showFallback);
  document.addEventListener("visibilitychange", handleVisibility);
  play();

  titleVideoCleanup = () => {
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

function reducedMotionFor(preferences) {
  return Boolean(
    preferences?.settings?.reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
}

function currentChapterBg() {
  if (!state) return CHAPTERS[0].bg;
  return currentChapter(state)?.bg || CHAPTERS[CHAPTERS.length - 1].bg;
}

function clearBattleTimerIfLeavingBattle() {
  if (screen === "battle") return;
  if (battleTimer) {
    window.clearTimeout(battleTimer);
    battleTimer = null;
  }
  clearBattleFeedbackTimer();
}

function scheduleBattle(callback, delay = 0) {
  if (battleTimer) window.clearTimeout(battleTimer);
  const speed = [1, 2, 4].includes(state?.settings?.battleSpeed)
    ? state.settings.battleSpeed
    : 1;
  battleTimer = window.setTimeout(() => {
    battleTimer = null;
    callback();
  }, Math.max(35, Math.round(delay / speed)));
}

function battleVfxTransitionDelay(defaultDelay) {
  if (!battleUi.vfx?.videoKey || reducedMotionFor(state)) return defaultDelay;
  return Math.max(defaultDelay, 1480);
}

function setScreen(nextScreen) {
  const previousScreen = screen;
  if (screen === "battle" || screen === "story") {
    if (battleTimer) window.clearTimeout(battleTimer);
    battleTimer = null;
    clearBattleFeedbackTimer();
  }
  clearEndingCinematicTimer();
  if (nextScreen !== "ending") endingCinematicActive = false;
  clearArenaAutoTimer();
  screen = nextScreen;
  rosterDetailOpen = false;
  if (previousScreen !== "roster" || nextScreen !== "roster") {
    rosterGalleryScrollTop = 0;
    rosterResetScroll = true;
  }
  pendingInputRestore = null;
  updateSteamPresence();
  render();
}

function clearEndingCinematicTimer() {
  if (!endingCinematicTimer) return;
  window.clearTimeout(endingCinematicTimer);
  endingCinematicTimer = null;
}

function showEndingCinematic(endingId) {
  if (reducedMotionFor(state)) {
    endingCinematicActive = false;
    setScreen("ending");
    return;
  }
  endingCinematicActive = true;
  setScreen("ending");
  endingCinematicTimer = window.setTimeout(() => {
    endingCinematicTimer = null;
    endingCinematicActive = false;
    render();
  }, 5700);
  reportDiagnostic?.("info", "ending-cinematic", { endingId });
}

function clearArenaAutoTimer() {
  if (!arenaAutoTimer) return;
  window.clearTimeout(arenaAutoTimer);
  arenaAutoTimer = null;
}

function queueArenaAutoContinue() {
  clearArenaAutoTimer();
  if (
    screen !== "arena-reward" ||
    modal ||
    document.hidden ||
    !state?.settings?.autoArena ||
    !arenaRun
  ) {
    return;
  }
  const plan = planArenaAutoContinue(arenaRun, arenaRewardChoices);
  if (plan.action !== "continue") return;
  const speed = [1, 2, 4].includes(state.settings.battleSpeed)
    ? state.settings.battleSpeed
    : 1;
  const delay = Math.max(900, Math.round(2200 / speed));
  arenaAutoTimer = window.setTimeout(() => {
    arenaAutoTimer = null;
    if (
      screen !== "arena-reward" ||
      modal ||
      document.hidden ||
      !state?.settings?.autoArena ||
      !arenaRun ||
      !arenaRun.pendingBoons?.includes(plan.boonId)
    ) {
      return;
    }
    chooseArenaReward(plan.boonId);
  }, delay);
}

function applyPreferences() {
  sound.setSceneMusic(screen, {
    chapterId: activeChapter?.id || null,
    boss: Boolean(
      battle?.enemies?.some((unit) => unit.boss && unit.hp > 0),
    ),
  });
  const reducedMotion = Boolean(
    state?.settings?.reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  if (!state) return;
  sound.setEnabled(state.settings.sound);
  sound.setVolumes({
    musicVolume: state.settings.musicVolume / 100,
    sfxVolume: state.settings.sfxVolume / 100,
  });
  document.documentElement.dataset.textSpeed = state.settings.textSpeed;
  document.documentElement.dataset.uiScale = [
    "normal",
    "large",
    "largest",
  ].includes(state.settings.uiScale)
    ? state.settings.uiScale
    : "normal";
  document.documentElement.dataset.contrast = state.settings.highContrast
    ? "high"
    : "normal";
}

function reportDiagnostic(level, event, details = null) {
  diagnosticsBridge
    ?.report?.(level, event, details)
    .catch?.(() => {});
}

function steamStatsSnapshot() {
  if (!state) return {};
  return {
    battlesWon: state.stats?.battlesWon || 0,
    enemiesDefeated: state.stats?.enemiesDefeated || 0,
    heroesRecruited: state.recruited?.length || 0,
    arenaBestWave: state.arena?.bestWave || 0,
    chapterMedals: Object.values(state.chapterMedals || {}).reduce(
      (total, medals) => total + (Array.isArray(medals) ? medals.length : 0),
      0,
    ),
    newGamePlus: state.newGamePlus || 0,
  };
}

function unlockSteamAchievements(ids) {
  if (!steamStatus.available || !ids?.length) return;
  steamBridge
    ?.unlockAchievements?.(ids)
    .catch((error) =>
      reportDiagnostic("warning", "steam-achievement-failed", String(error)),
    );
}

function syncSteamStats() {
  if (!steamStatus.available || !state) return;
  steamBridge
    ?.syncStats?.(steamStatsSnapshot())
    .catch((error) =>
      reportDiagnostic("warning", "steam-stats-failed", String(error)),
    );
}

function queueSteamCloudSave(delay = 700) {
  if (!steamStatus.available || !steamStatus.cloudEnabled || !steamBridge) return;
  if (steamCloudTimer) window.clearTimeout(steamCloudTimer);
  steamCloudTimer = window.setTimeout(() => {
    steamCloudTimer = null;
    syncSteamCloudNow(false);
  }, delay);
}

async function syncSteamCloudNow(showResult = true) {
  if (!steamStatus.available || !steamStatus.cloudEnabled || !steamBridge || steamCloudSyncing) {
    if (showResult) {
      toast(
        steamStatus.available
          ? "Steam 云存档尚未启用"
          : "当前为本地存档模式",
        "default",
      );
    }
    return false;
  }
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) {
    if (showResult) toast("当前没有可同步的战卷", "danger");
    return false;
  }

  steamCloudSyncing = true;
  try {
    const result = await steamBridge.writeCloudSave(raw);
    if (result?.ok) {
      lastSteamCloudSyncAt = new Date().toISOString();
      if (showResult) toast("Steam 云存档已同步", "success");
      if (screen === "settings" && state) render();
      return true;
    }
    reportDiagnostic("warning", "steam-cloud-write-failed", result);
    if (showResult) toast("Steam 云存档写入失败", "danger");
    return false;
  } catch (error) {
    reportDiagnostic("error", "steam-cloud-write-error", String(error));
    if (showResult) toast("Steam 云存档写入失败", "danger");
    return false;
  } finally {
    steamCloudSyncing = false;
  }
}

function updateSteamPresence() {
  if (!steamStatus.available || !steamBridge) return;
  const chapter = activeChapter || (state ? currentChapter(state) : null);
  const labels = {
    title: "主菜单",
    map: "江湖行军",
    camp: "梁山营寨",
    roster: "好汉名册",
    formation: "三阵点将",
    equipment: "兵械整备",
    codex: "星命图谱",
    settings: "游戏设置",
    arena: arenaRun ? `演武第 ${arenaRun.wave} 阵` : "梁山演武",
    "arena-reward": arenaRun ? `演武第 ${arenaRun.wave} 阵` : "梁山演武",
    story: chapter ? chapter.title : "章回剧情",
    battle: battle?.mode === "arena"
      ? `演武第 ${battle.arenaWave} 阵`
      : chapter
        ? `${chapter.title} · 战斗`
        : "战斗",
    reward: "战后结算",
    "final-choice": "终卷抉择",
    ending: "全篇终",
  };
  steamBridge
    ?.setPresence?.({
      status: labels[screen] || "星命水浒",
      mode: battle?.mode === "arena" ? "arena" : state?.ending ? "ending" : "campaign",
      chapter: chapter?.title || "",
      progress: state ? `${completionPercent(state)}%` : "",
    })
    .catch((error) =>
      reportDiagnostic("warning", "steam-presence-failed", String(error)),
    );
}

async function initializePlatformServices() {
  if (!steamBridge?.getStatus) return;
  try {
    steamStatus = await steamBridge.getStatus();
    if (!steamStatus.available || !steamStatus.cloudEnabled) return;
    const cloud = await steamBridge.readCloudSave();
    if (!cloud?.ok) {
      reportDiagnostic("warning", "steam-cloud-read-failed", cloud);
      return;
    }
    const localRaw = window.localStorage.getItem(SAVE_KEY);
    const selected = chooseNewestSaveText(localRaw, cloud.content);
    if (selected?.source === "cloud") {
      if (localRaw) window.localStorage.setItem(SAVE_BACKUP_KEY, localRaw);
      window.localStorage.setItem(SAVE_KEY, selected.text);
      reportDiagnostic("info", "steam-cloud-restored", {
        savedAt: selected.savedAt,
      });
    } else if (selected?.source === "local") {
      queueSteamCloudSave(150);
    }
  } catch (error) {
    reportDiagnostic("warning", "steam-initialize-failed", String(error));
  }
}

function persist() {
  if (!state) return false;
  const unlocked = checkAchievements(state);
  if (unlocked.length) lastAchievementUnlocks = unlocked;
  if (!saveGame(state)) {
    const now = Date.now();
    reportDiagnostic("error", "save-write-failed", {
      screen,
      chapter: activeChapter?.id || null,
    });
    if (now - lastSaveFailureAt > 5000) {
      lastSaveFailureAt = now;
      toast("存档写入失败，请检查磁盘空间或权限", "danger");
    }
    return false;
  }
  unlockSteamAchievements(unlocked.map((achievement) => achievement.id));
  syncSteamStats();
  queueSteamCloudSave();
  updateSteamPresence();
  return true;
}

function toast(message, tone = "default") {
  const layer = document.querySelector("#toast-layer");
  if (!layer) return;
  if (toastTimer) window.clearTimeout(toastTimer);
  layer.innerHTML = `
    <div class="toast toast-${tone}">
      ${icon(tone === "success" ? "check" : tone === "danger" ? "circle-alert" : "scroll-text", 18)}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  createIcons({ icons: ICON_COMPONENTS });
  toastTimer = window.setTimeout(() => {
    layer.innerHTML = "";
  }, 2800);
}

function showClickFeedback(element, event) {
  if (!element || reducedMotionFor(state)) return;
  const origin = clickFeedbackOrigin(element, event);
  if (!origin || origin.width <= 0 || origin.height <= 0) return;
  const feedback = document.createElement("span");
  const size = Math.max(
    28,
    Math.min(82, Math.min(origin.width, origin.height) * 0.78),
  );
  const tone =
    element.classList.contains("primary") || element.closest(".topbar")
      ? "bronze"
      : "paper";
  feedback.className = `ui-click-feedback tone-${tone}`;
  feedback.style.setProperty("--feedback-x", `${origin.x}px`);
  feedback.style.setProperty("--feedback-y", `${origin.y}px`);
  feedback.style.setProperty("--feedback-size", `${size}px`);
  document.body.append(feedback);
  feedback.addEventListener("animationend", () => feedback.remove(), {
    once: true,
  });
  window.setTimeout(() => feedback.remove(), 620);
}

function showCurrencyFeedback(previous, current) {
  const feedback = currencyFeedback(previous, current);
  const resource = document.querySelector(".topbar-resource");
  if (!feedback || !resource) return;
  resource.classList.add(`is-${feedback.tone}`);
  const float = document.createElement("span");
  float.className = `currency-feedback is-${feedback.tone}`;
  float.setAttribute("aria-live", "polite");
  float.textContent = `${feedback.label} 贯`;
  resource.append(float);
  window.setTimeout(() => {
    resource.classList.remove(`is-${feedback.tone}`);
    float.remove();
  }, 1100);
}

function openModal({ title, body, actions = [], kind = "" }) {
  modal = { title, body, actions, kind };
  render();
}

function closeModal() {
  modal = null;
  render();
}

function renderModal() {
  if (!modal) return "";
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-panel ${modal.kind ? `is-${modal.kind}` : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(modal.title)}" data-modal-panel>
        <button class="icon-button modal-close" data-action="close-modal" aria-label="关闭">${icon("x", 18)}</button>
        <p class="eyebrow">梁山令</p>
        <h2>${escapeHtml(modal.title)}</h2>
        <div class="modal-body">${modal.body}</div>
        <div class="modal-actions">
          ${modal.actions
            .map(
              (action) => `
                <button class="button ${action.tone || "ghost"}" data-action="${action.action}">
                  ${action.icon ? icon(action.icon, 17) : ""}
                  <span>${escapeHtml(action.label)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function topbar(active = "", backAction = "") {
  if (!state) return "";
  const progress = completionPercent(state);
  const chapter = currentChapter(state);
  const navItems = [
    { id: "map", label: "江湖", icon: "map" },
    { id: "camp", label: "营寨", icon: "landmark" },
    { id: "arena", label: "演武", icon: "swords" },
    { id: "roster", label: "好汉", icon: "users" },
    { id: "quests", label: "异闻", icon: "scroll-text" },
    { id: "codex", label: "星图", icon: "sparkles" },
    { id: "settings", label: "设置", icon: "settings" },
  ];
  return `
    <header class="topbar">
      <div class="topbar-leading">
        ${
          backAction
            ? `<button class="icon-button" data-action="${backAction}" aria-label="返回">${icon("arrow-left", 19)}</button>`
            : `<button class="brand-mark" data-action="go-map" aria-label="返回江湖地图">
                <span class="brand-star">${icon("star", 17)}</span>
                <span class="brand-copy"><b>星命水浒</b><small>风雪山神庙</small></span>
              </button>`
        }
        <div class="chapter-progress">
          <span>${state.currentChapter >= CHAPTERS.length ? "全篇终" : chapter.label}</span>
          <b>${state.currentChapter >= CHAPTERS.length ? "水泊已定" : chapter.title}</b>
        </div>
      </div>
      <div class="topbar-resource">
        ${icon("coins", 17)}
        <span>${state.inventory.copper}</span>
        <small>贯</small>
      </div>
      <nav class="topbar-nav" aria-label="主导航">
        ${navItems
          .map(
            (item) => `
              <button class="nav-button ${active === item.id ? "is-active" : ""}" data-action="nav-${item.id}" aria-label="${item.label}">
                ${icon(item.icon, 18)}
                <span>${item.label}</span>
              </button>
            `,
          )
          .join("")}
      </nav>
      <div class="progress-compact" title="战役完成度 ${progress}%">
        <span style="--progress:${progress}%"></span>
        <b>${progress}%</b>
      </div>
    </header>
  `;
}

function renderTitlePrologue(saved) {
  const profile = openingCinematicProfile(saved);
  return `
    <section class="title-prologue is-${profile.variant}" style="--scene-count:${profile.scenes.length}" aria-hidden="true">
      ${profile.scenes
        .map(
          (scene, index) => `
            <figure class="title-prologue-frame" style="--scene:${index};--focus:${scene.focal};background-image:url('${scene.asset}')">
              <figcaption>
                <small>${escapeHtml(scene.label)}</small>
                <b>${escapeHtml(scene.title)}</b>
                <p>${escapeHtml(scene.text)}</p>
              </figcaption>
            </figure>
          `,
        )
        .join("")}
      <span class="title-prologue-rule"></span>
    </section>
  `;
}

function renderTitle() {
  const saved = hasSavedGame() ? loadGame() : null;
  const showPrologue = !titleProloguePlayed && !reducedMotionFor(saved);
  titleProloguePlayed = true;
  const routeLead = saved
    ? buildRoutePlan(saved, { limit: 1 })[0]
    : null;
  const arenaResume = saved?.arena?.activeRun
    ? ` · ${saved.arena.activeRun.mode === "weekly" ? "本周军令" : "演武"}第 ${saved.arena.activeRun.wave} 阵待续`
    : "";
  return `
    <main class="title-screen ${showPrologue ? "has-prologue" : ""}">
      <div class="title-backdrop" aria-hidden="true"></div>
      <video class="title-video" autoplay muted loop playsinline poster="${titlePosterUrl}">
        <source src="${titleVideoUrl}" type="video/mp4" />
      </video>
      ${showPrologue ? renderTitlePrologue(saved) : ""}
      <div class="title-shade"></div>
      <div class="title-rule"></div>
      <section class="title-content">
        <p class="title-kicker"><span></span>北宋末年 · 梁山群像回合 RPG</p>
        <h1><span>星命</span>水浒</h1>
        <p class="title-subtitle">风雪山神庙</p>
        <p class="title-copy">一纸冤案，${HERO_ORDER.length}位好汉，${CHAPTERS.length}场风雪。<br />从黄河夜渡到水泊聚义，替梁山选一条能走下去的路。</p>
        <div class="title-actions">
          ${
            saved
              ? `<button class="button primary large" data-action="continue-game">
                  ${icon("play", 20)}<span>续上旧卷</span>
                  <small>${saved.completedChapters.length}/${CHAPTERS.length} 回</small>
                </button>`
              : ""
          }
          <button class="button ${saved ? "secondary" : "primary"} large" data-action="new-game">
            ${icon("book-open", 20)}<span>${saved ? "另开新卷" : "踏入江湖"}</span>
          </button>
          <button class="button ghost large" data-action="title-settings">
            ${icon("settings", 20)}<span>设置</span>
          </button>
        </div>
        ${
          saved
            ? `<p class="continue-note">上次行至：${escapeHtml(saved.ending ? "全篇终" : currentChapter(saved).title)} · 完成度 ${completionPercent(saved)}%${escapeHtml(arenaResume)}${
                routeLead
                  ? `<span class="title-next-goal">${icon("compass", 14)}<b>${escapeHtml(routeLead.eyebrow)}</b>${escapeHtml(routeLead.title)}</span>`
                  : ""
              }</p>`
            : `<div class="difficulty-picker title-difficulty">
                <span>选择难度</span>
                ${Object.values(DIFFICULTIES)
                  .map(
                    (difficulty) => `
                      <button class="${selectedDifficulty === difficulty.id ? "is-selected" : ""}" data-action="difficulty" data-difficulty="${difficulty.id}">
                        <b>${difficulty.name}</b>
                        <small>${difficulty.desc}</small>
                      </button>
                    `,
                  )
                  .join("")}
              </div>`
        }
      </section>
      <aside class="title-roster" aria-label="${HERO_ORDER.length}位好汉">
        <p>天罡地煞 · ${HERO_ORDER.length}位好汉</p>
        <div class="title-figures">
          ${TITLE_FEATURED_HEROES
            .map(
              (heroId, index) => `
                <div class="title-figure" style="--index:${index}">
                  ${heroThumb(heroId, "")}
                  <span>${HEROES[heroId].nickname}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </aside>
      <footer class="title-footer">
        <span>单机战役 · 自动存档</span>
        <span>手柄 / 键盘 / 鼠标 / 触屏</span>
        <button data-action="title-settings">${icon("volume-2", 15)} ${saved?.settings?.sound === false ? "声音关闭" : "声音开启"}</button>
      </footer>
    </main>
  `;
}

function renderMap() {
  const chapter = chapterById(focusedChapterId) || currentChapter(state);
  const status = chapterStatus(state, chapter);
  const team = activeHeroes(state);
  return `
    <div class="app-screen map-screen">
      ${topbar("map")}
      <main class="map-layout">
        <section class="chapter-focus" style="--chapter-bg:url('${chapter.bg}')">
          <div class="chapter-focus-shade"></div>
          <div class="chapter-focus-copy">
            <div class="chapter-seal">
              <span>${chapter.label}</span>
              <b>${chapter.index + 1}</b>
            </div>
            <p class="eyebrow">${chapter.location}</p>
            <h1>${chapter.title}</h1>
            <p class="chapter-summary">${chapter.summary}</p>
            <div class="objective-line">${icon("target", 18)}<span>${chapter.objective}</span></div>
            ${renderChapterMedals(state, chapter)}
            <div class="chapter-focus-actions">
              <button class="button primary large" data-action="enter-chapter" ${status === "locked" ? "disabled" : ""}>
                ${icon(status === "completed" ? "rotate-ccw" : status === "locked" ? "lock-keyhole" : "play", 20)}
                <span>${status === "completed" ? "重游旧战" : status === "locked" ? "尚未解锁" : "启程"}</span>
              </button>
              ${
                status !== "locked"
                  ? `<button class="button glass large" data-action="nav-camp">${icon("landmark", 19)}<span>先回营整备</span></button>`
                  : ""
              }
            </div>
          </div>
          <div class="chapter-party">
            <p>当前出战</p>
            <div class="chapter-party-figures">
              ${team
                .map(
                  ({ heroId, row, entry }) => `
                    <button data-action="equipment-hero" data-hero="${heroId}" title="${ROWS[row].name} · ${HEROES[heroId].name}">
                      ${heroPortrait(heroId, "")}
                      <span>${HEROES[heroId].name}<small>Lv.${entry.level}</small></span>
                    </button>
                  `,
                )
                .join("")}
            </div>
            <div class="party-power">${icon("flame", 17)} 队伍战力 <b>${Math.round(totalPower(state))}</b></div>
          </div>
        </section>
        <aside class="campaign-rail">
          <div class="campaign-rail-head">
            <div>
              <p class="eyebrow">梁山行军录</p>
              <h2>风雪${CHAPTERS.length}回</h2>
            </div>
            <span>${state.completedChapters.length}/${CHAPTERS.length}</span>
          </div>
          ${renderRouteGuide({ limit: 2 })}
          <div class="chapter-list">
            ${CHAPTERS.map((item) => {
              const itemStatus = chapterStatus(state, item);
              return `
                <button class="chapter-node status-${itemStatus} ${chapter.id === item.id ? "is-focused" : ""}" data-action="select-chapter" data-chapter="${item.id}">
                  <span class="node-index">${String(item.index + 1).padStart(2, "0")}</span>
                  <span class="node-line"></span>
                  <span class="node-copy">
                    <small>${item.label} · ${item.location}</small>
                    <b>${item.title}</b>
                  </span>
                  <span class="node-medals">${chapterMedalIds(state, item).length}/${CHAPTER_MEDALS.length}</span>
                  ${icon(itemStatus === "completed" ? "circle-check" : itemStatus === "locked" ? "lock-keyhole" : "chevron-right", 18)}
                </button>
              `;
            }).join("")}
          </div>
          <div class="rail-quick">
            <button data-action="nav-roster">${icon("users", 19)}<span><b>编成好汉</b><small>${state.recruited.length} 人结义</small></span>${icon("chevron-right", 17)}</button>
            <button data-action="nav-camp">${icon("landmark", 19)}<span><b>经营营寨</b><small>${state.inventory.copper} 贯可用</small></span>${icon("chevron-right", 17)}</button>
          </div>
        </aside>
      </main>
    </div>
  `;
}

function renderCamp() {
  const team = activeHeroes(state);
  const restCost = campRestCost(state);
  const next = currentChapter(state);
  const [campCols, campRows] = campAreaSize(state);
  const campLevel = campAreaLevel(state);
  const nextAreaWins = campAreaRequirement(state);
  const campBuildings = Object.values(CAMP_BUILDINGS).map((building) => ({
    building,
    status: campBuildingStatus(state, building.id),
  }));
  const builtCount = campBuildings.filter(
    ({ status }) => status === "built",
  ).length;
  const availableCount = campBuildings.filter(
    ({ status }) => status === "available",
  ).length;
  const lockedCount = campBuildings.filter(
    ({ status }) => status === "locked",
  ).length;
  const stockEntries = Object.entries(state.camp.stock).filter(
    ([productId, amount]) => CAMP_PRODUCTS[productId] && amount > 0,
  );
  return `
    <div class="app-screen camp-screen">
      ${topbar("camp")}
      <main class="camp-layout">
        <section class="camp-heading">
          <div>
            <p class="eyebrow">水泊深处 · 忠义堂前</p>
            <h1>梁山营寨</h1>
            <p>以战功开辟营区，经营水泊与工坊，让山寨真正成为众人的归处。</p>
          </div>
          <div class="camp-heading-data">
            <div class="camp-resources">
              <span>${icon("coins", 17)}<b>${state.inventory.copper}</b> 贯</span>
              <span>${icon("flame", 17)}<b>${Math.round(totalPower(state))}</b> 战力</span>
              <span>${icon("users", 17)}<b>${state.recruited.length}/${HERO_ORDER.length}</b> 好汉</span>
            </div>
            <div class="camp-team">
              ${team
                .map(
                  ({ heroId, entry }) => `
                    <button data-action="open-hero" data-hero="${heroId}">
                      ${heroPortrait(heroId, "")}
                      <span>${HEROES[heroId].name}<small>Lv.${entry.level}</small></span>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>
        <section class="camp-main">
          <div class="section-heading camp-main-heading">
            <div><p class="eyebrow">水泊营图 · 第 ${campLevel} 期</p><h2>${campCols} × ${campRows} 营区</h2></div>
            <div class="camp-main-tools">
              <div class="camp-building-counts" aria-label="营寨建筑状态">
                <span class="is-built"><b>${builtCount}</b>已建</span>
                <span class="is-available"><b>${availableCount}</b>可建</span>
                <span class="is-locked"><b>${lockedCount}</b>未开</span>
              </div>
              <button class="button small ${nextAreaWins !== null && state.stats.battlesWon >= nextAreaWins ? "secondary" : "ghost"}" data-action="expand-camp-area" ${nextAreaWins === null || state.stats.battlesWon < nextAreaWins ? "disabled" : ""}>${icon(nextAreaWins === null ? "check" : "grid-3x3", 15)}<span>${nextAreaWins === null ? "营区全开" : `扩建营区 · ${nextAreaWins} 胜`}</span></button>
            </div>
          </div>
          <div class="camp-map" aria-label="${campCols} × ${campRows} 梁山营寨建筑布局">
            ${campBuildings
              .map(({ building, status }) => {
                const [spanCols, spanRows] = building.size;
                const level = state.facilities[building.id] || 1;
                const recipe = CAMP_RECIPES.find(
                  (entry) => entry.buildingId === building.id,
                );
                const statusLabel =
                  status === "built"
                    ? "已建成"
                    : status === "available"
                      ? "可建造"
                      : "未解锁";
                const statusIcon =
                  status === "built"
                    ? "circle-check"
                    : status === "available"
                      ? "hammer"
                      : "lock-keyhole";
                const detail =
                  status === "built"
                    ? building.resource
                      ? `存量 ${state.camp.stock[building.resource] || 0}`
                      : recipe
                        ? "可加工"
                        : "设施已启用"
                    : status === "available"
                      ? `建造需 ${building.cost} 贯`
                      : `累计 ${building.unlockVictories} 胜开放`;
                return `
                  <button
                    class="camp-building is-${status}"
                    data-action="select-camp-building"
                    data-building="${building.id}"
                    data-zone="${CAMP_BUILDING_ZONES[building.id] || "寨务"}"
                    aria-label="${building.name}，${status === "built" ? `等级 ${level}` : status === "available" ? `可建造，需 ${building.cost} 贯` : `胜利 ${building.unlockVictories} 场后开放`}"
                    ${status === "locked" ? "disabled" : ""}
                  >
                    <span class="camp-building-top">
                      <span class="camp-building-icon">${icon(building.icon, 24)}</span>
                      <span class="camp-building-status">${icon(statusIcon, 12)}${statusLabel}</span>
                    </span>
                    <span class="camp-building-copy">
                      <small>${CAMP_BUILDING_ZONES[building.id] || "寨务"} · 占地 ${spanCols} × ${spanRows}</small>
                      <b>${building.name}</b>
                    </span>
                    <span class="camp-building-desc">${building.desc}</span>
                    <span class="camp-building-meta">
                      <em>${status === "built" ? `Lv.${level}` : detail}</em>
                      <small>${status === "built" ? detail : status === "available" ? "点击查看" : "继续征战"}</small>
                    </span>
                  </button>
                `;
              })
              .join("")}
          </div>
          <div class="camp-stock" aria-label="营寨库存">
            <span class="camp-stock-title">${icon("package-open", 15)}库存</span>
            ${stockEntries.length ? stockEntries.map(([productId, amount]) => `<span>${icon(CAMP_PRODUCTS[productId].icon, 14)}${CAMP_PRODUCTS[productId].name}<b>${amount}</b></span>`).join("") : `<small>建造农田、矿场、林地和水产后可采集原料</small>`}
          </div>
        </section>
        <aside class="camp-side">
          <section class="camp-operation">
            <div class="section-heading compact"><div><p class="eyebrow">营寨整备</p><h2>${icon("moon-star", 18)}休整与编成</h2></div></div>
            <button class="button secondary" data-action="camp-rest">${icon("flame", 17)}<span>营中休整 · ${restCost} 贯</span></button>
            <button class="button ghost" data-action="nav-roster">${icon("users", 17)}<span>调整三阵</span></button>
          </section>
          <section class="camp-next">
            <p class="eyebrow">下一程</p>
            <div class="next-chapter-art" style="background-image:url('${next.bg}')"></div>
            <span>${next.label} · ${next.location}</span>
            <h2>${next.title}</h2>
            <p>${next.summary}</p>
            <button class="button primary" data-action="go-map">${icon("map", 18)}<span>查看行军图</span></button>
          </section>
        </aside>
      </main>
    </div>
  `;
}

function openCampBuilding(buildingId) {
  const building = CAMP_BUILDINGS[buildingId];
  if (!building) return;
  const status = campBuildingStatus(state, buildingId);
  const level = state.facilities[buildingId] || 1;
  const facility = FACILITIES[buildingId];
  const recipe = CAMP_RECIPES.find(
    (entry) => entry.buildingId === buildingId,
  );
  const actions = [];
  if (status === "available") {
    actions.push({
      label: `建造 · ${building.cost} 贯`,
      action: "build-camp-building",
      tone: "primary",
      icon: "hammer",
      building: building.id,
    });
  }
  if (status === "built" && building.resource) {
    actions.push({
      label: `收获 · ${CAMP_PRODUCTS[building.resource].name} +${building.output + level - 1}`,
      action: "collect-camp-resource",
      tone: "primary",
      icon: "package-open",
      building: building.id,
    });
  }
  if (status === "built" && recipe) {
    const recipeStatus = campRecipeStatus(state, recipe.id);
    actions.push({
      label: `${recipe.name} · ${CAMP_PRODUCTS[recipe.input.item].name} ${recipe.input.amount}`,
      action: "craft-camp-recipe",
      tone: "primary",
      icon: "refresh-cw",
      disabled: !recipeStatus.available,
      recipe: recipe.id,
    });
  }
  if (status === "built" && facility) {
    const cost = upgradeCost(state, buildingId);
    actions.push({
      label: cost ? `升级至 ${level + 1} 级 · ${cost} 贯` : "已至最高等级",
      action: "upgrade-facility",
      tone: "secondary",
      icon: cost ? "arrow-up" : "check",
      disabled: !cost,
      building: building.id,
    });
  }
  actions.push({
    label: "返回营图",
    action: "close-modal",
    tone: "ghost",
    icon: "grid-3x3",
  });
  const stock = Object.entries(state.camp.stock)
    .filter(([productId, amount]) => CAMP_PRODUCTS[productId] && amount > 0)
    .map(
      ([productId, amount]) =>
        `<span>${escapeHtml(CAMP_PRODUCTS[productId].name)}<b>${amount}</b></span>`,
    )
    .join("");
  const statusCopy =
    status === "built"
      ? `${level} 级 · 占地 ${building.size[0]} × ${building.size[1]}`
      : status === "available"
        ? `胜利 ${building.unlockVictories} 场已解锁 · 建造需 ${building.cost} 贯`
        : `累计胜利 ${building.unlockVictories} 场后开放`;
  let operation = "";
  if (status === "built" && building.resource) {
    operation = `<p class="camp-dialog-intro">每次收获 <b>${CAMP_PRODUCTS[building.resource].name} +${building.output + level - 1}</b>，建筑升级后产量增加。</p>`;
  } else if (status === "built" && recipe) {
    operation = `<p class="camp-dialog-intro">消耗 <b>${CAMP_PRODUCTS[recipe.input.item].name} ${recipe.input.amount}</b>，产出 <b>${CAMP_PRODUCTS[recipe.output.item].name} ${recipe.output.amount}</b>。</p>`;
  }
  const modalActions = actions
    .map(
      ({ action, label, tone, icon: iconName, disabled, recipe: recipeId, building: targetBuilding }) =>
        `<button class="button ${tone || "ghost"}" data-action="${action}" data-building="${targetBuilding || ""}" data-facility="${targetBuilding || ""}" data-recipe="${recipeId || ""}" ${disabled ? "disabled" : ""}>${icon(iconName, 17)}<span>${escapeHtml(label)}</span></button>`,
    )
    .join("");
  openModal({
    title: building.name,
    body: `
      <p class="camp-dialog-intro">${escapeHtml(building.desc)}</p>
      <p class="camp-dialog-intro"><b>${escapeHtml(statusCopy)}</b></p>
      ${operation}
      <div class="camp-dialog-stock"><b>当前库存</b>${stock || "暂无"}</div>
      <div class="camp-dialog-actions">${modalActions}</div>
    `,
    actions: [],
  });
  document
    .querySelector("[data-modal-panel]")
    ?.setAttribute("data-camp-building", building.id);
}

function arenaBoonCards(boons, action, options = {}) {
  const counts = arenaBoonCounts();
  return boons
    .map((boon) => {
      const selected = selectedArenaBoon === boon.id;
      const recommended = options.recommendation?.boonId === boon.id;
      const count = counts[boon.id] || 0;
      const mastery = count >= 3 ? ARENA_BOON_MASTERIES[boon.id] : null;
      const nextMastery = count < 3 ? 3 - count : 0;
      return `
        <button class="arena-boon ${selected ? "is-selected" : ""} ${recommended ? "is-recommended" : ""}" data-action="${action}" data-boon="${boon.id}" ${options.disabled ? "disabled" : ""}>
          <span class="arena-boon-icon tone-${boon.tone}">${icon(boon.icon, 24)}</span>
          <span>
            <small>${recommended ? `<i class="arena-advisor-badge">${icon("compass", 11)}军师荐令</i> · ` : ""}${boon.route}路军令 · ${count ? `已取 ${count} 重` : "初立此令"}</small>
            <b>${boon.name}</b>
            <p>${boon.desc}</p>
            ${
              mastery
                ? `<i class="arena-boon-mastery">${icon(mastery.icon, 13)}阵眼已成：${mastery.name}</i>`
                : count > 0
                  ? `<i class="arena-boon-next">再取 ${nextMastery} 重，凝成${ARENA_BOON_MASTERIES[boon.id].name}</i>`
                  : ""
            }
          </span>
          <em>${selected ? icon("check", 17) : count >= 3 ? icon("sparkles", 17) : icon("plus", 17)}</em>
        </button>
      `;
    })
    .join("");
}

function renderArenaBuild(boons = arenaRun?.boons || [], compact = false) {
  if (!boons.length) return "";
  const build = arenaBuildSnapshot(boons);
  const nextSynergy = nextArenaSynergy(boons);
  const counts = Object.entries(build.counts).sort(
    (a, b) => b[1] - a[1] || ARENA_BOONS[a[0]].name.localeCompare(ARENA_BOONS[b[0]].name),
  );
  return `
    <div class="arena-build-summary ${compact ? "is-compact" : ""}">
      <div class="arena-build-heading">
        <span>${icon("layout-grid", 14)}军令成阵</span>
        <b>${build.masteries.length + build.synergies.length} 阵</b>
      </div>
      <div class="arena-build-traits">
        ${counts
          .map(([boonId, count]) => {
            const boon = ARENA_BOONS[boonId];
            return `
              <span class="tone-${boon.tone}" title="${boon.desc}">
                ${icon(boon.icon, 13)}
                <b>${boon.name}</b>
                <em>×${count}</em>
                <i>${Array.from({ length: 3 }, (_, index) => `<u class="${index < Math.min(3, count) ? "is-lit" : ""}"></u>`).join("")}</i>
              </span>
            `;
          })
          .join("")}
      </div>
      ${
        build.masteries.length || build.synergies.length
          ? `<div class="arena-doctrines">
              ${build.masteries
                .map(
                  ({ mastery }) =>
                    `<span class="is-mastery tone-${mastery.tone}" title="${mastery.desc}">${icon(mastery.icon, 14)}${mastery.name}</span>`,
                )
                .join("")}
              ${build.synergies
                .map(
                  (synergy) =>
                    `<span class="is-synergy tone-${synergy.tone}" title="${synergy.desc}">${icon(synergy.icon, 14)}${synergy.name}</span>`,
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        nextSynergy
          ? `<p class="arena-build-next">
              ${icon(nextSynergy.synergy.icon, 13)}
              <span>下一阵 <b>${nextSynergy.synergy.name}</b></span>
              <em>${nextSynergy.requirements
                .filter((requirement) => requirement.missing > 0)
                .map(
                  (requirement) =>
                    `${ARENA_BOONS[requirement.boonId].name}再 ${requirement.missing} 重`,
                )
                .join(" · ")}</em>
            </p>`
          : ""
      }
    </div>
  `;
}

function arenaRelicLadder() {
  const relics = arenaRelicIds();
  const next = nextArenaMilestone();
  return `
    <div class="arena-relic-block">
      <div class="arena-relic-heading">
        <span>星命遗物</span>
        <b>${relics.length}/${ARENA_MILESTONES.length}</b>
      </div>
      <div class="arena-relic-track">
        ${ARENA_MILESTONES.map((milestone) => {
          const relic = ARENA_RELICS[milestone.relicId];
          const unlocked = relics.includes(milestone.relicId);
          return `
            <span class="${unlocked ? "is-unlocked" : ""}" title="${relic.name}：${relic.desc}">
              ${icon(unlocked ? relic.icon : "lock-keyhole", 15)}
              <small>${milestone.wave} 阵</small>
            </span>
          `;
        }).join("")}
      </div>
      <p class="arena-relic-next">
        ${
          next
            ? `下一件：<b>${ARENA_RELICS[next.relicId].name}</b> · 破第 ${next.wave} 阵解锁`
            : `${ARENA_MILESTONES.length} 件星命遗物已经齐聚，演武纪录仍可继续刷新。`
        }
      </p>
    </div>
  `;
}

function prepareArenaDraft(force = false) {
  if (!force && arenaDraftBoons.length) return;
  const weekConfig = getArenaWeekConfig(state.arena.weekly.weekKey);
  if (
    force ||
    !Number.isFinite(arenaDraftSeed) ||
    arenaMode === "weekly"
  ) {
    arenaDraftSeed =
      arenaMode === "weekly"
        ? weekConfig.seed
        : ((Date.now() >>> 0) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }
  arenaDraftBoons =
    arenaMode === "weekly"
      ? getArenaWeekBoonOffer(weekConfig, 0, 3)
      : randomArenaBoons(3);
  selectedArenaBoon = arenaDraftBoons[0]?.id || null;
}

function arenaWeekProgress(weekly = state.arena.weekly) {
  const bestScore = weekly?.bestScore || 0;
  const reached = ARENA_WEEK_MARKS.filter((mark) =>
    (weekly?.marks || []).includes(mark.id),
  );
  const next = ARENA_WEEK_MARKS.find((mark) => mark.score > bestScore);
  return {
    bestScore,
    reached,
    next,
    percent: next ? pct(bestScore, next.score) : "100%",
  };
}

function renderArenaModeSwitch() {
  return `
    <div class="arena-mode-switch" role="group" aria-label="演武模式">
      <button class="${arenaMode === "endless" ? "is-selected" : ""}" data-action="select-arena-mode" data-mode="endless">
        <span>${icon("swords", 18)}</span>
        <b>无尽演武</b>
        <small>自由构筑 · 冲击最高波次</small>
      </button>
      <button class="${arenaMode === "weekly" ? "is-selected" : ""}" data-action="select-arena-mode" data-mode="weekly">
        <span>${icon("calendar-days", 18)}</span>
        <b>本周军令</b>
        <small>${state.arena.weekly.weekKey} · 固定牌池</small>
      </button>
    </div>
  `;
}

function renderArenaTrialSelector() {
  const bestWave = state.arena?.bestWave || 0;
  const availableIds = new Set(
    availableArenaTrials(bestWave).map((trial) => trial.id),
  );
  const selectedIds = sanitizeArenaTrialIds(arenaTrialSelection, {
    bestWave,
    limit: ARENA_TRIAL_LIMIT,
  });
  const effects = arenaTrialEffects(selectedIds);
  const records = state.arena?.starTrials || {};
  return `
    <section class="arena-trial-panel" aria-label="天书星劫">
      <div class="arena-trial-heading">
        <span>${icon("circle-alert", 18)}</span>
        <div>
          <small>天书星劫 · 自愿加难</small>
          <b>把熟悉的敌阵改写成另一种题</b>
        </div>
        <em>${selectedIds.length}/${ARENA_TRIAL_LIMIT}</em>
      </div>
      <p>可同时启用至多三道星劫。每道都改变实战规则，并提高军功与战后收益；不选星劫也能照常出阵。</p>
      <div class="arena-trial-grid">
        ${Object.values(ARENA_TRIALS)
          .map((trial) => {
            const unlocked = availableIds.has(trial.id);
            const selected = selectedIds.includes(trial.id);
            const limitReached =
              selectedIds.length >= ARENA_TRIAL_LIMIT && !selected;
            return `
              <button
                class="arena-trial tone-${trial.tone} ${selected ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}"
                data-action="toggle-arena-trial"
                data-trial="${trial.id}"
                aria-pressed="${selected}"
                title="${unlocked ? trial.desc : `最高突破至第 ${trial.unlockWave} 阵后解锁`}"
                ${!unlocked || limitReached ? "disabled" : ""}
              >
                <span>${icon(unlocked ? trial.icon : "lock-keyhole", 17)}</span>
                <div>
                  <small>${unlocked ? `星劫 · ${selected ? "已启用" : "待启用"}` : `第 ${trial.unlockWave} 阵解锁`}</small>
                  <b>${trial.name}</b>
                  <p>${trial.risk}</p>
                </div>
                <em>${unlocked ? trial.reward : icon("lock-keyhole", 11)}</em>
                <i>${selected ? icon("check", 13) : ""}</i>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="arena-trial-record">
        <span>${icon("history", 13)}星劫纪录</span>
        <b>最高 ${records.bestWave || 0} 阵</b>
        <b>军功 ${records.bestScore || 0}</b>
        <em>${records.maxSelected ? `最高同启 ${records.maxSelected} 道` : "尚未携星劫出阵"}</em>
        ${
          selectedIds.length
            ? `<strong>本轮加成 · 军功 +${Math.round(effects.scorePct * 100)}% · 铜钱 +${Math.round(effects.copperPct * 100)}% · 历练 +${Math.round(effects.xpPct * 100)}%</strong>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderArenaTrialStrip(trialIds, options = {}) {
  const effects = arenaTrialEffects(trialIds);
  if (!effects.count) return "";
  return `
    <div class="arena-trial-strip ${options.compact ? "is-compact" : ""}">
      <span>${icon("circle-alert", options.compact ? 13 : 15)}星劫 ${effects.count} 道</span>
      <div>
        ${effects.trialIds
          .map((trialId) => {
            const trial = ARENA_TRIALS[trialId];
            return `<b class="tone-${trial.tone}" title="${trial.desc}">${icon(trial.icon, 12)}${trial.name}</b>`;
          })
          .join("")}
      </div>
      <em>军功 +${Math.round(effects.scorePct * 100)}% · 铜钱 +${Math.round(effects.copperPct * 100)}% · 历练 +${Math.round(effects.xpPct * 100)}%</em>
    </div>
  `;
}

function renderArenaTrialHud(trialIds) {
  const effects = arenaTrialEffects(trialIds);
  if (!effects.count) return "";
  return `
    <div class="battle-trial-hud" aria-label="本轮天书星劫">
      <span>${icon("circle-alert", 16)}</span>
      <small>星劫</small>
      <div>
        ${effects.trialIds
          .map((trialId) => {
            const trial = ARENA_TRIALS[trialId];
            return `<b class="tone-${trial.tone}" title="${trial.desc}">${icon(trial.icon, 13)}${trial.name}</b>`;
          })
          .join("")}
      </div>
      <em>军功 +${Math.round(effects.scorePct * 100)}%</em>
    </div>
  `;
}

function renderArenaWeekCard(config) {
  const weekly = state.arena.weekly;
  const progress = arenaWeekProgress(weekly);
  const previousWeek = weekly.history?.[weekly.history.length - 1];
  return `
    <div class="arena-week-card">
      <div class="arena-week-heading">
        <div>
          <small>${config.key} · ${config.label} · 周一 UTC 换令</small>
          <h3>${config.rule.name}</h3>
          <p>${config.rule.desc}</p>
        </div>
        <span class="tone-${config.rule.tone}">${icon(config.rule.icon, 21)}</span>
      </div>
      <div class="arena-week-pools">
        <div>
          <small>本周军令池</small>
          <span>${config.boonPool
            .map(
              (boonId) =>
                `<b>${icon(ARENA_BOONS[boonId].icon, 12)}${ARENA_BOONS[boonId].name}</b>`,
            )
            .join("")}</span>
        </div>
        <div>
          <small>本周悬赏池</small>
          <span>${config.bountyPool
            .map((bountyId) => {
              const bounty = ARENA_BOUNTIES.find(
                (entry) => entry.id === bountyId,
              );
              return `<b>${icon(bounty.icon, 12)}${bounty.name}</b>`;
            })
            .join("")}</span>
        </div>
      </div>
      <div class="arena-week-record">
        <div>
          <span><small>本周个人最高军功</small><b>${weekly.bestScore}</b></span>
          <span><small>本周最高波次</small><b>${weekly.bestWave}</b></span>
          <span><small>本周挑战次数</small><b>${weekly.runs}</b></span>
        </div>
        <p>${progress.next ? `距“${progress.next.name}”还差 ${progress.next.score - progress.bestScore} 军功` : "三枚周印已全部收入演武簿。"}</p>
        <i style="--week-progress:${progress.percent}"><span></span></i>
      </div>
      ${
        previousWeek
          ? `<div class="arena-week-history">
              ${icon("history", 13)}
              <span>上周 ${previousWeek.weekKey}</span>
              <b>最高军功 ${previousWeek.bestScore}</b>
              <em>${previousWeek.marks.length}/${ARENA_WEEK_MARKS.length} 周印</em>
            </div>`
          : ""
      }
    </div>
  `;
}

function arenaDiscoveryShelf() {
  const discoveries = state.arena.discoveries || {
    masteries: [],
    synergies: [],
    encounters: [],
  };
  const masteryIds = Object.keys(ARENA_BOON_MASTERIES);
  const synergyIds = Object.keys(ARENA_SYNERGIES);
  const encounterIds = Object.keys(ARENA_ENCOUNTERS);
  const foundEncounters = discoveries.encounters || [];
  return `
    <div class="arena-discovery-shelf">
      <div class="arena-discovery-heading">
        <span>${icon("book-open", 15)}演武图鉴</span>
        <b>${discoveries.masteries.length + discoveries.synergies.length + foundEncounters.length}/${masteryIds.length + synergyIds.length + encounterIds.length}</b>
      </div>
      <div class="arena-discovery-grid">
        ${encounterIds
          .map((encounterId) => {
            const encounter = ARENA_ENCOUNTERS[encounterId];
            const found = foundEncounters.includes(encounterId);
            return `<span class="${found ? "is-found is-encounter" : ""}" title="${encounter.desc}">${icon(found ? encounter.icon : "lock-keyhole", 12)}<b>${encounter.name}</b></span>`;
          })
          .join("")}
        ${masteryIds
          .map((boonId) => {
            const mastery = ARENA_BOON_MASTERIES[boonId];
            const found = discoveries.masteries.includes(boonId);
            return `<span class="${found ? "is-found" : ""}" title="${mastery.desc}">${icon(found ? mastery.icon : "lock-keyhole", 12)}<b>${mastery.name}</b></span>`;
          })
          .join("")}
        ${synergyIds
          .map((synergyId) => {
            const synergy = ARENA_SYNERGIES[synergyId];
            const found = discoveries.synergies.includes(synergyId);
            return `<span class="${found ? "is-found is-synergy" : ""}" title="${synergy.desc}">${icon(found ? synergy.icon : "lock-keyhole", 12)}<b>${synergy.name}</b></span>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderArenaDiscoveryStrip(discoveries) {
  const masteryIds = discoveries?.masteries || [];
  const synergyIds = discoveries?.synergies || [];
  const encounterIds = discoveries?.encounters || [];
  if (!masteryIds.length && !synergyIds.length && !encounterIds.length) {
    return "";
  }
  return `
    <div class="arena-discovery-strip">
      <span>${icon("book-open-check", 16)}阵法谱新收录</span>
      ${encounterIds
        .map(
          (encounterId) =>
            `<b>${icon(ARENA_ENCOUNTERS[encounterId].icon, 13)}${ARENA_ENCOUNTERS[encounterId].name}</b>`,
        )
        .join("")}
      ${masteryIds
        .map(
          (boonId) =>
            `<b>${icon(ARENA_BOON_MASTERIES[boonId].icon, 13)}${ARENA_BOON_MASTERIES[boonId].name}</b>`,
        )
        .join("")}
      ${synergyIds
        .map(
          (synergyId) =>
            `<b>${icon(ARENA_SYNERGIES[synergyId].icon, 13)}${ARENA_SYNERGIES[synergyId].name}</b>`,
        )
        .join("")}
    </div>
  `;
}

function renderArenaEncounterCard(encounter, wave, options = {}) {
  if (!encounter) return "";
  const scorePct = Math.round((encounter.scorePct || 0) * 100);
  return `
    <article class="arena-encounter-preview tone-${encounter.tone} ${options.compact ? "is-compact" : ""}">
      <span class="arena-encounter-icon">${icon(encounter.icon, 21)}</span>
      <div>
        <small>${options.label || `第 ${wave} 阵军势`} · ${encounter.tactic}</small>
        <b>${encounter.name}</b>
        <p>${encounter.desc}</p>
      </div>
      <em>${icon("trending-up", 12)}军功 +${scorePct}%</em>
    </article>
  `;
}

function renderArenaEncounterHud(encounter) {
  if (!encounter) return "";
  return `
    <div class="arena-encounter-hud tone-${encounter.tone}" aria-label="本阵演武军势">
      <span>${icon(encounter.icon, 17)}</span>
      <div><small>演武军势 · ${encounter.tactic}</small><b>${encounter.name}</b></div>
      <p>${encounter.desc}</p>
      <em>军功 +${Math.round((encounter.scorePct || 0) * 100)}%</em>
    </div>
  `;
}

function renderArena() {
  const weekSync = syncArenaWeek(state);
  if (weekSync.changed) {
    restoreArenaRunFromState();
    persist();
  }
  if (arenaRun) arenaMode = arenaRun.mode || "endless";
  if (unlockArenaRelics().length) persist();
  prepareArenaDraft();
  const unlocked = state.recruited.length >= 2;
  const best = state.arena?.bestWave || 0;
  const team = activeHeroes(state);
  const weekConfig = getArenaWeekConfig(state.arena.weekly.weekKey);
  const openingRecommendation = recommendArenaBoon([], arenaDraftBoons);
  const openingEncounter = resolveArenaEncounter({
    mode: arenaMode,
    seed: arenaMode === "weekly" ? weekConfig.seed : arenaDraftSeed,
    wave: 1,
    encounterId: "",
  });
  const upcomingEncounter = arenaRun
    ? resolveArenaEncounter(
        arenaRun,
        arenaRun.wave,
        arenaRun.encounterId,
      )
    : openingEncounter;
  return `
    <div class="app-screen arena-screen">
      ${topbar("arena")}
      <main class="arena-layout">
        <section class="arena-hero-panel">
          <div class="arena-hero-art"></div>
          <div class="arena-hero-shade"></div>
          <div class="arena-hero-copy">
            <p class="eyebrow">无尽围剿 · 星命演武</p>
            <h1>梁山演武</h1>
            <p>一路自由构筑冲击最高波次，一路按本周固定军令与悬赏争夺周印。官军不会只来一次，阵法也不会只成一种。</p>
            <div class="arena-record">
              <span><small>最高波次</small><b>${best}</b></span>
              <span><small>最高军功</small><b>${state.arena?.bestScore || 0}</b></span>
              <span><small>悬赏达成</small><b>${state.arena?.totalBounties || 0}</b></span>
              <span><small>演武次数</small><b>${state.arena?.totalRuns || 0}</b></span>
            </div>
          </div>
          <div class="arena-team">
            ${team
              .map(
                ({ heroId, entry }) => `
                  <div>
                    ${heroPortrait(heroId, "")}
                    <span><b>${HEROES[heroId].name}</b><small>Lv.${entry.level}</small></span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
        ${
          unlocked
            ? `
              <section class="arena-briefing-panel">
                <div class="section-heading compact">
                  <div><p class="eyebrow">出阵前</p><h2>${arenaRun ? `${arenaRun.mode === "weekly" ? "周令" : "演武"}进行至第 ${arenaRun.wave} 阵` : arenaMode === "weekly" ? "本周军令已张榜" : "择第一道军令"}</h2></div>
                  <span>${arenaRun ? `${arenaRun.boons.length} 重军令` : arenaMode === "weekly" ? weekConfig.key : "三选其一"}</span>
                </div>
                ${
                  arenaRun
                    ? `${renderArenaEncounterCard(upcomingEncounter, arenaRun.wave, {
                        label: arenaRun.pendingBoons?.length ? "下一阵军势" : "本阵军势",
                        compact: true,
                      })}
                      ${renderArenaTrialStrip(arenaRun.trialIds, { compact: true })}
                      <div class="arena-run-card">
                        <div>${icon(arenaRun.mode === "weekly" ? "calendar-days" : "flame", 24)}<span><b>${arenaRun.mode === "weekly" ? "本周军令" : "继续当前演武"} · 军功 ${arenaRun.score || 0}</b><small>${arenaRun.pendingBoons?.length ? `第 ${arenaRun.completedWave} 阵已破，下一道军令已经备好。` : "当前阵、生命与军令均已写入存档，重启后仍可续战。"}</small></span></div>
                        <button class="button primary" data-action="resume-arena">${icon(arenaRun.pendingBoons?.length ? "list-checks" : "play", 18)}<span>${arenaRun.pendingBoons?.length ? "择取军令" : "再入战阵"}</span></button>
                        <button class="button ghost" data-action="retire-arena">${icon("flag", 18)}<span>收束本轮</span></button>
                      </div>
                      ${renderArenaBuild(arenaRun.boons, true)}`
                    : `${renderArenaModeSwitch()}
                       ${arenaMode === "weekly" ? renderArenaWeekCard(weekConfig) : ""}
                       ${renderArenaTrialSelector()}
                       ${renderArenaEncounterCard(openingEncounter, 1, {
                         label: "首阵军势",
                       })}
                       <div class="arena-boon-grid">${arenaBoonCards(arenaDraftBoons, "select-arena-boon", { recommendation: openingRecommendation })}</div>
                       ${
                         openingRecommendation
                           ? `<p class="arena-advisor-note">${icon("compass", 14)}<span><b>军师建议</b>${openingRecommendation.reason}</span></p>`
                           : ""
                       }
                       <button class="button primary large arena-start" data-action="start-arena" ${!selectedArenaBoon ? "disabled" : ""}>
                         ${icon(arenaMode === "weekly" ? "calendar-days" : "swords", 20)}<span>${arenaTrialSelection.length ? `携 ${arenaTrialSelection.length} 道星劫出阵` : arenaMode === "weekly" ? "接下本周军令，迎第一阵" : "立下军令，迎第一阵"}</span>
                       </button>`
                }
              </section>
            `
            : `<section class="arena-locked">
                ${icon("lock-keyhole", 31)}
                <p class="eyebrow">尚缺同行之人</p>
                <h2>再结义一位好汉后开启</h2>
                <p>演武需要至少两人成阵。完成第一回并接纳新兄弟，即可从导航进入无尽挑战。</p>
                <button class="button secondary" data-action="nav-map">${icon("map", 18)}<span>返回行军图</span></button>
              </section>`
        }
        <aside class="arena-rule-panel">
          <p class="eyebrow">演武规则</p>
          <h2>军令成阵</h2>
          <div><span>01</span><p><b>生命跨波保留</b><small>每破一阵恢复部分生命，阵亡好汉不会在下一阵复归。</small></p></div>
          <div><span>02</span><p><b>同令成阵眼</b><small>同一军令取满三重，额外觉醒一条强力阵眼效果。</small></p></div>
          <div><span>03</span><p><b>双线结阵法</b><small>两路军令各取二重，可触发摧锋、仁壁、风雷与星火阵法。</small></p></div>
          <div><span>04</span><p><b>悬赏夺军功</b><small>每阵追加一项战功目标，达成可夺额外铜钱与军功，刷新最高纪录。</small></p></div>
          <div><span>05</span><p><b>周令换新局</b><small>每周一 UTC 更新固定军令池、悬赏池与敌阵规则；本周纪录和一枚枚周印都会留在演武簿。</small></p></div>
          <div><span>06</span><p><b>阵后逢奇遇</b><small>每破三阵会遇到一次军中奇遇，在休整、夺功、复归与复制军令之间作出取舍。</small></p></div>
          <div><span>07</span><p><b>军势换打法</b><small>每阵都会预告一种官军军势，拒马、齐射、连环、封穴各有解法，也会提高本阵军功。</small></p></div>
          <div><span>08</span><p><b>星劫自选难度</b><small>可选至多三道星劫改写敌军规则。越险的局军功与资源倍率越高，最高波次也会逐层解锁新的星劫。</small></p></div>
          ${arenaRelicLadder()}
          ${arenaDiscoveryShelf()}
          <button class="button ghost" data-action="nav-roster">${icon("layout-grid", 18)}<span>先调整三阵</span></button>
        </aside>
      </main>
    </div>
  `;
}

function renderMasteryUnlocks() {
  if (!lastMasteryUnlocks.length) return "";
  return `
    <div class="mastery-unlock-strip">
      <span>${icon("trophy", 17)} 星命试炼完成</span>
      ${lastMasteryUnlocks
        .map(
          ({ heroName, trial }) => `
            <b>${heroName} · ${trial.name}<small>铜钱 +${trial.reward.copper} · 历练 +${trial.reward.xp} · 全属性 +2%</small></b>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderAchievementUnlocks() {
  if (!lastAchievementUnlocks.length) return "";
  return `
    <div class="achievement-unlock-strip">
      <span>${icon("medal", 17)} 战功入册</span>
      ${lastAchievementUnlocks
        .map(
          (achievement) => `
            <b>${achievement.name}<small>铜钱 +${achievement.reward.copper} · 历练 +${achievement.reward.xp}</small></b>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderArenaBattleReport() {
  const report = arenaRun?.lastPerformance;
  if (!report) return "";
  const mvp = HEROES[report.mvpHeroId];
  return `
    <div class="arena-battle-report grade-${report.grade.toLowerCase()}">
      <span class="arena-grade">
        <small>战阵评</small>
        <b>${report.grade}</b>
        <em>+${report.bonusScore} 军功</em>
      </span>
      <div class="arena-report-copy">
        <small>第 ${arenaRun.completedWave} 阵战报 · ${report.rounds} 回合</small>
        <b>${mvp ? `${mvp.name} 当先` : "全阵同心"}</b>
        <p>${report.survivors}/${report.heroCount} 人尚立阵中 · ${report.mvpKills} 次破敌 · 星命绝技 ${report.mvpUltimates} 次</p>
        <div class="arena-report-objectives">
          ${(report.objectives || [])
            .map(
              (objective) =>
                `<span class="${objective.met ? "is-met" : ""}">${icon(objective.met ? "check" : "minus", 11)}${objective.label}</span>`,
            )
            .join("")}
        </div>
      </div>
      ${
        mvp
          ? `<div class="arena-mvp">
              ${heroPortrait(report.mvpHeroId, "")}
              <span><small>本阵当先</small><b>${mvp.name}</b><em>${report.mvpDamage} 伤害</em></span>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderArenaReward() {
  if (!arenaRun) return "";
  const wave = arenaRun.completedWave;
  const isWeekly = arenaRun.mode === "weekly";
  const eventOffers = (arenaRun.eventOffer || [])
    .map((eventId) => ARENA_EVENTS[eventId])
    .filter(Boolean);
  const eventPending = eventOffers.length > 0 && !arenaRun.selectedEvent;
  const weeklyProgress = arenaWeekProgress();
  const newWeeklyMarks = (arenaRun.lastWeeklyMarks || [])
    .map((markId) => ARENA_WEEK_MARKS.find((mark) => mark.id === markId))
    .filter(Boolean);
  const lastBounty = ARENA_BOUNTIES.find(
    (bounty) => bounty.id === arenaRun.lastBounty?.id,
  );
  const recommendation = recommendArenaBoon(
    arenaRun.boons,
    arenaRewardChoices,
  );
  const autoPlan = planArenaAutoContinue(
    arenaRun,
    arenaRewardChoices,
  );
  const lastEncounter = ARENA_ENCOUNTERS[arenaRun.encounterId];
  const nextEncounter = resolveArenaEncounter(
    arenaRun,
    arenaRun.wave,
    arenaRun.encounterId,
  );
  const autoPaused = state.settings.autoArena && autoPlan.action === "pause";
  const canReroll =
    !eventPending &&
    !arenaRun.rerollUsed &&
    arenaRewardChoices.length > 0;
  return `
    <div class="app-screen arena-reward-screen">
      ${topbar("arena", "nav-arena")}
      <main class="arena-reward-layout">
        <section class="arena-victory-copy">
          <p class="eyebrow">${isWeekly ? `本周军令 · ${arenaRun.weekKey}` : "无尽演武"} · 第 ${wave} 阵</p>
          <h1>${eventOffers.length ? "阵后整军" : "再择一道军令"}</h1>
          <p>${arenaRun.lastReward?.copper || 0} 贯、${arenaRun.lastReward?.xp || 0} 历练与 ${arenaRun.lastReward?.score || 0} 军功已收入行囊。${eventOffers.length ? "每三阵会遇到一次军中奇遇，先定去向，再补军令。" : "下一阵敌军更强，选定军令后继续。"}</p>
          <div class="arena-run-summary">
            <span><small>当前波次</small><b>${arenaRun.wave}</b></span>
            <span><small>本轮军功</small><b>${arenaRun.score || 0}</b></span>
            <span><small>已得军令</small><b>${arenaRun.boons.length}</b></span>
            <span><small>最高军功</small><b>${state.arena.bestScore}</b></span>
          </div>
          ${renderArenaTrialStrip(arenaRun.trialIds, { compact: true })}
          ${renderArenaBattleReport()}
          ${renderArenaEncounterCard(lastEncounter, wave, {
            label: "本阵军势",
            compact: true,
          })}
          ${
            lastBounty
              ? `<div class="arena-bounty-result ${arenaRun.lastBounty.cleared ? "is-cleared" : ""}">
                  <span>${icon(lastBounty.icon, 20)}</span>
                  <div>
                    <small>本阵悬赏 · ${arenaRun.lastBounty.cleared ? "已达成" : "未达成"}</small>
                    <b>${lastBounty.name}</b>
                    <p>${lastBounty.desc}</p>
                  </div>
                  <em>${arenaRun.lastBounty.cleared ? `铜钱 +${arenaRun.lastBounty.copper}<br>军功 +${arenaRun.lastBounty.score}` : "整军再战"}</em>
                </div>`
              : ""
          }
          ${
            isWeekly
              ? `<div class="arena-week-result">
                  <div>
                    <span>${icon(weeklyProgress.reached.length === 3 ? "crown" : "stamp", 19)}</span>
                    <p><small>本周个人军功</small><b>${state.arena.weekly.bestScore}</b><em>${weeklyProgress.next ? `下一周印 ${weeklyProgress.next.score}` : "三印齐收"}</em></p>
                  </div>
                  <i style="--week-progress:${weeklyProgress.percent}"><span></span></i>
                  ${
                    newWeeklyMarks.length
                      ? `<div class="arena-week-marks">${newWeeklyMarks
                          .map(
                            (mark) =>
                              `<span class="tone-${mark.tone}">${icon(mark.icon, 14)}<b>${mark.name}</b><small>铜钱 +${mark.reward.copper} · 历练 +${mark.reward.xp}</small></span>`,
                          )
                          .join("")}</div>`
                      : ""
                  }
                </div>`
              : ""
          }
          ${renderArenaBuild(arenaRun.boons)}
          <div class="arena-current-booms">
            ${(arenaRun.lastUnlocks || [])
              .map(({ relicId, wave: unlockWave }) => {
                const relic = ARENA_RELICS[relicId];
                return relic
                  ? `<span class="is-relic">${icon(relic.icon, 16)}第 ${unlockWave} 阵 · ${relic.name}</span>`
                  : "";
              })
              .join("")}
          </div>
          ${renderMasteryUnlocks()}
          ${renderArenaDiscoveryStrip(arenaRun.lastDiscoveries)}
          ${renderBondUnlocks()}
          ${renderChainUnlocks()}
          ${renderAchievementUnlocks()}
        </section>
        <section class="arena-reward-options">
          ${renderArenaEncounterCard(nextEncounter, arenaRun.wave, {
            label: "下一阵军势",
            compact: true,
          })}
          ${renderArenaEventChoices(eventOffers, arenaRun.selectedEvent)}
          <div class="arena-reward-draft">
            <div class="arena-reward-draft-heading">
              <span>${icon(eventPending ? "lock-keyhole" : "layout-grid", 15)}${eventPending ? "先择阵后奇遇" : "下一道军令"}</span>
              <div class="arena-draft-tools">
                <button class="arena-reroll-button" data-action="reroll-arena-boons" ${canReroll ? "" : "disabled"}>
                  ${icon(arenaRun.rerollUsed ? "check" : "refresh-cw", 13)}
                  <span>${arenaRun.rerollUsed ? "本轮已变阵" : eventPending ? "奇遇后可变阵" : "军师变阵 · 每轮一次"}</span>
                </button>
                <div class="arena-auto-advance">
                  <small>${eventPending ? "奇遇会立即改变当前演武" : "三选其一"}</small>
                  <button class="${state.settings.autoArena ? "is-on" : ""} ${autoPaused ? "is-paused" : ""}" data-action="toggle-arena-auto" aria-pressed="${state.settings.autoArena}" aria-label="${state.settings.autoArena ? "暂停演武自动续阵" : "开启演武自动续阵"}">
                    ${icon(autoPaused ? "timer" : state.settings.autoArena ? "fast-forward" : "hand", 13)}
                    <span>${autoPaused ? "奇遇待决" : state.settings.autoArena ? "自动续阵中" : "自动续阵"}</span>
                  </button>
                </div>
              </div>
            </div>
            ${arenaBoonCards(arenaRewardChoices, "choose-arena-reward", {
              disabled: eventPending,
              recommendation,
            })}
            ${
              recommendation
                ? `<p class="arena-advisor-note">${icon("compass", 14)}<span><b>军师建议</b>${recommendation.reason}</span></p>
                    <button class="button secondary arena-follow-advice" data-action="follow-arena-advice" data-boon="${recommendation.boonId}" ${eventPending ? "disabled" : ""}>
                      ${icon("fast-forward", 16)}<span>采纳建议，继续下一阵</span>
                    </button>`
                : ""
            }
          </div>
        </section>
        <footer class="arena-reward-footer">
          <button class="text-button" data-action="retire-arena">${icon("flag", 16)} 收束本轮并保留纪录</button>
        </footer>
      </main>
    </div>
  `;
}

function renderArenaEventChoices(events, selectedEvent) {
  if (!events.length) return "";
  return `
    <section class="arena-event-choice">
      <div class="arena-event-heading">
        <span>${icon("compass", 18)}</span>
        <div>
          <p class="eyebrow">军中奇遇</p>
          <h2>下一步，如何整军</h2>
        </div>
        <small>${activeHeroes(state).filter(({ heroId }) => (arenaRun?.healthRatios?.[heroId] ?? 1) > 0).length}/${activeHeroes(state).length} 人尚可出战</small>
      </div>
      <div class="arena-event-grid">
        ${events
          .map((event) => {
            const selected = selectedEvent === event.id;
            const available = arenaEventAvailability(event.id);
            return `
              <button class="arena-event-card tone-${event.tone} ${selected ? "is-selected" : ""}" data-action="choose-arena-event" data-event="${event.id}" aria-pressed="${selected}" ${!available ? "disabled" : ""}>
                <span>${icon(event.icon, 22)}</span>
                <b>${event.name}</b>
                <p>${event.desc}</p>
                <em>${selected ? `${icon("check", 15)} 已定` : !available ? "铜钱不足" : `${icon("chevron-right", 15)} 定下此策`}</em>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function heroCard(heroId, options = {}) {
  const hero = HEROES[heroId];
  const recruited = state.recruited.includes(heroId);
  if (!recruited && !options.showLocked) {
    return "";
  }
  const entry = state.roster[heroId];
  if (!entry) {
    return `
      <article class="hero-card is-locked">
        <div class="locked-portrait">${icon("lock-keyhole", 28)}</div>
        <span class="hero-star">${hero.star}</span>
        <h3>未结义</h3>
        <p>继续推进主线，风雪会把人带到梁山。</p>
      </article>
    `;
  }
  const stats = deriveHeroStats(state, heroId);
  const inRow = state.team.indexOf(heroId);
  return `
    <article class="hero-card ${selectedCodexHero === heroId ? "is-focus" : ""}">
      <button class="hero-card-hit" data-action="${options.codex ? "codex-hero" : "open-hero"}" data-hero="${heroId}" aria-label="查看${hero.name}">
        <div class="hero-card-art">${heroPortrait(heroId, "")}</div>
        <div class="hero-card-top">
          <span class="hero-star">${hero.star}</span>
          <span class="hero-level">Lv.${entry.level}</span>
        </div>
        <div class="hero-card-copy">
          <small>${hero.nickname}</small>
          <h3>${hero.name}</h3>
          <p>${hero.role}</p>
          ${pathBadge(hero.path, true)}
        </div>
      </button>
      <footer>
        ${statLine(stats)}
        <span class="formation-tag">${inRow >= 0 ? ROWS[inRow].name : "后备"}</span>
      </footer>
      <div class="hero-card-actions">
        <button class="button small ghost" data-action="equipment-hero" data-hero="${heroId}">${icon("shield", 15)}<span>装备</span></button>
        <button class="button small ghost" data-action="formation-hero" data-hero="${heroId}">${icon("layout-grid", 15)}<span>上阵</span></button>
      </div>
    </article>
  `;
}

function showHeroChronicle(heroId) {
  const hero = HEROES[heroId];
  const chronicle = HERO_CHRONICLES[heroId];
  if (!hero || !chronicle) return;
  const questEntries = chronicle.entries.filter(
    (entry) => entry.kind === "quest",
  );
  const claimed = new Set(state.heroQuests?.claimed || []);
  const completed = questEntries.filter((entry) => claimed.has(entry.id)).length;
  const legend = HERO_LEGENDS[heroId];
  const legendDone = heroLegendCompleted(state, heroId);
  openModal({
    title: chronicle.title,
    kind: "chronicle",
    body: `
      <article class="hero-chronicle">
        <header class="hero-chronicle-heading">
          <div class="hero-chronicle-keyart">${heroKeyart(heroId, "")}</div>
          <div>
            <p class="eyebrow">${escapeHtml(chronicle.subtitle)} · ${escapeHtml(hero.role)}</p>
            <h3>${escapeHtml(hero.name)}</h3>
            <div class="hero-chronicle-meta">
              ${pathBadge(hero.path)}
              <span>${icon("map-pin", 14)}${escapeHtml(legend.location)}</span>
              <span>${icon(legendDone ? "badge-check" : "scroll-text", 14)}${legendDone ? "列传已录" : `${completed}/3 异闻已录`}</span>
            </div>
            <blockquote>${escapeHtml(hero.bio)}</blockquote>
          </div>
        </header>
        <ol class="hero-chronicle-timeline">
          ${chronicle.entries
            .map(
              (entry) => `
                <li class="hero-chronicle-entry is-${entry.kind}">
                  <span class="hero-chronicle-marker">${escapeHtml(entry.marker)}</span>
                  <div>
                    <small>${
                      entry.kind === "origin"
                        ? "人物本传"
                        : entry.kind === "quest"
                          ? "好汉异闻"
                          : "群英列传"
                    }</small>
                    <h4>${escapeHtml(entry.title)}</h4>
                    <p>${escapeHtml(entry.text)}</p>
                    ${
                      entry.objective
                        ? `<em>${icon("swords", 13)}${escapeHtml(entry.objective)}</em>`
                        : ""
                    }
                    ${
                      entry.epithet
                        ? `<b>${icon("star", 13)}${escapeHtml(entry.epithet)}</b>`
                        : ""
                    }
                  </div>
                </li>
              `,
            )
            .join("")}
        </ol>
        <footer class="hero-chronicle-footer">
          <span>${icon("book-open", 14)}本传、异闻与列传同归一册</span>
          <b>${escapeHtml(hero.star)}</b>
        </footer>
      </article>
    `,
    actions: [
      {
        label: "合上列传",
        action: "close-modal",
        tone: "primary",
        icon: "book-open",
      },
    ],
  });
}

function renderRoster() {
  const detailId = selectedCodexHero && state.recruited.includes(selectedCodexHero)
    ? selectedCodexHero
    : state.recruited[0];
  const detailHero = HEROES[detailId];
  const detail = state.roster[detailId];
  const detailStats = deriveHeroStats(state, detailId);
  const doctrine = heroDoctrine(state, detailId);
  const filteredHeroes = state.recruited.filter(
    (heroId) =>
      rosterPathFilter === "all" || HEROES[heroId].path === rosterPathFilter,
  );
  const roster = pageItems(filteredHeroes, rosterPage, 12);
  rosterPage = roster.current;
  return `
    <div class="app-screen roster-screen">
      ${topbar("roster")}
      <main class="roster-layout">
        <section class="roster-heading">
          <div>
            <p class="eyebrow">聚义簿 · ${state.recruited.length}/${HERO_ORDER.length}</p>
            <h1>梁山好汉</h1>
            <p>${HERO_ORDER.length}人各有路数。前阵护住中军，后阵才有余裕蓄起义气。</p>
          </div>
          <div class="roster-heading-actions">
            <button class="button secondary" data-action="nav-formation" aria-label="三阵编成">${icon("layout-grid", 18)}<span class="roster-action-wide">三阵编成</span><span class="roster-action-compact">编成</span></button>
            <button class="button ghost" data-action="auto-team" aria-label="军师荐阵">${icon("wand-sparkles", 18)}<span class="roster-action-wide">军师荐阵</span><span class="roster-action-compact">荐阵</span></button>
          </div>
        </section>
        <section class="roster-list-panel">
          <div class="roster-filters" aria-label="按路数筛选已结义好汉">
            ${HERO_GROUPS.map(
              (group) => `<button class="${group.id === rosterPathFilter ? "is-selected" : ""}" data-action="filter-roster-path" data-path="${group.id}" aria-pressed="${group.id === rosterPathFilter}" ${group.color ? `style="--path-color:${group.color}"` : ""}>${group.name}<small>${group.id === "all" ? state.recruited.length : state.recruited.filter((heroId) => HEROES[heroId].path === group.id).length}</small></button>`,
            ).join("")}
          </div>
          <div class="hero-gallery">
            ${roster.items.map((heroId) => heroCard(heroId)).join("") || `<div class="empty-state">${icon("users", 30)}<b>此路暂无好汉</b><p>继续推进聚义帖，会有新的好汉加入。</p></div>`}
          </div>
          ${renderPagination(roster, "roster-page", "名册分页")}
        </section>
        <button class="roster-detail-backdrop ${rosterDetailOpen ? "is-open" : ""}" data-action="close-roster-detail" aria-label="收起好汉详情" tabindex="${rosterDetailOpen ? "0" : "-1"}"></button>
        <aside class="hero-dossier ${rosterDetailOpen ? "is-open" : ""}">
          <button class="roster-detail-close" data-action="close-roster-detail" aria-label="收起好汉详情">${icon("x", 18)}</button>
          <div class="dossier-art">${heroKeyart(detailId, "")}</div>
          <div class="dossier-overlay"></div>
          <div class="dossier-top">
            <span>${detailHero.star}</span>
            <b>${detailHero.nickname}</b>
          </div>
          <div class="dossier-copy">
            <p class="eyebrow">${detailHero.role}</p>
            <h2>${detailHero.name}</h2>
            <p>${detailHero.bio}</p>
            <div class="dossier-meta">
              ${pathBadge(detailHero.path)}
              <span>${icon("star", 15)} 等级 ${detail.level}</span>
            </div>
            <div class="xp-block">
              <div><span>历练</span><b>${detail.xp}/${xpForNext(detail.level)}</b></div>
              <i><span style="width:${pct(detail.xp, xpForNext(detail.level))}"></span></i>
            </div>
            <div class="dossier-stats">
              ${Object.entries(detailStats)
                .map(
                  ([key, value]) => `<span><small>${STAT_LABELS[key]}</small><b>${value}</b></span>`,
                )
                .join("")}
            </div>
            <div class="passive-box">
              <small>星命被动</small>
              <b>${detailHero.passive.name}</b>
              <p>${detailHero.passive.desc}</p>
            </div>
            ${
              doctrine
                ? `<div class="passive-box doctrine-summary">
                    <small>已择命途</small>
                    <b>${doctrine.name}</b>
                    <p>${doctrine.desc}</p>
                  </div>`
                : ""
            }
          </div>
          <div class="dossier-actions">
            <button class="button secondary" data-action="equipment-hero" data-hero="${detailId}">${icon("shield", 17)}<span>整理装备</span></button>
            <button class="button ghost" data-action="nav-formation">${icon("layout-grid", 17)}<span>调整站位</span></button>
            <button class="button ghost chronicle-action" data-action="open-hero-chronicle" data-hero="${detailId}">${icon("book-open", 17)}<span>人物生平</span></button>
          </div>
        </aside>
      </main>
    </div>
  `;
}

function renderFormation() {
  const activeBonds = activeHeroBonds(state);
  const activeBondIds = new Set(activeBonds.map((bond) => bond.id));
  const chainPreview = teamChainPreview();
  const advisorOptions = recommendTeams(state, 4);
  const currentTeamKey = [...state.team]
    .filter(Boolean)
    .sort()
    .join("|");
  return `
    <div class="app-screen formation-screen">
      ${topbar("roster", "nav-roster")}
      <main class="formation-layout">
        <section class="formation-heading">
          <div><p class="eyebrow">三阵之势</p><h1>点将编成</h1><p>先选阵位，再点好汉。前阵承受更多近战攻击，后阵更不易被集火。</p></div>
          <button class="button ghost" data-action="auto-team">${icon("wand-sparkles", 18)}<span>军师荐阵</span></button>
        </section>
        <section class="advisor-panel" aria-label="军师多目标荐阵">
          <header>
            <div><p class="eyebrow">军师推演 · 多阵并举</p><h2>不同目标，不同三阵</h2></div>
            <span>${icon("compass", 15)} ${advisorOptions.length} 套可用方案</span>
          </header>
          <div class="advisor-option-grid">
            ${advisorOptions
              .map((option, index) => {
                const teamKey = [...option.team].filter(Boolean).sort().join("|");
                const pathNames = [
                  ...new Set(
                    option.team
                      .filter(Boolean)
                      .map((heroId) => PATHS[HEROES[heroId].path].name),
                  ),
                ];
                return `
                  <button class="advisor-option ${teamKey === currentTeamKey ? "is-current" : ""}" data-action="apply-team-recommendation" data-index="${index}">
                    <span class="advisor-option-head">
                      <b>${option.name}</b>
                      <em>${option.pathCount}/3 路 · ${option.bonds.length} 契</em>
                    </span>
                    <span class="advisor-option-members">
                      ${option.team
                        .filter(Boolean)
                        .map(
                          (heroId, row) => `
                            <span>
                              ${heroPortrait(heroId, "")}
                              <i>${ROWS[row].name}</i>
                              <strong>${HEROES[heroId].name}</strong>
                            </span>
                          `,
                        )
                        .join("")}
                    </span>
                    <p>${option.reason}</p>
                    <span class="advisor-option-foot">
                      <span>${pathNames.join(" · ")}</span>
                      <em>${teamKey === currentTeamKey ? `${icon("check", 14)} 当前采用` : `${icon("arrow-right", 14)} 采用此阵`}</em>
                    </span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
        <section class="formation-board">
          ${[0, 1, 2]
            .map((row) => {
              const heroId = state.team[row];
              const stats = heroId ? deriveHeroStats(state, heroId) : null;
              return `
                <button class="formation-slot ${selectedFormationRow === row ? "is-selected" : ""} ${!heroId ? "is-empty" : ""}" data-action="select-formation-row" data-row="${row}">
                  <span class="row-label"><b>${ROWS[row].name}</b><small>${row === 0 ? "受击 145%" : row === 1 ? "均衡站位" : "受击 70%"}</small></span>
                  ${
                    heroId
                      ? `<div class="formation-figure">${heroPortrait(heroId, "")}</div>
                         <div class="formation-hero-copy">
                           <small>${HEROES[heroId].nickname} · ${PATHS[HEROES[heroId].path].name}</small>
                           <h2>${HEROES[heroId].name}</h2>
                           ${stats ? statLine(stats) : ""}
                         </div>`
                      : `<div class="empty-slot-copy">${icon("user-round-plus", 30)}<b>空阵位</b><small>从下方选择好汉</small></div>`
                  }
                  ${
                    heroId
                      ? `<span class="remove-slot" data-action="clear-formation-row" data-row="${row}">${icon("x", 15)}</span>`
                      : ""
                  }
                </button>
              `;
            })
            .join("")}
        </section>
        <section class="chain-team-panel ${chainPreview.formation ? "is-ready" : ""}">
          <div class="chain-team-heading">
            <div>
              <p class="eyebrow">星命合击谱 · 本阵预演</p>
              <h2>${chainPreview.formation?.name || "三路未齐"}</h2>
            </div>
            <span>${icon(chainPreview.formation?.icon || "route", 15)} ${chainPreview.pathIds.length}/3 路</span>
          </div>
          <div class="chain-team-roster">
            ${chainPreview.heroIds
              .map((heroId) => {
                const path = PATHS[HEROES[heroId].path];
                return `
                  <span class="chain-team-hero" style="--path-color:${path.color}">
                    <i>${path.short}</i>
                    <b>${HEROES[heroId].name}</b>
                    <small>${path.name}</small>
                  </span>
                `;
              })
              .join("")}
            ${Array.from(
              { length: Math.max(0, 3 - chainPreview.heroIds.length) },
              () => `<span class="chain-team-hero is-empty">${icon("user-round-plus", 16)}<b>空阵位</b></span>`,
            ).join("")}
          </div>
          <p class="chain-team-help">
            ${
              chainPreview.formation
                ? `${chainPreview.formation.desc} 战斗中三种路数依次出手后即可发动。`
                : chainPreview.replacementHeroId
                  ? `还缺${chainPreview.missingPathIds.map((pathId) => PATHS[pathId].name).join("、")}。例如换入${HEROES[chainPreview.replacementHeroId].name}（${PATHS[HEROES[chainPreview.replacementHeroId].path].name}），即可让本阵凑齐三路。`
                  : `本阵目前只有 ${chainPreview.pathIds.length} 种路数。继续聚义，寻找身负${chainPreview.missingPathIds.map((pathId) => PATHS[pathId].name).join("、")}的好汉。`
            }
          </p>
        </section>
        <section class="bond-panel">
          <div class="bond-panel-heading">
            <div>
              <p class="eyebrow">兄弟契 · 阵容共鸣</p>
              <h2>三人成阵，双雄同心</h2>
            </div>
            <span>${icon("sparkles", 15)} ${activeBonds.length}/${Object.keys(HERO_BONDS).length} 契生效</span>
          </div>
          <div class="bond-grid">
            ${Object.values(HERO_BONDS)
              .map((bond) =>
                renderBondCard(bond, {
                  active: activeBondIds.has(bond.id),
                  discovered: state.bondArchive?.includes(bond.id),
                }),
              )
              .join("")}
          </div>
        </section>
        <section class="bench-panel">
          <div class="section-heading compact">
            <div><p class="eyebrow">结义好汉</p><h2>选择入阵 · ${ROWS[selectedFormationRow].name}</h2></div>
            <span>${state.recruited.length} 人已结义</span>
          </div>
          <div class="bench-list">
            ${state.recruited
              .map((heroId) => {
                const hero = HEROES[heroId];
                const stats = deriveHeroStats(state, heroId);
                const row = state.team.indexOf(heroId);
                return `
                  <button class="bench-hero ${row >= 0 ? "in-team" : ""}" data-action="assign-formation" data-hero="${heroId}">
                    <span class="bench-portrait">${heroPortrait(heroId, "")}</span>
                    <span class="bench-copy"><small>${hero.star} · ${hero.nickname}</small><b>${hero.name}</b>${pathBadge(hero.path, true)}</span>
                    ${statLine(stats)}
                    <span class="bench-row">${row >= 0 ? ROWS[row].name : "后备"}</span>
                    ${icon(row >= 0 ? "check" : "plus", 18)}
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
        <div class="formation-footer">
          <p>${icon("info", 17)} 路数克制：刚猛克守御，守御克灵巧，灵巧克韬略，韬略克刚猛。</p>
          <button class="button primary" data-action="go-map">${icon("map", 18)}<span>编成完毕</span></button>
        </div>
      </main>
    </div>
  `;
}

function renderEquipment() {
  const heroId = state.recruited.includes(selectedEquipmentHero)
    ? selectedEquipmentHero
    : state.recruited[0];
  const hero = HEROES[heroId];
  const entry = state.roster[heroId];
  const stats = deriveHeroStats(state, heroId);
  const items = inventoryItems(state);
  const recommendation = recommendEquipment(state, heroId);
  const recommendedItemIds = new Set(
    Object.values(recommendation.equipment).filter(Boolean),
  );
  const visibleItems = items.filter(({ item }) =>
    equipmentMatchesCategory(item.id, equipmentCategory),
  );
  const inventoryPage = pageItems(visibleItems, equipmentPage, 5);
  equipmentPage = inventoryPage.current;
  const visibleHeroes = state.recruited.filter(
    (id) =>
      equipmentPathFilter === "all" ||
      HEROES[id].path === equipmentPathFilter,
  );
  return `
    <div class="app-screen equipment-screen">
      ${topbar("roster", "nav-roster")}
      <main class="equipment-layout">
        <section class="equipment-heading">
          <div><p class="eyebrow">甲兵武备</p><h1>整理行装</h1><p>武器、护甲、随身物各装备一件。从行囊换装时，旧装备会自动收回。</p></div>
          <div class="equipment-heading-actions">
            <button class="button ${recommendation.changes.length ? "secondary" : "ghost"}" data-action="recommend-equipment" title="按好汉路数、站位与属性综合推荐">
              ${icon("wand-sparkles", 17)}
              <span>${recommendation.changes.length ? `军师荐装 · ${recommendation.changes.length} 件` : "军师荐装 · 当前已优"}</span>
            </button>
            <div class="equipment-wallet">${icon("coins", 18)}<b>${state.inventory.copper}</b><span>贯</span></div>
          </div>
        </section>
        <section class="equipment-hero-tabs">
          ${visibleHeroes
            .map(
              (id) => `
                <button class="${id === heroId ? "is-selected" : ""}" data-action="select-equipment-hero" data-hero="${id}">
                  ${heroPortrait(id, "")}<span>${HEROES[id].name}</span><small>Lv.${state.roster[id].level}</small>
                </button>
              `,
            )
            .join("")}
        </section>
        <section class="equipment-filters" aria-label="装备与武将分类">
          <div class="equipment-filter-group">
            <small>武备分类</small>
            ${EQUIPMENT_CATEGORIES.map(
              (category) => `<button class="${equipmentCategory === category.id ? "is-selected" : ""}" data-action="filter-equipment-item" data-slot="${category.id}" aria-pressed="${equipmentCategory === category.id}">${icon(category.icon, 14)}${category.name}</button>`,
            ).join("")}
          </div>
          <div class="equipment-filter-group">
            <small>将星路数</small>
            ${HERO_GROUPS.map(
              (group) => `<button class="${equipmentPathFilter === group.id ? "is-selected" : ""}" data-action="filter-equipment-path" data-path="${group.id}" aria-pressed="${equipmentPathFilter === group.id}">${group.name}<em>${group.id === "all" ? state.recruited.length : state.recruited.filter((id) => HEROES[id].path === group.id).length}</em></button>`,
            ).join("")}
          </div>
        </section>
        <section class="equipment-main">
          <article class="equipped-panel">
            <div class="equipment-hero-stage">
              ${heroPortrait(heroId, "")}
              <div><p class="eyebrow">${hero.star} · ${hero.nickname}</p><h2>${hero.name}</h2>${pathBadge(hero.path)}</div>
            </div>
            <div class="equipped-stats">
              ${Object.entries(stats)
                .map(([key, value]) => `<span><small>${STAT_LABELS[key]}</small><b>${value}</b></span>`)
                .join("")}
            </div>
            <div class="equipment-slots">
              ${["weapon", "armor", "token"]
                .map((slot) => {
                  const item = EQUIPMENT[entry.equipment[slot]];
                  const slotNames = { weapon: "兵刃", armor: "护甲", token: "随身物" };
                  return `
                    <div class="equipment-slot">
                      <div class="slot-icon">${icon(slot === "weapon" ? "swords" : slot === "armor" ? "shield" : "gem", 21)}</div>
                      <span><small>${slotNames[slot]}</small><b>${item?.name || "未装备"}</b><em>${item?.rarity || ""}</em></span>
                      ${
                        item
                          ? `<button class="icon-button" data-action="unequip" data-slot="${slot}" data-hero="${heroId}" aria-label="卸下${item.name}">${icon("x", 16)}</button>`
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          </article>
          <aside class="inventory-panel">
            <div class="section-heading compact">
              <div><p class="eyebrow">梁山行囊 · ${hero.name}</p><h2>${EQUIPMENT_CATEGORIES.find((category) => category.id === equipmentCategory)?.name || "全部"}武备</h2></div>
              <span>${visibleItems.length} 种</span>
            </div>
            <div class="inventory-list">
              ${
                inventoryPage.items.length
                  ? inventoryPage.items
                      .map(
                        ({ item, amount }) => `
                          <button class="inventory-item ${recommendedItemIds.has(item.id) ? "is-recommended" : ""}" data-action="equip-item" data-item="${item.id}">
                            <span class="item-glyph">${icon(item.slot === "weapon" ? "swords" : item.slot === "armor" ? "shield" : "gem", 20)}</span>
                            <span class="item-copy">
                              <small>${item.slot === "weapon" ? "兵刃" : item.slot === "armor" ? "护甲" : "随身物"} · ${item.rarity}</small>
                              <b>${item.name} ×${amount}</b>
                              <em>${Object.entries(item.stats).map(([key, value]) => `${STAT_LABELS[key] || key} +${value}`).join(" · ")}</em>
                            </span>
                            ${icon("chevrons-up", 17)}
                          </button>
                        `,
                      )
                      .join("")
                  : `<div class="empty-state">${icon("package-open", 30)}<b>此类暂无装备</b><p>切换装备分类或武将路数查看其他武备。</p></div>`
              }
            </div>
            ${renderPagination(inventoryPage, "equipment-page", "装备分页")}
          </aside>
        </section>
      </main>
    </div>
  `;
}

function renderQuestBoard() {
  const allQuests = Object.values(HERO_QUESTS).flat();
  const legendEntries = Object.values(HERO_LEGENDS);
  const recruitmentEntries = Object.values(HERO_RECRUITMENTS);
  const totalClaimed = allQuests.filter((quest) =>
    state.heroQuests?.claimed?.includes(quest.id),
  ).length;
  const totalLegends = legendEntries.filter((legend) =>
    state.heroLegends?.completed?.includes(legend.id),
  ).length;
  const claimable = allQuests.filter(
    (quest) =>
      heroQuestUnlocked(state, quest.id) &&
      isHeroQuestComplete(state, quest.id) &&
      !state.heroQuests?.claimed?.includes(quest.id),
  ).length;
  const completedRecruitments = recruitmentEntries.filter((recruitment) =>
    heroRecruitmentCompleted(state, recruitment.heroId),
  ).length;
  const availableRecruitments = recruitmentEntries.filter((recruitment) =>
    heroRecruitmentUnlocked(state, recruitment.heroId),
  ).length;
  const selectedId = state.recruited.includes(selectedQuestHero)
    ? selectedQuestHero
    : state.recruited[0];
  selectedQuestHero = selectedId;
  const hero = HEROES[selectedId];
  const quests = HERO_QUESTS[selectedId] || [];
  const selectedClaimed = quests.filter((quest) =>
    state.heroQuests?.claimed?.includes(quest.id),
  ).length;
  const latestClaimed = [...quests]
    .reverse()
    .find((quest) => state.heroQuests?.claimed?.includes(quest.id));
  const selectedScale = heroQuestMasteryScale(state, selectedId);
  const selectedLegend = HERO_LEGENDS[selectedId];
  const selectedLegendUnlocked = heroLegendUnlocked(state, selectedId);
  const selectedLegendCompleted = heroLegendCompleted(state, selectedId);
  const selectedLegendChapterReady =
    state.currentChapter >= selectedLegend.requiredChapter;

  return `
    <div class="app-screen quests-screen">
      ${topbar("quests")}
      <main class="quests-layout">
        <section class="quests-heading">
          <div>
            <p class="eyebrow">群像列传 · ${allQuests.length} 段异闻 · ${legendEntries.length} 场列传战 · ${recruitmentEntries.length} 帖招贤令</p>
            <h1>江湖异闻</h1>
            <p>先在聚义帖中完成招贤战，再与好汉共写三段异闻。每位兄弟的旧债、故人与归处，最终都会汇入一场属于自己的群英列传终战。</p>
          </div>
          <div class="quest-overview">
            <span><small>异闻已录</small><b>${totalClaimed}</b><em>/${allQuests.length}</em></span>
            <span><small>可领取</small><b>${claimable}</b><em>段</em></span>
            <span><small>群英战</small><b>${totalLegends}</b><em>/${legendEntries.length}</em></span>
            <span><small>聚义帖</small><b>${completedRecruitments}</b><em>/${recruitmentEntries.length}</em></span>
            <button class="button primary" data-action="claim-all-hero-quests" ${claimable ? "" : "disabled"}>
              ${icon("scroll-text", 17)}<span>一键领取${claimable ? ` ${claimable}` : ""}</span>
            </button>
          </div>
        </section>

        <section class="recruitment-board" aria-label="聚义招贤">
          <div class="recruitment-board-heading">
            <div>
              <p class="eyebrow">${icon("user-round-plus", 14)} 聚义帖 · 群雄来投</p>
              <h2>先并肩，再问旧事</h2>
            </div>
            <span>${availableRecruitments ? `${availableRecruitments} 帖可接` : "推进回目或完成前帖"}</span>
          </div>
          <div class="recruitment-scroll">
            <div class="recruitment-grid">
              ${recruitmentEntries
                .map((recruitment) => {
                  const hero = HEROES[recruitment.heroId];
                  const completed = heroRecruitmentCompleted(
                    state,
                    recruitment.heroId,
                  );
                  const unlocked = heroRecruitmentUnlocked(
                    state,
                    recruitment.heroId,
                  );
                  const prerequisite = recruitment.prerequisite
                    ? HEROES[recruitment.prerequisite]
                    : null;
                  const chapterReady =
                    state.currentChapter >= recruitment.requiredChapter;
                  const status = completed
                    ? "已结义"
                    : unlocked
                      ? "可接帖"
                      : !chapterReady
                        ? `第 ${recruitment.requiredChapter} 回`
                        : prerequisite
                          ? `需先结义${prerequisite.name}`
                          : "尚未开放";
                  return `
                    <article class="recruitment-card ${completed ? "is-complete" : unlocked ? "is-ready" : "is-locked"}" style="--recruit-color:${hero.palette};--recruit-bg:url('${recruitment.bg}')">
                      <div class="recruitment-card-art">${heroKeyart(recruitment.heroId, "")}</div>
                      <div class="recruitment-card-top">
                        <span>${icon(completed ? "badge-check" : unlocked ? "scroll-text" : "lock-keyhole", 15)}${status}</span>
                        <em>${hero.star}</em>
                      </div>
                      <div class="recruitment-card-copy">
                        <small>${hero.nickname} · ${hero.role}</small>
                        <h3>${hero.name}</h3>
                        <p>${recruitment.teaser}</p>
                      </div>
                      <div class="recruitment-rule">
                        <span>${icon(recruitment.rule.icon, 14)}${recruitment.rule.name}</span>
                        <p>${recruitment.rule.desc}</p>
                      </div>
                      <footer>
                        <span>${icon("map-pin", 13)}${recruitment.location}</span>
                        ${
                          completed
                            ? `<em>${icon("check", 14)} 已入聚义簿</em>`
                            : unlocked
                              ? `<button class="button primary" data-action="start-hero-recruitment" data-hero="${recruitment.heroId}">${icon("swords", 15)}<span>接帖出征</span></button>`
                              : `<em>${chapterReady && prerequisite ? `${prerequisite.name}尚未结义` : `第 ${recruitment.requiredChapter} 回后开启`}</em>`
                        }
                      </footer>
                    </article>
                  `;
                })
                .join("")}
            </div>
          </div>
        </section>

        <aside class="quest-hero-list" aria-label="好汉异闻">
          <div class="quest-list-heading">
            <span>结义好汉</span>
            <b>${state.recruited.length}/${HERO_ORDER.length}</b>
          </div>
          <div class="quest-hero-track">
            ${HERO_ORDER.map((heroId) => {
              const itemHero = HEROES[heroId];
              const itemQuests = HERO_QUESTS[heroId] || [];
              const unlocked = state.recruited.includes(heroId);
              const claimed = itemQuests.filter((quest) =>
                state.heroQuests?.claimed?.includes(quest.id),
              ).length;
              const title = [...itemQuests]
                .reverse()
                .find((quest) =>
                  state.heroQuests?.claimed?.includes(quest.id),
                )?.epithet;
              return `
                <button
                  class="quest-hero-button ${heroId === selectedId ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}"
                  data-action="${unlocked ? "quest-hero" : "locked-hero"}"
                  data-hero="${heroId}"
                >
                  <span class="quest-hero-thumb">
                    ${
                      unlocked
                        ? heroPortrait(heroId)
                        : icon("lock-keyhole", 18)
                    }
                  </span>
                  <span class="quest-hero-copy">
                    <small>${unlocked ? `${itemHero.star} · ${itemHero.nickname}` : "星位未明"}</small>
                    <b>${unlocked ? itemHero.name : "未结义"}</b>
                    <em>${unlocked ? title || itemHero.role : "继续推进战役"}</em>
                  </span>
                  <span class="quest-hero-count">
                    <b>${claimed}</b><small>/3</small>
                    <i><span style="width:${pct(claimed, 3)}"></span></i>
                  </span>
                </button>
              `;
            }).join("")}
          </div>
        </aside>

        <section class="quest-board" style="--quest-hero-color:${hero.palette}">
          <header class="quest-board-hero">
            <div class="quest-board-art" aria-hidden="true">
              ${heroKeyart(selectedId)}
            </div>
            <div class="quest-board-copy">
              <p class="eyebrow">${hero.star} · ${hero.nickname}</p>
              <h2>${hero.name}</h2>
              <div class="quest-board-meta">
                ${pathBadge(hero.path)}
                <span>${icon("scroll-text", 15)} 已录 ${selectedClaimed}/3 段</span>
                <span>${icon("trending-up", 15)} 全属性 +${((selectedScale - 1) * 100).toFixed(1)}%</span>
              </div>
              <p>${latestClaimed ? `新称号：${latestClaimed.epithet}` : hero.bio}</p>
              ${statLine(deriveHeroStats(state, selectedId), "quest-stat-line")}
            </div>
          </header>

          <div class="quest-chain">
            ${quests.map((quest) => {
              const claimed = state.heroQuests?.claimed?.includes(quest.id);
              const unlocked = heroQuestUnlocked(state, quest.id);
              const complete = isHeroQuestComplete(state, quest.id);
              const current = Math.min(
                heroQuestProgress(state, quest.id),
                quest.objective.target,
              );
              const previousQuest = quests.find(
                (entry) => entry.stage === quest.stage - 1,
              );
              const chapterLocked =
                state.currentChapter < quest.requiredChapter;
              const previousLocked = Boolean(
                previousQuest &&
                  !state.heroQuests?.claimed?.includes(previousQuest.id),
              );
              const status = claimed
                ? "已录"
                : chapterLocked
                  ? `第 ${quest.requiredChapter} 回`
                  : previousLocked
                    ? "前段未结"
                    : complete
                      ? "可领取"
                      : "进行中";
              const cardClass = claimed
                ? "is-claimed"
                : complete && unlocked
                  ? "is-claimable"
                  : unlocked
                    ? "is-active"
                    : "is-locked";
              return `
                <article class="quest-card ${cardClass}">
                  <div class="quest-card-top">
                    <span class="quest-stage">第${["一", "二", "三"][quest.stage - 1]}段</span>
                    <em>${status}</em>
                  </div>
                  <div class="quest-card-title">
                    <span>${icon(claimed ? "badge-check" : unlocked ? "scroll-text" : "lock-keyhole", 18)}</span>
                    <div><small>${quest.requiredChapter ? `第 ${quest.requiredChapter} 回后` : "即刻开启"} · ${quest.epithet}</small><h3>${quest.title}</h3></div>
                  </div>
                  <p class="quest-premise">${quest.premise}</p>
                  <div class="quest-objective">
                    <div><span>${quest.objective.label}</span><b>${claimed ? "已完成" : `${current}/${quest.objective.target}`}</b></div>
                    <i><span style="width:${claimed ? 100 : pct(current, quest.objective.target)}%"></span></i>
                  </div>
                  <footer class="quest-card-footer">
                    <span>${icon("coins", 14)}${quest.reward.copper} 贯</span>
                    <span>${icon("sparkles", 14)}${quest.reward.xp} 历练</span>
                    ${
                      claimed
                        ? `<em>${icon("check", 14)} 已载入列传</em>`
                        : unlocked && complete
                          ? `<button class="button primary" data-action="claim-hero-quest" data-quest="${quest.id}">${icon("scroll-text", 15)}<span>领取</span></button>`
                          : `<button class="button ghost" disabled>${icon(chapterLocked || previousLocked ? "lock-keyhole" : "hourglass", 15)}<span>${chapterLocked ? `第 ${quest.requiredChapter} 回开启` : previousLocked ? "先结上一段" : "目标未竟"}</span></button>`
                    }
                  </footer>
                </article>
              `;
            }).join("")}
          </div>
          ${
            selectedLegend
              ? `
                <article class="hero-legend-mission ${selectedLegendCompleted ? "is-complete" : selectedLegendUnlocked ? "is-ready" : "is-locked"}" style="--legend-bg:url('${selectedLegend.bg}')">
                  <div class="hero-legend-mission-art" aria-hidden="true"></div>
                  <div class="hero-legend-mission-copy">
                    <p class="eyebrow">${icon("swords", 14)} 群英列传 · ${hero.name}</p>
                    <h3>${selectedLegend.title}</h3>
                    <p>${selectedLegend.objective}</p>
                    <div class="hero-legend-meta">
                      <span>${icon("map-pin", 14)}${selectedLegend.location}</span>
                      <span>${icon("coins", 14)}${selectedLegend.reward.copper} 贯</span>
                      <span>${icon("gem", 14)}${EQUIPMENT[selectedLegend.reward.item]?.name || "专属装备"}</span>
                    </div>
                    <div class="hero-legend-rule">
                      <span>${icon(selectedLegend.rule.icon, 14)}${selectedLegend.rule.name}</span>
                      <p>${selectedLegend.rule.desc}</p>
                    </div>
                  </div>
                  <div class="hero-legend-action">
                    ${
                      selectedLegendCompleted
                        ? `<span>${icon("badge-check", 18)} 已载入群英列传</span>`
                        : selectedLegendUnlocked
                          ? `<button class="button primary" data-action="start-hero-legend" data-hero="${selectedId}">${icon("play", 17)}<span>进入列传战</span></button>`
                          : `<span>${icon("lock-keyhole", 18)} ${
                              selectedLegendChapterReady
                                ? "完成三段异闻后开启"
                                : `第 ${selectedLegend.requiredChapter} 回后开启`
                            }</span>`
                    }
                  </div>
                </article>
              `
              : ""
          }
        </section>
      </main>
    </div>
  `;
}

function renderCodex() {
  const alignment = state.alignment;
  const total = Object.values(alignment).reduce((sum, value) => sum + value, 0);
  const summary = alignmentSummary(state);
  const unlockedEndings = new Set([
    ...(state.endingsUnlocked || []),
    ...(state.ending ? [state.ending] : []),
  ]);
  const unlockedAchievements = new Set(state.achievements || []);
  const selectedId = state.recruited.includes(selectedCodexHero)
    ? selectedCodexHero
    : state.recruited[0];
  const mastery = state.heroMastery?.[selectedId] || {
    wins: 0,
    kills: 0,
    damage: 0,
    ultimates: 0,
    trials: [],
  };
  const completedTrials = HERO_TRIALS.filter((trial) =>
    mastery.trials.includes(trial.id),
  ).length;
  const doctrineConfig = HERO_DOCTRINES[selectedId];
  const selectedDoctrineId = state.doctrines?.[selectedId] || null;
  const doctrineUnlocked = heroDoctrineUnlocked(state, selectedId);
  const totalChapterMedals = CHAPTERS.reduce(
    (sum, chapter) => sum + chapterMedalIds(state, chapter).length,
    0,
  );
  const maxChapterMedals = CHAPTERS.length * CHAPTER_MEDALS.length;
  const archivedBonds = new Set(state.bondArchive || []);
  const archivedChains = new Set(state.chainArchive || []);
  const activeBondIds = new Set(
    activeHeroBonds(state).map((bond) => bond.id),
  );
  return `
    <div class="app-screen codex-screen">
      ${topbar("codex")}
      <main class="codex-layout">
        <section class="star-map-panel">
          <div class="star-map-copy">
            <p class="eyebrow">一百单八星 · 已点亮 ${state.recruited.length}</p>
            <h1>星命图谱</h1>
            <p>每位好汉都是一颗落进乱世的星。聚义、招安、归隐，三条路会在水泊决战后给出答案。</p>
          </div>
          <div class="campaign-medal-overview">
            <div class="campaign-medal-overview-head">
              <span>${icon("medal", 17)}<small>战卷评鉴</small><b>${totalChapterMedals}/${maxChapterMedals}</b></span>
              <em>${totalChapterMedals === maxChapterMedals ? "全卷全璧" : `尚缺 ${maxChapterMedals - totalChapterMedals} 枚`}</em>
            </div>
            <div class="campaign-medal-track" style="--chapter-medal-progress:${pct(totalChapterMedals, maxChapterMedals)}%"><span></span></div>
            <div class="campaign-medal-grid">
              ${CHAPTERS.map((chapter) => {
                const earned = chapterMedalIds(state, chapter).length;
                const complete = earned === CHAPTER_MEDALS.length;
                return `
                  <div class="campaign-medal-chapter ${complete ? "is-complete" : ""}" title="${chapter.title}：${earned}/${CHAPTER_MEDALS.length}">
                    <small>${String(chapter.index + 1).padStart(2, "0")}</small>
                    <b>${chapter.title}</b>
                    <em>${earned}/${CHAPTER_MEDALS.length}</em>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
          <div class="star-map">
            <div class="constellation-line line-a"></div>
            <div class="constellation-line line-b"></div>
            <div class="constellation-core">${icon("sparkles", 30)}<span>梁山</span></div>
            ${HERO_ORDER.map((heroId, index) => {
              const unlocked = state.recruited.includes(heroId);
              return `
                <button class="star-node node-${index + 1} ${unlocked ? "is-unlocked" : "is-locked"} ${selectedId === heroId ? "is-selected" : ""}" data-action="${unlocked ? "codex-hero" : "locked-hero"}" data-hero="${heroId}">
                  <span>${unlocked ? icon("star", 20) : icon("lock-keyhole", 16)}</span>
                  <b>${unlocked ? HEROES[heroId].name : "未结义"}</b>
                  <small>${unlocked ? HEROES[heroId].star : "星位未明"}</small>
                </button>
              `;
            }).join("")}
          </div>
          <section class="bond-archive codex-archive codex-bonds">
            <button class="codex-archive-toggle" type="button" data-action="toggle-codex-archive" data-archive="bonds" aria-expanded="${codexArchives.bonds}" aria-controls="codex-bond-archive">
              <div>
                <p class="eyebrow">阵谱 · 兄弟契</p>
                <h2>人与人的合阵之法</h2>
              </div>
              <span>${archivedBonds.size}/${Object.keys(HERO_BONDS).length} 已录 ${icon(codexArchives.bonds ? "chevron-up" : "chevron-down", 17)}</span>
            </button>
            <div id="codex-bond-archive" class="codex-archive-body" data-archive-body="bonds" ${codexArchives.bonds ? "" : "hidden"}>
              <div class="bond-archive-grid">
                ${Object.values(HERO_BONDS)
                  .map((bond) =>
                    renderBondCard(bond, {
                      active: activeBondIds.has(bond.id),
                      discovered: archivedBonds.has(bond.id),
                      compact: true,
                    }),
                  )
                  .join("")}
              </div>
            </div>
          </section>
          <section class="chain-archive codex-archive codex-chains">
            <button class="codex-archive-toggle" type="button" data-action="toggle-codex-archive" data-archive="chains" aria-expanded="${codexArchives.chains}" aria-controls="codex-chain-archive">
              <div>
                <p class="eyebrow">战谱 · 星命合击</p>
                <h2>三路星火，四象成阵</h2>
              </div>
              <span>${archivedChains.size}/${Object.keys(CHAIN_FORMATIONS).length} 已录 ${icon(codexArchives.chains ? "chevron-up" : "chevron-down", 17)}</span>
            </button>
            <div id="codex-chain-archive" class="codex-archive-body" data-archive-body="chains" ${codexArchives.chains ? "" : "hidden"}>
              <p class="chain-archive-lead">同一场战斗中依次施展三种不同路数，下一次我方行动即可发动合击。最后三段武学决定结成哪一种阵。</p>
              <div class="chain-archive-grid">
                ${Object.values(CHAIN_FORMATIONS)
                  .map(
                    (formation) => `
                      <article class="chain-formation tone-${formation.tone} ${archivedChains.has(formation.id) ? "is-discovered" : ""}">
                        <span>${icon(archivedChains.has(formation.id) ? formation.icon : "lock-keyhole", 18)}</span>
                        <div>
                          <small>${formation.paths.map((pathId) => PATHS[pathId]?.name || pathId).join(" · ")}</small>
                          <b>${formation.name}</b>
                          <p>${formation.desc}</p>
                        </div>
                        <em>${archivedChains.has(formation.id) ? "已录战谱" : "尚未结成"}</em>
                      </article>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          </section>
          <div class="codex-hero-detail">
            <div class="codex-keyart">${heroKeyart(selectedId, "")}</div>
            <div>
              <p class="eyebrow">${HEROES[selectedId].star} · ${HEROES[selectedId].nickname}</p>
              <h2>${HEROES[selectedId].name}</h2>
              <p>${HEROES[selectedId].bio}</p>
              <div class="codex-skills">
                ${heroSkillList({ refId: selectedId })
                  .slice(0, 3)
                  .map((skill) => `<span><b>${skill.name}</b><small>${skill.desc}</small></span>`)
                  .join("")}
              </div>
              <button class="codex-chronicle-action" data-action="open-hero-chronicle" data-hero="${selectedId}">
                ${icon("book-open", 16)}<span>翻阅${HEROES[selectedId].name}列传</span>${icon("chevron-right", 15)}
              </button>
              <div class="codex-mastery">
                <div class="codex-mastery-heading">
                  <span>${icon("trophy", 15)} 星命试炼</span>
                  <b>${completedTrials}/${HERO_TRIALS.length} · 每完成一项全属性 +2%</b>
                </div>
                <div class="codex-trials">
                  ${HERO_TRIALS.map((trial) => {
                    const done = mastery.trials.includes(trial.id);
                    const value = mastery[trial.metric] || 0;
                    return `
                      <div class="codex-trial ${done ? "is-complete" : ""}">
                        <span>${icon(done ? "badge-check" : "star", 14)}</span>
                        <div>
                          <b>${trial.name}</b>
                          <small>${trial.desc}</small>
                          <i><span style="width:${done ? 100 : pct(value, trial.target)}%"></span></i>
                        </div>
                        <em>${done ? "已完成" : `${Math.min(value, trial.target)}/${trial.target}`}</em>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
              <div class="codex-doctrines ${doctrineUnlocked ? "is-unlocked" : ""}">
                <div class="codex-doctrine-heading">
                  <span>${icon(doctrineUnlocked ? "route" : "lock-keyhole", 15)} 星命命途</span>
                  <b>${doctrineUnlocked ? (selectedDoctrineId ? "可随时切换" : "三试圆满 · 择一而行") : "完成三试后开启"}</b>
                </div>
                <div class="codex-doctrine-grid">
                  ${Object.values(doctrineConfig?.paths || {})
                    .map(
                      (doctrine) => `
                        <button class="codex-doctrine tone-${doctrine.tone} ${selectedDoctrineId === doctrine.id ? "is-selected" : ""}" data-action="choose-doctrine" data-hero="${selectedId}" data-doctrine="${doctrine.id}" ${doctrineUnlocked ? "" : "disabled"} aria-pressed="${selectedDoctrineId === doctrine.id}">
                          <span>${icon(doctrineUnlocked ? doctrine.icon : "lock-keyhole", 18)}</span>
                          <b>${doctrine.name}</b>
                          <small>${doctrine.desc}</small>
                          <em>${selectedDoctrineId === doctrine.id ? "当前命途" : doctrineUnlocked ? "择此命途" : "尚未开启"}</em>
                        </button>
                      `,
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </div>
        </section>
        <aside class="alignment-panel">
          <p class="eyebrow">聚义之志</p>
          <h2>梁山倾向</h2>
          <div class="alignment-primary">
            <span>${icon("compass", 25)}</span>
            <div><small>当下主势</small><b>${summary}</b></div>
          </div>
          ${[
            ["brotherhood", "聚义", "先护兄弟与百姓", "users"],
            ["order", "招安", "在朝堂争一线公道", "landmark"],
            ["freedom", "归隐", "不受王旗与官印", "wind"],
          ]
            .map(
              ([key, label, desc, iconName]) => `
                <div class="alignment-row">
                  <div><span>${icon(iconName, 17)}</span><b>${label}</b><small>${desc}</small></div>
                  <em>${alignment[key]}</em>
                  <i><span class="tone-${key}" style="width:${pct(alignment[key], total)}"></span></i>
                </div>
              `,
            )
            .join("")}
          <div class="ending-archive">
            <div class="section-heading compact"><div><p class="eyebrow">终卷</p><h3>结局收录</h3></div><span>${unlockedEndings.size}/3</span></div>
            ${Object.values(ENDINGS)
              .map(
                (ending) => `
                  <div class="ending-row ${unlockedEndings.has(ending.id) ? "unlocked" : ""}">
                    ${icon(unlockedEndings.has(ending.id) ? "book-open-check" : "lock-keyhole", 17)}
                    <span><b>${unlockedEndings.has(ending.id) ? ending.title : "尚未抵达"}</b><small>${unlockedEndings.has(ending.id) ? ending.subtitle : "终回战后开启"}</small></span>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="achievement-archive">
            <div class="section-heading compact">
              <div><p class="eyebrow">战功</p><h3>梁山功簿</h3></div>
              <span>${unlockedAchievements.size}/${ACHIEVEMENTS.length}</span>
            </div>
            <div class="achievement-list">
              ${ACHIEVEMENTS.map((achievement) => {
                const unlocked = unlockedAchievements.has(achievement.id);
                const progress = achievementProgress(state, achievement.id);
                return `
                  <div class="achievement-row ${unlocked ? "is-unlocked" : ""} tone-${achievement.tone}">
                    <span>${icon(unlocked ? achievement.icon : "lock-keyhole", 16)}</span>
                    <div>
                      <b>${achievement.name}</b>
                      <small>${achievement.desc}</small>
                      ${
                        unlocked
                          ? ""
                          : `<span class="achievement-progress"><i><span style="width:${progress.pct}%"></span></i><small>${progress.label}</small></span>`
                      }
                    </div>
                    <em>${unlocked ? "已录" : `${progress.pct}%`}</em>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </aside>
      </main>
    </div>
  `;
}

function renderSettings() {
  const steamDescription = steamStatus.available
    ? `已连接 ${escapeHtml(steamStatus.playerName || "Steam 玩家")}，成就、统计与云存档会同步至 Steam。`
    : desktopStatus.desktop
      ? "当前未由 Steam 启动，进度与设置保存在本机；进入 Steam 环境后会自动启用云同步。"
      : "网页试玩使用本地存档；桌面正式版可在 Steam 环境中同步成就与云存档。";
  const cloudDescription = steamStatus.cloudEnabled
    ? `最近同步：${lastSteamCloudSyncAt ? formatSaveTime(lastSteamCloudSyncAt) : "尚未同步"}。`
    : "云存档未启用时，本地安全副本仍会持续保留。";
  return `
    <div class="app-screen settings-screen">
      ${topbar("settings", state ? "back-from-settings" : "")}
      <main class="settings-layout">
        <section class="settings-heading">
          <div>
            <p class="eyebrow">卷宗与偏好</p>
            <h1>游戏设置</h1>
          </div>
          <p>设置会随自动存档保存。当前进度在每次选择、战斗奖励和营寨操作后自动写入本地。</p>
        </section>
        <section class="settings-grid">
          <article class="settings-card">
            <div class="settings-icon">${icon("volume-2", 23)}</div>
            <div><h3>声音</h3><p>关闭后会同时暂停配乐与战斗反馈音。</p></div>
            <button class="toggle ${state.settings.sound ? "is-on" : ""}" data-action="toggle-sound" aria-label="切换声音"><span></span></button>
          </article>
          <article class="settings-card settings-card-wide volume-mixer">
            <div class="settings-icon">${icon("sliders-horizontal", 23)}</div>
            <div><h3>音量平衡</h3><p>分别调整场景配乐与战斗反馈音。</p></div>
            <div class="volume-controls">
              <label>
                <span>配乐</span>
                <input type="range" min="0" max="100" step="1" value="${state.settings.musicVolume}" data-volume-setting="musicVolume" aria-label="配乐音量" />
                <output>${state.settings.musicVolume}%</output>
              </label>
              <label>
                <span>音效</span>
                <input type="range" min="0" max="100" step="1" value="${state.settings.sfxVolume}" data-volume-setting="sfxVolume" aria-label="音效音量" />
                <output>${state.settings.sfxVolume}%</output>
              </label>
            </div>
          </article>
          <article class="settings-card">
            <div class="settings-icon">${icon("accessibility", 23)}</div>
            <div><h3>减少动态</h3><p>关闭界面位移与闪烁效果。</p></div>
            <button class="toggle ${state.settings.reducedMotion ? "is-on" : ""}" data-action="toggle-motion" aria-label="切换减少动态"><span></span></button>
          </article>
          <article class="settings-card">
            <div class="settings-icon">${icon("eye", 23)}</div>
            <div><h3>高对比界面</h3><p>增强文字、边框与交互状态的明暗区分。</p></div>
            <button class="toggle ${state.settings.highContrast ? "is-on" : ""}" data-action="toggle-contrast" aria-label="切换高对比界面"><span></span></button>
          </article>
          <article class="settings-card settings-card-wide">
            <div class="settings-icon">${icon("text", 23)}</div>
            <div><h3>界面字号</h3><p>放大按钮、战斗信息与说明文字，不改变角色立绘比例。</p></div>
            <div class="segmented">
              ${[
                ["normal", "标准"],
                ["large", "较大"],
                ["largest", "最大"],
              ]
                .map(
                  ([id, label]) => `<button class="${state.settings.uiScale === id ? "is-selected" : ""}" data-action="ui-scale" data-scale="${id}" aria-label="界面字号${label}">${label}</button>`,
                )
                .join("")}
            </div>
          </article>
          <article class="settings-card">
            <div class="settings-icon">${icon("bot", 23)}</div>
            <div><h3>自动战斗</h3><p>默认由战阵自动出招，可随时手动接管。</p></div>
            <button class="toggle ${state.settings.autoBattle ? "is-on" : ""}" data-action="toggle-auto-battle" aria-label="切换自动战斗"><span></span></button>
          </article>
          <article class="settings-card settings-card-wide">
            <div class="settings-icon">${icon(currentAutoTactic().icon, 23)}</div>
            <div><h3>自动战法</h3><p>同一套阵容可以用不同战法托管。战斗中按 <kbd>T</kbd> 或手柄 <kbd>LB</kbd> 快速轮换。</p></div>
            <div class="auto-tactic-choice" role="group" aria-label="自动战斗战法">
              ${Object.values(AUTO_BATTLE_TACTICS)
                .map(
                  (tactic) => `
                    <button class="tone-${tactic.tone} ${state.settings.autoTactic === tactic.id ? "is-selected" : ""}" data-action="auto-tactic" data-tactic="${tactic.id}" aria-pressed="${state.settings.autoTactic === tactic.id}">
                      <span>${icon(tactic.icon, 17)}</span>
                      <b>${tactic.name}</b>
                      <small>${tactic.desc}</small>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </article>
          <article class="settings-card settings-card-wide">
            <div class="settings-icon">${icon("gauge", 23)}</div>
            <div><h3>战斗速度</h3><p>加快结算、敌方行动与自动出招节奏。</p></div>
            <div class="segmented">
              ${[1, 2, 4]
                .map(
                  (speed) => `<button class="${state.settings.battleSpeed === speed ? "is-selected" : ""}" data-action="battle-speed" data-speed="${speed}" aria-label="${speed}倍战斗速度">${speed}x</button>`,
                )
                .join("")}
            </div>
          </article>
          <article class="settings-card settings-card-wide">
            <div class="settings-icon">${icon("fast-forward", 23)}</div>
            <div><h3>演武自动续阵</h3><p>开启时同时启用自动战斗，阵后采纳军师建议并继续下一阵；每三次阵后的奇遇仍会停下。</p></div>
            <button class="toggle ${state.settings.autoArena ? "is-on" : ""}" data-action="toggle-arena-auto" aria-label="切换演武自动续阵"><span></span></button>
          </article>
          <article class="settings-card settings-card-wide">
            <div class="settings-icon">${icon("text", 23)}</div>
            <div><h3>文字节奏</h3><p>调整剧情文字出现速度。</p></div>
            <div class="segmented">
              ${[
                ["slow", "缓读"],
                ["normal", "标准"],
                ["fast", "快读"],
              ]
                .map(
                  ([id, label]) => `<button class="${state.settings.textSpeed === id ? "is-selected" : ""}" data-action="text-speed" data-speed="${id}">${label}</button>`,
                )
                .join("")}
            </div>
          </article>
          <article class="settings-card settings-card-wide platform-service-card">
            <div class="settings-icon">${icon("cloud", 23)}</div>
            <div>
              <h3>Steam 与诊断</h3>
              <p>${steamDescription}</p>
              <p>${cloudDescription}</p>
            </div>
            <div class="desktop-actions">
              ${
                steamStatus.available
                  ? `<button class="button small secondary" data-action="steam-open-achievements">${icon("trophy", 17)}<span>查看成就</span></button>`
                  : ""
              }
              ${
                steamStatus.cloudEnabled
                  ? `<button class="button small secondary" data-action="steam-sync-now" ${steamCloudSyncing ? "disabled" : ""}>${icon("refresh-cw", 17)}<span>${steamCloudSyncing ? "同步中" : "立即同步"}</span></button>`
                  : ""
              }
              ${
                desktopStatus.desktop
                  ? `<button class="button small ghost" data-action="open-log-folder">${icon("file-text", 17)}<span>诊断日志</span></button>`
                  : ""
              }
            </div>
          </article>
          ${
            desktopStatus.desktop
              ? `<article class="settings-card settings-card-wide desktop-display-card">
                  <div class="settings-icon">${icon("monitor-up", 23)}</div>
                  <div><h3>显示与桌面版</h3><p>${desktopStatus.fullscreen ? "当前使用全屏显示。" : "当前使用窗口显示。"} 快捷键 F11。</p></div>
                  <div class="desktop-actions">
                    <button class="button small secondary" data-action="toggle-fullscreen">${icon(desktopStatus.fullscreen ? "minimize-2" : "maximize-2", 17)}<span>${desktopStatus.fullscreen ? "退出全屏" : "进入全屏"}</span></button>
                    <button class="button small ghost" data-action="ask-quit-game">${icon("power", 17)}<span>退出游戏</span></button>
                  </div>
                </article>`
              : ""
          }
        </section>
        <section class="save-panel">
          <div>
            <p class="eyebrow">本地战卷</p>
            <h2>存档管理</h2>
            <p>最近保存：${formatSaveTime(state.lastSavedAt)}。自动存档会保留上一份安全副本。</p>
          </div>
          <div class="save-actions">
            <button class="button secondary" data-action="manual-save">${icon("save", 18)}<span>立即保存</span></button>
            <button class="button ghost" data-action="export-save">${icon("download", 18)}<span>导出存档</span></button>
            <label class="button ghost file-button">
              ${icon("upload", 18)}<span>导入存档</span>
              <input type="file" accept=".json,application/json" data-save-import />
            </label>
            <button class="button danger-ghost" data-action="ask-delete-save">${icon("trash-2", 18)}<span>删除存档</span></button>
          </div>
        </section>
        <section class="settings-about">
          <span>星命水浒 · 风雪山神庙</span>
          <div class="settings-about-actions">
            <button class="text-button" data-action="show-credits">${icon("book-open", 15)} 制作名单与内容说明</button>
            <button class="text-button" data-action="show-legal-document" data-document="privacy">${icon("shield-check", 15)} 隐私说明</button>
            <button class="text-button" data-action="show-legal-document" data-document="eula">${icon("gavel", 15)} 用户许可</button>
            <button class="text-button" data-action="show-legal-document" data-document="support">${icon("info", 15)} 支持与更新</button>
            <button class="text-button" data-action="show-legal-document" data-document="refund">${icon("file-text", 15)} 退款说明</button>
            <button class="text-button" data-action="show-third-party-notices">${icon("file-text", 15)} 第三方许可</button>
          </div>
        </section>
        <section class="journey-stats">
          <div><small>战斗胜利</small><b>${state.stats.battlesWon}</b></div>
          <div><small>击败敌手</small><b>${state.stats.enemiesDefeated}</b></div>
          <div><small>结义好汉</small><b>${state.recruited.length}</b></div>
          <div><small>完成度</small><b>${completionPercent(state)}%</b></div>
        </section>
      </main>
    </div>
  `;
}

function formatSaveTime(value) {
  if (!value) return "尚未保存";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function exportCurrentSave() {
  if (!state) return;
  const payload = JSON.stringify(
    {
      ...state,
      lastSavedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `星命水浒-存档-${stamp}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  sound.confirm();
  toast("战卷已导出", "success");
}

async function prepareSaveImport(file) {
  if (!file) return;
  try {
    const imported = validateSaveText(await file.text());
    if (!imported) {
      toast("这份战卷格式不兼容或已经损坏", "danger");
      return;
    }
    pendingImportedState = imported;
    openModal({
      title: "载入这份战卷？",
      body: `<p>导入后会覆盖当前本地进度。当前战卷会自动留作安全副本。</p><p><b>${escapeHtml(imported.ending ? "全篇终" : currentChapter(imported).title)}</b> · ${imported.recruited.length} 位好汉 · 完成度 ${completionPercent(imported)}%</p>`,
      actions: [
        { label: "取消", action: "cancel-save-import", tone: "ghost", icon: "x" },
        { label: "载入战卷", action: "confirm-save-import", tone: "primary", icon: "upload" },
      ],
    });
  } catch {
    toast("无法读取这份战卷", "danger");
  }
}

function showCredits() {
  openModal({
    title: "制作名单与内容说明",
    body: `
      <p><b>星命水浒 · 风雪山神庙</b></p>
      <p>回合制系统、叙事、界面与程序：星命水浒制作组。角色、场景、敌人、图标与音乐由项目内 ComfyUI 资产管线生成并整理。</p>
      <p>本作取材自《水浒传》公版人物与故事背景，战斗系统采用原创三人阵位、四路克制、义气与军令构筑。</p>
      <p>内容说明：包含冷兵器战斗、流血、囚禁、冤案与权力压迫等主题，不含写实肢解或性内容。</p>
      <p>版本 ${escapeHtml(desktopStatus.desktop ? "桌面版" : "网页版")} · 存档版本 ${SAVE_VERSION}</p>
    `,
    actions: [{ label: "返回游戏", action: "close-modal", tone: "primary", icon: "check" }],
  });
}

async function showThirdPartyNotices() {
  try {
    const response = await fetch("/THIRD_PARTY_NOTICES.txt", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const notices = await response.text();
    openModal({
      title: "第三方软件许可",
      body: `<pre class="legal-notice-text">${escapeHtml(notices)}</pre>`,
      actions: [
        {
          label: "返回游戏",
          action: "close-modal",
          tone: "primary",
          icon: "check",
        },
      ],
    });
  } catch (error) {
    reportDiagnostic("error", "third-party-notices-failed", String(error));
    toast("未能读取第三方许可文件", "danger");
  }
}

async function showLegalDocument(documentId) {
  const documents = {
    privacy: {
      title: "隐私说明",
      path: "/legal/privacy.html",
    },
    eula: {
      title: "最终用户许可协议",
      path: "/legal/eula.html",
    },
    support: {
      title: "支持与版本更新",
      path: "/legal/support.html",
    },
    refund: {
      title: "退款说明",
      path: "/legal/refund.html",
    },
  };
  const documentInfo = documents[documentId];
  if (!documentInfo) return;
  try {
    const response = await fetch(documentInfo.path, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const page = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const text = page.querySelector("main")?.textContent?.trim();
    if (!text) throw new Error("empty legal document");
    openModal({
      title: documentInfo.title,
      body: `<pre class="legal-notice-text" tabindex="0">${escapeHtml(text)}</pre>`,
      actions: [
        {
          label: "返回游戏",
          action: "close-modal",
          tone: "primary",
          icon: "check",
        },
      ],
    });
  } catch (error) {
    reportDiagnostic("error", "legal-document-failed", {
      document: documentId,
      error: String(error),
    });
    toast("未能读取发行文档", "danger");
  }
}

function requestDesktopQuit() {
  if (!gameShell?.quit) return;
  openModal({
    title: "退出星命水浒？",
    body: "<p>当前进度已经自动保存。下次启动可以继续当前战役或演武。</p>",
    actions: [
      { label: "继续游玩", action: "close-modal", tone: "ghost", icon: "play" },
      { label: "退出游戏", action: "confirm-quit-game", tone: "danger", icon: "power" },
    ],
  });
}

function toggleDesktopFullscreen() {
  if (!gameShell?.toggleFullscreen) return;
  gameShell.toggleFullscreen().then((fullscreen) => {
    desktopStatus.fullscreen = Boolean(fullscreen);
    sound.confirm();
    render();
  });
}

function renderStory() {
  if (!activeChapter || !story) return "";
  const isChoice = story.stage === "choice";
  const isResponse = story.stage === "choice-response";
  const isLegendReady = story.stage === "legend-ready";
  const isRecruitment = Boolean(story.heroRecruitmentId);
  const lines = story.stage === "outro" ? activeChapter.outro : activeChapter.intro;
  const line = lines[Math.min(story.line, lines.length - 1)];
  const portrait = getStoryPortrait(line, isResponse ? activeChapter.choice.options[story.choiceIndex] : null);
  return `
    <main class="story-screen" style="--story-bg:url('${activeChapter.bg}')">
      <div class="story-background"></div>
      <div class="story-vignette"></div>
      <header class="story-header">
        <div class="story-chapter-mark"><span>${activeChapter.label}</span><b>${activeChapter.title}</b></div>
        <div class="story-header-actions">
          <span>${activeChapter.location}</span>
          <button class="icon-button" data-action="story-menu" aria-label="故事菜单">${icon("menu", 20)}</button>
        </div>
      </header>
      <div class="story-party-silhouettes">
        ${state.recruited
          .slice(0, 4)
          .map(
            (heroId, index) => `
              <div style="--silhouette-index:${index}" class="${line?.portrait === heroId ? "is-speaking" : ""}">
                ${heroPortrait(heroId, "")}
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="story-speaker-portrait ${portrait?.kind || "hero"}">
        ${portrait?.html || ""}
      </div>
      ${
        isLegendReady
          ? renderLegendReady()
          : isChoice
            ? renderStoryChoice()
            : isResponse
              ? renderStoryResponse()
              : `
              <section class="dialogue-panel" data-action="story-next">
                <div class="dialogue-speaker">
                  <span>${escapeHtml(line.speaker)}</span>
                  <i></i>
                </div>
                <p class="dialogue-text speed-${state.settings.textSpeed}">${escapeHtml(line.text)}</p>
                <div class="dialogue-next">${icon("mouse-pointer-2", 16)} 点击继续</div>
              </section>
              `
      }
      <footer class="story-footer">
        <span>${story.stage === "outro" ? "战后余音" : story.legendHeroId ? "群英列传" : isRecruitment ? "聚义帖" : "本章剧情"}</span>
        <div class="story-progress">
          ${lines.map((_, index) => `<i class="${index <= story.line ? "is-read" : ""}"></i>`).join("")}
        </div>
        ${
          story.stage === "intro"
            ? `<button data-action="story-skip">跳过回想 ${icon("chevrons-right", 15)}</button>`
            : `<span>${activeChapter.location}</span>`
        }
      </footer>
    </main>
  `;
}

function renderLegendReady() {
  const legend = HERO_LEGENDS[story.legendHeroId];
  const deployed = state.team.includes(story.legendHeroId);
  return `
    <section class="legend-ready">
      <p class="eyebrow">群英列传 · 临阵篇</p>
      <h2>${legend.title}</h2>
      <p>${legend.readyText}</p>
      <div class="legend-ready-rule">
        <span>${icon(legend.rule.icon, 16)}${legend.rule.name}</span>
        <p>${legend.rule.desc}</p>
      </div>
      <div class="legend-ready-meta">
        <span>${icon("map-pin", 15)}${legend.location}</span>
        <span>${icon("users", 15)}${deployed ? `${HEROES[story.legendHeroId].name}已入三阵` : "调整阵容后出战"}</span>
        <span>${icon("gem", 15)}${EQUIPMENT[legend.reward.item]?.name || "专属装备"}</span>
      </div>
      <button class="button primary large" data-action="story-to-battle">${icon("swords", 20)}<span>领阵出征</span></button>
    </section>
  `;
}

function getStoryPortrait(line, response) {
  if (response) {
    const responseHero =
      story?.legendHeroId ||
      story?.heroRecruitmentId ||
      state.team.find(Boolean) ||
      "linchong";
    return {
      kind: "hero",
      html: heroPortrait(responseHero || "linchong", ""),
    };
  }
  if (line?.portrait && HEROES[line.portrait]) {
    return { kind: "hero", html: heroPortrait(line.portrait, "") };
  }
  if (line?.speaker?.includes("教头")) {
    return {
      kind: "enemy",
      html: `<img class="story-enemy-portrait" src="/assets/enemies/instructor.png" alt="" />`,
    };
  }
  if (line?.speaker?.includes("押差")) {
    return {
      kind: "enemy",
      html: `<img class="story-enemy-portrait" src="/assets/enemies/captain.png" alt="" />`,
    };
  }
  return {
    kind: "hero",
    html: heroPortrait(state.team.find(Boolean) || "linchong", ""),
  };
}

function renderStoryChoice() {
  const choice = activeChapter.choice;
  return `
    <section class="story-choice">
      <p class="eyebrow">抉择 · 星命将记下这一笔</p>
      <h2>${choice.prompt}</h2>
      <div class="choice-list">
        ${choice.options
          .map(
            (option, index) => {
              const tactic = getChapterTactic(activeChapter.id, index);
              return `
              <button data-action="story-choice" data-option="${index}">
                <span class="choice-index">${String(index + 1).padStart(2, "0")}</span>
                <span class="choice-copy">
                  <b>${option.text}</b>
                  <small>${alignmentEffectText(option.effect)}</small>
                  ${
                    tactic
                      ? `<span class="choice-tactic tone-${tactic.tone}">
                          ${icon(tactic.icon, 12)}
                          <b>临阵战意 · ${tactic.name}</b>
                          <small>${tactic.desc}</small>
                        </span>`
                      : ""
                  }
                </span>
                ${icon("chevron-right", 19)}
              </button>
            `;
            },
          )
          .join("")}
      </div>
    </section>
  `;
}

function alignmentEffectText(effect) {
  const labels = { brotherhood: "聚义", order: "招安", freedom: "归隐" };
  return Object.entries(effect)
    .map(([key, value]) => `${labels[key]} +${value}`)
    .join(" · ");
}

function renderStoryResponse() {
  const option = activeChapter.choice.options[story.choiceIndex];
  const tactic = getChapterTactic(activeChapter.id, story.choiceIndex);
  return `
    <section class="story-response">
      <p class="eyebrow">你的选择</p>
      <blockquote>${option.text}</blockquote>
      <p>${option.response}</p>
      ${
        tactic
          ? `<div class="tactic-reveal tone-${tactic.tone}">
              <span>${icon(tactic.icon, 20)}</span>
              <div>
                <small>临阵战意已定</small>
                <b>${tactic.name}</b>
                <p>${tactic.desc}</p>
              </div>
            </div>`
          : ""
      }
      <button class="button primary large" data-action="story-to-battle">${icon("swords", 20)}<span>拔刃迎战</span></button>
    </section>
  `;
}

function renderBattle() {
  if (!battle) return "";
  const actor = currentCombatant(battle);
  const autoTactic = currentAutoTactic();
  const heroUnit = actor?.side === "hero" ? actor : null;
  const selectedSkill = heroUnit
    ? heroSkillList(heroUnit).find((skill) => skill.id === battleUi.selectedSkillId)
    : null;
  const targetIds = selectedSkill
    ? new Set(validTargets(battle, heroUnit.uid, selectedSkill).map((unit) => unit.uid))
    : new Set();
  const preview = turnPreview(battle, 7);
  const arenaBounty =
    battle.mode === "arena"
      ? ARENA_BOUNTIES.find(
          (bounty) => bounty.id === arenaRun?.currentBounty,
        )
      : null;
  const arenaEncounter =
    battle.mode === "arena" ? battle.specialRule : null;
  const battleBonds = (battle.bondIds || [])
    .map((bondId) => HERO_BONDS[bondId])
    .filter(Boolean);
  const battleDoctrines = battle.heroes
    .filter((unit) => unit.doctrineId)
    .map((unit) => ({
      unit,
      doctrine: HERO_DOCTRINES[unit.refId]?.paths?.[unit.doctrineId],
    }))
    .filter((entry) => entry.doctrine);
  const battleSpecialRule =
    battle.mode === "legend" ||
    battle.mode === "recruitment" ||
    (battle.mode === "campaign" && battle.specialRule)
      ? battle.specialRule || battle.legendRule
      : null;
  const battleSpecialRuleLabel =
    battle.mode === "legend"
      ? "群英列传战意"
      : battle.mode === "recruitment"
        ? "聚义战意"
        : "临阵战意";
  const chainFormation = battle.chainReady
    ? chainFormationForBattle(battle)
    : null;
  const chainPaths = chainPathsForBattle(battle);
  const chainCandidates = Object.values(CHAIN_FORMATIONS).filter((formation) =>
    chainPaths.every((pathId) => formation.paths.includes(pathId)),
  );
  const chainHint = chainFormation
    ? chainFormation.name
    : chainPaths.length === 2
      ? "两路待合"
      : chainPaths.length === 1
        ? "一路起势"
        : "待取三路";
  const chainLabel = chainFormation
    ? `星命合击已蓄势：${chainFormation.name}`
    : chainPaths.length === 2
      ? `已记录${chainPaths.map((pathId) => PATHS[pathId].name).join("、")}，再取一路可结${chainCandidates.map((formation) => formation.name).join("或")}`
      : chainPaths.length === 1
        ? `已记录${PATHS[chainPaths[0]].name}，再取两种不同路数`
        : "星命连携：使用三种不同路数后即可发动合击";
  const currentSide = battleActorSide;
  const resultEvents = battleUi.result?.events || [];
  const heroStriking =
    currentSide === "hero" &&
    Boolean(battleUi.result) &&
    (resultEvents.some(
      (event) =>
        event.targetUid !== actor?.uid &&
        (event.targetUid.startsWith("enemy-") || event.type === "combo"),
    ) ||
      battleUi.result.targets?.some((targetUid) =>
        targetUid.startsWith("enemy-"),
      ));
  const enemyStriking =
    currentSide === "enemy" &&
    Boolean(
      resultEvents.some((event) => event.targetUid?.startsWith("hero-")),
    );
  const battleImpact = resultEvents.some(
    (event) => event.type === "damage" || event.type === "combo",
  );
  return `
    <main class="battle-screen">
      <div class="battle-background" style="background-image:url('${battle.backdrop}')"></div>
      <div class="battle-overlay"></div>
      <header class="battle-header">
        <div class="battle-title">
          <button class="icon-button" data-action="battle-menu" aria-label="战斗菜单">${icon("menu", 19)}</button>
          <div><small>${activeChapter.label} · ${activeChapter.location}</small><b>${activeChapter.title}</b></div>
        </div>
        <div class="battle-controls" aria-label="战斗控制">
          <button class="auto-battle-toggle ${state.settings.autoBattle ? "is-active" : ""}" data-action="toggle-auto-battle" aria-label="${state.settings.autoBattle ? "关闭自动战斗" : "开启自动战斗"}">
            ${icon(state.settings.autoBattle ? "bot" : "hand", 17)}
            <span>${state.settings.autoBattle ? "自动中" : "自动战斗"}</span>
          </button>
          <button class="auto-tactic-toggle tone-${autoTactic.tone}" data-action="cycle-auto-tactic" title="${autoTactic.name}：${autoTactic.desc}（键盘 T / 手柄 LB）" aria-label="自动战法：${autoTactic.name}，点击切换">
            ${icon(autoTactic.icon, 15)}
            <span>${autoTactic.short}</span>
          </button>
          <div class="battle-speed-control" role="group" aria-label="战斗速度">
            ${[1, 2, 4]
              .map(
                (speed) => `<button class="${state.settings.battleSpeed === speed ? "is-selected" : ""}" data-action="battle-speed" data-speed="${speed}" aria-label="${speed}倍战斗速度">${speed}x</button>`,
              )
              .join("")}
          </div>
          <button class="icon-button battle-sound" data-action="toggle-sound" aria-label="声音">${icon(state.settings.sound ? "volume-2" : "volume-x", 18)}</button>
        </div>
        <div class="round-badge"><span>回合</span><b>${String(Math.max(1, battle.round)).padStart(2, "0")}</b></div>
        <div class="turn-order">
          <span>行动顺序</span>
          ${preview
            .map(
              (unit, index) => `
                <div class="turn-face ${index === 0 ? "is-current" : ""} ${unit.side}" title="${unit.name}">
                  ${turnPortrait(unit)}
                  <small>${unit.spd}</small>
                </div>
              `,
            )
            .join("")}
        </div>
      </header>
      <section class="battle-field ${arenaBounty ? "has-arena-bounty" : ""} ${arenaEncounter ? "has-arena-encounter" : ""} ${battle.chainReady ? "is-chain-ready" : ""} ${battleImpact ? "is-impacting" : ""}">
        ${
          battleSpecialRule
            ? `<div class="battle-legend-hud ${battle.mode === "recruitment" ? "is-recruitment" : ""} ${battle.mode === "campaign" ? "is-tactic" : ""}" aria-label="${battleSpecialRuleLabel}">
                <span>${icon(battleSpecialRule.icon, 18)}</span>
                <div><small>${battleSpecialRuleLabel}</small><b>${battleSpecialRule.name}</b></div>
                <p>${battleSpecialRule.desc}</p>
              </div>`
            : ""
        }
        ${
          arenaEncounter
            ? renderArenaEncounterHud(arenaEncounter)
            : ""
        }
        ${
          battle.mode === "arena"
            ? renderArenaTrialHud(arenaRun?.trialIds)
            : ""
        }
        ${
          battleBonds.length
            ? `<div class="battle-bond-hud" aria-label="当前兄弟契">
                <span>${icon("sparkles", 16)}</span>
                <small>兄弟契</small>
                <div>
                  ${battleBonds
                    .map(
                      (bond) => `
                        <b class="tone-${bond.tone}" title="${bond.desc}">
                          ${icon(bond.icon, 13)}${bond.name}
                        </b>
                      `,
                    )
                    .join("")}
                </div>
              </div>`
            : ""
        }
        ${
          battleDoctrines.length
            ? `<div class="battle-doctrine-hud" aria-label="当前星命命途">
                <span>${icon("route", 16)}</span>
                <small>命途</small>
                <div>
                  ${battleDoctrines
                    .map(
                      ({ unit, doctrine }) => `
                        <b class="tone-${doctrine.tone}" title="${doctrine.desc}">
                          ${icon(doctrine.icon, 13)}${unit.name}·${doctrine.name}
                        </b>
                      `,
                    )
                    .join("")}
                </div>
              </div>`
            : ""
        }
        ${
          arenaBounty
            ? `<div class="arena-bounty-hud tone-${arenaBounty.tone}">
                <span>${icon(arenaBounty.icon, 17)}</span>
                <div><small>本阵悬赏</small><b>${arenaBounty.name}</b></div>
                <p>${arenaBounty.desc}</p>
                <em>铜钱 +${arenaBounty.copper} · 军功 +${arenaBounty.score}</em>
              </div>`
            : ""
        }
        ${renderBattleSkillCallout()}
        <div class="battle-stage">
          <div class="enemy-formation">
            <div class="formation-caption"><span>${battle.mode === "arena" ? `演武第 ${battle.arenaWave} 阵` : "高俅爪牙"}</span><i></i><small>${battle.enemies.filter((unit) => unit.hp > 0).length} 人</small></div>
            <div class="enemy-line ${enemyStriking ? "is-striking" : ""}">
              ${renderFormationLine(battle.enemies, (unit) =>
                renderEnemyUnit(
                  unit,
                  targetIds.has(unit.uid) &&
                    !battleUi.processing &&
                    !state.settings.autoBattle,
                  battle.currentUid === unit.uid,
                ),
              )}
            </div>
          </div>
          <div class="battle-midline">
            <span></span>
            <div class="battle-chain ${battle.chainReady ? "is-ready" : ""}" aria-label="${chainLabel}">
              <small>星命连携</small>
              <span class="chain-path-slots">
                ${Array.from({ length: 3 }, (_, index) =>
                  chainPathMark(chainPaths[index] || null),
                ).join("")}
              </span>
              <b title="${chainFormation?.desc || chainLabel}">${chainHint}</b>
            </div>
            <div class="battle-phase-label">
              ${battle.phase === "enemy" ? "敌军行动" : battle.phase === "select" ? "轮到我方" : battle.phase === "victory" ? "敌阵已破" : battle.phase === "defeat" ? "众人力竭" : "交锋"}
            </div>
            <span></span>
          </div>
          <div class="hero-formation">
            <div class="formation-caption"><span>梁山好汉</span><i></i><small>义气</small></div>
            <div class="hero-line ${heroStriking ? "is-striking" : ""}">
              ${renderFormationLine(battle.heroes, (unit) =>
                renderBattleHero(
                  unit,
                  targetIds.has(unit.uid) &&
                    !battleUi.processing &&
                    !state.settings.autoBattle,
                  battle.currentUid === unit.uid,
                  heroStriking && battle.currentUid === unit.uid,
                ),
              )}
            </div>
          </div>
        </div>
        ${renderBattleResult()}
        ${renderBattleCommand(actor, selectedSkill, chainFormation)}
      </section>
      ${battle.phase === "defeat" ? renderDefeatOverlay() : ""}
    </main>
  `;
}

function turnPortrait(unit) {
  if (unit.side === "hero") {
    return `<img src="${unit.portrait}" alt="" />`;
  }
  return `<img class="turn-enemy-image" src="${unit.sprite}" alt="" />`;
}

function renderEnemyUnit(unit, targetable, current) {
  const striking = current && battleActorSide === "enemy";
  const vfx = battleUi.vfx;
  const casting = vfx?.actorUid === unit.uid;
  const vfxTarget = Boolean(vfx?.targetUids?.includes(unit.uid));
  const damage = takeBattleFeedback(unit.uid, "damage");
  const evade = takeBattleFeedback(unit.uid, "evade");
  const spatialStyle = battleUnitSpatialStyle(unit.uid);
  const feedbackLabel = damage
    ? `-${damage.damage}${damage.critical ? " 暴击" : ""}${
        damage.pathAdvantage ? " 克制" : ""
      }`
    : evade
      ? "闪避"
      : "";
  return `
    <button class="battle-unit enemy-unit ${targetable ? "is-targetable" : ""} ${current ? "is-current" : ""} ${striking ? "is-striking" : ""} ${casting ? `is-casting tone-${vfx.tone}` : ""} ${unit.hp <= 0 ? "is-defeated" : ""} ${damage ? "is-hit" : ""} ${evade ? "is-evading" : ""}" data-action="${targetable ? "battle-target" : "inspect-unit"}" data-uid="${unit.uid}" data-row="${unit.row}" style="${spatialStyle}" aria-label="${unit.name}">
      ${renderBattleMotion(damage || evade, feedbackLabel, damage?.critical ? "is-critical" : evade ? "is-evade" : "")}
      ${vfxTarget ? renderBattleSkillImpact(vfx, vfx?.targetUids?.[0] === unit.uid) : ""}
      <div class="enemy-figure">
        <img src="${unit.sprite}" alt="" draggable="false" />
        <span class="target-reticle">${icon("crosshair", 28)}</span>
      </div>
      <div class="unit-hud">
        <div class="unit-name-line">
          <span><small>Lv.${unit.level}</small><b>${unit.name}</b></span>
          ${pathBadge(unit.path, true)}
        </div>
        <div class="unit-bars">
          <div class="bar hp"><i><span style="width:${pct(unit.hp, unit.maxHp)}"></span></i><b>${unit.hp}/${unit.maxHp}</b></div>
          <div class="bar poise"><i><span style="width:${pct(unit.poise, unit.poiseMax)}"></span></i><small>${unit.broken > 0 ? "破势" : "护势"}</small></div>
        </div>
        <div class="unit-statuses">${statusList(unit)}</div>
      </div>
    </button>
  `;
}

function renderFormationLine(units, renderer) {
  const occupiedRows = new Set(units.map((unit) => unit.row));
  const visibleRows = occupiedRows.has(1)
    ? [0, 1, 2]
    : [0, 2];
  return visibleRows
    .map((row) => {
      const unit = units.find((candidate) => candidate.row === row);
      return `
        <div class="formation-slot formation-slot-${row} ${unit ? "" : "is-empty"}" data-row="${row}">
          ${unit ? renderer(unit) : ""}
        </div>
      `;
    })
    .join("");
}

function renderBattleHero(unit, targetable, current, striking) {
  const teamRow = ROWS[unit.row]?.name || "";
  const vfx = battleUi.vfx;
  const casting = vfx?.actorUid === unit.uid;
  const vfxTarget = Boolean(vfx?.targetUids?.includes(unit.uid));
  const damage = takeBattleFeedback(unit.uid, "damage");
  const heal = takeBattleFeedback(unit.uid, "heal");
  const spatialStyle = battleUnitSpatialStyle(unit.uid);
  const feedbackLabel = damage
    ? `-${damage.damage}${damage.critical ? " 暴击" : ""}${
        damage.pathAdvantage ? " 克制" : ""
      }`
    : heal
      ? `+${heal.healing}`
      : "";
  return `
    <button class="battle-unit hero-unit ${targetable ? "is-targetable" : ""} ${current ? "is-current" : ""} ${striking ? "is-striking" : ""} ${casting ? `is-casting tone-${vfx.tone}` : ""} ${unit.hp <= 0 ? "is-defeated" : ""} ${damage ? "is-hit" : ""} ${heal ? "is-healed" : ""}" data-action="${targetable ? "battle-target" : "inspect-unit"}" data-uid="${unit.uid}" data-row="${unit.row}" style="${spatialStyle}" aria-label="${unit.name}">
      ${renderBattleMotion(damage || heal, feedbackLabel, damage?.critical ? "is-critical" : heal ? "is-heal" : "")}
      ${vfxTarget ? renderBattleSkillImpact(vfx, vfx?.targetUids?.[0] === unit.uid) : ""}
      <span class="row-ribbon">${teamRow}</span>
      <div class="hero-figure">
        <img src="${unit.portrait}" alt="" draggable="false" />
        <span class="target-reticle">${icon("crosshair", 28)}</span>
      </div>
      <div class="unit-hud">
        <div class="unit-name-line">
          <span><small>Lv.${unit.level}</small><b>${unit.name}</b></span>
          ${pathBadge(unit.path, true)}
        </div>
        <div class="unit-bars">
          <div class="bar hp"><i><span style="width:${pct(unit.hp, unit.maxHp)}"></span></i><b>${unit.hp}/${unit.maxHp}</b></div>
          <div class="bar yiqi"><i><span style="width:${unit.yiqi}%"></span></i><small>义气 ${unit.yiqi}</small></div>
        </div>
        <div class="unit-statuses">${statusList(unit)}</div>
      </div>
    </button>
  `;
}

function renderBattleResult() {
  if (!battleUi.result || battleUi.feedback.length) return "";
  return `
    <div class="battle-result ${battleUi.resultTone}">
      <div class="result-mark">${icon(
        battleUi.result.kind === "heal"
          ? "heart-pulse"
          : battleUi.result.kind === "combo"
            ? "sparkles"
            : "swords",
        19,
      )}</div>
      <div class="result-lines">
        ${battleUi.result.lines.slice(0, 5).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderBattleCommand(actor, selectedSkill, chainFormation) {
  if (!actor || actor.hp <= 0) {
    return `<aside class="battle-command"><div class="command-waiting">${icon("hourglass", 22)}<b>整理战阵</b></div></aside>`;
  }
  if (actor.side === "enemy") {
    return `
      <aside class="battle-command enemy-command">
        <p class="eyebrow">敌方行动</p>
        <div class="enemy-command-name">
          <img class="enemy-command-crop" src="${actor.sprite}" alt="" />
          <div><small>${PATH_LABEL(actor.path)} · Lv.${actor.level}</small><h2>${actor.name}</h2></div>
        </div>
        <div class="command-waiting">${icon("hourglass", 24)}<b>正在判断阵势</b><small>敌军将在片刻后出手</small></div>
      </aside>
    `;
  }
  const tutorialPending =
    battle.mode === "campaign" &&
    !state.flags.tutorialSeen;
  const skills = heroSkillList(actor);
  return `
    <aside class="battle-command ${tutorialPending ? "has-tutorial" : ""} ${state.settings.autoBattle ? "is-auto" : ""}">
      <div class="current-actor">
        <span class="actor-portrait"><img src="${actor.portrait}" alt="" /></span>
        <div><small>${ROWS[actor.row].name} · ${PATHS[actor.path].name}</small><h2>${actor.name}</h2></div>
        <span class="actor-yiqi">${icon("zap", 16)}<b>${actor.yiqi}</b></span>
      </div>
      ${
        tutorialPending
          ? `<section class="battle-tutorial" aria-labelledby="battle-tutorial-title">
              <header>
                <span>${icon("compass", 20)}</span>
                <div><p class="eyebrow">军师点拨</p><h3 id="battle-tutorial-title">先看路数，再定招式</h3></div>
                <small>首战</small>
              </header>
              <div class="battle-tutorial-lessons">
                <div>
                  <span>${icon("route", 17)}</span>
                  <p><b>路数相克</b>刚猛克守御，守御克灵巧，灵巧克韬略，韬略克刚猛。克制时伤害与破势更高。</p>
                </div>
                <div>
                  <span>${icon("crosshair", 17)}</span>
                  <p><b>选择目标</b>点选招式后，如有多名可选目标，再点敌阵中发亮的人物。</p>
                </div>
                <div>
                  <span>${icon("sparkles", 17)}</span>
                  <p><b>星命合击</b>同场依次使用三种不同路数，下一次我方行动即可发动合击。右上角可开自动、轮换战法与倍速；键盘用 A / T，手柄用 X / LB。</p>
                </div>
              </div>
              <button class="button primary battle-tutorial-start" data-action="dismiss-battle-tutorial">
                ${icon("swords", 18)}<span>记住阵要，开始迎敌</span>
              </button>
            </section>`
          : ""
      }
      ${
        !tutorialPending &&
        chainAttackReady(battle)
          ? `<button class="chain-attack-action tone-${chainFormation?.tone || "gold"}" data-action="chain-attack" ${state.settings.autoBattle || battleUi.processing ? "disabled" : ""}>
              <span>${icon(chainFormation?.icon || "sparkles", 20)}</span>
              <span><b>${chainFormation?.name || "星命合击"}</b><small>${chainFormation?.desc || "三路星火同发，攻击全体敌军并鼓舞全队"}</small></span>
              <em>${state.settings.autoBattle ? "自动待发" : "发动"}</em>
            </button>`
          : ""
      }
      ${
        !tutorialPending
          ? state.settings.autoBattle
            ? `<div class="skill-prompt is-auto"><span>${icon("bot", 16)} 战阵自动出招</span><small>关闭自动即可接管</small></div>`
            : selectedSkill
              ? `<div class="target-prompt">${icon("crosshair", 17)}<span>为「${selectedSkill.name}」选择${
                  selectedSkill.target === "ally" ? "一名好汉" : "一个目标"
                }</span><button data-action="cancel-target">取消</button></div>`
              : `<div class="skill-prompt"><span>选择招式</span><small>${battle.phase === "select" ? "路数克制会造成额外伤害" : "等待行动结算"}</small></div>`
          : ""
      }
      ${
        !tutorialPending
          ? `<div class="skill-list">
        ${skills
          .map((skill) => renderSkillButton(skill, actor))
          .join("")}
      </div>
      <div class="battle-log">
        <div class="log-heading"><span>战况</span><small>${battle.log.length ? "实时" : ""}</small></div>
        <div class="log-lines">
          ${[...battle.log]
            .reverse()
            .slice(0, 5)
            .map((entry) => `<p class="log-${entry.type}">${escapeHtml(entry.text)}</p>`)
            .join("")}
        </div>
      </div>`
          : ""
      }
    </aside>
  `;
}

function PATH_LABEL(pathId) {
  return PATHS[pathId]?.name || "";
}

function renderSkillButton(skill, actor) {
  const cooldown = actor.cooldowns[skill.id] || 0;
  const usable =
    skillUsable(actor, skill) &&
    battle.phase === "select" &&
    !battleUi.processing &&
    !state.settings.autoBattle;
  const selected = battleUi.selectedSkillId === skill.id;
  const ult = Boolean(skill.ultimate);
  const cost = skill.yiqiCost ? `义气 ${skill.yiqiCost}` : skill.cooldown ? `冷却 ${skill.cooldown} 回合` : "调息";
  return `
    <button class="skill-button ${selected ? "is-selected" : ""} ${ult ? "is-ultimate" : ""}" data-action="select-skill" data-skill="${skill.id}" ${!usable ? "disabled" : ""}>
      <span class="skill-icon">${ult ? icon("sparkles", 20) : icon(skill.heal ? "heart-pulse" : skill.power > 0 ? "swords" : "shield", 19)}</span>
      <span class="skill-copy"><b>${skill.name}</b><small>${skill.desc}</small></span>
      <span class="skill-cost ${cooldown > 0 ? "is-cooling" : ""}">${cooldown > 0 ? `冷却 ${cooldown}` : cost}</span>
    </button>
  `;
}

function renderDefeatOverlay() {
  if (battle?.mode === "arena") {
    return `
      <div class="battle-end-overlay defeat-overlay">
        <section>
          <span class="end-seal">${icon("flag", 32)}</span>
          <p class="eyebrow">演武止于第 ${battle.arenaWave} 阵</p>
          <h2>胜负有数，星火未熄</h2>
          <p>本轮已积 ${arenaRun?.score || 0} 军功，军令、悬赏与本阵生命均已记下。可原阵再战，也可收束后重整三阵与装备。</p>
          <div>
            <button class="button primary" data-action="retire-arena">${icon("list-restart", 18)}<span>收束演武</span></button>
            <button class="button ghost" data-action="retry-arena-wave">${icon("rotate-ccw", 18)}<span>重试本阵</span></button>
          </div>
        </section>
      </div>
    `;
  }
  return `
    <div class="battle-end-overlay defeat-overlay">
      <section>
        <span class="end-seal">${icon("swords", 32)}</span>
        <p class="eyebrow">此战失利</p>
        <h2>风雪未止</h2>
        <p>官军封住退路，但梁山仍在。退回营寨整备后，可再战此回。</p>
        <div>
          <button class="button primary" data-action="retry-battle">${icon("rotate-ccw", 18)}<span>重整再战</span></button>
          <button class="button ghost" data-action="retreat-camp">${icon("landmark", 18)}<span>退回营寨</span></button>
        </div>
      </section>
    </div>
  `;
}

function runBattleAutomation() {
  if (!battle || battleUi.processing) return;
  if (battle.mode === "campaign" && !state.flags.tutorialSeen) return;
  if (battle.phase === "skipping") {
    battleUi.processing = true;
    scheduleBattle(() => {
      battleUi.processing = false;
      finishResolutionAndAdvance(battle);
      render();
    }, 520);
    return;
  }
  if (battle.phase === "select") {
    const actor = currentCombatant(battle);
    if (!actor || actor.hp <= 0 || actor.side !== "hero") {
      battleUi.processing = true;
      scheduleBattle(() => {
        battleUi.processing = false;
        finishResolutionAndAdvance(battle);
        render();
      }, 260);
      return;
    }
    if (state.settings.autoBattle) {
      battleUi.processing = true;
      scheduleBattle(() => {
        battleUi.processing = false;
        if (!battle || battle.phase !== "select") {
          render();
          return;
        }
        if (!state.settings.autoBattle) {
          render();
          return;
        }
        runAutoHeroTurn();
      }, 260);
    }
    return;
  }
  if (battle.phase === "enemy") {
    battleUi.processing = true;
    scheduleBattle(() => runEnemyTurn(), 620);
  }
}

function runAutoHeroTurn() {
  if (!battle || battle.phase !== "select" || battleUi.processing) return;
  const actor = currentCombatant(battle);
  if (!actor || actor.side !== "hero" || actor.hp <= 0) {
    finishResolutionAndAdvance(battle);
    render();
    return;
  }
  if (chainAttackReady(battle)) {
    resolveChainAttack();
    return;
  }
  const action = chooseAutoBattleAction(
    battle,
    actor,
    state.settings.autoTactic,
  );
  if (!action) {
    battleUi.processing = true;
    scheduleBattle(() => {
      battleUi.processing = false;
      finishResolutionAndAdvance(battle);
      render();
    }, 220);
    return;
  }
  recordAutoBattleChoice(battle, action);
  resolveHeroAction(action.skill, action.target?.uid || null);
}

function resolveChainAttack() {
  if (!battle || battle.phase !== "select" || battleUi.processing) return;
  const actor = currentCombatant(battle);
  if (!actor || actor.side !== "hero" || !chainAttackReady(battle)) return;
  battleUi.processing = true;
  battleUi.selectedSkillId = null;
  battleActorSide = actor.side;
  const result = performChainAttack(battle, actor.uid);
  if (!result.ok) {
    battleUi.processing = false;
    toast(result.message || "星命合击尚未蓄势", "danger");
    render();
    return;
  }
  presentBattleResult(
    result,
    battleVfxProfile({
      skill: { name: "星命合击", path: actor.path, ultimate: true },
      actor,
      result,
    }),
  );
  battleUi.resultTone = "combo";
  sound.playCombatCue("combo");
  render();
  showBattleResult();
  scheduleBattle(
    () => advanceAfterResult(),
    battleVfxTransitionDelay(1120),
  );
}

function runEnemyTurn() {
  if (!battle || battle.phase !== "enemy") {
    battleUi.processing = false;
    return;
  }
  const actor = currentCombatant(battle);
  if (!actor || actor.hp <= 0) {
    battleUi.processing = false;
    finishResolutionAndAdvance(battle);
    render();
    return;
  }
  const action = chooseEnemyAction(battle, actor);
  if (!action?.skill) {
    battleUi.processing = false;
    finishResolutionAndAdvance(battle);
    render();
    return;
  }
  battleActorSide = actor.side;
  const result = action.skill
    ? performAction(battle, actor.uid, action.skill, action.target?.uid || null)
    : { ok: false, lines: ["敌军阵脚已乱。"] };
  const battleResult = result.ok
    ? result
    : { lines: ["敌军阵脚已乱。"], kind: "damage" };
  presentBattleResult(
    battleResult,
    battleVfxProfile({
      skill: action.skill && { ...action.skill, path: actor.path },
      actor,
      result: battleResult,
    }),
  );
  battleUi.resultTone = "hostile";
  sound.playCombatCue(
    combatSfxCue({
      skill: action.skill && { ...action.skill, path: actor.path },
      result,
    }),
  );
  render();
  showBattleResult();
  scheduleBattle(
    () => advanceAfterResult(),
    battleVfxTransitionDelay(920),
  );
}

function selectSkill(skillId) {
  if (!battle || battle.phase !== "select" || battleUi.processing) return;
  const actor = currentCombatant(battle);
  if (!actor || actor.side !== "hero") return;
  const skill = heroSkillList(actor).find((item) => item.id === skillId);
  if (!skill || !skillUsable(actor, skill)) {
    toast(skill?.yiqiCost ? "义气不足" : "招式尚未冷却", "danger");
    return;
  }
  sound.click();
  const targets = validTargets(battle, actor.uid, skill);
  if (!targets.length) return;
  const needsManualTarget = ["enemy", "ally"].includes(skill.target);
  if (!needsManualTarget || targets.length === 1) {
    resolveHeroAction(skill, targets[0]?.uid || null);
    return;
  }
  battleUi.selectedSkillId = skill.id;
  render();
}

function resolveHeroAction(skill, targetUid = null) {
  if (!battle || battle.phase !== "select" || battleUi.processing) return;
  const actor = currentCombatant(battle);
  if (!actor || actor.side !== "hero") return;
  battleUi.processing = true;
  battleUi.selectedSkillId = null;
  battleActorSide = actor.side;
  const result = performAction(battle, actor.uid, skill, targetUid);
  if (!result.ok) {
    battleUi.processing = false;
    battle.phase = "select";
    toast(result.message || "此招无法施展", "danger");
    render();
    return;
  }
  presentBattleResult(
    result,
    battleVfxProfile({
      skill: { ...skill, path: actor.path },
      actor,
      result,
    }),
  );
  battleUi.resultTone = result.kind === "heal" ? "support" : "heroic";
  sound.playCombatCue(
    combatSfxCue({
      skill: { ...skill, path: actor.path },
      result,
    }),
  );
  render();
  showBattleResult();
  scheduleBattle(
    () => advanceAfterResult(),
    battleVfxTransitionDelay(900),
  );
}

function showBattleResult() {
  if (!battleUi.result) return;
  clearBattleFeedbackTimer();
  const speed = [1, 2, 4].includes(state?.settings?.battleSpeed)
    ? state.settings.battleSpeed
    : 1;
  const hold = battleVfxTransitionDelay(720) - 60;
  battleFeedbackTimer = window.setTimeout(() => {
    battleFeedbackTimer = null;
    clearBattleFeedback();
    render();
  }, Math.max(180, Math.round(hold / speed)));
}

function advanceAfterResult() {
  clearBattleFeedbackTimer();
  clearBattleFeedback();
  battleUi.result = null;
  battleUi.resultTone = "";
  battleUi.processing = false;
  if (battle.phase === "victory") {
    settleVictory();
    return;
  }
  if (battle.phase === "defeat") {
    if (battle.mode === "arena" && arenaRun && !arenaRun.defeated) {
      arenaRun.defeated = true;
      state.arena.lastWave = Math.max(
        state.arena.lastWave,
        battle.arenaWave || 0,
      );
      state.arena.bestWave = Math.max(
        state.arena.bestWave,
        battle.arenaWave || 0,
      );
      if (arenaRun.mode === "weekly") {
        state.arena.weekly.bestWave = Math.max(
          state.arena.weekly.bestWave || 0,
          arenaRun.completedWave || 0,
          battle.arenaWave || 0,
        );
        state.arena.weekly.bestScore = Math.max(
          state.arena.weekly.bestScore || 0,
          arenaRun.score || 0,
        );
      }
      persist();
    }
    sound.defeat();
    render();
    return;
  }
  finishResolutionAndAdvance(battle);
  render();
}

function settleHeroLegend() {
  const heroId = story?.legendHeroId;
  const legend = HERO_LEGENDS[heroId];
  if (!legend || !battle) return;
  state.heroLegends ||= { completed: [] };
  if (!Array.isArray(state.heroLegends.completed)) {
    state.heroLegends.completed = [];
  }
  if (!state.heroLegends.completed.includes(legend.id)) {
    state.heroLegends.completed.push(legend.id);
  }
  state.inventory.copper += legend.reward.copper;
  state.inventory[legend.reward.item] =
    (state.inventory[legend.reward.item] || 0) + 1;
  state.stats.battlesWon += 1;
  state.stats.enemiesDefeated += battle.enemies.length;
  state.stats.damageDealt += battle.damageDealt;
  const levelUps = [];
  const rewardedHeroes = new Set([
    heroId,
    ...battle.heroes.map((unit) => unit.refId),
  ]);
  for (const rewardedHeroId of rewardedHeroes) {
    if (!state.roster[rewardedHeroId]) continue;
    const experience = grantExperience(
      state,
      rewardedHeroId,
      legend.reward.xp,
    );
    if (experience.levels > 0) {
      levelUps.push({
        heroId: rewardedHeroId,
        levels: experience.levels,
      });
    }
  }
  lastMasteryUnlocks = recordHeroMastery(battle);
  lastBondUnlocks = discoverHeroBonds(state, battle).bonds;
  lastChainUnlocks = discoverChainFormations(state, battle).formations;
  persist();
  sound.victory();
  battleUi = createBattleUi();
  story.reward = {
    copper: legend.reward.copper,
    xp: legend.reward.xp,
    item: legend.reward.item,
    recruits: [],
    levelUps,
    medals: null,
    legend,
  };
  setScreen("reward");
}

function settleHeroRecruitment() {
  const heroId = story?.heroRecruitmentId;
  const recruitment = HERO_RECRUITMENTS[heroId];
  if (!recruitment || !battle) return;
  const result = applyHeroRecruitmentRewards(state, heroId, battle);
  lastMasteryUnlocks = recordHeroMastery(battle);
  lastBondUnlocks = discoverHeroBonds(state, battle).bonds;
  lastChainUnlocks = discoverChainFormations(state, battle).formations;
  persist();
  sound.victory();
  battleUi = createBattleUi();
  story.reward = {
    ...result,
    medals: null,
    recruitment,
  };
  setScreen("reward");
}

function settleVictory() {
  if (!battle || !activeChapter) return;
  if (battle.mode === "arena") {
    settleArenaWave();
    return;
  }
  if (battle.mode === "legend") {
    settleHeroLegend();
    return;
  }
  if (battle.mode === "recruitment") {
    settleHeroRecruitment();
    return;
  }
  const replay = Boolean(story?.replay);
  const result = applyBattleRewards(state, activeChapter, replay);
  result.medals = evaluateChapterMedals(
    state,
    activeChapter,
    battle,
    replay,
  );
  result.tactic = recordChapterTactic(
    state,
    activeChapter.id,
    state.choices?.[activeChapter.id],
  );
  if (activeChapter.id === CHAPTERS[CHAPTERS.length - 1].id) {
    state.flags.finalBattleWon = true;
  }
  state.stats.enemiesDefeated += battle.enemies.length;
  state.stats.damageDealt += battle.damageDealt;
  lastMasteryUnlocks = recordHeroMastery(battle);
  lastBondUnlocks = discoverHeroBonds(state, battle).bonds;
  lastChainUnlocks = discoverChainFormations(state, battle).formations;
  persist();
  sound.victory();
  battleUi = createBattleUi();
  story.reward = result;
  setScreen("reward");
}

function renderReward() {
  const reward = story?.reward;
  if (!reward) return "";
  const additionalRecruits = (reward.recruits || []).filter(
    (heroId) => heroId !== reward.recruitment?.heroId,
  );
  const recruitCards = additionalRecruits.length
    ? `<div class="recruit-section">
        <p class="eyebrow">新入伙</p>
        <div class="recruit-cards">
          ${additionalRecruits
            .map(
              (heroId) => `
                <article>
                  ${heroPortrait(heroId, "")}
                  <span><small>${HEROES[heroId].star} · ${HEROES[heroId].nickname}</small><b>${HEROES[heroId].name}</b></span>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>`
    : "";
  return `
    <main class="reward-screen" style="--reward-bg:url('${activeChapter.bg}')">
      <div class="reward-background"></div>
      <div class="reward-shade"></div>
      <section class="reward-panel">
        <div class="reward-scroll">
          <div class="victory-seal">${icon("sparkles", 33)}<span>胜</span></div>
          <p class="eyebrow">${activeChapter.label} · 战事已定</p>
          <h1>${activeChapter.title}</h1>
          <p class="reward-lead">${activeChapter.outro?.[0]?.text || "敌阵已破，水泊暂安。"}</p>
          <div class="reward-grid">
            <div class="reward-item">${icon("coins", 23)}<small>铜钱</small><b>+${reward.copper}</b><span>贯</span></div>
            <div class="reward-item">${icon("trending-up", 23)}<small>全队历练</small><b>+${reward.xp}</b><span>经验</span></div>
            <div class="reward-item">${icon("gem", 23)}<small>获得装备</small><b>${reward.item ? EQUIPMENT[reward.item]?.name : "旧战重游"}</b><span>${reward.item ? EQUIPMENT[reward.item]?.rarity : ""}</span></div>
          </div>
          ${renderRecruitmentReward(reward.recruitment)}
          ${recruitCards}
          ${renderChapterMedalRewards(reward.medals)}
          ${renderChapterTacticReward(reward.tactic)}
          ${renderLegendReward(reward.legend)}
          ${renderMasteryUnlocks()}
          ${renderBondUnlocks()}
          ${renderChainUnlocks()}
          ${renderAchievementUnlocks()}
          ${
            reward.levelUps?.length
              ? `<p class="level-up-line">${icon("arrow-up", 16)} ${reward.levelUps.map((entry) => `${HEROES[entry.heroId].name}提升 ${entry.levels} 级`).join(" · ")}</p>`
              : ""
          }
        </div>
        <div class="reward-actions">
          <button class="button primary large" data-action="story-outro">${icon("book-open", 19)}<span>${reward.legend ? "继续列传" : reward.recruitment ? "继续聚义帖" : "继续本章"}</span></button>
        </div>
      </section>
    </main>
  `;
}

function renderLegendReward(legend) {
  if (!legend) return "";
  const hero = HEROES[legend.heroId];
  return `
    <div class="legend-reward-panel">
      <span>${icon("swords", 20)}</span>
      <div>
        <small>群英列传 · ${hero?.name || ""}</small>
        <b>${legend.title}</b>
        <p>${legend.objective}</p>
      </div>
      <em>${icon("badge-check", 15)} 已载入列传</em>
    </div>
  `;
}

function renderRecruitmentReward(recruitment) {
  if (!recruitment) return "";
  const hero = HEROES[recruitment.heroId];
  if (!hero) return "";
  return `
    <section class="recruitment-reward-panel" aria-label="${hero.name}入队">
      <div class="recruitment-reward-art">${heroPortrait(recruitment.heroId, "")}</div>
      <div class="recruitment-reward-copy">
        <p class="eyebrow">${icon("user-round-plus", 14)} 聚义帖 · 新兄弟入伙</p>
        <h2>${hero.name}<small>${hero.star} · ${hero.nickname}</small></h2>
        <p>${recruitment.teaser}</p>
        <span>${icon("badge-check", 15)} 已入聚义簿</span>
      </div>
    </section>
  `;
}

function renderChapterMedalRewards(summary) {
  if (!summary?.newlyEarned?.length) return "";
  const medals = CHAPTER_MEDALS.filter((medal) =>
    summary.newlyEarned.includes(medal.id),
  );
  return `
    <div class="medal-reward-panel">
      <div class="medal-reward-heading">
        <span>${icon(summary.completed ? "crown" : "medal", 18)} ${summary.completed ? "战卷三星齐聚" : "战功载入新评鉴"}</span>
        <b>+${summary.copper} 贯 · +${summary.xp} 历练</b>
      </div>
      <div class="medal-reward-list">
        ${medals
          .map(
            (medal) => `
              <span>
                ${icon(medal.icon, 18)}
                <b>${medal.name}</b>
                <small>${medal.desc}</small>
              </span>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderChapterTacticReward(discovery) {
  if (!discovery?.tactic) return "";
  const tactic = discovery.tactic;
  const archiveCount = Array.isArray(state?.tacticArchive)
    ? state.tacticArchive.length
    : 0;
  return `
    <div class="chapter-tactic-reward tone-${tactic.tone} ${discovery.newlyDiscovered ? "is-new" : ""}">
      <span>${icon(tactic.icon, 21)}</span>
      <div>
        <small>临阵战意 · ${discovery.newlyDiscovered ? "初录" : "已录"}</small>
        <b>${tactic.name}</b>
        <p>${tactic.desc}</p>
      </div>
      <em>
        ${
          discovery.newlyDiscovered
            ? `铜钱 +${discovery.copper}<br>历练 +${discovery.xp}`
            : `${archiveCount}/${totalChapterTactics()} 战意已入谱`
        }
      </em>
    </div>
  `;
}

function renderFinalChoice() {
  const summary = alignmentSummary(state);
  const alignmentToEnding = {
    聚义: "brotherhood",
    招安: "order",
    归隐: "freedom",
  };
  const recommendedEnding = alignmentToEnding[summary];
  const endingAlignment = {
    brotherhood: state.alignment.brotherhood,
    order: state.alignment.order,
    freedom: state.alignment.freedom,
  };
  return `
    <main class="final-choice-screen" style="--final-bg:url('/assets/environments/liangshan_water_fort.png')">
      <div class="final-background"></div>
      <div class="final-shade"></div>
      <section class="final-copy">
        <p class="eyebrow">终回 · 水泊聚义</p>
        <h1>梁山往何处去</h1>
        <p>官军已退，招安文书仍在案上。一路走来的选择，已让众人心中各有答案。此刻的主势是「${summary}」，但最后一步仍由你落笔。</p>
        <div class="final-alignment">
          <span>聚义 ${state.alignment.brotherhood}</span>
          <span>招安 ${state.alignment.order}</span>
          <span>归隐 ${state.alignment.freedom}</span>
        </div>
      </section>
      <section class="ending-choices">
        ${Object.values(ENDINGS)
          .map(
            (ending) => `
              <button data-action="choose-ending" data-ending="${ending.id}" class="${recommendedEnding === ending.id ? "is-recommended" : ""}">
                <span class="ending-symbol">${icon(ending.id === "brotherhood" ? "users" : ending.id === "order" ? "landmark" : "wind", 27)}</span>
                <small>${ending.subtitle} · ${endingAlignment[ending.id]} 点命途</small>
                <h2>${ending.title}</h2>
                <p>${ending.text.slice(0, 78)}…</p>
                <span class="ending-select">落定此卷 ${icon("arrow-right", 17)}</span>
              </button>
            `,
          )
          .join("")}
      </section>
      <footer>三项选择都将完成本篇战役。不同道路会解锁对应的结局收录。</footer>
    </main>
  `;
}

function renderEndingCinematic(cinematic) {
  return `
    <section class="ending-cinematic tone-${cinematic.tone}" data-ending-cinematic="${cinematic.id}" aria-label="${cinematic.title}过场">
      <div class="ending-cinematic-frames">
        ${cinematic.frames
          .map(
            (frame, index) => {
              const portrait = frame.portrait ? HEROES[frame.portrait] : null;
              return `
                <figure class="ending-cinematic-frame" style="--frame:${index}">
                  <img
                    class="ending-cinematic-backdrop"
                    src="${frame.asset}"
                    alt=""
                    style="object-position:${frame.focal};object-fit:${cinematicImageFit("backdrop")}"
                  />
                  ${
                    portrait
                      ? `<img
                          class="ending-cinematic-portrait"
                          src="${portrait.cutout}"
                          alt=""
                          style="object-fit:${cinematicImageFit("portrait")}"
                        />`
                      : ""
                  }
                  <figcaption>
                    <small>${escapeHtml(frame.label)}</small>
                    <b>${escapeHtml(frame.title)}</b>
                    <p>${escapeHtml(frame.text)}</p>
                  </figcaption>
                </figure>
              `;
            },
          )
          .join("")}
      </div>
      <div class="ending-cinematic-seal">
        <small>九回抉择 · 已记 ${cinematic.decisionCount} 笔</small>
        <b>${cinematic.title}</b>
      </div>
      <button class="ending-cinematic-skip" data-action="skip-ending-cinematic">跳过过场 ${icon("chevrons-right", 15)}</button>
    </section>
  `;
}

function renderEnding() {
  const ending = ENDINGS[state.ending] || ENDINGS.brotherhood;
  const cinematic = endingCinematicProfile(ending.id, state);
  const endingIds = new Set([
    ...(state.endingsUnlocked || []),
    ...(state.ending ? [state.ending] : []),
  ]);
  const claimedQuests = Object.values(HERO_QUESTS)
    .flat()
    .filter((quest) => state.heroQuests?.claimed?.includes(quest.id)).length;
  const totalQuests = Object.values(HERO_QUESTS).flat().length;
  const completedLegends = Object.values(HERO_LEGENDS).filter((legend) =>
    state.heroLegends?.completed?.includes(legend.id),
  ).length;
  const totalLegends = Object.keys(HERO_LEGENDS).length;
  return `
    <main class="ending-screen ending-${ending.id} tone-${cinematic.tone}">
      <div class="ending-background" style="background-image:url('${cinematic.background}')"></div>
      <div class="ending-wash"></div>
      <div class="ending-stars">${Array.from({ length: 12 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}</div>
      <section class="ending-letter">
        <p class="eyebrow">星命水浒 · 全篇终</p>
        <span class="ending-title-mark">${icon(ending.id === "brotherhood" ? "users" : ending.id === "order" ? "landmark" : "wind", 24)} ${ending.subtitle}</span>
        <h1>${ending.title}</h1>
        <div class="ending-rule"><i></i><span>终</span><i></i></div>
        <p class="ending-body">${ending.text}</p>
        <p class="ending-epilogue">${ending.epilogue}</p>
        <p class="ending-choice-echo">${cinematic.echo}</p>
        <div class="ending-record">
          <span><small>战斗胜利</small><b>${state.stats.battlesWon}</b></span>
          <span><small>结义好汉</small><b>${state.recruited.length}/${HERO_ORDER.length}</b></span>
          <span><small>战役完成度</small><b>${completionPercent(state)}%</b></span>
        </div>
        <div class="ending-collection-record" aria-label="长线收集进度">
          <span><small>人物异闻</small><b>${claimedQuests}/${totalQuests}</b></span>
          <span><small>群英列传</small><b>${completedLegends}/${totalLegends}</b></span>
          <span><small>兄弟契</small><b>${state.bondArchive?.length || 0}/${Object.keys(HERO_BONDS).length}</b></span>
          <span><small>演武纪录</small><b>第 ${state.arena?.bestWave || 0} 阵</b></span>
          <span><small>梁山功簿</small><b>${state.achievements?.length || 0}/${ACHIEVEMENTS.length}</b></span>
          <span><small>结局收录</small><b>${endingIds.size}/${Object.keys(ENDINGS).length}</b></span>
        </div>
        ${renderRouteGuide({ context: "ending", limit: 3 })}
        <div class="ending-actions">
          <button class="button primary" data-action="continue-after-ending">${icon("book-open", 18)}<span>再览星图</span></button>
          <button class="button ghost" data-action="new-game-plus">${icon("rotate-ccw", 18)}<span>携星图重开</span></button>
          <button class="button ghost" data-action="back-to-title">${icon("home", 18)}<span>返回标题</span></button>
        </div>
      </section>
      ${endingCinematicActive ? renderEndingCinematic(cinematic) : ""}
    </main>
  `;
}

function startNewGame(options = {}) {
  endingCinematicActive = false;
  clearEndingCinematicTimer();
  const previousEndings = options.preserveArchive
    ? [...(state?.endingsUnlocked || []), ...(state?.ending ? [state.ending] : [])]
    : [];
  const previousArena = options.preserveArchive ? state?.arena : null;
  const previousMastery = options.preserveArchive ? state?.heroMastery : null;
  const previousAchievements = options.preserveArchive
    ? [...(state?.achievements || [])]
    : [];
  const previousBonds = options.preserveArchive
    ? [...(state?.bondArchive || [])]
    : [];
  const previousChains = options.preserveArchive
    ? [...(state?.chainArchive || [])]
    : [];
  const previousTactics = options.preserveArchive
    ? [...(state?.tacticArchive || [])]
    : [];
  const previousDoctrines = options.preserveArchive
    ? structuredClone(state?.doctrines || {})
    : null;
  const previousHeroQuests = options.preserveArchive
    ? structuredClone(state?.heroQuests || { claimed: [] })
    : null;
  const previousHeroLegends = options.preserveArchive
    ? structuredClone(state?.heroLegends || { completed: [] })
    : null;
  const previousChapterMedals = options.preserveArchive
    ? structuredClone(state?.chapterMedals || {})
    : null;
  const previousSettings = options.preserveArchive
    ? structuredClone(state?.settings || {})
    : null;
  const nextNewGamePlus = options.preserveArchive
    ? (state?.newGamePlus || 0) + 1
    : 0;
  state = createInitialState({
    difficulty: selectedDifficulty,
    newGamePlus: nextNewGamePlus,
  });
  if (options.preserveArchive) {
    state.endingsUnlocked = [...new Set(previousEndings)];
    if (previousArena) state.arena = { ...previousArena, activeRun: null };
    if (previousMastery) {
      state.heroMastery = structuredClone(previousMastery);
    }
    if (previousChapterMedals) {
      state.chapterMedals = previousChapterMedals;
    }
    state.bondArchive = [...new Set(previousBonds)];
    state.chainArchive = [...new Set(previousChains)];
    state.tacticArchive = [...new Set(previousTactics)];
    if (previousDoctrines) state.doctrines = previousDoctrines;
    if (previousHeroQuests) state.heroQuests = previousHeroQuests;
    if (previousHeroLegends) state.heroLegends = previousHeroLegends;
    state.achievements = [...new Set(previousAchievements)];
    if (previousSettings) {
      state.settings = { ...state.settings, ...previousSettings };
    }
  }
  focusedChapterId = CHAPTERS[0].id;
  selectedFormationRow = 0;
  selectedEquipmentHero = "linchong";
  selectedCodexHero = "linchong";
  selectedQuestHero = "linchong";
  clearArenaTransientState();
  persist();
  sound.confirm();
  modal = null;
  setScreen("map");
  window.setTimeout(
    () =>
      toast(
        options.preserveArchive
          ? "战功、命途、异闻、演武与设置已保留，新卷再启"
          : "新卷已开：先查看营寨，再踏出黄河渡口。",
        "success",
      ),
    120,
  );
}

function continueGame() {
  endingCinematicActive = false;
  clearEndingCinematicTimer();
  const loaded = loadGame();
  if (!loaded) {
    toast("未找到可用存档", "danger");
    return;
  }
  state = loaded;
  restoreArenaRunFromState();
  focusedChapterId = currentChapter(state)?.id || CHAPTERS[CHAPTERS.length - 1].id;
  selectedEquipmentHero = state.recruited[0];
  selectedCodexHero = state.recruited[0];
  selectedQuestHero = state.recruited[0];
  unlockSteamAchievements(state.achievements || []);
  syncSteamStats();
  queueSteamCloudSave(150);
  sound.confirm();
  if (state.ending) {
    setScreen("ending");
  } else if (state.flags.finalBattleWon && state.currentChapter >= CHAPTERS.length) {
    setScreen("final-choice");
  } else {
    setScreen("map");
  }
}

function enterChapter() {
  const chapter = chapterById(focusedChapterId);
  const status = chapterStatus(state, chapter);
  if (status === "locked") {
    toast("此回尚未解锁", "danger");
    return;
  }
  activeChapter = chapter;
  story = {
    stage: "intro",
    line: 0,
    choiceIndex: null,
    replay: state.completedChapters.includes(chapter.id),
    reward: null,
  };
  sound.confirm();
  setScreen("story");
}

function createLegendChapter(heroId) {
  const legend = HERO_LEGENDS[heroId];
  const levels = activeHeroes(state).map(({ entry }) => entry.level);
  const averageLevel =
    levels.reduce((sum, level) => sum + level, 0) / Math.max(1, levels.length);
  const enemyLevel = Math.max(
    legend.minLevel,
    Math.round(averageLevel + legend.levelOffset),
  );
  return {
    id: `legend-${legend.id}`,
    index: -1,
    label: "群英列传",
    title: legend.title,
    location: legend.location,
    bg: legend.bg,
    summary: legend.objective,
    objective: legend.objective,
    parRounds: 10,
    intro: legend.intro,
    outro: legend.outro,
    battle: {
      enemies: legend.enemies.map((enemy) => ({
        ...enemy,
        level: enemyLevel,
      })),
      reward: legend.reward,
    },
    legendHeroId: heroId,
    legend,
  };
}

function createRecruitmentChapter(heroId) {
  const recruitment = HERO_RECRUITMENTS[heroId];
  const levels = activeHeroes(state).map(({ entry }) => entry.level);
  const averageLevel =
    levels.reduce((sum, level) => sum + level, 0) / Math.max(1, levels.length);
  const enemyLevel = Math.max(
    recruitment.requiredChapter + 2,
    Math.round(averageLevel + 1),
  );
  return {
    id: `recruitment-${heroId}`,
    index: -1,
    label: "聚义帖",
    title: recruitment.title,
    location: recruitment.location,
    bg: recruitment.bg,
    summary: recruitment.teaser,
    objective: recruitment.teaser,
    parRounds: 10,
    choice: recruitment.choice,
    intro: recruitment.intro,
    outro: recruitment.outro,
    battle: {
      enemies: recruitment.enemies.map((enemy) => ({
        ...enemy,
        level: enemyLevel,
      })),
      reward: recruitment.reward,
    },
    recruitment,
  };
}

function ensureLegendHeroDeployed(heroId) {
  if (state.team.includes(heroId)) return;
  const emptySlot = state.team.findIndex((entry) => !entry);
  const slot = emptySlot >= 0 ? emptySlot : state.team.length - 1;
  setTeamSlot(state, slot, heroId);
}

function startHeroLegend(heroId) {
  const legend = HERO_LEGENDS[heroId];
  if (!legend) return;
  if (!state.recruited.includes(heroId)) {
    toast("尚未与这位好汉结义", "danger");
    return;
  }
  if (state.currentChapter < legend.requiredChapter) {
    toast(`第 ${legend.requiredChapter} 回后开放此列传`, "danger");
    return;
  }
  if (!heroLegendUnlocked(state, heroId)) {
    toast("先完成并领取三段江湖异闻", "danger");
    return;
  }
  if (heroLegendCompleted(state, heroId)) {
    toast("此篇群英列传已经完成", "success");
    return;
  }
  ensureLegendHeroDeployed(heroId);
  persist();
  activeChapter = createLegendChapter(heroId);
  story = {
    stage: "intro",
    line: 0,
    choiceIndex: null,
    replay: false,
    reward: null,
    legendHeroId: heroId,
  };
  sound.confirm();
  setScreen("story");
}

function startHeroRecruitment(heroId) {
  const recruitment = HERO_RECRUITMENTS[heroId];
  if (!recruitment) return;
  if (heroRecruitmentCompleted(state, heroId)) {
    toast("此帖已经完成，兄弟已在聚义簿中", "success");
    return;
  }
  if (state.currentChapter < recruitment.requiredChapter) {
    toast(`第 ${recruitment.requiredChapter} 回后开放此帖`, "danger");
    return;
  }
  if (
    recruitment.prerequisite &&
    !heroRecruitmentCompleted(state, recruitment.prerequisite)
  ) {
    toast(
      `需先完成${HEROES[recruitment.prerequisite].name}的聚义帖`,
      "danger",
    );
    return;
  }
  const recommendation = recommendTeam(state);
  const currentTeam = state.team.filter(Boolean);
  const suggestedTeam = recommendation.team.filter(Boolean);
  const usesRecommendedTeam =
    currentTeam.length === suggestedTeam.length &&
    currentTeam.every((heroId) => suggestedTeam.includes(heroId)) &&
    currentTeam.every(
      (heroId, index) => heroId === suggestedTeam[index],
    );
  if (!usesRecommendedTeam) {
    pendingRecruitment = { heroId, recommendedTeam: recommendation.team };
    const recommendedNames = recommendation.team
      .filter(Boolean)
      .map((heroId) => HEROES[heroId].name)
      .join("、");
    openModal({
      title: "军师荐阵",
      body: `<p>军师根据攻防、阵位、路数与羁绊，建议以「${recommendedNames}」迎战。可直接出征，也可保留当前三阵。</p>`,
      actions: [
        {
          label: "军师荐阵",
          action: "recommend-recruitment-team",
          tone: "primary",
          icon: "wand-sparkles",
        },
        {
          label: "以当前三阵出征",
          action: "recruitment-battle",
          tone: "ghost",
          icon: "swords",
        },
      ],
    });
    return;
  }
  pendingRecruitment = null;
  persist();
  activeChapter = createRecruitmentChapter(heroId);
  story = {
    stage: "intro",
    line: 0,
    choiceIndex: null,
    replay: false,
    reward: null,
    heroRecruitmentId: heroId,
  };
  sound.confirm();
  setScreen("story");
}

function continuePendingRecruitment() {
  const heroId = pendingRecruitment?.heroId;
  pendingRecruitment = null;
  if (!state || !heroId) return;
  startHeroRecruitment(heroId);
}

function storyNext() {
  if (screen !== "story" || !story || !activeChapter) return;
  if (story.stage === "intro" || story.stage === "outro") {
    const lines = story.stage === "intro" ? activeChapter.intro : activeChapter.outro;
    sound.click();
    if (story.line < lines.length - 1) {
      story.line += 1;
      render();
      return;
    }
    if (story.stage === "intro") {
      story.stage = story.legendHeroId
        ? "legend-ready"
        : "choice";
      render();
      return;
    }
    if (story.legendHeroId) {
      finishHeroLegend();
      return;
    }
    if (story.heroRecruitmentId) {
      finishHeroRecruitment();
      return;
    }
    finishChapter();
  }
}

function finishHeroLegend() {
  const heroId = story?.legendHeroId;
  battle = null;
  battleUi = createBattleUi();
  activeChapter = null;
  story = null;
  selectedQuestHero = heroId || selectedQuestHero;
  persist();
  setScreen("quests");
}

function finishHeroRecruitment() {
  const heroId = story?.heroRecruitmentId;
  battle = null;
  battleUi = createBattleUi();
  activeChapter = null;
  story = null;
  if (heroId) selectedQuestHero = heroId;
  persist();
  setScreen("quests");
}

function chooseStoryOption(index) {
  if (screen !== "story" || !story || story.stage !== "choice") return;
  const option = activeChapter.choice.options[index];
  if (!option) return;
  story.choiceIndex = index;
  story.stage = "choice-response";
  recordChoice(state, activeChapter.id, index, option.effect);
  persist();
  sound.confirm();
  render();
}

function startChapterBattle() {
  if (!activeChapter || screen === "battle") return;
  const priorStage = story?.stage;
  story.stage = "battle";
  launchStoryBattle();
  if (story) story.stage = priorStage;
}

function launchStoryBattle() {
  if (!activeChapter) return;
  if (screen === "battle") return;
  lastMasteryUnlocks = [];
  lastAchievementUnlocks = [];
  lastBondUnlocks = [];
  lastChainUnlocks = [];
  const legend = story?.legendHeroId
    ? HERO_LEGENDS[story.legendHeroId]
    : null;
  const recruitment = story?.heroRecruitmentId
    ? HERO_RECRUITMENTS[story.heroRecruitmentId]
    : null;
  const chapterTactic =
    !legend && !recruitment
      ? getChapterTactic(
          activeChapter.id,
          state.choices?.[activeChapter.id] ?? story?.choiceIndex,
        )
      : null;
  battle = createBattle(state, activeChapter, {
    replay: Boolean(story?.replay),
    mode: legend ? "legend" : recruitment ? "recruitment" : "campaign",
    legendHeroId: story?.legendHeroId || null,
    recruitmentHeroId: story?.heroRecruitmentId || null,
    legendRule: legend?.rule || null,
    specialRule: recruitment?.rule || chapterTactic,
    specialRuleLabel: chapterTactic ? "临阵战意" : undefined,
    enemyScale:
      battleEnemyScale(state) *
      (legend?.enemyScale || recruitment?.enemyScale || 1),
    enemyModifiers:
      legend?.enemyModifiers || recruitment?.enemyModifiers || {},
  });
  setBattleFacilityContext(battle, state);
  battleUi = createBattleUi();
  sound.playCombatCue("battle-start");
  lastBattleScreenOpenedAt = performance.now();
  setScreen("battle");
}

function randomArenaBoons(count) {
  const counts = arenaBoonCounts();
  return Object.values(ARENA_BOONS)
    .map((boon) => {
      const depth = counts[boon.id] || 0;
      const weight = depth === 1 || depth === 2 ? 1.35 : depth >= 3 ? 0.65 : 1;
      return {
        boon,
        order: Math.pow(Math.random(), 1 / weight),
      };
    })
    .sort((a, b) => b.order - a.order)
    .slice(0, count)
    .map(({ boon }) => boon);
}

function randomArenaEventOffer(count = 3) {
  return Object.keys(ARENA_EVENTS)
    .map((eventId) => ({ eventId, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count)
    .map(({ eventId }) => eventId);
}

function arenaRewardOffer(revision = 0) {
  if (!arenaRun) return [];
  if (arenaRun.mode === "weekly") {
    const weekConfig = getArenaWeekConfig(
      arenaRun.weekKey || state.arena.weekly.weekKey,
    );
    return getArenaWeekBoonOffer(
      weekConfig,
      arenaRun.wave,
      3,
      revision,
    );
  }
  return randomArenaBoons(3);
}

function sameArenaOffer(left, right) {
  const leftIds = left.map((boon) => boon.id).sort();
  const rightIds = right.map((boon) => boon.id).sort();
  return (
    leftIds.length === rightIds.length &&
    leftIds.every((boonId, index) => boonId === rightIds[index])
  );
}

function arenaBoonCounts(boons = arenaRun?.boons || []) {
  return boons.reduce((counts, boonId) => {
    if (!ARENA_BOONS[boonId]) return counts;
    counts[boonId] = (counts[boonId] || 0) + 1;
    return counts;
  }, {});
}

function arenaBuildSnapshot(boons = arenaRun?.boons || []) {
  const counts = arenaBoonCounts(boons);
  return {
    counts,
    masteries: Object.entries(counts)
      .filter(([boonId, count]) => count >= 3 && ARENA_BOON_MASTERIES[boonId])
      .map(([boonId, count]) => ({
        boonId,
        count,
        mastery: ARENA_BOON_MASTERIES[boonId],
      })),
    synergies: Object.values(ARENA_SYNERGIES).filter((synergy) =>
      synergy.requires.every(
        ([boonId, required]) => (counts[boonId] || 0) >= required,
      ),
    ),
  };
}

function recordArenaDiscoveries(
  boons = arenaRun?.boons || [],
  encounterId = arenaRun?.encounterId || "",
) {
  const build = arenaBuildSnapshot(boons);
  if (!state.arena.discoveries) {
    state.arena.discoveries = {
      masteries: [],
      synergies: [],
      encounters: [],
    };
  }
  state.arena.discoveries.encounters ||= [];
  const newMasteries = build.masteries
    .map(({ boonId }) => boonId)
    .filter(
      (boonId) => !state.arena.discoveries.masteries.includes(boonId),
    );
  const newSynergies = build.synergies
    .map((synergy) => synergy.id)
    .filter(
      (synergyId) =>
        !state.arena.discoveries.synergies.includes(synergyId),
    );
  const newEncounter =
    ARENA_ENCOUNTERS[encounterId] &&
    !state.arena.discoveries.encounters.includes(encounterId)
      ? [encounterId]
      : [];
  state.arena.discoveries.masteries.push(...newMasteries);
  state.arena.discoveries.synergies.push(...newSynergies);
  state.arena.discoveries.encounters.push(...newEncounter);
  return {
    masteries: newMasteries,
    synergies: newSynergies,
    encounters: newEncounter,
  };
}

function updateArenaWeeklyRecord(run = arenaRun) {
  if (!run || run.mode !== "weekly" || !state.arena.weekly) return;
  state.arena.weekly.bestScore = Math.max(
    state.arena.weekly.bestScore || 0,
    run.score || 0,
  );
  state.arena.weekly.bestWave = Math.max(
    state.arena.weekly.bestWave || 0,
    run.completedWave || 0,
  );
}

function claimArenaWeekMarks() {
  if (!arenaRun || arenaRun.mode !== "weekly") return [];
  updateArenaWeeklyRecord();
  const weekly = state.arena.weekly;
  const unlocked = ARENA_WEEK_MARKS.filter(
    (mark) =>
      weekly.bestScore >= mark.score && !weekly.marks.includes(mark.id),
  );
  for (const mark of unlocked) {
    weekly.marks.push(mark.id);
    state.inventory.copper += mark.reward.copper;
    for (const unit of battle?.heroes || activeHeroes(state)) {
      grantExperience(state, unit.refId || unit.heroId, mark.reward.xp);
    }
  }
  return unlocked;
}

function addArenaEffects(totals, effects = {}) {
  for (const [key, value] of Object.entries(effects)) {
    if (key === "openingGuard") {
      totals[key] = Math.max(totals[key] || 0, value);
    } else {
      totals[key] = (totals[key] || 0) + value;
    }
  }
}

function arenaModifiers(itemIds) {
  const totals = {};
  for (const itemId of itemIds) {
    const relic = ARENA_RELICS[itemId];
    if (relic) addArenaEffects(totals, relic.effects);
  }
  const boonIds = itemIds.filter((itemId) => ARENA_BOONS[itemId]);
  const build = arenaBuildSnapshot(boonIds);
  for (const [boonId, count] of Object.entries(build.counts)) {
    for (let index = 0; index < count; index += 1) {
      addArenaEffects(totals, ARENA_BOONS[boonId].effects);
    }
  }
  for (const { mastery } of build.masteries) {
    addArenaEffects(totals, mastery.effects);
  }
  for (const synergy of build.synergies) {
    addArenaEffects(totals, synergy.effects);
  }
  return totals;
}

function recordHeroMastery(battleResult) {
  if (!battleResult || !state.heroMastery) return [];
  const unlocked = [];
  for (const unit of battleResult.heroes) {
    const mastery = state.heroMastery[unit.refId];
    if (!mastery) continue;
    const metrics = battleResult.heroMetrics?.[unit.refId] || {};
    mastery.wins += 1;
    mastery.kills += metrics.kills || 0;
    mastery.damage += metrics.damage || 0;
    mastery.ultimates += metrics.ultimates || 0;
    for (const trial of HERO_TRIALS) {
      if (
        mastery.trials.includes(trial.id) ||
        (mastery[trial.metric] || 0) < trial.target
      ) {
        continue;
      }
      mastery.trials.push(trial.id);
      state.inventory.copper += trial.reward.copper;
      grantExperience(state, unit.refId, trial.reward.xp);
      unlocked.push({ heroId: unit.refId, heroName: unit.name, trial });
    }
  }
  return unlocked;
}

function arenaRelicIds() {
  return state?.arena?.relics || [];
}

function clearArenaTransientState() {
  arenaRun = null;
  arenaMode = "endless";
  arenaDraftSeed = null;
  arenaRewardChoices = [];
  arenaDraftBoons = [];
  selectedArenaBoon = null;
  arenaTrialSelection = [];
}

function restoreArenaRunFromState() {
  clearArenaTransientState();
  const savedRun = state?.arena?.activeRun;
  if (
    savedRun &&
    Array.isArray(savedRun.boons) &&
    savedRun.boons.length > 0
  ) {
    arenaRun = savedRun;
    arenaMode = savedRun.mode || "endless";
    arenaTrialSelection = sanitizeArenaTrialIds(savedRun.trialIds);
    arenaRewardChoices = Array.isArray(savedRun.pendingBoons)
      ? savedRun.pendingBoons
          .map((boonId) => ARENA_BOONS[boonId])
          .filter(Boolean)
      : [];
  }
}

function resumeArenaSession() {
  if (!arenaRun) return;
  if (arenaRun.pendingBoons?.length) {
    arenaRewardChoices = arenaRun.pendingBoons
      .map((boonId) => ARENA_BOONS[boonId])
      .filter(Boolean);
    selectedArenaBoon = null;
    setScreen("arena-reward");
    return;
  }
  launchArenaWave();
}

function nextArenaMilestone() {
  return ARENA_MILESTONES.find(
    (milestone) => !arenaRelicIds().includes(milestone.relicId),
  );
}

function unlockArenaRelics() {
  if (!state.arena) return [];
  if (!Array.isArray(state.arena.relics)) state.arena.relics = [];
  const unlocked = ARENA_MILESTONES.filter(
    (milestone) =>
      state.arena.bestWave >= milestone.wave &&
      !state.arena.relics.includes(milestone.relicId),
  ).map((milestone) => ({
    ...milestone,
    relic: ARENA_RELICS[milestone.relicId],
  }));
  for (const entry of unlocked) {
    if (entry.relic) state.arena.relics.push(entry.relicId);
  }
  return unlocked;
}

function createArenaChapter(wave) {
  const levels = activeHeroes(state).map(({ entry }) => entry.level);
  const averageLevel =
    levels.reduce((sum, level) => sum + level, 0) / Math.max(1, levels.length);
  const patterns = [
    [
      { id: "runner", row: 0 },
      { id: "archer", row: 2 },
    ],
    [
      { id: "instructor", row: 0 },
      { id: "runner", row: 1 },
      { id: "archer", row: 2 },
    ],
    [
      { id: "instructor", row: 0 },
      { id: "archer", row: 2 },
    ],
    [
      { id: "runner", row: 0 },
      { id: "runner", row: 1 },
      { id: "archer", row: 2 },
    ],
    [
      { id: "runner", row: 0 },
      { id: "archer", row: 2 },
      { id: "archer", row: 2 },
    ],
    [
      { id: "instructor", row: 0 },
      { id: "runner", row: 1 },
      { id: "runner", row: 2 },
    ],
    [
      { id: "runner", row: 0 },
      { id: "instructor", row: 1 },
      { id: "archer", row: 2 },
    ],
    [
      { id: "runner", row: 0 },
      { id: "instructor", row: 1 },
      { id: "runner", row: 2 },
    ],
  ];
  const bossWave = wave % 5 === 0;
  const bossId = wave % 10 === 0 ? "executioner" : "captain";
  const pattern = bossWave
    ? bossId === "executioner"
      ? [
          { id: "executioner", row: 0 },
          { id: "captain", row: 1 },
          { id: "archer", row: 2 },
        ]
      : [
          { id: "captain", row: 0 },
          { id: "runner", row: 1 },
          { id: "archer", row: 2 },
        ]
    : patterns[(wave - 1) % patterns.length];
  const level = Math.max(1, Math.round(averageLevel + Math.ceil(wave / 2)));
  const backdrops = [
    "/assets/environments/liangshan_water_fort.png",
    "/assets/environments/boar_forest.png",
    "/assets/environments/yellow_river_ferry.png",
    "/assets/environments/bianjing_snow_night.png",
  ];
  return {
    id: `arena-${wave}`,
    index: wave - 1,
    label: `演武第 ${wave} 阵`,
    title: bossWave
      ? `${ENEMIES[bossId].name}坐镇`
      : "梁山围剿",
    location: "演武场",
    bg: bossWave && bossId === "executioner"
      ? "/assets/environments/jiangzhou_execution.png"
      : bossWave
        ? "/assets/environments/liangshan_water_fort.png"
        : backdrops[(wave - 1) % backdrops.length],
    battle: {
      enemies: pattern.map((enemy) => ({ ...enemy, level })),
      reward: { copper: 0, xp: 0, item: null, recruit: [] },
    },
  };
}

function startArenaRun(boonId, trialIds = arenaTrialSelection) {
  const weekConfig = getArenaWeekConfig(state.arena.weekly.weekKey);
  const weeklyPool =
    arenaMode === "weekly"
      ? weekConfig.boonPool.map((id) => ARENA_BOONS[id]).filter(Boolean)
      : [];
  const initialBoon =
    (arenaMode === "weekly"
      ? weeklyPool.find((boon) => boon.id === boonId)
      : ARENA_BOONS[boonId]) ||
    (arenaMode === "weekly" ? weeklyPool[0] : arenaDraftBoons[0]);
  if (!initialBoon) return;
  const selectedTrialIds = sanitizeArenaTrialIds(trialIds, {
    bestWave: state.arena.bestWave || 0,
    limit: ARENA_TRIAL_LIMIT,
  });
  arenaRun = {
    mode: arenaMode,
    weekKey: arenaMode === "weekly" ? weekConfig.key : null,
    seed:
      arenaMode === "weekly"
        ? weekConfig.seed
        : arenaDraftSeed ??
          (((Date.now() >>> 0) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0),
    wave: 1,
    encounterId: null,
    boons: [initialBoon.id],
    pendingBoons: [],
    rerollUsed: false,
    eventOffer: [],
    selectedEvent: null,
    lastEvent: null,
    healthRatios: {},
    completedWave: 0,
    lastReward: null,
    score: 0,
    bountiesCleared: 0,
    currentBounty: null,
    lastBounty: null,
    defeated: false,
    lastUnlocks: [],
    lastDiscoveries: { masteries: [], synergies: [], encounters: [] },
    lastWeeklyMarks: [],
    lastPerformance: null,
    trialIds: selectedTrialIds,
  };
  state.arena.activeRun = arenaRun;
  if (selectedTrialIds.length) {
    state.arena.starTrials.runs += 1;
    state.arena.starTrials.maxSelected = Math.max(
      state.arena.starTrials.maxSelected || 0,
      selectedTrialIds.length,
    );
  }
  if (arenaMode === "weekly") state.arena.weekly.runs += 1;
  else state.arena.totalRuns += 1;
  selectedArenaBoon = null;
  arenaDraftBoons = [];
  arenaTrialSelection = [...selectedTrialIds];
  persist();
  launchArenaWave();
}

function launchArenaWave() {
  if (!arenaRun) return;
  lastMasteryUnlocks = [];
  lastAchievementUnlocks = [];
  lastBondUnlocks = [];
  lastChainUnlocks = [];
  const weekConfig =
    arenaRun.mode === "weekly"
      ? getArenaWeekConfig(arenaRun.weekKey || state.arena.weekly.weekKey)
      : null;
  if (arenaRun.mode === "weekly") {
    const weekSync = syncArenaWeek(state);
    if (weekSync.changed || weekConfig.key !== state.arena.weekly.weekKey) {
      arenaRun = null;
      state.arena.activeRun = null;
      clearArenaTransientState();
      prepareArenaDraft(true);
      persist();
      toast("本周军令已经换榜，请从新周令重新出阵", "success");
      setScreen("arena");
      return;
    }
  }
  if (!ARENA_BOUNTIES.some((bounty) => bounty.id === arenaRun.currentBounty)) {
    const previousBounty = arenaRun.lastBounty?.id || "";
    const bounty =
      arenaRun.mode === "weekly"
        ? getArenaWeekBounty(weekConfig, arenaRun.wave, previousBounty)
        : (() => {
            const bountyPool = ARENA_BOUNTIES.filter(
              (entry) => entry.id !== previousBounty,
            );
            return (
              bountyPool[
                Math.floor(Math.random() * Math.max(1, bountyPool.length))
              ] || ARENA_BOUNTIES[0]
            );
          })();
    arenaRun.currentBounty = bounty.id;
  }
  const encounter = resolveArenaEncounter(
    arenaRun,
    arenaRun.wave,
    arenaRun.encounterId,
  );
  if (encounter) arenaRun.encounterId = encounter.id;
  activeChapter = createArenaChapter(arenaRun.wave);
  const enemyScale =
    battleEnemyScale(state) *
    (1 +
      Math.max(0, arenaRun.wave - 1) * 0.085 +
      (arenaRun.wave % 5 === 0 ? 0.16 : 0));
  const modifiers = arenaModifiers([
    ...arenaRelicIds(),
    ...arenaRun.boons,
  ]);
  const trialEffects = arenaTrialEffects(arenaRun.trialIds);
  addArenaEffects(modifiers, trialEffects.heroModifiers);
  if (weekConfig) addArenaEffects(modifiers, weekConfig.rule.heroMods);
  const enemyModifiers = {};
  addArenaEffects(enemyModifiers, trialEffects.enemyModifiers);
  if (weekConfig) addArenaEffects(enemyModifiers, weekConfig.rule.enemyMods);
  if (encounter) addArenaEffects(enemyModifiers, encounter.enemyModifiers);
  battle = createBattle(state, activeChapter, {
    mode: "arena",
    arenaWave: arenaRun.wave,
    modifiers,
    enemyModifiers,
    specialRule: encounter,
    specialRuleLabel: "演武军势",
    healthRatios: arenaRun.healthRatios,
    enemyScale,
  });
  setBattleFacilityContext(battle, state);
  battleUi = createBattleUi();
  state.arena.lastWave = Math.max(state.arena.lastWave, arenaRun.wave);
  state.arena.bestWave = Math.max(state.arena.bestWave, arenaRun.wave);
  persist();
  sound.playCombatCue("battle-start");
  setScreen("battle");
}

function settleArenaWave() {
  if (!battle || !arenaRun) return;
  const wave = arenaRun.wave;
  const modifiers = arenaModifiers([
    ...arenaRelicIds(),
    ...arenaRun.boons,
  ]);
  const trialEffects = arenaTrialEffects(arenaRun.trialIds);
  addArenaEffects(modifiers, trialEffects.heroModifiers);
  const weekConfig =
    arenaRun.mode === "weekly"
      ? getArenaWeekConfig(arenaRun.weekKey || state.arena.weekly.weekKey)
      : null;
  const encounter = ARENA_ENCOUNTERS[arenaRun.encounterId];
  if (weekConfig) {
    addArenaEffects(modifiers, weekConfig.rule.heroMods);
    modifiers.scorePct =
      (modifiers.scorePct || 0) + weekConfig.rule.scorePct;
  }
  if (encounter) {
    modifiers.scorePct =
      (modifiers.scorePct || 0) + encounter.scorePct;
  }
  modifiers.scorePct =
    (modifiers.scorePct || 0) + trialEffects.scorePct;
  const bounty = ARENA_BOUNTIES.find(
    (entry) => entry.id === arenaRun.currentBounty,
  );
  const bountyCleared = Boolean(bounty?.check(battle));
  const bountyCopper = bountyCleared ? bounty.copper : 0;
  const copper = Math.round(
    (24 + wave * 9 + (wave % 5 === 0 ? 40 : 0) + bountyCopper) *
      (1 + trialEffects.copperPct),
  );
  const xp = Math.round(
    (18 + wave * 7 + (wave % 5 === 0 ? 26 : 0)) *
      (1 + trialEffects.xpPct),
  );
  const survivors = battle.heroes.filter((unit) => unit.hp > 0).length;
  const speedTarget = wave % 5 === 0 ? 9 : 6;
  const baseScore =
    90 +
    wave * 42 +
    (wave % 5 === 0 ? 150 : 0) +
    survivors * 35 +
    Math.min(3, battle.chainAttacks) * 35 +
    (battle.round <= speedTarget ? 80 : 0);
  const performance = evaluateArenaPerformance(battle, wave, bountyCleared);
  const score = Math.round(
    (baseScore + (bountyCleared ? bounty.score : 0)) *
      (1 + (modifiers.scorePct || 0)),
  ) + performance.bonusScore;
  state.inventory.copper += copper;
  for (const unit of battle.heroes) {
    grantExperience(state, unit.refId, xp);
  }
  const recovery = 0.2 + (modifiers.waveHealPct || 0);
  arenaRun.healthRatios = Object.fromEntries(
    battle.heroes.map((unit) => {
      const ratio = unit.hp / unit.maxHp;
      return [
        unit.refId,
        ratio > 0 ? Math.min(1, ratio + recovery) : 0,
      ];
    }),
  );
  state.stats.battlesWon += 1;
  state.stats.enemiesDefeated += battle.enemies.length;
  state.stats.damageDealt += battle.damageDealt;
  lastMasteryUnlocks = recordHeroMastery(battle);
  lastBondUnlocks = discoverHeroBonds(state, battle).bonds;
  lastChainUnlocks = discoverChainFormations(state, battle).formations;
  state.arena.lastWave = wave;
  state.arena.bestWave = Math.max(state.arena.bestWave, wave);
  state.arena.totalWavesCleared += 1;
  arenaRun.score += score;
  state.arena.lastScore = arenaRun.score;
  state.arena.bestScore = Math.max(state.arena.bestScore, arenaRun.score);
  if (arenaRun.trialIds?.length) {
    state.arena.starTrials.bestScore = Math.max(
      state.arena.starTrials.bestScore || 0,
      arenaRun.score,
    );
    state.arena.starTrials.bestWave = Math.max(
      state.arena.starTrials.bestWave || 0,
      wave,
    );
  }
  if (bountyCleared) {
    arenaRun.bountiesCleared += 1;
    state.arena.totalBounties += 1;
  }
  arenaRun.completedWave = wave;
  arenaRun.wave = wave + 1;
  arenaRun.lastReward = { copper, xp, score };
  arenaRun.lastPerformance = performance;
  arenaRun.lastBounty = bounty
    ? {
        id: bounty.id,
        cleared: bountyCleared,
        copper: bountyCopper,
        score: bountyCleared ? bounty.score : 0,
      }
    : null;
  arenaRun.currentBounty = null;
  arenaRun.lastEvent = null;
  arenaRun.lastUnlocks = unlockArenaRelics();
  arenaRun.lastDiscoveries = recordArenaDiscoveries(
    arenaRun.boons,
    arenaRun.encounterId,
  );
  updateArenaWeeklyRecord();
  arenaRewardChoices =
    arenaRun.mode === "weekly"
      ? getArenaWeekBoonOffer(weekConfig, arenaRun.wave, 3)
      : randomArenaBoons(3);
  arenaRun.pendingBoons = arenaRewardChoices.map((boon) => boon.id);
  arenaRun.eventOffer =
    arenaRun.completedWave % 3 === 0
      ? arenaRun.mode === "weekly"
        ? getArenaWeekEventOffer(weekConfig, arenaRun.wave, 3)
        : randomArenaEventOffer(3)
      : [];
  arenaRun.selectedEvent = null;
  arenaRun.lastWeeklyMarks = claimArenaWeekMarks().map((mark) => mark.id);
  selectedArenaBoon = null;
  persist();
  sound.victory();
  battle = null;
  battleUi = createBattleUi();
  setScreen("arena-reward");
}

function concludeArenaRun() {
  if (arenaRun) {
    state.arena.lastWave = Math.max(
      state.arena.lastWave,
      arenaRun.completedWave || 0,
      arenaRun.wave || 0,
    );
    state.arena.bestWave = Math.max(
      state.arena.bestWave,
      state.arena.lastWave,
    );
    state.arena.lastScore = arenaRun.score || 0;
    state.arena.bestScore = Math.max(
      state.arena.bestScore,
      arenaRun.score || 0,
    );
    updateArenaWeeklyRecord(arenaRun);
    arenaRun.pendingBoons = [];
    state.arena.activeRun = null;
    persist();
  }
  clearArenaTransientState();
  battle = null;
  battleUi = createBattleUi();
  prepareArenaDraft(true);
  setScreen("arena");
}

function arenaTeamHealth() {
  return Object.fromEntries(
    activeHeroes(state).map(({ heroId }) => [
      heroId,
      Math.max(
        0,
        Math.min(1, Number(arenaRun?.healthRatios?.[heroId] ?? 1) || 0),
      ),
    ]),
  );
}

function arenaEventAvailability(eventId) {
  if (eventId !== "reinforce") return true;
  const health = arenaTeamHealth();
  const hasFallen = Object.values(health).some((ratio) => ratio <= 0);
  return !hasFallen || state.inventory.copper >= 70;
}

function toggleArenaTrial(trialId) {
  if (arenaRun || !ARENA_TRIALS[trialId]) return;
  const unlocked = availableArenaTrials(state.arena.bestWave || 0).some(
    (trial) => trial.id === trialId,
  );
  if (!unlocked) {
    toast(`最高突破至第 ${ARENA_TRIALS[trialId].unlockWave} 阵后解锁`, "danger");
    return;
  }
  if (arenaTrialSelection.includes(trialId)) {
    arenaTrialSelection = arenaTrialSelection.filter(
      (selectedId) => selectedId !== trialId,
    );
  } else if (arenaTrialSelection.length < ARENA_TRIAL_LIMIT) {
    arenaTrialSelection = [...arenaTrialSelection, trialId];
  } else {
    toast(`至多同时启用 ${ARENA_TRIAL_LIMIT} 道星劫`, "danger");
    return;
  }
  sound.click();
  render();
}

function shiftArenaTeamHealth(amount) {
  if (!arenaRun) return;
  const health = arenaTeamHealth();
  arenaRun.healthRatios = Object.fromEntries(
    Object.entries(health).map(([heroId, ratio]) => {
      if (ratio <= 0) return [heroId, 0];
      if (amount >= 0) {
        return [heroId, Math.min(1, ratio + amount)];
      }
      return [heroId, Math.max(0.08, ratio + amount)];
    }),
  );
}

function applyArenaEvent(eventId) {
  if (!arenaRun || !ARENA_EVENTS[eventId] || !arenaEventAvailability(eventId)) {
    return false;
  }
  const event = ARENA_EVENTS[eventId];
  if (eventId === "feast") {
    shiftArenaTeamHealth(0.32);
    state.inventory.copper += 45;
  } else if (eventId === "raid") {
    const merit = 180 + arenaRun.completedWave * 30;
    arenaRun.score += merit;
    state.inventory.copper += 80;
    shiftArenaTeamHealth(-0.12);
    state.arena.lastScore = arenaRun.score;
    state.arena.bestScore = Math.max(state.arena.bestScore, arenaRun.score);
    updateArenaWeeklyRecord(arenaRun);
    const gainedMarks = claimArenaWeekMarks().map((mark) => mark.id);
    arenaRun.lastWeeklyMarks = [
      ...new Set([...(arenaRun.lastWeeklyMarks || []), ...gainedMarks]),
    ];
  } else if (eventId === "drill") {
    const counts = arenaBoonCounts();
    const copiedBoonId = Object.keys(counts).sort(
      (a, b) =>
        counts[a] - counts[b] ||
        ARENA_BOONS[a].name.localeCompare(ARENA_BOONS[b].name),
    )[0];
    if (copiedBoonId) arenaRun.boons.push(copiedBoonId);
    shiftArenaTeamHealth(-0.15);
  } else if (eventId === "reinforce") {
    const health = arenaTeamHealth();
    const fallenHeroId = Object.keys(health).find(
      (heroId) => health[heroId] <= 0,
    );
    if (fallenHeroId && state.inventory.copper >= 70) {
      state.inventory.copper -= 70;
      arenaRun.healthRatios = {
        ...arenaRun.healthRatios,
        [fallenHeroId]: 0.4,
      };
    } else {
      shiftArenaTeamHealth(0.2);
    }
  } else if (eventId === "forage") {
    shiftArenaTeamHealth(0.12);
    state.inventory.copper += 140;
  }
  arenaRun.lastEvent = event.id;
  return true;
}

function chooseArenaEvent(eventId) {
  if (!arenaRun || !ARENA_EVENTS[eventId]) return;
  if (!(arenaRun.eventOffer || []).includes(eventId)) return;
  if (arenaRun.selectedEvent === eventId) return;
  if (!arenaEventAvailability(eventId)) {
    toast("铜钱不足，无法招抚义士", "danger");
    return;
  }
  clearArenaAutoTimer();
  if (!applyArenaEvent(eventId)) return;
  arenaRun.selectedEvent = eventId;
  persist();
  sound.confirm();
  render();
}

function chooseArenaReward(boonId) {
  if (!arenaRun || !ARENA_BOONS[boonId]) return;
  if (arenaRun.eventOffer?.length && !arenaRun.selectedEvent) {
    toast("先定下阵后奇遇，再择取下一道军令", "danger");
    return;
  }
  if (
    arenaRun.pendingBoons?.length &&
    !arenaRun.pendingBoons.includes(boonId)
  ) {
    return;
  }
  clearArenaAutoTimer();
  arenaRun.boons.push(boonId);
  arenaRun.pendingBoons = [];
  arenaRun.eventOffer = [];
  arenaRun.selectedEvent = null;
  arenaRewardChoices = [];
  persist();
  sound.confirm();
  launchArenaWave();
}

function rerollArenaRewardChoices() {
  if (!arenaRun || arenaRun.rerollUsed) {
    toast("本轮军师变阵已经用尽", "default");
    return;
  }
  if (arenaRun.eventOffer?.length && !arenaRun.selectedEvent) {
    toast("先定下阵后奇遇，再请军师变阵", "danger");
    return;
  }
  const current = [...arenaRewardChoices];
  let replacement = [];
  for (let revision = 1; revision <= 16; revision += 1) {
    const candidate = arenaRewardOffer(revision);
    if (candidate.length && !sameArenaOffer(candidate, current)) {
      replacement = candidate;
      break;
    }
  }
  if (!replacement.length) {
    toast("当前牌池没有更多可换军令", "default");
    return;
  }
  clearArenaAutoTimer();
  arenaRun.rerollUsed = true;
  arenaRun.pendingBoons = replacement.map((boon) => boon.id);
  arenaRewardChoices = replacement;
  selectedArenaBoon = null;
  persist();
  sound.confirm();
  render();
  toast("军师已重排三道军令，本轮变阵机会已用尽", "success");
}

function finishChapter() {
  if (story?.replay) {
    focusedChapterId = activeChapter.id;
    setScreen("map");
    toast("旧战重游完成", "success");
    return;
  }
  if (activeChapter.id === CHAPTERS[CHAPTERS.length - 1].id) {
    state.flags.finalBattleWon = true;
    persist();
    setScreen("final-choice");
    return;
  }
  focusedChapterId = currentChapter(state)?.id || activeChapter.id;
  setScreen("map");
  toast("本章已记入行军录", "success");
}

function showStoryMenu() {
  const legend = Boolean(story?.legendHeroId);
  const recruitment = Boolean(story?.heroRecruitmentId);
  const specialStory = legend || recruitment;
  openModal({
    title: legend
      ? "暂离列传"
      : recruitment
        ? "暂离聚义帖"
        : "暂离剧情",
    body: specialStory
      ? `<p>${legend ? "群英列传" : "聚义帖"}进度会自动保存。返回异闻录后可重新进入此战。</p>`
      : "<p>当前剧情会自动存档。返回行军图后可以从本章开头重新进入。</p>",
    actions: [
      { label: "继续阅读", action: "close-modal", tone: "primary", icon: "book-open" },
      { label: specialStory ? "返回异闻录" : "返回行军图", action: "story-exit-map", tone: "ghost", icon: specialStory ? "scroll-text" : "map" },
    ],
  });
}

function showBattleMenu() {
  const legend = Boolean(story?.legendHeroId);
  const recruitment = Boolean(story?.heroRecruitmentId);
  const specialBattle = legend || recruitment;
  openModal({
    title: "战阵暂停",
    body: specialBattle
      ? `<p>${legend ? "列传" : "聚义帖"}奖励尚未结算。退出不会消耗本次挑战，可重新进入再战。</p>`
      : "<p>战斗进度不会随手动存档保留。退出后需要从本章战前重新开始。</p>",
    actions: [
      { label: "继续迎战", action: "close-modal", tone: "primary", icon: "swords" },
      { label: specialBattle ? (legend ? "暂离列传" : "暂离聚义帖") : "退回营寨", action: "battle-retreat", tone: "danger-ghost", icon: specialBattle ? "scroll-text" : "landmark" },
    ],
  });
}

function toggleAutoBattle() {
  if (!state) return;
  state.settings.autoBattle = !state.settings.autoBattle;
  battleUi.selectedSkillId = null;
  persist();
  sound.confirm();
  render();
}

function toggleArenaAutoAdvance() {
  if (!state) return;
  state.settings.autoArena = !state.settings.autoArena;
  if (state.settings.autoArena) state.settings.autoBattle = true;
  clearArenaAutoTimer();
  persist();
  sound.confirm();
  toast(
    state.settings.autoArena
      ? "演武自动续阵已开启，战报停留后自动进入下一阵"
      : "演武自动续阵已暂停",
    state.settings.autoArena ? "success" : "default",
  );
  render();
}

function setBattleSpeed(speed) {
  if (!state || ![1, 2, 4].includes(speed)) return;
  state.settings.battleSpeed = speed;
  persist();
  sound.click();
  render();
}

function setAutoTactic(tacticId, notify = true) {
  if (!state || !AUTO_BATTLE_TACTICS[tacticId]) return;
  state.settings.autoTactic = tacticId;
  battleUi.selectedSkillId = null;
  persist();
  sound.confirm();
  if (notify) {
    const tactic = AUTO_BATTLE_TACTICS[tacticId];
    toast(`自动战法：${tactic.name} · ${tactic.desc}`, "success");
  }
  render();
}

function cycleAutoTactic() {
  if (!state) return;
  const tactics = Object.keys(AUTO_BATTLE_TACTICS);
  const current = normalizeAutoBattleTactic(state.settings.autoTactic);
  const next = tactics[(tactics.indexOf(current) + 1) % tactics.length];
  setAutoTactic(next);
}

function handleAction(action, element) {
  if (!action) return;
  switch (action) {
    case "new-game":
      if (hasSavedGame()) {
        openModal({
          title: "另开新卷？",
          body: "<p>当前本地存档会被新游戏覆盖。旧卷进度无法恢复。</p>",
          actions: [
            { label: "取消", action: "close-modal", tone: "ghost", icon: "x" },
            { label: "确定重开", action: "confirm-new-game", tone: "danger", icon: "book-open" },
          ],
        });
      } else {
        startNewGame();
      }
      return;
    case "confirm-new-game":
      startNewGame();
      return;
    case "continue-game":
      continueGame();
      return;
    case "difficulty":
      selectedDifficulty = element.dataset.difficulty;
      sound.click();
      render();
      return;
    case "title-settings":
      settingsOrigin = "title";
      if (state) {
        setScreen("settings");
      } else {
        const temporary = createInitialState({ difficulty: selectedDifficulty });
        const saved = loadGame();
        state = saved || temporary;
        setScreen("settings");
      }
      return;
    case "back-from-settings":
      if (settingsOrigin === "title") {
        state = null;
        settingsOrigin = "nav";
        setScreen("title");
        return;
      }
      if (state?.ending) setScreen("ending");
      else if (state?.completedChapters || state?.currentChapter) setScreen("map");
      else {
        state = null;
        setScreen("title");
      }
      return;
    case "route-chapter": {
      const chapter = chapterById(element.dataset.chapter);
      if (chapterStatus(state, chapter) === "locked") {
        toast("此回尚未解锁", "danger");
        return;
      }
      focusedChapterId = chapter.id;
      setScreen("map");
      return;
    }
    case "route-quest":
      if (state.recruited.includes(element.dataset.hero)) {
        selectedQuestHero = element.dataset.hero;
      }
      setScreen("quests");
      return;
    case "route-codex":
      if (state.recruited.includes(element.dataset.hero)) {
        selectedCodexHero = element.dataset.hero;
      }
      setScreen("codex");
      return;
    case "route-arena":
      prepareArenaDraft();
      setScreen("arena");
      return;
    case "route-final-choice":
      setScreen("final-choice");
      return;
    case "route-new-cycle": {
      const unlocked = new Set([
        ...(state.endingsUnlocked || []),
        ...(state.ending ? [state.ending] : []),
      ]);
      modal = {
        title: "携星图另启一卷？",
        body: `<p>已录结局 ${unlocked.size}/3、梁山功簿 ${state.achievements?.length || 0}/${ACHIEVEMENTS.length}。新卷会保留功簿、命途、异闻、聚义、战卷评鉴与演武纪录，并从黄河夜渡重新开始。</p><p>另一条路只有换一次选择，才会真正展开。</p>`,
        actions: [
          {
            label: "暂不重开",
            action: "close-modal",
            tone: "ghost",
            icon: "arrow-left",
          },
          {
            label: "启新卷",
            action: "new-game-plus",
            tone: "primary",
            icon: "rotate-ccw",
          },
        ],
      };
      render();
      return;
    }
    case "go-map":
    case "nav-map":
      if (!state) return;
      focusedChapterId = currentChapter(state)?.id || focusedChapterId;
      setScreen("map");
      return;
    case "nav-camp":
      setScreen("camp");
      return;
    case "nav-arena":
      prepareArenaDraft();
      setScreen("arena");
      return;
    case "nav-roster":
      setScreen("roster");
      return;
    case "nav-quests":
      if (!state.recruited.includes(selectedQuestHero)) {
        selectedQuestHero = state.recruited[0];
      }
      setScreen("quests");
      return;
    case "quest-hero":
      if (state.recruited.includes(element.dataset.hero)) {
        selectedQuestHero = element.dataset.hero;
        sound.click();
        render();
      }
      return;
    case "claim-hero-quest": {
      const result = claimHeroQuest(state, element.dataset.quest);
      if (!result.ok) {
        toast(
          result.reason === "incomplete"
            ? "这段异闻尚未完成"
            : result.reason === "claimed"
              ? "这段异闻已经载入列传"
              : "当前尚不能领取",
          "danger",
        );
        return;
      }
      persist();
      sound.confirm();
      toast(
        `${result.quest.title}已载入列传 · 铜钱 +${result.copper} · 历练 +${result.xp}`,
        "success",
      );
      render();
      return;
    }
    case "claim-all-hero-quests": {
      const results = Object.values(HERO_QUESTS)
        .flat()
        .filter(
          (quest) =>
            heroQuestUnlocked(state, quest.id) &&
            isHeroQuestComplete(state, quest.id) &&
            !state.heroQuests?.claimed?.includes(quest.id),
        )
        .map((quest) => claimHeroQuest(state, quest.id))
        .filter((result) => result.ok);
      if (!results.length) {
        toast("当前没有可领取的异闻", "default");
        return;
      }
      persist();
      sound.confirm();
      const copper = results.reduce((sum, result) => sum + result.copper, 0);
      const xp = results.reduce((sum, result) => sum + result.xp, 0);
      toast(
        `领取 ${results.length} 段异闻 · 铜钱 +${copper} · 历练 +${xp}`,
        "success",
      );
      render();
      return;
    }
    case "start-hero-legend":
      startHeroLegend(element.dataset.hero);
      return;
    case "start-hero-recruitment":
      startHeroRecruitment(element.dataset.hero);
      return;
    case "recommend-recruitment-team": {
      const heroId = pendingRecruitment?.heroId;
      if (!heroId) return;
      state.team = [...pendingRecruitment.recommendedTeam];
      pendingRecruitment = null;
      persist();
      sound.confirm();
      modal = null;
      startHeroRecruitment(heroId);
      return;
    }
    case "recruitment-battle":
      modal = null;
      continuePendingRecruitment();
      return;
    case "nav-formation":
      setScreen("formation");
      return;
    case "nav-codex":
      setScreen("codex");
      return;
    case "nav-settings":
      settingsOrigin = "nav";
      setScreen("settings");
      return;
    case "select-arena-boon":
      selectedArenaBoon = element.dataset.boon;
      sound.click();
      render();
      return;
    case "select-arena-mode":
      if (arenaRun) return;
      arenaMode =
        element.dataset.mode === "weekly" ? "weekly" : "endless";
      arenaDraftSeed = null;
      arenaDraftBoons = [];
      selectedArenaBoon = null;
      prepareArenaDraft(true);
      sound.click();
      render();
      return;
    case "toggle-arena-trial":
      toggleArenaTrial(element.dataset.trial);
      return;
    case "start-arena":
      startArenaRun(selectedArenaBoon);
      return;
    case "resume-arena":
      resumeArenaSession();
      return;
    case "choose-arena-event":
      chooseArenaEvent(element.dataset.event);
      return;
    case "choose-arena-reward":
      chooseArenaReward(element.dataset.boon);
      return;
    case "follow-arena-advice":
      chooseArenaReward(element.dataset.boon);
      return;
    case "reroll-arena-boons":
      rerollArenaRewardChoices();
      return;
    case "toggle-arena-auto":
      toggleArenaAutoAdvance();
      return;
    case "retire-arena":
      concludeArenaRun();
      return;
    case "retry-arena-wave":
      if (arenaRun) {
        arenaRun.defeated = false;
        launchArenaWave();
      }
      return;
    case "select-chapter": {
      const chapter = chapterById(element.dataset.chapter);
      if (chapterStatus(state, chapter) === "locked") {
        toast("继续推进前回，方可抵达此处", "danger");
        return;
      }
      focusedChapterId = chapter.id;
      sound.click();
      render();
      return;
    }
    case "enter-chapter":
      enterChapter();
      return;
    case "camp-rest": {
      const cost = campRestCost(state);
      if (campRest(state)) {
        persist();
        sound.heal();
        toast(`众人休整完毕，消耗 ${cost} 贯`, "success");
        render();
      } else {
        toast("铜钱不足，无法休整", "danger");
      }
      return;
    }
    case "select-camp-building":
      openCampBuilding(element.dataset.building);
      return;
    case "expand-camp-area": {
      const result = expandCampArea(state);
      if (result.ok) {
        persist();
        sound.confirm();
        toast(`营区扩展至第 ${result.level} 期`, "success");
        render();
      } else {
        const labels = {
          victories: "战斗胜利不足",
          copper: "铜钱不足",
          timber: "林地木材不足",
          iron: "矿场铁矿不足",
          max: "营区已全开",
        };
        toast(labels[result.reason] || "暂时无法扩建", "danger");
      }
      return;
    }
    case "build-camp-building": {
      const result = buildCampBuilding(state, element.dataset.building);
      if (result.ok) {
        persist();
        sound.confirm();
        toast(`${result.building.name}已落成`, "success");
        openCampBuilding(result.building.id);
      } else {
        toast(
          result.reason === "copper" ? "铜钱不足" : "此建筑尚未开放",
          "danger",
        );
      }
      return;
    }
    case "collect-camp-resource": {
      const result = collectCampResource(state, element.dataset.building);
      if (result.ok) {
        persist();
        sound.confirm();
        toast(`${CAMP_PRODUCTS[result.item].name} +${result.amount}`, "success");
        openCampBuilding(element.dataset.building);
      } else {
        toast("需先建造此处", "danger");
      }
      return;
    }
    case "craft-camp-recipe": {
      const result = craftCampItem(state, element.dataset.recipe);
      if (result.available) {
        persist();
        sound.confirm();
        toast(
          `${CAMP_PRODUCTS[result.recipe.output.item].name} +${result.output}`,
          "success",
        );
        openCampBuilding(result.recipe.buildingId);
      } else {
        toast(
          result.reason === "material" ? "原料不足" : "加工建筑尚未建造",
          "danger",
        );
      }
      return;
    }
    case "upgrade-facility": {
      const facilityId = element.dataset.facility;
      const facility = FACILITIES[facilityId];
      if (upgradeFacility(state, facilityId)) {
        persist();
        sound.confirm();
        toast(`${facility.name}提升至 ${state.facilities[facilityId]} 级`, "success");
        if (screen === "camp") openCampBuilding(facilityId);
        else render();
      } else {
        toast(upgradeCost(state, facilityId) ? "铜钱不足" : "此处已升至顶阶", "danger");
      }
      return;
    }
    case "open-hero":
    case "codex-hero":
    case "locked-hero":
      selectedCodexHero = element.dataset.hero;
      if (screen === "codex") render();
      else {
        rosterDetailOpen = screen === "roster";
        if (rosterDetailOpen) render();
        else setScreen("roster");
      }
      return;
    case "close-roster-detail":
      rosterDetailOpen = false;
      sound.click();
      render();
      return;
    case "open-hero-chronicle":
      showHeroChronicle(element.dataset.hero);
      return;
    case "toggle-codex-archive": {
      const archive = element.dataset.archive;
      if (!["bonds", "chains"].includes(archive)) return;
      codexArchives[archive] = !codexArchives[archive];
      sound.click();
      render();
      return;
    }
    case "choose-doctrine": {
      const heroId = element.dataset.hero;
      const doctrineId = element.dataset.doctrine;
      if (!heroDoctrineUnlocked(state, heroId)) {
        toast("需先完成三项星命试炼", "danger");
        return;
      }
      if (!setHeroDoctrine(state, heroId, doctrineId)) {
        toast("无法选定此命途", "danger");
        return;
      }
      const doctrine = HERO_DOCTRINES[heroId].paths[doctrineId];
      persist();
      sound.confirm();
      toast(`${HEROES[heroId].name}命途已定：${doctrine.name}`, "success");
      render();
      return;
    }
    case "equipment-hero":
      selectedEquipmentHero = element.dataset.hero;
      equipmentCategory = "all";
      equipmentPathFilter = "all";
      equipmentPage = 0;
      setScreen("equipment");
      return;
    case "formation-hero":
      selectedFormationRow = Math.max(0, state.team.indexOf(element.dataset.hero));
      setScreen("formation");
      return;
    case "auto-team": {
      const recommendation = recommendTeams(state, 1)[0];
      if (!recommendation) return;
      state.team = recommendation.team;
      persist();
      sound.confirm();
      const bondNames = recommendation.bonds.map((bond) => bond.name).join("、");
      const pathNames = [
        ...new Set(
          state.team
            .filter(Boolean)
            .map((heroId) => PATHS[HEROES[heroId]?.path]?.name)
            .filter(Boolean),
        ),
      ].join("、");
      render();
      toast(
        bondNames
          ? `${recommendation.name}：${state.team.map((heroId) => HEROES[heroId]?.name).filter(Boolean).join(" · ")}，三路为${pathNames}，激活${bondNames}`
          : `${recommendation.name}：军师已按惯用阵位排成三阵`,
        "success",
      );
      return;
    }
    case "apply-team-recommendation": {
      const recommendation = recommendTeams(state, 4)[
        Number(element.dataset.index)
      ];
      if (!recommendation) {
        toast("这套荐阵已不可用，请重新推演", "danger");
        return;
      }
      state.team = recommendation.team;
      persist();
      sound.confirm();
      render();
      toast(
        `${recommendation.name}已列阵：${recommendation.team.map((heroId) => HEROES[heroId]?.name).filter(Boolean).join(" · ")}`,
        "success",
      );
      return;
    }
    case "select-formation-row":
      selectedFormationRow = Number(element.dataset.row);
      sound.click();
      render();
      return;
    case "assign-formation":
      setTeamSlot(state, selectedFormationRow, element.dataset.hero);
      persist();
      sound.confirm();
      render();
      return;
    case "clear-formation-row": {
      const row = Number(element.dataset.row);
      state.team[row] = null;
      persist();
      sound.click();
      render();
      return;
    }
    case "select-equipment-hero":
      selectedEquipmentHero = element.dataset.hero;
      equipmentCategory = "all";
      equipmentPage = 0;
      sound.click();
      render();
      return;
    case "filter-equipment-item":
      equipmentCategory = EQUIPMENT_CATEGORIES.some(
        (category) => category.id === element.dataset.slot,
      )
        ? element.dataset.slot
        : "all";
      equipmentPage = 0;
      sound.click();
      render();
      return;
    case "filter-equipment-path": {
      const pathId = element.dataset.path;
      equipmentPathFilter = ["all", ...Object.keys(PATHS)].includes(pathId)
        ? pathId
        : "all";
      equipmentPage = 0;
      if (
        equipmentPathFilter !== "all" &&
        HEROES[selectedEquipmentHero]?.path !== equipmentPathFilter
      ) {
        selectedEquipmentHero =
          state.recruited.find(
            (heroId) => HEROES[heroId].path === equipmentPathFilter,
          ) || selectedEquipmentHero;
      }
      sound.click();
      render();
      return;
    }
    case "equipment-page":
      equipmentPage += Number(element.dataset.direction) || 0;
      sound.click();
      render();
      return;
    case "filter-roster-path": {
      const pathId = element.dataset.path;
      rosterPathFilter = ["all", ...Object.keys(PATHS)].includes(pathId)
        ? pathId
        : "all";
      rosterPage = 0;
      rosterDetailOpen = false;
      rosterResetScroll = true;
      selectedCodexHero =
        state.recruited.find(
          (heroId) =>
            rosterPathFilter === "all" ||
            HEROES[heroId].path === rosterPathFilter,
        ) || selectedCodexHero;
      sound.click();
      render();
      return;
    }
    case "roster-page":
      rosterPage += Number(element.dataset.direction) || 0;
      rosterDetailOpen = false;
      rosterResetScroll = true;
      sound.click();
      render();
      return;
    case "equip-item":
      if (equipItem(state, selectedEquipmentHero, element.dataset.item)) {
        persist();
        sound.confirm();
        toast(`${HEROES[selectedEquipmentHero].name}已换上新装备`, "success");
        render();
      } else {
        toast("无法装备此物", "danger");
      }
      return;
    case "recommend-equipment": {
      const heroId = state.recruited.includes(selectedEquipmentHero)
        ? selectedEquipmentHero
        : state.recruited[0];
      const recommendation = recommendEquipment(state, heroId);
      if (!recommendation.changes.length) {
        sound.click();
        toast(`${HEROES[heroId].name}当前配装已是最优`, "success");
        return;
      }
      const equipped = recommendation.changes.filter((change) =>
        equipItem(state, heroId, change.to),
      );
      if (!equipped.length) {
        toast("当前没有可替换的推荐装备", "danger");
        return;
      }
      persist();
      sound.confirm();
      render();
      toast(
        `${HEROES[heroId].name}已调整 ${equipped.length} 件装备 · ${EQUIPMENT_STYLE_LABELS[recommendation.style]}配装`,
        "success",
      );
      return;
    }
    case "unequip":
      if (unequipItem(state, element.dataset.hero, element.dataset.slot)) {
        persist();
        sound.click();
        render();
      }
      return;
    case "toggle-sound":
      state.settings.sound = !state.settings.sound;
      sound.setEnabled(state.settings.sound);
      if (state.settings.sound) sound.confirm();
      persist();
      if (screen === "battle") render();
      else render();
      return;
    case "toggle-fullscreen":
      toggleDesktopFullscreen();
      return;
    case "ask-quit-game":
      requestDesktopQuit();
      return;
    case "confirm-quit-game":
      gameShell?.quit?.();
      return;
    case "show-credits":
      showCredits();
      return;
    case "show-third-party-notices":
      showThirdPartyNotices();
      return;
    case "show-legal-document":
      showLegalDocument(element.dataset.document);
      return;
    case "export-save":
      exportCurrentSave();
      return;
    case "cancel-save-import":
      pendingImportedState = null;
      modal = null;
      render();
      return;
    case "confirm-save-import":
      if (pendingImportedState) {
        state = pendingImportedState;
        restoreArenaRunFromState();
        pendingImportedState = null;
        modal = null;
        persist();
        sound.confirm();
        if (state.ending) setScreen("ending");
        else setScreen("map");
        toast("战卷已载入", "success");
      }
      return;
    case "toggle-auto-battle":
      toggleAutoBattle();
      return;
    case "cycle-auto-tactic":
      cycleAutoTactic();
      return;
    case "auto-tactic":
      setAutoTactic(element.dataset.tactic);
      return;
    case "battle-speed":
      setBattleSpeed(Number(element.dataset.speed));
      return;
    case "toggle-motion":
      state.settings.reducedMotion = !state.settings.reducedMotion;
      persist();
      render();
      return;
    case "toggle-contrast":
      state.settings.highContrast = !state.settings.highContrast;
      persist();
      render();
      return;
    case "ui-scale":
      if (
        !["normal", "large", "largest"].includes(element.dataset.scale)
      ) {
        return;
      }
      state.settings.uiScale = element.dataset.scale;
      persist();
      sound.click();
      render();
      return;
    case "text-speed":
      state.settings.textSpeed = element.dataset.speed;
      persist();
      sound.click();
      render();
      return;
    case "manual-save":
      if (persist()) {
        sound.confirm();
        toast("战卷已保存", "success");
        render();
      } else {
        toast("存档写入失败，请检查磁盘空间或权限", "danger");
      }
      return;
    case "steam-open-achievements":
      steamBridge?.openAchievements?.().then((result) => {
        if (!result?.ok) toast("Steam 成就面板暂不可用", "danger");
      });
      return;
    case "steam-sync-now":
      syncSteamCloudNow(true);
      return;
    case "open-log-folder":
      diagnosticsBridge?.openLogFolder?.().then((result) => {
        if (!result?.ok) toast("未能打开诊断日志目录", "danger");
      });
      return;
    case "ask-delete-save":
      openModal({
        title: "删去整卷？",
        body: "<p>本地存档、章节进度与人物养成都会清除。此操作无法撤销。</p>",
        actions: [
          { label: "保留", action: "close-modal", tone: "ghost", icon: "x" },
          { label: "删除并返回标题", action: "delete-save", tone: "danger", icon: "trash-2" },
        ],
      });
      return;
    case "delete-save":
      if (steamCloudTimer) window.clearTimeout(steamCloudTimer);
      steamCloudTimer = null;
      steamBridge
        ?.deleteCloudSave?.()
        .catch((error) =>
          reportDiagnostic("warning", "steam-cloud-delete-failed", String(error)),
        );
      deleteSave();
      state = null;
      modal = null;
      setScreen("title");
      toast("旧卷已删除");
      return;
    case "story-next":
      storyNext();
      return;
    case "story-choice":
      chooseStoryOption(Number(element.dataset.option));
      return;
    case "story-to-battle":
      startChapterBattle();
      return;
    case "dismiss-battle-tutorial":
      if (!state || !battle) return;
      state.flags.tutorialSeen = true;
      persist();
      sound.confirm();
      render();
      return;
    case "story-skip":
      story.stage = story.legendHeroId ? "legend-ready" : "choice";
      render();
      return;
    case "story-menu":
      showStoryMenu();
      return;
    case "story-exit-map":
      modal = null;
      if (story?.legendHeroId || story?.heroRecruitmentId) {
        battle = null;
        battleUi = createBattleUi();
        activeChapter = null;
        story = null;
        setScreen("quests");
        return;
      }
      focusedChapterId = activeChapter?.id || focusedChapterId;
      setScreen("map");
      return;
    case "chain-attack":
      resolveChainAttack();
      return;
    case "select-skill":
      selectSkill(element.dataset.skill);
      return;
    case "cancel-target":
      battleUi.selectedSkillId = null;
      render();
      return;
    case "battle-target": {
      if (!battleUi.selectedSkillId) {
        toast("先从右侧选择招式", "danger");
        return;
      }
      const actor = currentCombatant(battle);
      const skill = actor ? heroSkillList(actor).find((item) => item.id === battleUi.selectedSkillId) : null;
      if (skill) resolveHeroAction(skill, element.dataset.uid);
      return;
    }
    case "battle-menu":
      showBattleMenu();
      return;
    case "battle-retreat":
    case "retreat-camp":
    case "battle-retreat-confirm":
      if (story?.legendHeroId || story?.heroRecruitmentId) {
        modal = null;
        battle = null;
        battleUi = createBattleUi();
        activeChapter = null;
        story = null;
        setScreen("quests");
        return;
      }
      modal = null;
      battle = null;
      battleUi = createBattleUi();
      focusedChapterId = activeChapter?.id || focusedChapterId;
      setScreen("camp");
      return;
    case "retry-battle":
      battle = null;
      battleUi = createBattleUi();
      launchStoryBattle();
      return;
    case "story-outro":
      story.stage = "outro";
      story.line = 0;
      setScreen("story");
      return;
    case "choose-ending":
      state.ending = element.dataset.ending;
      state.endingsUnlocked = [
        ...new Set([...(state.endingsUnlocked || []), state.ending]),
      ];
      state.flags.finalBattleWon = true;
      persist();
      sound.victory();
      showEndingCinematic(state.ending);
      return;
    case "skip-ending-cinematic":
      endingCinematicActive = false;
      clearEndingCinematicTimer();
      render();
      return;
    case "continue-after-ending":
      setScreen("codex");
      return;
    case "new-game-plus":
      selectedDifficulty = state?.difficulty || "normal";
      startNewGame({ preserveArchive: true });
      return;
    case "back-to-title":
      state = null;
      setScreen("title");
      return;
    case "close-modal":
      modal = null;
      pendingRecruitment = null;
      render();
      return;
    default:
      return;
  }
}

app.addEventListener("input", (event) => {
  const input = event.target.closest("[data-volume-setting]");
  if (!input || !state) return;
  const key = input.dataset.volumeSetting;
  if (!["musicVolume", "sfxVolume"].includes(key)) return;
  const value = Math.max(0, Math.min(100, Number(input.value)));
  state.settings[key] = value;
  const output = input.closest("label")?.querySelector("output");
  if (output) output.value = `${value}%`;
  sound.setVolumes({
    musicVolume: state.settings.musicVolume / 100,
    sfxVolume: state.settings.sfxVolume / 100,
  });
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-save-import]")) {
    const [file] = event.target.files || [];
    prepareSaveImport(file);
    event.target.value = "";
    return;
  }
  if (event.target.closest("[data-volume-setting]") && state) {
    persist();
    sound.click();
  }
});

app.addEventListener("click", (event) => {
  sound.unlock();
  document.documentElement.dataset.input = "pointer";
  const target = event.target.closest("[data-action]");
  if (
    event.target.closest("[data-modal-panel]") &&
    target?.classList.contains("modal-backdrop")
  ) {
    return;
  }
  if (!target) {
    if (
      screen === "story" &&
      !isTextEditable(event.target) &&
      story?.stage !== "choice" &&
      story?.stage !== "choice-response"
    ) {
      const dialogue = event.target.closest(".story-screen");
      if (dialogue && !event.target.closest("button, .story-choice, .story-response")) storyNext();
    }
    return;
  }
  event.stopPropagation();
  showClickFeedback(target, event);
  const previousCopper = state?.inventory?.copper;
  handleAction(target.dataset.action, target);
  showCurrencyFeedback(previousCopper, state?.inventory?.copper);
});

const gamepadState = {
  active: false,
  previousButtons: [],
  direction: null,
  directionStartedAt: 0,
  lastDirectionAt: 0,
};

function gamepadFocusables() {
  const scope =
    document.querySelector("[data-modal-panel]") ||
    document.querySelector(".game-frame") ||
    document;
  return [...scope.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex='0']")]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2 && getComputedStyle(element).visibility !== "hidden";
    });
}

function focusForGamepad(element) {
  if (!element) return;
  document.documentElement.dataset.input = "gamepad";
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function moveGamepadFocus(direction) {
  const focusables = gamepadFocusables();
  if (!focusables.length) return;
  const current = focusables.includes(document.activeElement)
    ? document.activeElement
    : focusables.find((element) => element.matches(".button.primary, .skill-button, .toggle")) ||
      focusables[0];
  if (document.activeElement !== current) {
    focusForGamepad(current);
    return;
  }

  const currentRect = current.getBoundingClientRect();
  const originX = currentRect.left + currentRect.width / 2;
  const originY = currentRect.top + currentRect.height / 2;
  const candidates = focusables
    .filter((element) => element !== current)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - originX;
      const dy = rect.top + rect.height / 2 - originY;
      const primary =
        direction === "left" ? -dx :
          direction === "right" ? dx :
            direction === "up" ? -dy : dy;
      const cross = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
      return { element, primary, score: primary + cross * 2.15 };
    })
    .filter((item) => item.primary > 2)
    .sort((a, b) => a.score - b.score);
  focusForGamepad(candidates[0]?.element || current);
}

function activateGamepadFocus() {
  const focusables = gamepadFocusables();
  if (!focusables.length) return;
  if (!focusables.includes(document.activeElement)) {
    focusForGamepad(focusables[0]);
    return;
  }
  const active = document.activeElement;
  if (active.matches("input[type='range']")) {
    active.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  active.click();
}

function gamepadDirection(pad) {
  const [axisX = 0, axisY = 0] = pad.axes || [];
  const buttons = pad.buttons || [];
  if (buttons[12]?.pressed || axisY < -0.58) return "up";
  if (buttons[13]?.pressed || axisY > 0.58) return "down";
  if (buttons[14]?.pressed || axisX < -0.58) return "left";
  if (buttons[15]?.pressed || axisX > 0.58) return "right";
  return null;
}

function activateGamepadBack() {
  const close = document.querySelector(
    "[data-modal-panel] [data-action='close-modal']",
  );
  if (close) {
    close.click();
    return;
  }
  if (screen === "title") return;
  if (screen === "story") {
    showStoryMenu();
    return;
  }
  if (screen === "battle") {
    showBattleMenu();
    return;
  }
  const navigableBack =
    document.querySelector("button[data-action='back-from-settings']") ||
    document.querySelector("button[data-action='nav-map']");
  if (navigableBack) {
    navigableBack.click();
    return;
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function handleGamepadButtonPress(index, pad) {
  if (index === 0) activateGamepadFocus();
  if (index === 1) activateGamepadBack();
  if (index === 2 && screen === "battle" && battle && !modal) toggleAutoBattle();
  if (index === 3 && screen === "battle" && battle && !modal) {
    const speeds = [1, 2, 4];
    const next = speeds[(speeds.indexOf(state.settings.battleSpeed) + 1) % speeds.length];
    setBattleSpeed(next);
  }
  if (index === 4 && screen === "battle" && battle && !modal) cycleAutoTactic();
  if (index === 10) moveGamepadFocus("left");
  if (index === 11) moveGamepadFocus("right");
  if (index === 6 || index === 9) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  if (index === 7) {
    const journal = document.querySelector("button[data-action='nav-codex']");
    if (journal && !modal) journal.click();
    else activateGamepadFocus();
  }
  if (index === 16) {
    const active = document.activeElement;
    if (active?.matches("input[type='range']")) {
      active.value = String(Math.max(Number(active.min || 0), Number(active.value) - 5));
      active.dispatchEvent(new Event("input", { bubbles: true }));
      active.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  if (index === 17) {
    const active = document.activeElement;
    if (active?.matches("input[type='range']")) {
      active.value = String(Math.min(Number(active.max || 100), Number(active.value) + 5));
      active.dispatchEvent(new Event("input", { bubbles: true }));
      active.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

function pollGamepads() {
  const pad = [...(navigator.getGamepads?.() || [])].find((item) => item?.connected);
  if (!pad) {
    gamepadState.active = false;
    window.requestAnimationFrame(pollGamepads);
    return;
  }
  gamepadState.active = true;
  const now = performance.now();
  const buttons = [...(pad.buttons || [])];

  buttons.forEach((button, index) => {
    const pressed = button.pressed || button.value > 0.45;
    const wasPressed = gamepadState.previousButtons[index] || false;
    if (pressed && !wasPressed) handleGamepadButtonPress(index, pad);
    gamepadState.previousButtons[index] = pressed;
  });

  const direction = gamepadDirection(pad);
  if (direction) {
    if (direction !== gamepadState.direction) {
      gamepadState.direction = direction;
      gamepadState.directionStartedAt = now;
      gamepadState.lastDirectionAt = now;
      moveGamepadFocus(direction);
    } else if (now - gamepadState.directionStartedAt > 360 && now - gamepadState.lastDirectionAt > 115) {
      gamepadState.lastDirectionAt = now;
      moveGamepadFocus(direction);
    }
  } else {
    gamepadState.direction = null;
  }

  window.requestAnimationFrame(pollGamepads);
}

window.addEventListener("keydown", (event) => {
  if (isTextEditable(event.target)) {
    if (isGameShortcut(event)) event.stopImmediatePropagation();
    return;
  }
  sound.unlock();
  document.documentElement.dataset.input = "keyboard";
  if (event.key === "Escape") {
    if (modal) {
      modal = null;
      render();
      return;
    }
    if (screen === "story") showStoryMenu();
    if (screen === "battle") showBattleMenu();
  }
  if (screen === "story" && (event.key === " " || event.key === "Enter") && !modal) {
    if (story?.stage === "intro" || story?.stage === "outro") {
      event.preventDefault();
      storyNext();
    }
  }
  if (screen === "battle" && !modal && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (event.key.toLowerCase() === "a") {
      event.preventDefault();
      toggleAutoBattle();
    } else if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      cycleAutoTactic();
    } else if (event.key.toLowerCase() === "c" && chainAttackReady(battle)) {
      event.preventDefault();
      resolveChainAttack();
    } else if (["1", "2", "4"].includes(event.key)) {
      event.preventDefault();
      setBattleSpeed(Number(event.key));
    }
  }
});

window.setInterval(() => {
  if (
    screen !== "battle" ||
    !battle ||
    battleTimer ||
    modal ||
    performance.now() - lastBattleScreenOpenedAt < 2000
  ) {
    return;
  }
  if (battle.phase === "resolving") {
    battleUi.processing = true;
    scheduleBattle(() => advanceAfterResult(), 400);
  } else if (battle.phase === "skipping") {
    battleUi.processing = true;
    scheduleBattle(() => {
      battleUi.processing = false;
      finishResolutionAndAdvance(battle);
      render();
    }, 250);
  } else if (battle.phase === "enemy") {
    battleUi.processing = true;
    scheduleBattle(() => runEnemyTurn(), 250);
  } else if (battle.phase === "select") {
    const actor = currentCombatant(battle);
    if (state.settings.autoBattle || !actor || actor.hp <= 0) {
      runBattleAutomation();
    }
  } else if (battle.phase === "victory") {
    scheduleBattle(() => settleVictory(), 150);
  } else if (battle.phase === "defeat") {
    battleUi.processing = false;
    render();
  }
}, 1200);

window.addEventListener("pointerdown", () => {
  document.documentElement.dataset.input = "pointer";
});

window.addEventListener("gamepadconnected", (event) => {
  sound.confirm();
  toast(`已连接手柄：${event.gamepad.id.slice(0, 42)}`, "success");
});

window.addEventListener("gamepaddisconnected", () => {
  toast("手柄已断开");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "battle" && battle && !modal) {
    showBattleMenu();
  } else if (!document.hidden && screen === "arena-reward") {
    queueArenaAutoContinue();
  }
});

window.addEventListener(
  "error",
  (event) => {
    const target = event.target;
    if (target && target !== window && target !== document) {
      reportDiagnostic("error", "resource-load-failed", {
        tag: target.tagName || null,
        source: target.currentSrc || target.src || target.href || null,
      });
      return;
    }
    reportDiagnostic("error", "window-error", {
      message: event.message || "unknown",
      source: event.filename || null,
      line: event.lineno || null,
      column: event.colno || null,
    });
    if (!app.childElementCount) showFatalError(event.error || event.message);
  },
  true,
);

window.addEventListener("unhandledrejection", (event) => {
  reportDiagnostic("error", "unhandled-rejection", String(event.reason));
  if (!app.childElementCount) showFatalError(event.reason);
});

if (gameShell?.getStatus) {
  gameShell
    .getStatus()
    .then((status) => {
      desktopStatus = { ...desktopStatus, ...status };
      if (screen === "settings" && state) render();
    })
    .catch(() => {});
}

gameShell?.onFullscreenChanged?.((fullscreen) => {
  desktopStatus.fullscreen = Boolean(fullscreen);
  if (screen === "settings" && state) render();
});

if (
  import.meta.env.PROD &&
  "serviceWorker" in navigator &&
  /^https?:$/.test(window.location.protocol)
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      reportDiagnostic("error", "service-worker-registration-failed", String(error));
    });
  });
}

if (navigator.getGamepads) window.requestAnimationFrame(pollGamepads);

initializePlatformServices().finally(() => {
  updateSteamPresence();
  render();
});
