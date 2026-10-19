#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const groups = [
  {
    file: "release/SHA256SUMS-macOS.txt",
    artifacts: [
      "release/XingmingShuihu-1.0.0-mac-arm64.dmg",
      "release/XingmingShuihu-1.0.0-mac-arm64.zip",
    ],
  },
  {
    file: "release/SHA256SUMS-Windows.txt",
    artifacts: [
      "release/XingmingShuihu-1.0.0-win-x64.exe",
      "release/XingmingShuihu-1.0.0-win-x64.zip",
      "release/XingmingShuihu-1.0.0-win-arm64.exe",
      "release/XingmingShuihu-1.0.0-win-arm64.zip",
    ],
  },
];

for (const group of groups) {
  const lines = [];
  for (const artifact of group.artifacts) {
    const contents = await readFile(artifact);
    const hash = createHash("sha256").update(contents).digest("hex");
    lines.push(`${hash}  ${artifact}`);
  }
  await writeFile(group.file, `${lines.join("\n")}\n`);
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
