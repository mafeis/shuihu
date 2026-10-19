#!/usr/bin/env python3
"""Generate and master short Shuihu combat one-shots through ComfyUI YuE2."""

from __future__ import annotations

import argparse
import subprocess
import time
import uuid
from pathlib import Path

from comfy_music_pipeline import (
    CHECKPOINT,
    ROOT,
    download_output,
    find_audio_output,
    request_json,
    wait_for_result,
)
from combat_sfx_synth import render_combat_sfx


SFX_OUTPUT_DIR = ROOT / "assets" / "audio" / "sfx"
SFX_RAW_DIR = ROOT / "assets" / "raw" / "audio" / "sfx"
TARGET_LUFS = -16.0
TARGET_TRUE_PEAK = -1.2

CUES = {
    "battle-start": {
        "seed": 281001,
        "generate_duration": 2.4,
        "trim_duration": 1.55,
        "style": (
            "single isolated game sound effect, one deep Chinese war drum strike followed by "
            "a short low horn swell, cinematic historical battlefield, strong opening transient, "
            "starts immediately, no music bed, no melody, no voice, no ambience, dry and punchy"
        ),
    },
    "blade": {
        "seed": 281013,
        "generate_duration": 1.8,
        "trim_duration": 0.72,
        "style": (
            "single isolated game weapon sound effect, fast Chinese guandao blade whoosh and "
            "one sharp metal cut, close perspective, crisp transient, no music, no melody, "
            "no voice, no footsteps, no ambience, no reverb tail"
        ),
    },
    "impact": {
        "seed": 281031,
        "generate_duration": 2.2,
        "trim_duration": 0.95,
        "style": (
            "single isolated heavy game impact sound effect, iron war mace crushing wooden armor, "
            "deep sub thump, dry bone crack and small debris, cinematic combat hit, starts immediately, "
            "no music, no melody, no voice, no crowd, no ambience"
        ),
    },
    "volley": {
        "seed": 281047,
        "generate_duration": 1.9,
        "trim_duration": 0.82,
        "style": (
            "single isolated ranged combat game sound effect, three arrows cutting fast through air "
            "ending in one compact wooden shield thud, sharp aerodynamic transients, no music, "
            "no voice, no bow string melody, no ambience, no long tail"
        ),
    },
    "guard": {
        "seed": 281063,
        "generate_duration": 1.9,
        "trim_duration": 0.88,
        "style": (
            "single isolated defensive game sound effect, sword blade striking a heavy iron shield, "
            "solid metallic clang, short armored brace and restrained low resonance, close perspective, "
            "no music, no melody, no voice, no ambience"
        ),
    },
    "evade": {
        "seed": 281081,
        "generate_duration": 1.5,
        "trim_duration": 0.58,
        "style": (
            "single isolated evasion game sound effect, quick cloth and sleeve whip through air, "
            "light foot pivot, clean whoosh, starts immediately, no music, no voice, no footsteps "
            "on stone, no ambience, no long tail"
        ),
    },
    "restore": {
        "seed": 281099,
        "generate_duration": 2.5,
        "trim_duration": 1.35,
        "style": (
            "single isolated healing game sound effect, warm guzheng harmonic, two soft bronze bells "
            "and a gentle rising shimmer, restorative Chinese historical fantasy, no melody, no music bed, "
            "no voice, no choir, no ambience, clean game-ready one-shot"
        ),
    },
    "ultimate": {
        "seed": 281117,
        "generate_duration": 2.8,
        "trim_duration": 1.6,
        "style": (
            "single isolated ultimate attack game sound effect, rapid three-hit weapon flurry, "
            "rising air cut, one enormous final metal impact, heroic Chinese martial fantasy, "
            "starts immediately, no music, no melody, no voice, no crowd, no ambience"
        ),
    },
    "victory": {
        "seed": 281133,
        "generate_duration": 3.0,
        "trim_duration": 1.9,
        "style": (
            "single short victory sting for a Chinese historical RPG, one suona call, one bright "
            "guzheng chord and a final frame drum accent, compact triumphant cadence, instrumental, "
            "no vocals, no long music bed, no ambience"
        ),
    },
    "defeat": {
        "seed": 281151,
        "generate_duration": 3.0,
        "trim_duration": 2.0,
        "style": (
            "single short defeat sting for a Chinese historical RPG, low frame drum, one broken "
            "erhu note and a fading bronze bell, somber but restrained, compact instrumental cadence, "
            "no vocals, no long music bed, no ambience"
        ),
    },
}


