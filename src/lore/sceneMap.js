import {
  WATER_MARGIN_SCENE_LOCATIONS,
  waterMarginSceneAsset,
} from "./waterMarginChronicle.js";

export const STORY_SCENE_IDS = [
  "longhu_mountain",
  "shijia_village",
  "weizhou_pavilion",
  "huangni_ridge",
  "yuncheng_courtyard",
  "yiling_mountain",
  "gaotang_temple",
  "mangdang_shrine",
  "zengtou_fort",
  "dongchang_wall",
  "youzhou_plain",
  "hebei_fortress",
  "nanfeng_river",
  "yongjin_gate",
  "liuhe_temple",
];

export const STORY_SCENE_ASSETS = Object.fromEntries(
  STORY_SCENE_IDS.map((sceneId) => [
    sceneId,
    `/assets/environments/${sceneId}.png`,
  ]),
);

export function storySceneAsset(sceneId) {
  return waterMarginSceneAsset(sceneId);
}

export function storySceneLocation(sceneId) {
  return WATER_MARGIN_SCENE_LOCATIONS[sceneId] || "梁山泊";
}
