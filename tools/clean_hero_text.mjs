#!/usr/bin/env node

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { HERO_ORDER } from "../src/data.js";

const root = process.cwd();
const rawRoot = path.join(root, "assets", "raw", "heroes108");
const characterRoot = path.join(root, "assets", "characters");
const workflowRoot = path.join(root, "workflows", "api");
const comfyUrl = process.env.COMFY_URL || "http://127.0.0.1:8188";

const flaggedHeroes = new Set(
  (process.argv.find((value) => value.startsWith("--heroes="))?.split("=")[1] ||
    "")
    .split(",")
    .map((heroId) => heroId.trim())
    .filter(Boolean),
);
const cleanAll = process.argv.includes("--all");
const rerun = process.argv.includes("--rerun");

function configuredHeroes() {
  const value = process.env.HERO_TEXT_CLEANUP_HEROES || "";
  return new Set(value.split(",").map((heroId) => heroId.trim()).filter(Boolean));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(command, args, {
      cwd: root,
      env: { ...process.env, COMFY_URL: comfyUrl },
      stdio: "inherit",
    });
    processHandle.on("error", reject);
    processHandle.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

function cleanArgs(heroId) {
  return [
    "tools/comfy_asset_pipeline.py",
    "--model",
    "qwen-edit",
    "--input-image",
    `assets/characters/${heroId}/keyart.png`,
    "--prompt",
    [
      "Use case: precise-object-edit. Using <image1> strictly as the edit target.",
      "Remove every piece of readable Chinese calligraphy, pseudo-writing, lettering, captions and painted characters from background flags, banners, plaques, signs and hanging cloth.",
      "Also remove ink symbols, pseudo-glyphs, seals and decorative painted marks on those surfaces.",
      "Replace the removed text only with clean fabric, wood or plaster matching the surrounding surface, preserving all folds, seams, weathering and lighting.",
      "Keep the featured person, face, expression, armor, weapon, hands, pose, scale and composition exactly unchanged.",
      "Keep all architecture, boats, soldiers and scenery exactly unchanged.",
      "Do not add new lettering, symbols, seals, logos, watermarks, extra people or new objects.",
    ].join(" "),
    "--negative",
    "background writing, calligraphy, ink glyphs, characters, letters, captions, pseudo-writing, symbols, logos, watermark, extra text, changed face, changed pose, changed weapon, changed armor",
    "--width",
    "832",
    "--height",
    "1216",
    "--steps",
    "25",
    "--seed",
    String(620000 + HERO_ORDER.indexOf(heroId) * 101),
    "--prefix",
    `shuihu_${heroId}_keyart_v2_clean`,
    "--output-dir",
    rawRoot,
    "--workflow-out",
    path.join(workflowRoot, `qwen_${heroId}_keyart_v2_clean.json`),
    "--timeout",
    "2400",
    "--poll",
    "3",
  ];
}

async function cleanHero(heroId) {
  const source = path.join(rawRoot, `shuihu_${heroId}_keyart_v2_clean_00001_.png`);
  const target = path.join(characterRoot, heroId, "keyart.png");
  const prefix = `shuihu_${heroId}_keyart_v2_clean`;
  const serial = (filename) =>
    Number(filename.match(/_(\d+)\.png$/)?.[1] || 0);
  const candidates = () =>
    readdirSync(rawRoot)
      .filter(
        (filename) =>
          filename.startsWith(prefix) && filename.endsWith(".png"),
      )
      .sort((left, right) => serial(left) - serial(right));
  if (rerun || !existsSync(source)) await run("python3", cleanArgs(heroId));
  if (!existsSync(source)) {
    const latest = candidates().at(-1);
    if (!latest) {
      throw new Error(`Text cleanup returned no image for ${heroId}`);
    }
    copyFileSync(path.join(rawRoot, latest), source);
  }
  copyFileSync(source, target);
  console.log(`[cleaned] ${heroId}`);
}

const selectedHeroes = cleanAll ? new Set(HERO_ORDER) : configuredHeroes();
const heroes = HERO_ORDER.filter((heroId) => {
  if (flaggedHeroes.size) return flaggedHeroes.has(heroId);
  return selectedHeroes.size && selectedHeroes.has(heroId);
});
if (!heroes.length) {
  console.log(
    "No heroes selected. Pass --heroes=id,id, or --all, or set " +
      "HERO_TEXT_CLEANUP_HEROES=id,id.",
  );
}
for (const heroId of heroes) {
  await cleanHero(heroId);
}
