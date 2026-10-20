const PATH_STYLES = {
  gang: {
    tone: "cinnabar",
  },
  ling: {
    tone: "teal",
  },
  tao: {
    tone: "gold",
  },
  shou: {
    tone: "blue",
  },
};

const TEMPLATE_META = {
  blade: {
    icon: "swords",
    duration: 760,
  },
  volley: {
    icon: "crosshair",
    duration: 820,
  },
  impact: {
    icon: "hammer",
    duration: 900,
  },
  guard: {
    icon: "shield-check",
    duration: 860,
  },
  restore: {
    icon: "heart-pulse",
    duration: 940,
  },
  ultimate: {
    icon: "sparkles",
    duration: 1120,
  },
};

const PROJECTILE_PATTERN =
  /(箭|矢|飞石|连珠三石|飞蝗|没羽|飞刃|飞刀|袖中|暗器|飞镖|索镖|连掷|撒网|掷出|击向后阵)/;
const EXPLOSION_PATTERN = /(炮|轰|雷|爆|炸|震天)/;
const IMPACT_PATTERN =
  /(锤|棒|斧|铁棍|禅杖|门闩|炮|轰|雷|震|砸|劈|碎|横扫|压阵|踏|山门|杨柳|破军|旋风|裂甲|断索)/;
function skillText(skill) {
  return `${skill?.name || ""} ${skill?.desc || ""}`;
}

function skillEffects(skill) {
  return Array.isArray(skill?.effects) ? skill.effects : [];
}

function hasDefensiveEffect(skill) {
  return skillEffects(skill).some(
    (effect) =>
      effect.status === "guard" ||
      effect.type === "teamStatus" ||
      effect.type === "selfStatus" ||
      effect.type === "targetStatus",
  );
}

function uniqueTargets(result) {
  return [
    ...new Set(
      [
        ...(Array.isArray(result?.targets) ? result.targets : []),
        ...(Array.isArray(result?.events)
          ? result.events.map((event) => event.targetUid)
          : []),
      ].filter(Boolean),
    ),
  ];
}

function visualVariant(skill, result) {
  const key = [
    skill?.id,
    skill?.name,
    result?.actorUid,
    result?.skillId,
    result?.kind,
  ]
    .filter(Boolean)
    .join("|");
  let hash = 0;
  for (const character of key) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return hash % 3;
}

function isOffensiveUltimate(skill, result) {
  return Boolean(
    result?.kind === "combo" ||
      (skill?.ultimate &&
        (Number(skill?.power) > 0 ||
          result?.kind === "damage" ||
          result?.events?.some(
            (event) => event.type === "damage" || event.type === "combo",
          ))),
  );
}

export function battleVfxTemplate({ skill, result } = {}) {
  if (!result?.ok) return null;
  const text = skillText(skill);
  const events = Array.isArray(result.events) ? result.events : [];
  const heals =
    Number(skill?.heal) > 0 ||
    result.kind === "heal" ||
    events.some((event) => event.type === "heal");
  const support =
    Number(skill?.power || 0) <= 0 ||
    result.kind === "support" ||
    result.kind === "heal";
  const damaging =
    Number(skill?.power) > 0 ||
    result.kind === "damage" ||
    events.some((event) => event.type === "damage" || event.type === "combo");

  if (result.kind === "combo" || isOffensiveUltimate(skill, result)) {
    return "ultimate";
  }
  if (heals) return "restore";
  if (support || (!damaging && hasDefensiveEffect(skill))) return "guard";
  if (events.some((event) => event.type === "evade")) return "guard";
  if (EXPLOSION_PATTERN.test(text)) return "impact";
  if (PROJECTILE_PATTERN.test(text)) return "volley";
  if (
    IMPACT_PATTERN.test(text) ||
    skill?.target === "allEnemies" ||
    Number(skill?.hits) > 1 ||
    Number(skill?.power) >= 1.3
  ) {
    return "impact";
  }
  return "blade";
}

export function battleVfxProfile({ skill, actor, result } = {}) {
  const kind = battleVfxTemplate({ skill, result });
  if (!kind) return null;
  const pathId = skill?.path || skill?.actorPath || actor?.path || "gang";
  const path = PATH_STYLES[pathId] || PATH_STYLES.gang;
  const template = TEMPLATE_META[kind];
  const events = Array.isArray(result.events) ? result.events : [];
  const ultimate = Boolean(skill?.ultimate || result?.kind === "combo");
  return {
    actorUid: result.actorUid || actor?.uid || null,
    actorSide: actor?.side || null,
    actorRow: Number.isInteger(actor?.row) ? actor.row : null,
    pathId,
    kind,
    template: kind,
    tone: path.tone,
    icon: template.icon,
    duration: template.duration + (ultimate ? 120 : 0),
    heavy:
      ultimate ||
      kind === "impact" ||
      Number(skill?.power) >= 1.3 ||
      Number(skill?.hits) > 1,
    ultimate,
    multiTarget: uniqueTargets(result).length > 1,
    variant: visualVariant(skill, result),
    skillName:
      skill?.name ||
      (result.kind === "combo" ? "星命合击" : result.kind === "heal" ? "回春" : "变阵"),
    targetUids: uniqueTargets(result),
    events: events.map((event) => ({
      type: event.type,
      targetUid: event.targetUid || null,
      damage: Number(event.damage) || 0,
      healing: Number(event.healing) || 0,
      critical: Boolean(event.critical),
      pathAdvantage: Boolean(event.pathAdvantage),
    })),
    critical: events.some((event) => event.critical),
    pathAdvantage: events.some((event) => event.pathAdvantage),
    evaded: events.some((event) => event.type === "evade"),
  };
}
