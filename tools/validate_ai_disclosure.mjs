#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const disclosure = JSON.parse(
  readFileSync(path.join(root, "store", "steam_ai_disclosure.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(path.join(root, "assets", "manifest.json"), "utf8"),
);
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

assert(disclosure.schemaVersion === 1, "AI disclosure schemaVersion must be 1");
assert(
  disclosure.runtimeGeneration === false,
  "runtime generation must remain disabled",
);
assert(
  disclosure.generatedContentPresent === true,
  "pre-generated AI content must be disclosed",
);
assert(
  disclosure.playerDataUsedForTraining === false,
  "player data must not be used for model training",
);
assert(
  disclosure.runtimeBoundary?.networkRequired === false,
  "runtime must not require a generation network",
);
assert(
  disclosure.runtimeBoundary?.comfyUiBundled === false,
  "ComfyUI must not be bundled into the game",
);
assert(
  disclosure.runtimeBoundary?.modelWeightsBundled === false,
  "generation model weights must not be bundled into the game",
);
assert(
  disclosure.runtimeBoundary?.generationEndpointsInRuntime === false,
  "runtime must not contain generation endpoints",
);

const categories = new Map(
  (disclosure.categories || []).map((category) => [category.id, category]),
);
for (const category of ["image", "video", "audio"]) {
  assert(categories.has(category), `missing AI disclosure category: ${category}`);
  assert(
    categories.get(category)?.assetCount > 0,
    `AI disclosure category has no assets: ${category}`,
  );
  assert(
    Array.isArray(categories.get(category)?.toolchain) &&
      categories.get(category).toolchain.length > 0,
    `AI disclosure category has no toolchain: ${category}`,
  );
}

const manifestPipelines = Object.values(manifest.pipeline || {}).join(" ");
for (const expectedTool of [
  "ComfyUI",
  "Qwen Image 2.1",
  "MiniMax H3",
  "YuE2 3B",
]) {
  assert(
    manifestPipelines.includes(expectedTool),
    `asset manifest does not record pipeline tool: ${expectedTool}`,
  );
}

const runtimeFiles = [
  path.join(root, "index.html"),
  ...walkFiles(path.join(root, "src")),
  ...walkFiles(path.join(root, "electron")),
];
const forbiddenPatterns = [
  [/100\.122\.17\.21/, "ComfyUI development host"],
  [/\bCOMFY_URL\b/, "ComfyUI endpoint environment variable"],
  [/YuE2GenerateMusic/, "YuE2 generation node"],
  [/MiniMaxH3ImageToVideo/, "MiniMax generation node"],
  [/TextEncodeQwenImage21/, "Qwen generation node"],
];
for (const file of runtimeFiles) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const [pattern, label] of forbiddenPatterns) {
    assert(
      !pattern.test(source),
      `runtime file contains ${label}: ${path.relative(root, file)}`,
    );
  }
}

const surveyPath = path.join(root, "docs", "steam_content_survey.md");
assert(existsSync(surveyPath), "missing Steam content survey worksheet");

console.log(
  JSON.stringify(
    {
      status: failures.length ? "failed" : "passed",
      disclosureVersion: disclosure.disclosureVersion,
      runtimeGeneration: disclosure.runtimeGeneration,
      generatedCategories: categories.size,
      disclosedAssets: (disclosure.categories || []).reduce(
        (sum, category) => sum + Number(category.assetCount || 0),
        0,
      ),
      runtimeFilesChecked: runtimeFiles.length,
      externalReviewComplete:
        disclosure.externalReview?.modelCommercialTermsVerified === true &&
        disclosure.externalReview?.finalSteamSurveySubmitted === true,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
