#!/usr/bin/env python3
"""Validate loudness, true peak, encoding, and loop boundaries for game music."""

from __future__ import annotations

import array
import json
import math
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "assets" / "audio"
TRACKS = [
    "title_theme",
    "jianghu_theme",
    "battle_theme",
    "ending_theme",
    "qingfeng_theme",
    "jiangzhou_theme",
    "zhujiazhuang_theme",
    "damingfu_theme",
    "boss_theme",
    "recruitment_theme",
]
TARGET_LUFS = -16.0
LUFS_TOLERANCE = 1.5
TRUE_PEAK_LIMIT = -1.0
DECODED_PEAK_LIMIT = 0.98
BOUNDARY_RATIO_LIMIT = 2.0


def ffprobe(path: Path) -> dict:
    output = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,sample_rate,channels:format=duration,bit_rate",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    data = json.loads(output)
    stream = (data.get("streams") or [{}])[0]
    format_info = data.get("format") or {}
    return {
        "codec": stream.get("codec_name"),
        "sample_rate": int(stream.get("sample_rate") or 0),
        "channels": int(stream.get("channels") or 0),
        "duration": float(format_info.get("duration") or 0),
        "bit_rate": int(format_info.get("bit_rate") or 0),
    }


def loudness(path: Path) -> dict[str, float]:
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json",
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
        raise ValueError("loudnorm did not return JSON")
    measured = json.loads(payload[-1])
    return {
        "integrated_lufs": float(measured["input_i"]),
        "true_peak_dbtp": float(measured["input_tp"]),
        "lra": float(measured["input_lra"]),
    }


def decoded_metrics(path: Path) -> dict[str, float]:
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-f",
            "f32le",
            "-acodec",
            "pcm_f32le",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-",
        ]
    )
    samples = array.array("f")
    samples.frombytes(raw)
    if not samples:
        raise ValueError("No decoded samples")
    frame_count = len(samples) // 2
    channels = [samples[index::2] for index in range(2)]
    peak = max(abs(value) for value in samples)
    rms = math.sqrt(sum(value * value for value in samples) / len(samples))
    boundary_ratios = []
    for channel in channels:
        deltas = sorted(
            abs(channel[index] - channel[index - 1])
            for index in range(1, len(channel))
        )
        reference = deltas[min(len(deltas) - 1, int(len(deltas) * 0.99))]
        boundary = abs(channel[-1] - channel[0])
        boundary_ratios.append(boundary / max(reference, 1e-9))
    return {
        "decoded_peak": peak,
        "decoded_rms": rms,
        "boundary_ratio": max(boundary_ratios),
        "frames": frame_count,
    }


def validate_track(name: str) -> dict:
    path = AUDIO_DIR / f"{name}.mp3"
    if not path.exists():
        raise FileNotFoundError(path)
    encoding = ffprobe(path)
    loud = loudness(path)
    decoded = decoded_metrics(path)
    errors = []
    if encoding["codec"] != "mp3":
        errors.append(f"codec is {encoding['codec']}, expected mp3")
    if encoding["sample_rate"] != 44100:
        errors.append(f"sample rate is {encoding['sample_rate']}, expected 44100")
    if encoding["channels"] != 2:
        errors.append(f"channel count is {encoding['channels']}, expected 2")
    if encoding["bit_rate"] < 180_000:
        errors.append(f"bit rate is {encoding['bit_rate']}, expected at least 180 kbps")
    if not 31.5 <= encoding["duration"] <= 33.0:
        errors.append(f"duration is {encoding['duration']:.2f}s, expected a 32s loop")
    if abs(loud["integrated_lufs"] - TARGET_LUFS) > LUFS_TOLERANCE:
        errors.append(
            f"integrated loudness is {loud['integrated_lufs']:.2f} LUFS"
        )
    if loud["true_peak_dbtp"] > TRUE_PEAK_LIMIT:
        errors.append(f"true peak is {loud['true_peak_dbtp']:.2f} dBTP")
    if decoded["decoded_peak"] > DECODED_PEAK_LIMIT:
        errors.append(f"decoded peak is {decoded['decoded_peak']:.4f}")
    if decoded["boundary_ratio"] > BOUNDARY_RATIO_LIMIT:
        errors.append(
            f"loop boundary ratio is {decoded['boundary_ratio']:.2f}"
        )
    return {
        "track": name,
        "duration": round(encoding["duration"], 3),
        "bit_rate": encoding["bit_rate"],
        **{key: round(value, 4) for key, value in loud.items()},
        **{key: round(value, 4) for key, value in decoded.items()},
        "errors": errors,
    }


def main() -> int:
    reports = []
    failed = False
    for name in TRACKS:
        report = validate_track(name)
        reports.append(report)
        status = "PASS" if not report["errors"] else "FAIL"
        print(
            f"{status} {name:18} "
            f"{report['integrated_lufs']:>6.2f} LUFS  "
            f"{report['true_peak_dbtp']:>6.2f} dBTP  "
            f"loop {report['boundary_ratio']:.2f}"
        )
        for error in report["errors"]:
            print(f"  - {error}")
        failed = failed or bool(report["errors"])
    print(json.dumps({"passed": not failed, "tracks": reports}, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
