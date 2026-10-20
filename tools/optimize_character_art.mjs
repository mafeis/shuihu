#!/usr/bin/env node
/**
 * 角色立绘 PNG -> WebP 压缩工具。
 *
 * 用法：
 *   node tools/optimize_character_art.mjs --dry-run
 *   node tools/optimize_character_art.mjs --quality 82 --alpha-quality 90
 *   node tools/optimize_character_art.mjs --keep-png
 *   node tools/optimize_character_art.mjs --dir assets/environments --all-png
 *   node tools/optimize_character_art.mjs --dir assets/enemies --all-png
 *
 * 默认处理 assets/characters/<id>/{keyart,cutout}.png；
 * 用 --dir <目录> --all-png 处理任意目录下的全部 PNG。
 * 依赖 cwebp（macOS: brew install webp）。
 *
 * 压缩后必须同步：
 *   1. src/data.js 中的 keyart/cutout 路径
 *   2. src/main.js 的 thumb 派生正则
 *   3. assets/manifest.json 的 file / sha256 / bytes
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const has = (name) => args.includes(`--${name}`);

const quality = Number(flag("quality", "82"));
const alphaQuality = Number(flag("alpha-quality", "90"));
const keepPng = has("keep-png");
const dryRun = has("dry-run");
const onlyDir = flag("dir", null);
const allPng = has("all-png");
const root = process.cwd();
const characterRoot = join(root, "assets", "characters");
const targets = ["keyart", "cutout"];

if (onlyDir && !existsSync(join(root, onlyDir))) {
  console.error(`找不到目录 ${onlyDir}`);
  process.exit(1);
}
if (!onlyDir && !existsSync(characterRoot)) {
  console.error(`找不到 ${characterRoot}`);
  process.exit(1);
}

let pngBytes = 0;
let webpBytes = 0;
let converted = 0;
const skipped = [];

if (onlyDir && allPng) {
  const flatDir = join(root, onlyDir);
  for (const file of readdirSync(flatDir).sort()) {
    if (!file.toLowerCase().endsWith(".png")) continue;
    const source = join(flatDir, file);
    const output = source.slice(0, -4) + ".webp";
    const sourceBytes = statSync(source).size;
    if (dryRun) {
      console.log(`[dry-run] ${onlyDir}/${file} ${(sourceBytes / 1024).toFixed(0)} KB`);
      pngBytes += sourceBytes;
      continue;
    }
    execFileSync("cwebp", ["-quiet", "-q", String(quality), "-m", "6", "-metadata", "none", "-alpha_q", String(alphaQuality), source, "-o", output]);
    const outputBytes = statSync(output).size;
    if (outputBytes >= sourceBytes) {
      skipped.push(`${onlyDir}/${file}: webp ${outputBytes} >= png ${sourceBytes}`);
      if (!keepPng) unlinkSync(output);
      pngBytes += sourceBytes;
      webpBytes += sourceBytes;
      continue;
    }
    pngBytes += sourceBytes;
    webpBytes += outputBytes;
    converted += 1;
    if (!keepPng) unlinkSync(source);
  }
} else
for (const heroId of readdirSync(characterRoot).sort()) {
  const heroDir = join(characterRoot, heroId);
  if (!statSync(heroDir).isDirectory()) continue;
  for (const name of targets) {
    const source = join(heroDir, `${name}.png`);
    if (!existsSync(source)) continue;
    const output = join(heroDir, `${name}.webp`);
    const sourceBytes = statSync(source).size;

    if (dryRun) {
      console.log(`[dry-run] ${heroId}/${name}.png ${(sourceBytes / 1024).toFixed(0)} KB`);
      pngBytes += sourceBytes;
      continue;
    }

    execFileSync("cwebp", [
      "-quiet",
      "-q", String(quality),
      "-m", "6",
      "-metadata", "none",
      "-alpha_q", String(alphaQuality),
      source,
      "-o", output,
    ]);

    const outputBytes = statSync(output).size;
    if (outputBytes >= sourceBytes) {
      skipped.push(`${heroId}/${name}: webp ${outputBytes} >= png ${sourceBytes}`);
      if (!keepPng) unlinkSync(output);
      pngBytes += sourceBytes;
      webpBytes += sourceBytes;
      continue;
    }

    pngBytes += sourceBytes;
    webpBytes += outputBytes;
    converted += 1;
    if (!keepPng) unlinkSync(source);
  }
}

const saved = pngBytes - webpBytes;
console.log(`\n转换 ${converted} 个文件`);
console.log(`PNG  ${(pngBytes / 1024 / 1024).toFixed(1)} MB -> WebP ${(webpBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`节省 ${(saved / 1024 / 1024).toFixed(1)} MB（${((saved / pngBytes) * 100 || 0).toFixed(1)}%）`);
if (skipped.length) {
  console.log(`\n跳过 ${skipped.length} 个（WebP 未变小）：`);
  for (const line of skipped.slice(0, 10)) console.log(`  ${line}`);
}
if (converted && !dryRun && !keepPng) {
  console.log("\n下一步：更新 src/data.js 路径、src/main.js 正则、assets/manifest.json，然后跑 assets:verify。");
}
if (converted && !dryRun && keepPng) {
  console.log("\n已保留 PNG；确认后再手动删除。");
}
