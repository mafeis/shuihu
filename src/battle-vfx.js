const PATH_VFX = {
  gang: {
    tone: "cinnabar",
    light: "slash",
    heavy: "quake",
    icon: "swords",
  },
  ling: {
    tone: "teal",
    light: "projectile",
    heavy: "rain",
    icon: "crosshair",
  },
  tao: {
    tone: "gold",
    light: "sigil",
    heavy: "tempest",
    icon: "sparkles",
  },
  shou: {
    tone: "blue",
    light: "guard",
    heavy: "bulwark",
    icon: "shield-check",
  },
};

const RESULT_VFX = {
  combo: { kind: "starfall", tone: "gold", icon: "sparkles" },
  heal: { kind: "mend", tone: "teal", icon: "heart-pulse" },
  support: { kind: "ward", tone: "blue", icon: "shield" },
};

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

export function battleVfxProfile({ skill, actor, result } = {}) {
  if (!result?.ok) return null;
  const pathId = skill?.path || skill?.actorPath || actor?.path || "gang";
  const path = PATH_VFX[pathId] || PATH_VFX.gang;
  const resultKind = RESULT_VFX[result.kind];
  const heavy =
    Boolean(skill?.ultimate) ||
    Number(skill?.power) >= 1.3 ||
    Number(skill?.hits) > 1 ||
    result.kind === "combo";
  const fallbackResult =
    result.kind === "combo"
      ? RESULT_VFX.combo
      : result.events?.some((event) => event.type === "heal")
        ? RESULT_VFX.heal
        : null;
  const visual = fallbackResult || resultKind || {
    kind: heavy ? path.heavy : path.light,
    tone: path.tone,
    icon: path.icon,
  };
  const events = Array.isArray(result.events) ? result.events : [];
  return {
    actorUid: result.actorUid || actor?.uid || null,
    actorSide: actor?.side || null,
    pathId,
    kind: visual.kind,
    tone: visual.tone,
    icon: visual.icon,
    heavy,
    skillName:
      skill?.name ||
      (result.kind === "combo" ? "星命合击" : result.kind === "heal" ? "回春" : "变阵"),
    targetUids: uniqueTargets(result),
    critical: events.some((event) => event.critical),
    pathAdvantage: events.some((event) => event.pathAdvantage),
    evaded: events.some((event) => event.type === "evade"),
  };
}
