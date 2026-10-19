#!/usr/bin/env python3
"""Rebuild mastered game loops from the original ComfyUI YuE2 raw masters."""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

from comfy_music_pipeline import (
    COMFY_URL,
    OUTPUT_DIR,
    ROOT,
    TRACKS,
    make_seamless_loop,
)


RAW_DIR = ROOT / "assets" / "raw" / "audio"


def fetch_json(path: str) -> dict:
    with urllib.request.urlopen(f"{COMFY_URL}{path}", timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def find_latest_raw(history: dict, track_name: str) -> dict | None:
    candidates = []
    for prompt_id, entry in history.items():
        prompt = entry.get("prompt") or []
        prompt_meta = prompt[3] if len(prompt) > 3 else {}
        created_at = float(
            prompt_meta.get("create_time", 0)
            if isinstance(prompt_meta, dict)
            else 0
        )
        for node_output in entry.get("outputs", {}).values():
            for key in ("audio", "audio_files", "files"):
                values = node_output.get(key)
                if not isinstance(values, list):
                    continue
                for output in values:
                    filename = str(output.get("filename") or "")
                    if (
                        isinstance(output, dict)
                        and filename.startswith(f"{track_name}_raw_")
                        and filename.lower().endswith(".mp3")
                    ):
                        candidates.append((created_at, prompt_id, output))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[-1][2]


def download_raw(output: dict, destination: Path) -> None:
    query = urllib.parse.urlencode(
        {
            "filename": output["filename"],
            "subfolder": output.get("subfolder", ""),
            "type": output.get("type", "output"),
        }
    )
    request = urllib.request.Request(f"{COMFY_URL}/view?{query}")
    with urllib.request.urlopen(request, timeout=300) as response:
        data = response.read()
    if len(data) < 100_000:
        raise RuntimeError(f"Downloaded raw master is unexpectedly small: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "tracks",
        nargs="*",
        choices=[*TRACKS, []],
        help="Tracks to rebuild. Defaults to all seven runtime tracks.",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Replace cached raw masters with the latest ComfyUI outputs.",
    )
    args = parser.parse_args()

    requested = args.tracks or list(TRACKS)
    missing_raw = [
        name
        for name in requested
        if args.force_download
        or not (RAW_DIR / f"{name}_raw.mp3").exists()
    ]
    history = fetch_json("/history") if missing_raw else {}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name in requested:
        raw_path = RAW_DIR / f"{name}_raw.mp3"
        if name in missing_raw:
            output = find_latest_raw(history, name)
            if not output:
                raise RuntimeError(f"No ComfyUI raw master found for {name}.")
            print(f"[{name}] downloading 320k source master...", flush=True)
            download_raw(output, raw_path)
        destination = OUTPUT_DIR / f"{name}.mp3"
        print(f"[{name}] loop + master -> {destination.relative_to(ROOT)}", flush=True)
        make_seamless_loop(raw_path, destination, crossfade_seconds=4)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
