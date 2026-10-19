#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const characterRoot = path.join(root, "assets", "characters");
let generated = 0;
let current = 0;

for (const entry of readdirSync(characterRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const source = path.join(characterRoot, entry.name, "cutout.png");
  const target = path.join(characterRoot, entry.name, "thumb.webp");
  if (!existsSync(source)) continue;
  if (
    existsSync(target) &&
    statSync(target).mtimeMs >= statSync(source).mtimeMs
  ) {
    current += 1;
    continue;
  }
  const result = spawnSync(
    "cwebp",
    [
      "-quiet",
      "-q",
      "84",
      "-alpha_q",
      "100",
      "-m",
      "6",
      "-resize",
      "320",
      "0",
      source,
      "-o",
      target,
    ],
    { stdio: "inherit" },
  );
  if (result.error || result.status !== 0) {
    throw result.error || new Error(`cwebp failed for ${entry.name}`);
  }
  generated += 1;
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      generated,
      current,
      total: generated + current,
    },
    null,
    2,
  ),
);
