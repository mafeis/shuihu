#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const artifact = (platform, extension) =>
  `release/XingmingShuihu-${version}-${platform}.${extension}`;

const groups = [
  {
    file: "release/SHA256SUMS-macOS.txt",
    artifacts: [
      artifact("mac-arm64", "dmg"),
      artifact("mac-arm64", "zip"),
    ],
  },
  {
    file: "release/SHA256SUMS-Windows.txt",
    artifacts: [
      artifact("win-x64", "exe"),
      artifact("win-x64", "zip"),
      artifact("win-arm64", "exe"),
      artifact("win-arm64", "zip"),
    ],
  },
];

for (const group of groups) {
  const lines = [];
  for (const artifactPath of group.artifacts) {
    const contents = await readFile(path.join(root, artifactPath));
    const hash = createHash("sha256").update(contents).digest("hex");
    lines.push(`${hash}  ${artifactPath}`);
  }
  await writeFile(path.join(root, group.file), `${lines.join("\n")}\n`);
}

console.log(
  JSON.stringify(
    {
      status: "generated",
      files: groups.map((group) => group.file),
      entries: groups.reduce(
        (count, group) => count + group.artifacts.length,
        0,
      ),
    },
    null,
    2,
  ),
);
