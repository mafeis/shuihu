#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function positiveInteger(name, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function windowsPath(value) {
  return String(value).replaceAll("/", "\\");
}

let appId;
let windowsDepot;
let macosDepot;
try {
  appId = positiveInteger(
    "Steam AppID",
    argument("--app-id") || process.env.STEAM_APP_ID,
  );
  windowsDepot = positiveInteger(
    "Windows DepotID",
    argument("--windows-depot") || process.env.STEAM_WINDOWS_DEPOT_ID,
  );
  macosDepot = positiveInteger(
    "macOS DepotID",
    argument("--macos-depot") || process.env.STEAM_MACOS_DEPOT_ID,
  );
} catch (error) {
  console.error(error.message);
  console.error(
    "Usage: npm run steam:configure -- --app-id 123456 --windows-depot 123457 --macos-depot 123458",
  );
  process.exit(1);
}

const buildOutput = argument("--build-output") || "../steam_build_output";
const windowsContent = argument("--windows-content") || "../release/win-unpacked";
const macosContent = argument("--macos-content") || "../release/mac-arm64";
const dryRun = process.argv.includes("--dry-run");

const appBuild = `"AppBuild"
{
  "AppID" "${appId}"
  "Desc" "Xingming Shuihu ${appId}"
  "BuildOutput" "${windowsPath(buildOutput)}"
  "Preview" "0"
  "Local" ""
  "SetLive" ""
  "Depots"
  {
    "${windowsDepot}" "depot_build_windows.vdf"
    "${macosDepot}" "depot_build_macos.vdf"
  }
}
`;

const windowsDepotConfig = `"DepotBuildConfig"
{
  "DepotID" "${windowsDepot}"
  "ContentRoot" "${windowsPath(windowsContent)}"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "*.pdb"
  "FileExclusion" "*.log"
}
`;

const macosDepotConfig = `"DepotBuildConfig"
{
  "DepotID" "${macosDepot}"
  "ContentRoot" "${macosContent}"
  "FileMapping"
  {
    "LocalPath" "星命水浒.app/*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "*.log"
}
`;

if (!dryRun) {
  writeFileSync(path.join(root, "steam", "steam_appid.txt"), `${appId}\n`, "utf8");
  writeFileSync(path.join(root, "steam", "app_build.vdf"), appBuild, "utf8");
  writeFileSync(
    path.join(root, "steam", "depot_build_windows.vdf"),
    windowsDepotConfig,
    "utf8",
  );
  writeFileSync(
    path.join(root, "steam", "depot_build_macos.vdf"),
    macosDepotConfig,
    "utf8",
  );
}

console.log(
  JSON.stringify(
    {
      status: dryRun ? "dry-run" : "configured",
      appId,
      windowsDepot,
      macosDepot,
      files: [
        "steam/steam_appid.txt",
        "steam/app_build.vdf",
        "steam/depot_build_windows.vdf",
        "steam/depot_build_macos.vdf",
      ],
    },
    null,
    2,
  ),
);
