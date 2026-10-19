#!/usr/bin/env python3
"""Generate loopable Shuihu background music through the local ComfyUI YuE2 nodes."""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import subprocess
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "audio"
COMFY_URL = os.environ.get("COMFY_URL", "http://127.0.0.1:8188")
CHECKPOINT = "yue2_3b_int8_convrot.safetensors"
MASTER_TARGET_LUFS = -16.0
MASTER_TARGET_TRUE_PEAK = -1.5
MASTER_TARGET_LRA = 9.0

TRACKS = {
    "title_theme": {
        "seed": 183107,
        "duration": 36,
        "style": (
            "Chinese cinematic orchestral theme for a Song dynasty historical RPG, "
            "solo erhu, guzheng, dizi flute, low strings, deep frame drums, distant wind, "
            "snowy mountain atmosphere, solemn and lonely, restrained heroic melody, "
            "slow 68 BPM, instrumental, no vocals, no choir"
        ),
    },
    "jianghu_theme": {
        "seed": 183211,
        "duration": 36,
        "style": (
            "Chinese adventure game overworld music, Song dynasty Jianghu, "
            "plucked pipa, guzheng arpeggios, bamboo flute, light hand drums, cello drone, "
            "wandering road, quiet campfire, mysterious but hopeful, 92 BPM, "
            "instrumental, no vocals, seamless ambient loop"
        ),
    },
    "battle_theme": {
        "seed": 183319,
        "duration": 36,
        "style": (
            "Chinese battle music for a turn-based historical RPG, fast taiko and war drums, "
            "low brass, staccato pipa, sharp erhu ostinato, guzheng tremolo, male war cries far away, "
            "tense heroic momentum, 132 BPM, instrumental, no sung lyrics, no modern electronic drums"
        ),
    },
    "ending_theme": {
        "seed": 183427,
        "duration": 36,
        "style": (
            "Chinese reflective ending theme, warm guzheng, long erhu melody, soft dizi, "
            "low strings and subtle bells, after the battle, snow melting over Liangshan, "
            "bittersweet, peaceful, dignified, slow 60 BPM, instrumental, no vocals"
        ),
    },
    "qingfeng_theme": {
        "seed": 183539,
        "duration": 36,
        "style": (
            "Chinese moonlit military fort ambience for a Song dynasty RPG, "
            "lone dizi flute over muted guzheng harmonics, distant watchtower bells, "
            "low string tension, sparse war drum heartbeat, cold wind across arrows and banners, "
            "lyrical, vigilant, proud but isolated, 72 BPM, instrumental, no vocals"
        ),
    },
    "jiangzhou_theme": {
        "seed": 183641,
        "duration": 36,
        "style": (
            "Dark Chinese historical execution-ground theme, low erhu, bowed cello, "
            "heavy frame drums, iron percussion and distant crowd murmur, "
            "oppressive noon under a gray sky, restrained fury before a rescue, "
            "tense 108 BPM, cinematic, instrumental, no vocals, no modern synths"
        ),
    },
    "zhujiazhuang_theme": {
        "seed": 183681,
        "duration": 36,
        "style": (
            "Chinese snowbound fortress theme for a Song dynasty narrative RPG, "
            "lone suona calls far behind a muted guzheng pulse, low erhu, "
            "sparse frame drum footsteps, cold wind through bare branches, "
            "red lasso movement suggested by plucked pipa harmonics, "
            "tense but dignified, a village choosing its own allegiance, "
            "84 BPM, instrumental, no vocals, no modern synths"
        ),
    },
    "damingfu_theme": {
        "seed": 183709,
        "duration": 36,
        "style": (
            "Chinese Lantern Festival infiltration theme for a Song dynasty RPG, "
            "bright pipa and guzheng ostinato under warm festival bells, "
            "dizi melody, low secretive strings, distant crowd and firecrackers, "
            "elegant city lights concealing danger, nimble 104 BPM, "
            "instrumental, no vocals, no modern electronic drums"
        ),
    },
    "boss_theme": {
        "seed": 183757,
        "duration": 36,
        "style": (
            "High intensity Chinese boss battle theme for a turn-based Shuihu RPG, "
            "thunderous taiko, low brass, distorted erhu stabs, rapid pipa tremolo, "
            "guzheng glissandi and male war drums, dangerous heroic duel, "
            "relentless 148 BPM, instrumental, no sung lyrics, no electronic dance drums"
        ),
    },
    "recruitment_theme": {
        "seed": 183899,
        "duration": 36,
        "style": (
            "Chinese heroic recruitment theme for a Song dynasty narrative RPG, "
            "upright suona and dizi melody over steady frame drums, plucked pipa, "
            "guzheng harmonics, low strings and distant mountain wind, "
            "a capable outlaw arriving through snow to swear a new oath, "
            "dignified, hopeful, alert and game-ready, 96 BPM, "
            "instrumental, no vocals, no modern electronic drums"
        ),
    },
}


