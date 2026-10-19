#!/usr/bin/env node
// Regenerates Godot gameplay JSON from the shared campaign source.
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";

const data = await import("../src/data.js");
const assetPath = (value) => value?.replace(/^\/?assets\//, "res://assets/");

const pickHero = (hero) => ({
  id: hero.id,
  name: hero.name,
  nickname: hero.nickname,
  star: hero.star,
  role: hero.role,
  path: hero.path,
  preferred_row: hero.preferredRow,
  cutout: assetPath(hero.cutout),
  keyart: assetPath(hero.keyart),
  palette: hero.palette,
  base: hero.base,
  passive: hero.passive,
  skills: hero.skills,
  bio: hero.bio,
});

const pickChapter = (chapter) => ({
  id: chapter.id,
  index: chapter.index,
  label: chapter.label,
  title: chapter.title,
  location: chapter.location,
  bg: assetPath(chapter.bg),
  summary: chapter.summary,
  objective: chapter.objective,
  par_rounds: chapter.parRounds,
  intro: chapter.intro,
  choice: chapter.choice,
  battle: {
    enemies: chapter.battle.enemies,
    reward: chapter.battle.reward,
    recruit: chapter.battle.recruit || [],
    boss: chapter.battle.boss || null,
  },
  outro: chapter.outro,
});

const payload = {
  version: 1,
  rows: data.ROWS,
  paths: Object.fromEntries(
    Object.entries(data.PATHS).map(([id, path]) => [
      id,
      { ...path, icon: assetPath(path.icon) },
    ]),
  ),
  difficulties: data.DIFFICULTIES,
  hero_order: data.HERO_ORDER,
  heroes: Object.fromEntries(
    Object.entries(data.HEROES).map(([id, hero]) => [id, pickHero(hero)]),
  ),
  chapters: data.CHAPTERS.map(pickChapter),
  enemies: Object.fromEntries(
    Object.entries(data.ENEMIES).map(([id, enemy]) => {
      const copy = structuredClone(enemy);
      for (const key of ["sprite", "keyart"]) {
        if (typeof copy[key] === "string") copy[key] = assetPath(copy[key]);
      }
      return [id, copy];
    }),
  ),
  camp_buildings: data.CAMP_BUILDINGS,
};

await writeFile(
  new URL("../godot/data/game.json", import.meta.url),
  JSON.stringify(payload, null, 2) + "\n",
);

const assetsDir = new URL("../assets/", import.meta.url);
const godotAssetsDir = new URL("../godot/assets/", import.meta.url);
await mkdir(godotAssetsDir, { recursive: true });
const bundledAssets = ["characters", "enemies", "environments", "audio", "video"];
for (const entry of await readdir(godotAssetsDir)) {
  if (!bundledAssets.includes(entry)) {
    await rm(new URL(entry + "/", godotAssetsDir), { recursive: true, force: true });
  }
}
for (const folder of bundledAssets) {
  await rm(new URL(folder + "/", godotAssetsDir), { recursive: true, force: true });
}
const skipFiles = /^(?:turnaround\.png|.*\.mp4)$/;
for (const folder of bundledAssets) {
  await cp(new URL(folder + "/", assetsDir), new URL(folder + "/", godotAssetsDir), {
    recursive: true,
    filter: (source) => !skipFiles.test(source.split("/").at(-1)),
    force: true,
  });
}
