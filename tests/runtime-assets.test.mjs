import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  BATTLE_VFX_RUNTIME_FILES,
  RUNTIME_ASSET_DIRECTORIES,
} from "../vite.config.js";

const root = process.cwd();

test("production build includes the Kenney battle asset set", async () => {
  assert.ok(RUNTIME_ASSET_DIRECTORIES.includes("vfx/kenney"));
  assert.ok(RUNTIME_ASSET_DIRECTORIES.includes("audio"));

  const manifest = JSON.parse(
    await readFile(path.join(root, "assets", "manifest.json"), "utf8"),
  );
  const openSource = manifest.assets.filter((asset) =>
    ["combat_sfx", "open_source_ui_sfx", "open_source_vfx"].includes(asset.type),
  );
  assert.equal(openSource.length, 20);
  assert.ok(
    openSource.every(
      (asset) => asset.author === "Kenney" && asset.license === "CC0-1.0",
    ),
  );
  const vfxFiles = manifest.assets
    .filter((asset) => asset.type === "open_source_vfx")
    .map((asset) => path.basename(asset.file));
  assert.deepEqual(vfxFiles.sort(), [...BATTLE_VFX_RUNTIME_FILES].sort());
});

test("legacy generated VFX are not part of the runtime asset contract", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "assets", "manifest.json"), "utf8"),
  );
  assert.equal(
    manifest.assets.some((asset) => String(asset.type).startsWith("skill_vfx")),
    false,
  );
});
