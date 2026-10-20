import {
  ARENA_BOONS,
  ARENA_BOON_MASTERIES,
  ARENA_SYNERGIES,
} from "./data.js";

const BOON_BASE_VALUE = {
  vanguard: 16,
  ironwall: 16,
  swift: 13,
  rally: 15,
  remedy: 14,
  breaker: 15,
  insight: 14,
  bulwark: 13,
  linked: 15,
  volley: 14,
  pursuit: 15,
  aegis: 14,
};

export function arenaBoonCounts(boons = []) {
  return boons.reduce((counts, boonId) => {
    if (ARENA_BOONS[boonId]) {
      counts[boonId] = (counts[boonId] || 0) + 1;
    }
    return counts;
  }, {});
}

export function arenaBuildSnapshot(boons = []) {
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

function activeSynergyIds(counts) {
  return new Set(
    Object.values(ARENA_SYNERGIES)
      .filter((synergy) =>
        synergy.requires.every(
          ([boonId, required]) => (counts[boonId] || 0) >= required,
        ),
      )
      .map((synergy) => synergy.id),
  );
}

export function nextArenaSynergy(currentBoons = []) {
  const counts = arenaBoonCounts(currentBoons);
  const active = activeSynergyIds(counts);
  let best = null;

  for (const synergy of Object.values(ARENA_SYNERGIES)) {
    if (active.has(synergy.id)) continue;

    const requirements = synergy.requires.map(([boonId, required]) => {
      const current = counts[boonId] || 0;
      return {
        boonId,
        current,
        required,
        missing: Math.max(0, required - current),
      };
    });
    const missingTotal = requirements.reduce(
      (total, requirement) => total + requirement.missing,
      0,
    );
    const candidate = { synergy, requirements, missingTotal };
    if (
      !best ||
      candidate.missingTotal < best.missingTotal ||
      (candidate.missingTotal === best.missingTotal &&
        synergy.requires.length > best.synergy.requires.length)
    ) {
      best = candidate;
    }
  }

  return best;
}

export function recommendArenaBoon(
  currentBoons = [],
  offeredBoons = [],
) {
  const validOffers = offeredBoons
    .map((boon) =>
      typeof boon === "string" ? ARENA_BOONS[boon] : boon,
    )
    .filter((boon) => ARENA_BOONS[boon?.id]);
  if (!validOffers.length) return null;

  const counts = arenaBoonCounts(currentBoons);
  const currentSynergies = activeSynergyIds(counts);
  let best = null;

  for (const [offerIndex, boon] of validOffers.entries()) {
    const currentCount = counts[boon.id] || 0;
    const nextCount = currentCount + 1;
    const nextCounts = { ...counts, [boon.id]: nextCount };
    const nextSynergies = activeSynergyIds(nextCounts);
    const completedSynergy = Object.values(ARENA_SYNERGIES).find(
      (synergy) =>
        nextSynergies.has(synergy.id) && !currentSynergies.has(synergy.id),
    );
    const reachesMastery =
      nextCount >= 3 &&
      currentCount < 3 &&
      Boolean(ARENA_BOON_MASTERIES[boon.id]);

    let score = BOON_BASE_VALUE[boon.id] || 12;
    score += Math.min(2, currentCount) * 4;
    if (currentCount > 0 && nextCount < 3) score += 8;
    if (reachesMastery) score += 34;
    if (completedSynergy) score += 42;

    for (const synergy of Object.values(ARENA_SYNERGIES)) {
      if (!completedSynergy && synergy.requires.some(
        ([boonId, required]) =>
          boonId === boon.id && nextCount === required - 1,
      )) {
        score += 10;
      }
    }

    let reason = "开立新军令，补强当前阵势";
    if (completedSynergy) {
      reason = `补全「${completedSynergy.name}」阵法`;
    } else if (reachesMastery) {
      reason = `凝成「${ARENA_BOON_MASTERIES[boon.id].name}」阵眼`;
    } else if (currentCount > 0) {
      reason = `再加一重${boon.name}，逼近阵眼`;
    }

    const candidate = {
      boonId: boon.id,
      reason,
      score,
      offerIndex,
    };
    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.offerIndex < best.offerIndex)
    ) {
      best = candidate;
    }
  }

  return {
    boonId: best.boonId,
    reason: best.reason,
    score: best.score,
  };
}

export function planArenaAutoContinue(run, offeredBoons = []) {
  if (!run || typeof run !== "object") {
    return { action: "stop", reason: "no-run" };
  }
  if (run.defeated) {
    return { action: "stop", reason: "defeated" };
  }
  const eventPending =
    Array.isArray(run.eventOffer) &&
    run.eventOffer.length > 0 &&
    !run.selectedEvent;
  if (eventPending) {
    return { action: "pause", reason: "event" };
  }
  if (!Array.isArray(run.pendingBoons) || !run.pendingBoons.length) {
    return { action: "stop", reason: "no-pending-boons" };
  }
  const recommendation = recommendArenaBoon(
    Array.isArray(run.boons) ? run.boons : [],
    offeredBoons,
  );
  if (
    !recommendation ||
    !run.pendingBoons.includes(recommendation.boonId)
  ) {
    return { action: "stop", reason: "no-recommendation" };
  }
  return {
    action: "continue",
    reason: "recommended",
    boonId: recommendation.boonId,
    advice: recommendation.reason,
  };
}

function heroMvpScore(metrics = {}, alive = false) {
  return (
    (Number(metrics.damage) || 0) +
    (Number(metrics.kills) || 0) * 320 +
    (Number(metrics.ultimates) || 0) * 180 +
    (alive ? 90 : 0)
  );
}

export function evaluateArenaPerformance(
  battle,
  wave,
  bountyCleared = false,
) {
  const heroes = Array.isArray(battle?.heroes) ? battle.heroes : [];
  const rounds = Math.max(1, Number(battle?.round) || 1);
  const survivorCount = heroes.filter((unit) => unit.hp > 0).length;
  const speedTarget = wave % 5 === 0 ? 9 : 6;
  const objectives = [
    {
      id: "unbroken",
      label: "全阵而归",
      met: heroes.length > 0 && survivorCount === heroes.length,
    },
    {
      id: "swift",
      label: `${speedTarget} 回合破阵`,
      met: rounds <= speedTarget,
    },
    {
      id: "bounty",
      label: "悬赏达成",
      met: Boolean(bountyCleared),
    },
    {
      id: "chain",
      label: "星命合击",
      met: (battle?.chainAttacks || 0) > 0,
    },
  ];
  const completed = objectives.filter((objective) => objective.met).length;
  const grade = completed === objectives.length
    ? "S"
    : completed >= 2
      ? "A"
      : "B";
  const bonusScore = grade === "S" ? 100 : grade === "A" ? 55 : 20;
  const mvp = heroes
    .map((unit, index) => ({
      heroId: unit.refId,
      alive: unit.hp > 0,
      index,
      score: heroMvpScore(battle?.heroMetrics?.[unit.refId], unit.hp > 0),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.alive) - Number(left.alive) ||
        left.index - right.index,
    )[0];
  const metrics = battle?.heroMetrics?.[mvp?.heroId] || {};

  return {
    grade,
    bonusScore,
    rounds,
    survivors: survivorCount,
    heroCount: heroes.length,
    mvpHeroId: mvp?.heroId || null,
    mvpDamage: Math.max(0, Math.trunc(Number(metrics.damage) || 0)),
    mvpKills: Math.max(0, Math.trunc(Number(metrics.kills) || 0)),
    mvpUltimates: Math.max(0, Math.trunc(Number(metrics.ultimates) || 0)),
    objectives,
  };
}