def request_json(path: str, payload: dict | None = None) -> dict:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{COMFY_URL}{path}",
        data=data,
        headers=headers,
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def build_workflow(track: dict, filename_prefix: str) -> dict:
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "2": {
            "class_type": "YuE2GenerateMusic",
            "inputs": {
                "clip": ["1", 1],
                "style": track["style"],
                "lyrics": "",
                "abc": "",
                "seed": track["seed"],
                "mode": "full",
                "max_duration": track["duration"],
                "temperature": 0.92,
                "top_p": 0.92,
                "top_k": 80,
                "repetition_penalty": 1.08,
                "cfg_scale": 1.01,
            },
        },
        "3": {
            "class_type": "EmptyYuE2LatentAudio",
            "inputs": {"seconds": ["2", 1], "batch_size": 1},
        },
        "4": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["2", 0]},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "seed": track["seed"] + 97,
                "steps": 28,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "positive": ["2", 0],
                "negative": ["4", 0],
                "latent_image": ["3", 0],
                "denoise": 1.0,
            },
        },
        "6": {
            "class_type": "VAEDecodeAudio",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
        },
        "7": {
            "class_type": "SaveAudioMP3",
            "inputs": {
                "audio": ["6", 0],
                "filename_prefix": filename_prefix,
                "quality": "320k",
            },
        },
    }


def submit_workflow(name: str) -> str:
    client_id = uuid.uuid4().hex
    payload = {
        "prompt": build_workflow(TRACKS[name], f"shuihu_music/{name}_raw"),
        "client_id": client_id,
    }
    response = request_json("/prompt", payload)
    prompt_id = response.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI rejected workflow: {response}")
    return prompt_id


def wait_for_result(prompt_id: str, timeout_seconds: int = 7200) -> dict:
    deadline = time.time() + timeout_seconds
    last_status = ""
    while time.time() < deadline:
        history = request_json(f"/history/{prompt_id}")
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(json.dumps(status, ensure_ascii=False, indent=2))
            if status.get("completed"):
                return entry
        queue = request_json("/queue")
        running = {item[1] for item in queue.get("queue_running", [])}
        pending = {item[1] for item in queue.get("queue_pending", [])}
        status = "running" if prompt_id in running else "pending" if prompt_id in pending else "waiting"
        if status != last_status:
            print(f"  ComfyUI task {prompt_id[:8]} is {status}.", flush=True)
            last_status = status
        time.sleep(5)
    raise TimeoutError(f"Timed out waiting for ComfyUI prompt {prompt_id}")


def find_audio_output(entry: dict) -> dict:
    for node_output in entry.get("outputs", {}).values():
        for key in ("audio", "audio_files", "files"):
            values = node_output.get(key)
            if not isinstance(values, list):
                continue
            for value in values:
                if isinstance(value, dict) and value.get("filename"):
                    if Path(value["filename"]).suffix.lower() in {".mp3", ".flac", ".wav", ".opus"}:
                        return value
    raise RuntimeError("ComfyUI completed without an audio output.")


def download_output(output: dict, destination: Path) -> None:
    query = urllib.parse.urlencode(
        {
            "filename": output["filename"],
            "subfolder": output.get("subfolder", ""),
            "type": output.get("type", "output"),
        }
    )
    request = urllib.request.Request(f"{COMFY_URL}/view?{query}")
    with urllib.request.urlopen(request, timeout=300) as response:
        destination.write_bytes(response.read())


def measure_loudness(source: Path) -> dict[str, float]:
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(source),
            "-af",
            (
                f"loudnorm=I={MASTER_TARGET_LUFS}:"
                f"TP={MASTER_TARGET_TRUE_PEAK}:"
                f"LRA={MASTER_TARGET_LRA}:print_format=json"
            ),
            "-f",
            "null",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = re.findall(r"\{\s*\"input_i\".*?\}", result.stderr, re.DOTALL)
    if not payload:
        raise RuntimeError("FFmpeg loudnorm did not return measurable audio data.")
    measured = json.loads(payload[-1])
    return {
        "input_i": float(measured["input_i"]),
        "input_tp": float(measured["input_tp"]),
        "input_lra": float(measured["input_lra"]),
        "input_thresh": float(measured["input_thresh"]),
        "target_offset": float(measured["target_offset"]),
    }


