import { ROSTER_BASE } from "./rosterBase.js";
import { ROSTER_SUPPLEMENTS } from "./rosterSupplements.js";

const supplementByRank = new Map(
  ROSTER_SUPPLEMENTS.map((entry) => [entry[0], entry]),
);

export const FINAL_ROSTER = ROSTER_BASE.map(
  (entry) => supplementByRank.get(entry[0]) || [...entry],
);
