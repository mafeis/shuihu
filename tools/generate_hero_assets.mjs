#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";

import { HEROES, HERO_ORDER } from "../src/data.js";

const root = process.cwd();
const rawRoot = path.join(root, "assets", "raw", "heroes108");
const characterRoot = path.join(root, "assets", "characters");
const workflowRoot = path.join(root, "workflows", "api");
const comfyUrl = process.env.COMFY_URL || "http://127.0.0.1:8188";

function parseArgs() {
  const args = {
    concurrency: 2,
    only: "all",
    heroes: null,
  };
  for (const value of process.argv.slice(2)) {
    if (value.startsWith("--concurrency=")) {
      args.concurrency = Math.max(
        1,
        Math.min(4, Number(value.split("=")[1]) || 1),
      );
    } else if (value.startsWith("--only=")) {
      args.only = value.split("=")[1];
    } else if (value.startsWith("--heroes=")) {
      args.heroes = new Set(value.split("=")[1].split(",").filter(Boolean));
    }
  }
  return args;
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: { ...process.env, COMFY_URL: comfyUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(
          new Error(
            `${command} ${commandArgs.join(" ")} failed (${code})\n${output}`,
          ),
        );
      }
    });
  });
}

async function runPool(tasks, concurrency) {
  let cursor = 0;
  let completed = 0;
  const failures = [];
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      try {
        await task();
        completed += 1;
        console.log(`[${completed}/${tasks.length}] ${task.label}`);
      } catch (error) {
        failures.push({ label: task.label, error });
        console.error(`[failed] ${task.label}\n${error.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker),
  );
  if (failures.length) {
    throw new Error(
      `Hero asset generation failed for ${failures.length} tasks:\n${failures
        .map((failure) => `- ${failure.label}`)
        .join("\n")}`,
    );
  }
}

function heroPrompt(hero) {
  const skills = hero.skills
    .slice(0, 3)
    .map((skill) => `${skill.name}: ${skill.desc}`)
    .join("; ");
  return [
    "Use case: stylized-concept",
    "Asset type: vertical game roster character key art",
    `Primary request: Northern Song dynasty Chinese historical full-body portrait of ${hero.name}, known as ${hero.nickname}. ${hero.role}.`,
    `Identity and combat: ${hero.identity || hero.bio.slice(0, 180)} Signature techniques: ${skills}.`,
    `Palette: muted ${hero.palette} accents with historically grounded Song dynasty fabrics and lamellar armor.`,
    "Scene/backdrop: a restrained military camp or river town at dawn, atmospheric but unobtrusive.",
    "Style/medium: cinematic painterly realism, premium single-character RPG key art, historically plausible armor and weapons.",
    "Composition/framing: single adult figure, full body from head to boots, clear silhouette, centered with generous margins, readable at thumbnail size.",
    "Lighting/mood: dramatic warm rim light and cool shadow, heroic but grounded.",
    "Constraints: exactly one person; no companions; no pseudo-Chinese glyphs; no calligraphy; no banners with writing; no captions; no seals; no logos; no watermarks.",
    "Avoid: modern objects, fantasy glowing armor, extra limbs, cropped feet, text of any kind.",
  ].join("\n");
}

function turnaroundPrompt(hero) {
  return [
    "Use case: stylized-concept",
    "Asset type: game character turnaround model sheet",
    `Primary request: production turnaround of ${hero.name}, known as ${hero.nickname}, from the Northern Song dynasty. ${hero.role}.`,
    "Views: exactly three full-body views in one horizontal image, front view, side profile, and back view, same costume and same proportions in each.",
    "Style/medium: cinematic painterly realism matching premium Chinese historical RPG character art.",
    "Set: neutral warm grey studio backdrop with soft even lighting and a subtle ground shadow.",
    "Costume: historically grounded Song dynasty layered martial clothing, armor, belt, boots, and signature weapon appropriate to the character.",
    "Composition: three separated standing figures, complete head and feet, no overlap, generous margins, horizontal character sheet.",
    "Constraints: no text, no labels, no calligraphy, no numbers, no grids, no logos, no watermarks, no extra people.",
    "Avoid: cropped body parts, inconsistent costumes, changing faces, dramatic perspective, scenery.",
  ].join("\n");
}

function expectedPaths(heroId) {
  return {
    keyartRaw: path.join(
      rawRoot,
      `shuihu_${heroId}_keyart_qwen_v1_00001_.png`,
    ),
    turnRaw: path.join(
      rawRoot,
      `shuihu_${heroId}_turnaround_qwen_v2_00001_.png`,
    ),
    keyartWorkflow: path.join(
      workflowRoot,
      `qwen_${heroId}_keyart_v1.json`,
    ),
    turnWorkflow: path.join(
      workflowRoot,
      `qwen_${heroId}_turnaround_v2.json`,
    ),
    keyartFinal: path.join(characterRoot, heroId, "keyart.png"),
    turnFinal: path.join(characterRoot, heroId, "turnaround.png"),
    cutoutFinal: path.join(characterRoot, heroId, "cutout.png"),
    thumbFinal: path.join(characterRoot, heroId, "thumb.webp"),
  };
}

async function generateKeyart(hero, paths) {
  mkdirSync(rawRoot, { recursive: true });
  mkdirSync(path.dirname(paths.keyartFinal), { recursive: true });
  if (!existsSync(paths.keyartRaw)) {
    await run("python3", [
      "tools/comfy_asset_pipeline.py",
      "--model",
      "qwen",
      "--prompt",
      heroPrompt(hero),
      "--width",
      "832",
      "--height",
      "1216",
      "--steps",
      "25",
      "--seed",
      String(4100000 + (hero.rank || 0) * 101),
      "--prefix",
      `shuihu_${hero.id}_keyart_qwen_v1`,
      "--output-dir",
      rawRoot,
      "--workflow-out",
      paths.keyartWorkflow,
      "--timeout",
      "2400",
      "--poll",
      "3",
    ]);
  }
  copyFileSync(paths.keyartRaw, paths.keyartFinal);
}

async function buildCutout(hero, paths) {
  const visionRaw = path.join(
    rawRoot,
    `shuihu_${hero.id}_vision_cutout_v1.png`,
  );
  if (!existsSync(paths.keyartRaw)) {
    throw new Error(`Cannot build cutout without ${paths.keyartRaw}`);
  }
  await run("swift", [
    "tools/vision_cutout.swift",
    paths.keyartRaw,
    visionRaw,
  ]);
  await run("python3", [
    "tools/fit_sprite_canvas.py",
    visionRaw,
    paths.cutoutFinal,
    "--width",
    "896",
    "--height",
    "1024",
    "--scale",
    "0.96",
    "--bottom-margin",
    "12",
  ]);
  await run("cwebp", [
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
    paths.cutoutFinal,
    "-o",
    paths.thumbFinal,
  ]);
}

async function buildTurnaroundFromKeyart(hero, paths) {
  if (!existsSync(paths.keyartFinal)) {
    throw new Error(`Cannot build turnaround without ${paths.keyartFinal}`);
  }
  await run("python3", [
    "tools/comfy_asset_pipeline.py",
    "--model",
    "qwen-edit",
    "--input-image",
    paths.keyartFinal,
    "--prompt",
    turnaroundPrompt(hero),
    "--negative",
    "text, letters, calligraphy, labels, numbers, grids, logos, watermark, extra people, cropped feet, different costume",
    "--width",
    "1536",
    "--height",
    "1024",
    "--steps",
    "25",
    "--seed",
    String(4200000 + (hero.rank || 0) * 103),
    "--prefix",
    `shuihu_${hero.id}_turnaround_qwen_v2`,
    "--output-dir",
    rawRoot,
    "--workflow-out",
    paths.turnWorkflow,
    "--timeout",
    "2400",
    "--poll",
    "3",
  ]);
  copyFileSync(paths.turnRaw, paths.turnFinal);
}

async function main() {
  const args = parseArgs();
  if (!["all", "keyart", "turnaround"].includes(args.only)) {
    throw new Error("--only must be all, keyart, or turnaround");
  }
  const heroes = HERO_ORDER.map((heroId) => HEROES[heroId]).filter(
    (hero) => !args.heroes || args.heroes.has(hero.id),
  );
  const keyartTasks = [];
  const turnaroundTasks = [];
  for (const hero of heroes) {
    const paths = expectedPaths(hero.id);
    if (
      ["all", "keyart"].includes(args.only) &&
      (!existsSync(paths.keyartFinal) || !existsSync(paths.cutoutFinal))
    ) {
      const task = async () => {
        await generateKeyart(hero, paths);
        await buildCutout(hero, paths);
      };
      task.label = `${hero.id} keyart + cutout`;
      keyartTasks.push(task);
    }
    if (
      ["all", "turnaround"].includes(args.only) &&
      !existsSync(paths.turnFinal)
    ) {
      const task = () => buildTurnaroundFromKeyart(hero, paths);
      task.label = `${hero.id} turnaround`;
      turnaroundTasks.push(task);
    }
  }
  console.log(
    JSON.stringify(
      {
        comfyUrl,
        keyartTasks: keyartTasks.length,
        turnaroundTasks: turnaroundTasks.length,
        concurrency: args.concurrency,
      },
      null,
      2,
    ),
  );
  if (keyartTasks.length) {
    await runPool(keyartTasks, args.concurrency);
  }
  if (turnaroundTasks.length) {
    await runPool(turnaroundTasks, args.concurrency);
  }
  console.log(
    JSON.stringify(
      {
        status: "passed",
        keyartTasks: keyartTasks.length,
        turnaroundTasks: turnaroundTasks.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