def render_mastered_wav(source: Path, destination: Path) -> dict[str, float]:
    measured = measure_loudness(source)
    filter_graph = (
        f"loudnorm=I={MASTER_TARGET_LUFS}:"
        f"TP={MASTER_TARGET_TRUE_PEAK}:"
        f"LRA={MASTER_TARGET_LRA}:"
        f"measured_I={measured['input_i']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        "linear=true:print_format=summary,"
        "aresample=44100"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-af",
            filter_graph,
            "-map_metadata",
            "-1",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-codec:a",
            "pcm_s24le",
            str(destination),
        ],
        check=True,
    )
    return measured


def render_seamless_loop(
    source: Path,
    destination: Path,
    crossfade_seconds: float,
) -> None:
    duration = float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(source),
            ],
            text=True,
        ).strip()
    )
    if duration <= crossfade_seconds * 3:
        raise RuntimeError(f"Generated audio is too short for loop processing: {duration:.2f}s")
    loop_end = duration - crossfade_seconds
    fade = crossfade_seconds
    filter_graph = (
        f"[0:a]atrim=0:{fade},asetpts=PTS-STARTPTS[head];"
        f"[0:a]atrim={loop_end}:{duration},asetpts=PTS-STARTPTS[tail];"
        f"[tail][head]acrossfade=d={fade}:c1=tri:c2=tri[blend];"
        f"[0:a]atrim={fade}:{loop_end},asetpts=PTS-STARTPTS[body];"
        "[blend][body]concat=n=2:v=0:a=1[out]"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-filter_complex",
            filter_graph,
            "-map",
            "[out]",
            "-codec:a",
            "pcm_s24le",
            "-ar",
            "44100",
            str(destination),
        ],
        check=True,
    )


def encode_mp3(source: Path, destination: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "192k",
            "-id3v2_version",
            "3",
            str(destination),
        ],
        check=True,
    )


def make_seamless_loop(source: Path, destination: Path, crossfade_seconds: float) -> None:
    loop_wav = destination.with_suffix(".loop.wav")
    mastered_wav = destination.with_suffix(".mastered.wav")
    final_wav = destination.with_suffix(".final.wav")
    try:
        render_seamless_loop(source, loop_wav, crossfade_seconds)
        render_mastered_wav(loop_wav, mastered_wav)
        # Loudness normalization can introduce a tiny filter delay. Re-close the
        # sample boundary after mastering so the transport loops without a click.
        render_seamless_loop(mastered_wav, final_wav, 0.12)
        encode_mp3(final_wav, destination)
    finally:
        for temporary in (loop_wav, mastered_wav, final_wav):
            temporary.unlink(missing_ok=True)


def generate_track(name: str) -> None:
    final_path = OUTPUT_DIR / f"{name}.mp3"
    raw_path = OUTPUT_DIR / f"{name}_raw.mp3"
    print(f"[{name}] submitting YuE2 workflow...", flush=True)
    prompt_id = submit_workflow(name)
    entry = wait_for_result(prompt_id)
    output = find_audio_output(entry)
    download_output(output, raw_path)
    print(f"[{name}] downloaded {raw_path.name}; creating seamless game loop...", flush=True)
    make_seamless_loop(raw_path, final_path, crossfade_seconds=4)
    raw_path.unlink(missing_ok=True)
    print(f"[{name}] ready: {final_path.relative_to(ROOT)}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "tracks",
        nargs="*",
        choices=[*TRACKS, []],
        help="Tracks to generate. Defaults to all missing tracks.",
    )
    parser.add_argument("--force", action="store_true", help="Regenerate tracks that already exist.")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    requested = args.tracks or list(TRACKS)
    missing = [
        name
        for name in requested
        if args.force or not (OUTPUT_DIR / f"{name}.mp3").exists()
    ]
    if not missing:
        print("All requested tracks already exist. Use --force to regenerate.")
        return
    random.seed(1831)
    for name in missing:
        generate_track(name)


if __name__ == "__main__":
    main()
