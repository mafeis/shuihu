import { EQUIPMENT, HEROES } from "./data.js";

const SLOTS = ["weapon", "armor", "token"];

const PATH_WEIGHTS = {
  gang: { hp: 0.18, atk: 2.35, def: 1.25, spd: 0.85 },
  ling: { hp: 0.1, atk: 1.9, def: 0.95, spd: 1.9 },
  tao: { hp: 0.13, atk: 1.85, def: 1.1, spd: 1.55 },
  shou: { hp: 0.24, atk: 1.35, def: 1.9, spd: 0.95 },
};

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

function statStyle(stats) {
  const offense = stats.atk * 1.5 + stats.spd;
  const guard = stats.hp / 5 + stats.def * 1.5;
  const mobility = stats.spd * 2 + stats.atk;
  if (offense > guard * 1.25) return "offense";
  if (guard > offense * 1.15) return "guard";
  if (mobility > offense * 1.08) return "mobility";
  return "balanced";
}

export function equipmentWeights(hero) {
  const base = PATH_WEIGHTS[hero?.path] || PATH_WEIGHTS.tao;
  const weights = { ...base };
  if (hero?.preferredRow === 0) {
    weights.hp += 0.05;
    weights.def += 0.28;
  }
  if (hero?.preferredRow === 2) {
    weights.spd += 0.35;
    weights.hp -= 0.015;
  }
  if (hero?.role?.includes("治疗") || hero?.role?.includes("支援")) {
    weights.hp += 0.025;
    weights.def += 0.12;
    weights.atk += 0.08;
  }
  return weights;
}

export function scoreEquipmentSet(hero, equipment) {
  if (!hero) return 0;
  const weights = equipmentWeights(hero);
  const totals = { hp: 0, atk: 0, def: 0, spd: 0 };
  const pieces = [];
  for (const slot of SLOTS) {
    const item = EQUIPMENT[equipment?.[slot]];
    if (!item) continue;
    for (const [stat, value] of Object.entries(item.stats || {})) {
      totals[stat] = (totals[stat] || 0) + value;
    }
    pieces.push({ item, style: statStyle(item.stats || {}) });
  }
  let score = Object.entries(weights).reduce(
    (total, [stat, weight]) => total + (totals[stat] || 0) * weight,
    0,
  );

  // Two matching gear directions create a practical set-style bonus.
  for (const style of ["offense", "guard", "mobility"]) {
    const count = pieces.filter((piece) => piece.style === style).length;
    if (count >= 2) {
      const weight =
        style === "guard"
          ? weights.hp + weights.def
          : style === "mobility"
            ? weights.atk + weights.spd
            : weights.atk * 1.35;
      score += weight * 1.4;
    }
  }
  if (pieces.length === SLOTS.length) score += 2;
  return roundScore(score);
}

function slotCandidates(state, heroId, slot) {
  const currentId = state.roster?.[heroId]?.equipment?.[slot] || null;
  const candidates = [];
  if (currentId && EQUIPMENT[currentId]?.slot === slot) {
    candidates.push(currentId);
  }
  for (const [itemId, amount] of Object.entries(state.inventory || {})) {
    if (
      itemId === "copper" ||
      Number(amount) <= 0 ||
      candidates.includes(itemId) ||
      EQUIPMENT[itemId]?.slot !== slot
    ) {
      continue;
    }
    candidates.push(itemId);
  }
  if (!candidates.length) candidates.push(null);
  return candidates;
}

export function recommendEquipment(state, heroId) {
  const hero = HEROES[heroId];
  const entry = state?.roster?.[heroId];
  if (!hero || !entry) {
    return {
      equipment: { weapon: null, armor: null, token: null },
      changes: [],
      score: 0,
      currentScore: 0,
      style: "balanced",
    };
  }

  const current = Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      EQUIPMENT[entry.equipment?.[slot]]?.slot === slot
        ? entry.equipment[slot]
        : null,
    ]),
  );
  const candidates = Object.fromEntries(
    SLOTS.map((slot) => [slot, slotCandidates(state, heroId, slot)]),
  );
  const currentScore = scoreEquipmentSet(hero, current);
  let best = current;
  let bestScore = currentScore;

  for (const weapon of candidates.weapon) {
    for (const armor of candidates.armor) {
      for (const token of candidates.token) {
        const equipment = { weapon, armor, token };
        const score = scoreEquipmentSet(hero, equipment);
        if (score > bestScore) {
          best = equipment;
          bestScore = score;
        }
      }
    }
  }

  const changes = SLOTS.filter((slot) => current[slot] !== best[slot]).map(
    (slot) => ({
      slot,
      from: current[slot],
      to: best[slot],
    }),
  );
  const styles = SLOTS.map((slot) =>
    statStyle(EQUIPMENT[best[slot]]?.stats || {}),
  );
  const style =
    styles.filter((value) => value === "offense").length >= 2
      ? "offense"
      : styles.filter((value) => value === "guard").length >= 2
        ? "guard"
        : styles.filter((value) => value === "mobility").length >= 2
          ? "mobility"
          : "balanced";
  return {
    equipment: best,
    changes,
    score: bestScore,
    currentScore,
    improvement: roundScore(bestScore - currentScore),
    style,
  };
}
