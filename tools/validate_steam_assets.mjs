#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const capsuleSpecs = [
  ["header_capsule.png", 920, 430, false],
  ["small_capsule.png", 462, 174, false],
  ["main_capsule.png", 1232, 706, false],
  ["vertical_capsule.png", 748, 896, false],
  ["library_capsule.png", 600, 900, false],
  ["library_hero.png", 3840, 1240, false],
  ["library_logo.png", 1280, 720, true],
  ["page_background.png", 1438, 810, false],
];
const capsules = capsuleSpecs.flatMap((spec) => [
  spec,
  [`${spec[0].replace(".png", "_en.png")}`, ...spec.slice(1)],
]);

const screenshotSpecs = [
  "01_title.png",
  "02_campaign_map.png",
  "03_qingfeng_story.png",
  "04_qingfeng_battle.png",
  "05_star_codex.png",
];

function pngInfo(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Not a PNG file.");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

const failures = [];
const records = [];

for (const [name, width, height, alpha] of capsules) {
  const file = `store/steam_assets/${name}`;
  const info = pngInfo(await readFile(file));
  const hasAlpha = info.colorType === 4 || info.colorType === 6;
  const ok = info.width === width && info.height === height && hasAlpha === alpha;
  records.push({ file, ...info, hasAlpha, expected: [width, height, alpha], ok });
  if (!ok) failures.push(file);
}

for (const name of screenshotSpecs) {
  const file = `store/steam_assets/screenshots/${name}`;
  const info = pngInfo(await readFile(file));
  const ok = info.width === 1920 && info.height === 1080;
  records.push({ file, ...info, expected: [1920, 1080], ok });
  if (!ok) failures.push(file);
}

const trailerFile = "store/steam_assets/trailer_1080p.mp4";
const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height,pix_fmt",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    trailerFile,
  ],
  { encoding: "utf8" },
);
if (probe.status !== 0) {
  failures.push(trailerFile);
} else {
  const trailer = JSON.parse(probe.stdout);
  const stream = trailer.streams?.[0];
  const duration = Number(trailer.format?.duration || 0);
  const ok =
    stream?.codec_name === "h264" &&
    stream?.width === 1920 &&
    stream?.height === 1080 &&
    stream?.pix_fmt === "yuv420p" &&
    duration >= 28.5 &&
    duration <= 29.5;
  records.push({
    file: trailerFile,
    codec: stream?.codec_name,
    width: stream?.width,
    height: stream?.height,
    pixFmt: stream?.pix_fmt,
    duration,
    ok,
  });
  if (!ok) failures.push(trailerFile);
}

console.log(JSON.stringify({ checked: records.length, failures, records }, null, 2));
if (failures.length) process.exitCode = 1;
