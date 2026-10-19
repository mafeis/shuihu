import { ARENA_ENCOUNTERS } from "./data.js";

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function arenaEncountersForWave(wave = 1) {
  const safeWave = Math.max(1, Math.trunc(Number(wave) || 1));
  return Object.values(ARENA_ENCOUNTERS).filter(
    (encounter) => encounter.minWave <= safeWave,
  );
}

export function pickArenaEncounter({
  mode = "endless",
  seed = 0,
  wave = 1,
  previousId = "",
} = {}) {
  const candidates = arenaEncountersForWave(wave);
  if (!candidates.length) return null;
  const remaining =
    candidates.length > 1
      ? candidates.filter((encounter) => encounter.id !== previousId)
      : candidates;
  const pool = remaining.length ? remaining : candidates;
  const hash = hashString(`${mode}:${seed}:${Math.max(1, wave)}`);
  return pool[hash % pool.length];
}

export function resolveArenaEncounter(
  run,
  wave = run?.wave || 1,
  previousId = run?.encounterId || "",
) {
  if (!run) return null;
  return pickArenaEncounter({
    mode: run.mode || "endless",
    seed: run.seed ?? run.weekKey ?? 0,
    wave,
    previousId,
  });
}

