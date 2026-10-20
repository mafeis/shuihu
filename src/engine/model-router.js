import { HERO_QUESTS } from "../data.js";
import { endingCinematicProfile } from "../cinematic.js";
import { buildArenaModel, buildArenaRewardModel } from "./models/arena.js";
import {
  buildCodexModel,
  buildQuestsModel,
} from "./models/archive.js";
import {
  buildCampModel,
  buildMapModel,
} from "./models/campaign.js";
import {
  buildEquipmentModel,
  buildFormationModel,
  buildRosterModel,
} from "./models/roster.js";
import { buildSettingsModel } from "./models/settings.js";
import {
  buildEndingModel,
  buildFinalChoiceModel,
  buildRewardModel,
  buildStoryModel,
  buildTitleModel,
} from "./models/title-story.js";

const BUILDERS = Object.freeze({
  title: buildTitleModel,
  map: buildMapModel,
  camp: buildCampModel,
  arena: buildArenaModel,
  "arena-reward": buildArenaRewardModel,
  roster: buildRosterModel,
  formation: buildFormationModel,
  equipment: buildEquipmentModel,
  quests: buildQuestsModel,
  codex: buildCodexModel,
  settings: buildSettingsModel,
  story: buildStoryModel,
  reward: buildRewardModel,
  "final-choice": buildFinalChoiceModel,
  ending: buildEndingModel,
});

export function createEngineModel(context) {
  if (!context || context.screen === "battle") return null;
  const builder = BUILDERS[context.screen];
  if (!builder) return buildTitleModel(context);
  const enriched = {
    ...context,
    heroQuests: HERO_QUESTS,
    endingBackground:
      context.screen === "ending" && context.state
        ? endingCinematicProfile(context.state.ending, context.state).background
        : null,
  };
  return builder(enriched);
}
