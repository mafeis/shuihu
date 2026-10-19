#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, "assets", "manifest.json"), "utf8"),
);
const pointers = [];

for (const asset of manifest.assets) {
  const contents = readFileSync(path.join(root, asset.file));
  if (contents.subarray(0, 64).toString().startsWith("version https://git-lfs.github.com/spec/v1")) {
    pointers.push(asset.file);
  }
}

if (pointers.length) {
  console.error(
    `Detected ${pointers.length} Git LFS pointer files instead of runtime assets.`,
  );
  console.error(
    "Install Git LFS before cloning, then run `git lfs install && git lfs pull`.",
  );
  console.error(pointers.slice(0, 10).map((file) => `- ${file}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`All ${manifest.assets.length} runtime assets are present.`);
}
