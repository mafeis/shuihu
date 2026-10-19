#!/usr/bin/env python3
"""Rebuild mastered combat one-shots from cached ComfyUI YuE2 raw audio."""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

from comfy_music_pipeline import COMFY_URL, ROOT
from comfy_sfx_pipeline import CUES, SFX_OUTPUT_DIR, SFX_RAW_DIR, master_sfx


def fetch_json(path: str) -> dict:
    with urllib.request.urlopen(f"{COMFY_URL}{path}", timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def find_latest_raw(history: dict, cue: str) -> dict | None:
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
                    if not isinstance(output, dict):
                        continue
                    filename = str(output.get("filename") or "")
                    subfolder = str(output.get("subfolder") or "")
                    if (
                        filename.startswith(f"{cue}_raw_")
                        and "shuihu_sfx" in subfolder
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
    if len(data) < 8_000:
        raise RuntimeError(f"Downloaded raw one-shot is unexpectedly small: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "cues",
        nargs="*",
        choices=[*CUES, []],
        help="One-shots to rebuild. Defaults to every combat cue.",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Replace cached raw one-shots with the latest ComfyUI outputs.",
    )
    args = parser.parse_args()

    requested = args.cues or list(CUES)
    missing_raw = [
        cue
        for cue in requested
        if args.force_download or not (SFX_RAW_DIR / f"{cue}_raw.mp3").exists()
    ]
    history = fetch_json("/history") if missing_raw else {}
    SFX_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SFX_RAW_DIR.mkdir(parents=True, exist_ok=True)
    for cue in requested:
        raw_path = SFX_RAW_DIR / f"{cue}_raw.mp3"
        if cue in missing_raw:
            output = find_latest_raw(history, cue)
            if not output:
                raise RuntimeError(f"No ComfyUI raw SFX master found for {cue}.")
            print(f"[{cue}] downloading 320k source one-shot...", flush=True)
            download_raw(output, raw_path)
        destination = SFX_OUTPUT_DIR / f"{cue}.mp3"
        print(f"[{cue}] trim + master -> {destination.relative_to(ROOT)}", flush=True)
        master_sfx(cue, raw_path, destination, CUES[cue]["trim_duration"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
