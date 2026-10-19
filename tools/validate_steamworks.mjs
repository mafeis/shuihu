#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ACHIEVEMENTS } from "../src/data.js";

const root = process.cwd();
const failures = [];
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const config = JSON.parse(
  readFileSync(path.join(root, "steam", "steamworks.json"), "utf8"),
);
const inputManifest = JSON.parse(
  readFileSync(path.join(root, "steam", "input_manifest.json"), "utf8"),
);
const achievementMetadataPath = path.join(
  root,
  "steam",
  config.achievementMetadataFile || "",
);
const achievementMetadata = existsSync(achievementMetadataPath)
  ? JSON.parse(readFileSync(achievementMetadataPath, "utf8"))
  : null;
const steamworksPackage = JSON.parse(
  readFileSync(
    path.join(root, "node_modules", "steamworks.js", "package.json"),
    "utf8",
  ),
);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function pngInfo(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

assert(config.schemaVersion === 1, "steamworks schemaVersion must be 1");
assert(
  path.basename(config.cloudSaveFile) === config.cloudSaveFile,
  "cloudSaveFile must be a safe basename",
);
assert(
  packageJson.dependencies?.["steamworks.js"],
  "steamworks.js must be a production dependency",
);
assert(
  packageJson.build?.asarUnpack?.includes("node_modules/steamworks.js/dist/**/*"),
  "steamworks native binaries must be unpacked from asar",
);
assert(steamworksPackage.version === "0.4.0", "steamworks.js version must be 0.4.0");

const achievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
const configuredAchievementIds = Object.keys(config.achievements || {});
const apiNames = Object.values(config.achievements || {});
assert(
  configuredAchievementIds.length === achievementIds.size,
  "every achievement must have a Steam API mapping",
);
for (const id of achievementIds) {
  assert(configuredAchievementIds.includes(id), `missing Steam achievement mapping: ${id}`);
}
for (const id of configuredAchievementIds) {
  assert(achievementIds.has(id), `unknown Steam achievement mapping: ${id}`);
}
assert(new Set(apiNames).size === apiNames.length, "Steam achievement API names must be unique");
for (const apiName of apiNames) {
  assert(/^[A-Z0-9_]{3,64}$/.test(apiName), `invalid Steam achievement API name: ${apiName}`);
}

assert(
  config.achievementMetadataFile === "achievement_metadata.json",
  "achievement metadata file must be steam/achievement_metadata.json",
);
assert(
  config.achievementIconDirectory === "store/steam_achievements",
  "achievement icon directory must be store/steam_achievements",
);
assert(Boolean(achievementMetadata), "missing Steam achievement metadata");
if (achievementMetadata) {
  assert(
    achievementMetadata.schemaVersion === 1,
    "Steam achievement metadata schemaVersion must be 1",
  );
  assert(
    achievementMetadata.iconSize === 64,
    "Steam achievement icons must render at 64x64",
  );
  assert(
    achievementMetadata.iconDirectory === config.achievementIconDirectory,
    "achievement metadata icon directory does not match steamworks.json",
  );
  assert(
    Array.isArray(achievementMetadata.steamLocales) &&
      achievementMetadata.steamLocales.includes("schinese") &&
      achievementMetadata.steamLocales.includes("english"),
    "achievement metadata must include schinese and english",
  );
  const metadataAchievements = Array.isArray(achievementMetadata.achievements)
    ? achievementMetadata.achievements
    : [];
  assert(
    metadataAchievements.length === achievementIds.size,
    "achievement metadata must describe every achievement",
  );
  const metadataIds = metadataAchievements.map((achievement) => achievement.id);
  assert(
    new Set(metadataIds).size === metadataIds.length,
    "achievement metadata IDs must be unique",
  );
  for (const achievement of ACHIEVEMENTS) {
    const record = metadataAchievements.find(
      (candidate) => candidate.id === achievement.id,
    );
    assert(Boolean(record), `missing achievement metadata: ${achievement.id}`);
    if (!record) continue;
    assert(
      record.apiName === config.achievements[achievement.id],
      `achievement API name mismatch: ${achievement.id}`,
    );
    assert(record.hidden === false, `achievement should not be hidden: ${achievement.id}`);
    for (const locale of ["schinese", "english"]) {
      const copy = record.locales?.[locale];
      assert(
        typeof copy?.name === "string" && copy.name.trim().length > 0,
        `missing ${locale} achievement name: ${achievement.id}`,
      );
      assert(
        typeof copy?.description === "string" &&
          copy.description.trim().length > 0,
        `missing ${locale} achievement description: ${achievement.id}`,
      );
    }
    for (const iconField of ["icon", "iconGray"]) {
      const iconName = record[iconField];
      assert(
        typeof iconName === "string" &&
          path.basename(iconName) === iconName &&
          iconName.endsWith(".png"),
        `invalid achievement icon filename: ${achievement.id}.${iconField}`,
      );
      if (typeof iconName !== "string" || path.basename(iconName) !== iconName) {
        continue;
      }
      const iconPath = path.join(
        root,
        config.achievementIconDirectory,
        iconName,
      );
      assert(existsSync(iconPath), `missing achievement icon: ${iconName}`);
      if (!existsSync(iconPath)) continue;
      const info = pngInfo(readFileSync(iconPath));
      assert(Boolean(info), `achievement icon is not a PNG: ${iconName}`);
      assert(
        info?.width === 64 && info?.height === 64,
        `achievement icon must be 64x64: ${iconName}`,
      );
    }
  }
  assert(
    existsSync(
      path.join(root, config.achievementIconDirectory, "contact_sheet.png"),
    ),
    "missing Steam achievement contact sheet",
  );
}

const requiredStats = [
  "battlesWon",
  "enemiesDefeated",
  "heroesRecruited",
  "arenaBestWave",
  "chapterMedals",
  "newGamePlus",
];
for (const stat of requiredStats) {
  assert(config.stats?.[stat], `missing Steam stat mapping: ${stat}`);
}
assert(
  new Set(Object.values(config.stats || {})).size === Object.keys(config.stats || {}).length,
  "Steam stat API names must be unique",
);
assert(inputManifest.schemaVersion === 1, "Steam Input manifest schemaVersion must be 1");
assert(
  inputManifest.layout === "standard-gamepad",
  "Steam Input manifest must use the standard gamepad layout",
);
const inputActionNames = (inputManifest.actions || []).map((action) => action.name);
assert(inputActionNames.length >= 12, "Steam Input manifest is missing required actions");
assert(
  new Set(inputActionNames).size === inputActionNames.length,
  "Steam Input action names must be unique",
);
for (const action of inputManifest.actions || []) {
  assert(
    Number.isInteger(action.buttonIndex) && action.buttonIndex >= 0,
    `invalid Steam Input button index: ${action.name}`,
  );
  assert(Boolean(action.binding), `missing Steam Input binding: ${action.name}`);
}

for (const binary of [
  "dist/osx/steamworksjs.darwin-arm64.node",
  "dist/osx/steamworksjs.darwin-x64.node",
  "dist/win64/steamworksjs.win32-x64-msvc.node",
]) {
  assert(
    existsSync(path.join(root, "node_modules", "steamworks.js", binary)),
    `missing Steamworks native binary: ${binary}`,
  );
}

const appIdPath = path.join(root, "steam", "steam_appid.txt");
let configuredAppId = null;
if (existsSync(appIdPath)) {
  configuredAppId = Number(readFileSync(appIdPath, "utf8").trim());
  assert(
    Number.isInteger(configuredAppId) && configuredAppId > 0,
    "steam/steam_appid.txt must contain a positive AppID",
  );
}

const result = {
  status: failures.length ? "failed" : "passed",
  steamworksVersion: steamworksPackage.version,
  achievements: configuredAchievementIds.length,
  achievementIcons: achievementMetadata?.achievements?.length
    ? achievementMetadata.achievements.length * 2
    : 0,
  stats: Object.keys(config.stats || {}).length,
  inputActions: inputActionNames.length,
  nativeTargets: 3,
  appId: configuredAppId,
  appIdConfigured: Boolean(configuredAppId),
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
