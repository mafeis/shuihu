#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("store/steam_assets/trailer_1080p.mp4");
await mkdir(path.dirname(output), { recursive: true });

const clips = [
  ["store/steam_assets/screenshots/01_title.png", 6],
  ["store/steam_assets/screenshots/02_campaign_map.png", 5],
  ["store/steam_assets/screenshots/03_qingfeng_story.png", 5],
  ["store/steam_assets/screenshots/04_qingfeng_battle.png", 7],
  ["store/steam_assets/screenshots/05_star_codex.png", 5],
  ["store/steam_assets/main_capsule.png", 6],
];

const inputArgs = [];
for (const [file, duration] of clips) {
  inputArgs.push("-loop", "1", "-t", String(duration), "-i", file);
}
inputArgs.push("-i", "assets/audio/boss_theme.mp3");

const filters = clips.map(([, duration], index) => {
  const frames = Math.round(duration * 30);
  return (
    `[${index}:v]scale=2112:1188:flags=lanczos,` +
    "crop=1920:1080:(iw-ow)/2:(ih-oh)/2,setsar=1,fps=30," +
    `trim=duration=${duration},setpts=PTS-STARTPTS[v${index}]`
  );
});

const offsets = [5, 9, 13, 19, 23];
let previous = "v0";
for (let index = 1; index < clips.length; index += 1) {
  const outputLabel = index === clips.length - 1 ? "video" : `x${index}`;
  filters.push(
    `[${previous}][v${index}]xfade=transition=fade:duration=1:offset=${offsets[index - 1]}[${outputLabel}]`,
  );
  previous = outputLabel;
}

const args = [
  "-y",
  ...inputArgs,
  "-filter_complex",
  filters.join(";"),
  "-map",
  "[video]",
  "-map",
  `${clips.length}:a`,
  "-af",
  "volume=0.72,afade=t=in:st=0:d=1.2,afade=t=out:st=27:d=2,atrim=duration=29",
  "-t",
  "29",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  output,
];

await new Promise((resolve, reject) => {
  const ffmpeg = spawn("ffmpeg", args, { stdio: "inherit" });
  ffmpeg.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)),
  );
  ffmpeg.on("error", reject);
});

console.log(output);