def build_workflow(cue: str) -> dict:
    config = CUES[cue]
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "2": {
            "class_type": "YuE2GenerateMusic",
            "inputs": {
                "clip": ["1", 1],
                "style": config["style"],
                "lyrics": "",
                "abc": "",
                "seed": config["seed"],
                "mode": "full",
                "max_duration": config["generate_duration"],
                "temperature": 0.96,
                "top_p": 0.88,
                "top_k": 64,
                "repetition_penalty": 1.12,
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
                "seed": config["seed"] + 97,
                "steps": 24,
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
                "filename_prefix": f"shuihu_sfx/{cue}_raw",
                "quality": "320k",
            },
        },
    }


def submit_workflow(cue: str) -> str:
    response = request_json(
        "/prompt",
        {
            "prompt": build_workflow(cue),
            "client_id": uuid.uuid4().hex,
        },
    )
    prompt_id = response.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI rejected SFX workflow: {response}")
    return prompt_id


def master_sfx(
    cue: str,
    source: Path,
    destination: Path,
    trim_duration: float,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    synth_path = destination.with_suffix(".synth.wav")
    render_combat_sfx(cue, synth_path, trim_duration)
    fade_start = max(0.04, trim_duration - 0.1)
    texture_duration = min(trim_duration, 0.11)
    texture_fade_start = max(0.02, texture_duration - 0.045)
    filter_graph = (
        "[0:a]"
        "silenceremove=start_periods=1:start_duration=0.01:"
        "start_threshold=-46dB:detection=peak,"
        "highpass=f=110,lowpass=f=7600,"
        f"atrim=0:{texture_duration:.3f},asetpts=PTS-STARTPTS,"
        "volume=0.08,"
        f"afade=t=out:st={texture_fade_start:.3f}:d=0.045[texture];"
        "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[core];"
        "[texture][core]amix=inputs=2:duration=longest:normalize=0,"
        "highpass=f=24,"
        "acompressor=threshold=0.16:ratio=2.8:attack=3:release=80:makeup=1.2,"
        f"atrim=0:{trim_duration:.3f},asetpts=PTS-STARTPTS,"
        f"afade=t=out:st={max(0.04, trim_duration - 0.08):.3f}:d=0.08,"
        f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TRUE_PEAK}:LRA=6,"
        "aresample=44100[out]"
    )
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-i",
                str(synth_path),
                "-filter_complex",
                filter_graph,
                "-map",
                "[out]",
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
    finally:
        synth_path.unlink(missing_ok=True)


def generate_cue(cue: str) -> None:
    config = CUES[cue]
    raw_path = SFX_RAW_DIR / f"{cue}_raw.mp3"
    final_path = SFX_OUTPUT_DIR / f"{cue}.mp3"
    SFX_RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[{cue}] submitting YuE2 one-shot workflow...", flush=True)
    prompt_id = submit_workflow(cue)
    entry = wait_for_result(prompt_id)
    download_output(find_audio_output(entry), raw_path)
    print(f"[{cue}] downloaded raw one-shot; trimming and mastering...", flush=True)
    master_sfx(cue, raw_path, final_path, config["trim_duration"])
    print(f"[{cue}] ready: {final_path.relative_to(ROOT)}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "cues",
        nargs="*",
        choices=[*CUES, []],
        help="One-shots to generate. Defaults to all missing cues.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate cues that already exist.",
    )
    args = parser.parse_args()
    requested = args.cues or list(CUES)
    missing = [
        cue
        for cue in requested
        if args.force or not (SFX_OUTPUT_DIR / f"{cue}.mp3").exists()
    ]
    if not missing:
        print("All requested combat one-shots already exist. Use --force to regenerate.")
        return
    started = time.time()
    for cue in missing:
        generate_cue(cue)
    print(f"Generated {len(missing)} one-shots in {time.time() - started:.1f}s.")


if __name__ == "__main__":
    main()
