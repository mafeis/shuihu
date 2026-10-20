export const BATTLE_PHASES = Object.freeze({
  LOADING: "loading",
  SELECT: "select",
  ENEMY: "enemy",
  RESOLVING: "resolving",
  SKIPPING: "skipping",
  VICTORY: "victory",
  DEFEAT: "defeat",
});

const PHASE_DEFINITIONS = Object.freeze({
  [BATTLE_PHASES.LOADING]: Object.freeze({
    label: "排兵列阵",
    eyebrow: "准备",
    detail: "依速度排定出手顺序",
    tone: "neutral",
    icon: "hourglass",
    actionable: false,
    terminal: false,
  }),
  [BATTLE_PHASES.SELECT]: Object.freeze({
    label: "我方行动",
    eyebrow: "择招",
    detail: "选择招式，留意路数克制",
    tone: "hero",
    icon: "crosshair",
    actionable: true,
    terminal: false,
  }),
  [BATTLE_PHASES.ENEMY]: Object.freeze({
    label: "敌方行动",
    eyebrow: "来犯",
    detail: "敌军正在判断阵势",
    tone: "enemy",
    icon: "swords",
    actionable: false,
    terminal: false,
  }),
  [BATTLE_PHASES.RESOLVING]: Object.freeze({
    label: "交锋结算",
    eyebrow: "交锋",
    detail: "正在结算本次出手",
    tone: "resolve",
    icon: "sparkles",
    actionable: false,
    terminal: false,
  }),
  [BATTLE_PHASES.SKIPPING]: Object.freeze({
    label: "行动受阻",
    eyebrow: "变阵",
    detail: "本回合无法行动，正在换人",
    tone: "muted",
    icon: "hourglass",
    actionable: false,
    terminal: false,
  }),
  [BATTLE_PHASES.VICTORY]: Object.freeze({
    label: "敌阵已破",
    eyebrow: "胜势",
    detail: "战斗结束，正在清点战果",
    tone: "victory",
    icon: "flag",
    actionable: false,
    terminal: true,
  }),
  [BATTLE_PHASES.DEFEAT]: Object.freeze({
    label: "众人力竭",
    eyebrow: "败退",
    detail: "退回营寨后可重整再战",
    tone: "defeat",
    icon: "shield",
    actionable: false,
    terminal: true,
  }),
});

const ACTIVE_TRANSITIONS = Object.freeze(
  [
    BATTLE_PHASES.LOADING,
    BATTLE_PHASES.SELECT,
    BATTLE_PHASES.ENEMY,
    BATTLE_PHASES.RESOLVING,
    BATTLE_PHASES.SKIPPING,
  ].reduce((transitions, phase) => {
    transitions[phase] = new Set([
      BATTLE_PHASES.SELECT,
      BATTLE_PHASES.ENEMY,
      BATTLE_PHASES.RESOLVING,
      BATTLE_PHASES.SKIPPING,
      BATTLE_PHASES.VICTORY,
      BATTLE_PHASES.DEFEAT,
    ]);
    return transitions;
  }, {}),
);

const PHASE_TRANSITIONS = Object.freeze({
  ...ACTIVE_TRANSITIONS,
  [BATTLE_PHASES.VICTORY]: new Set([BATTLE_PHASES.VICTORY]),
  [BATTLE_PHASES.DEFEAT]: new Set([BATTLE_PHASES.DEFEAT]),
});

const FALLBACK_DEFINITION = Object.freeze({
  label: "交锋中",
  eyebrow: "战况",
  detail: "战斗正在推进",
  tone: "neutral",
  icon: "swords",
  actionable: false,
  terminal: false,
});

export function isKnownBattlePhase(phase) {
  return Object.hasOwn(PHASE_DEFINITIONS, phase);
}

export function isBattlePhase(value, phase) {
  const current = typeof value === "string" ? value : value?.phase;
  return current === phase;
}

export function isTerminalBattlePhase(value) {
  const current = typeof value === "string" ? value : value?.phase;
  return (
    current === BATTLE_PHASES.VICTORY ||
    current === BATTLE_PHASES.DEFEAT
  );
}

export function canTransitionBattlePhase(from, to) {
  if (!isKnownBattlePhase(to)) return false;
  if (!from || !isKnownBattlePhase(from)) return true;
  return PHASE_TRANSITIONS[from]?.has(to) || false;
}

export function setBattlePhase(battle, nextPhase, options = {}) {
  if (!battle || typeof battle !== "object") {
    throw new TypeError("setBattlePhase requires a battle state object");
  }
  if (!isKnownBattlePhase(nextPhase)) {
    throw new RangeError(`Unknown battle phase: ${nextPhase}`);
  }

  const previousPhase = battle.phase;
  if (previousPhase === nextPhase) return nextPhase;
  if (!canTransitionBattlePhase(previousPhase, nextPhase)) {
    throw new Error(
      `Invalid battle phase transition: ${previousPhase || "none"} -> ${nextPhase}`,
    );
  }

  battle.phase = nextPhase;
  battle.phaseSerial = (Number(battle.phaseSerial) || 0) + 1;
  battle.phaseTransition = {
    from: previousPhase || null,
    to: nextPhase,
    round: Number(battle.round) || 0,
    turn: Number(battle.turnsTaken) || 0,
    reason: options.reason || "",
    at: Date.now(),
  };
  return nextPhase;
}

export function battlePhasePresentation(battle, actor = null, options = {}) {
  const phase =
    typeof battle === "string" ? battle : battle?.phase;
  const definition =
    PHASE_DEFINITIONS[phase] || FALLBACK_DEFINITION;
  const actorName = actor?.name || "";
  let label = definition.label;
  let detail = definition.detail;

  if (phase === BATTLE_PHASES.SELECT) {
    if (options.processing) {
      detail = "正在准备本次出手";
    } else if (options.autoBattle) {
      detail = "自动战法正在推演下一手";
    } else if (actorName) {
      label = `${actorName}待命`;
    }
  } else if (phase === BATTLE_PHASES.ENEMY && actorName) {
    detail = `${actorName}正在判断阵势`;
  } else if (phase === BATTLE_PHASES.RESOLVING && actorName) {
    detail = `${actorName}出手，正在结算战果`;
  } else if (phase === BATTLE_PHASES.SKIPPING && actorName) {
    detail = `${actorName}本回合无法行动`;
  }

  return {
    id: phase || BATTLE_PHASES.LOADING,
    label,
    eyebrow: definition.eyebrow,
    detail,
    tone: definition.tone,
    icon: definition.icon,
    actionable: Boolean(
      definition.actionable && !options.processing && !options.autoBattle,
    ),
    terminal: definition.terminal,
    actorName,
    round: Math.max(0, Number(battle?.round) || 0),
  };
}
