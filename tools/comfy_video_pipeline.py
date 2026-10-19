#!/usr/bin/env python3
"""Generate a MiniMax H3 image-to-video clip through the ComfyUI API."""

from __future__ import annotations

import argparse
import json
import os
import random
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from comfy_asset_pipeline import PROJECT_ROOT, request_json, upload_image


DEFAULT_COMFY_URL = "http://127.0.0.1:8188"


def minimax_i2v(
    image_name: str,
    prompt: str,
    width: int,
    height: int,
    length: int,
    steps: int,
    seed: int,
    prefix: str,
) -> dict[str, Any]:
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "minimax_h3_fl2va_pruned_fp8_scaled.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen3vl_32b_minimax_h3_int8_convrot.safetensors",
                "type": "minimax",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_video_vae_fp16.safetensors"},
        },
        "4": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"},
        },
        "5": {
            "class_type": "LoraLoaderModelOnly",
            "inputs": {
                "model": ["1", 0],
                "lora_name": (
                    "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors"
                ),
                "strength_model": 1.0,
            },
        },
        "6": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
        "7": {
            "class_type": "MiniMaxH3ImageToVideo",
            "inputs": {
                "clip": ["2", 0],
                "vae": ["3", 0],
                "first_frame": ["6", 0],
                "prompt": prompt,
                "width": width,
                "height": height,
                "length": length,
            },
        },
        "8": {
            "class_type": "BasicScheduler",
            "inputs": {
                "model": ["5", 0],
                "scheduler": "simple",
                "steps": steps,
                "denoise": 1.0,
            },
        },
        "9": {
            "class_type": "KSamplerSelect",
            "inputs": {"sampler_name": "res_multistep"},
        },
        "10": {
            "class_type": "RandomNoise",
            "inputs": {"noise_seed": seed},
        },
        "11": {
            "class_type": "BasicGuider",
            "inputs": {"model": ["5", 0], "conditioning": ["7", 0]},
        },
        "12": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["10", 0],
                "guider": ["11", 0],
                "sampler": ["9", 0],
                "sigmas": ["8", 0],
                "latent_image": ["7", 1],
            },
        },
        "13": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["12", 0], "vae": ["3", 0]},
        },
        "14": {
            "class_type": "VAEDecodeAudio",
            "inputs": {"samples": ["12", 0], "vae": ["4", 0]},
        },
        "15": {
            "class_type": "CreateVideo",
            "inputs": {
                "images": ["13", 0],
                "audio": ["14", 0],
                "fps": 24.0,
                "bit_depth": 8,
            },
        },
        "16": {
            "class_type": "SaveVideo",
            "inputs": {
                "video": ["15", 0],
                "filename_prefix": prefix,
                "format": "mp4",
                "codec": "h264",
            },
        },
    }


def wait_for_completion(
    base_url: str, prompt_id: str, timeout: int, poll_seconds: float
) -> dict[str, Any]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        history = request_json(f"{base_url}/history/{prompt_id}")
        if prompt_id in history:
            return history[prompt_id]
        queue = request_json(f"{base_url}/queue")
        running = any(item[1] == prompt_id for item in queue.get("queue_running", []))
        pending = any(item[1] == prompt_id for item in queue.get("queue_pending", []))
        state = "running" if running else "pending" if pending else "waiting"
        print(f"  {state}...", flush=True)
        time.sleep(poll_seconds)
    raise TimeoutError(f"Prompt {prompt_id} did not finish within {timeout} seconds")


def iter_output_files(value: Any) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if "filename" in value:
            files.append(value)
        else:
            for child in value.values():
                files.extend(iter_output_files(child))
    elif isinstance(value, list):
        for child in value:
            files.extend(iter_output_files(child))
    return files


def download_outputs(
    base_url: str, history: dict[str, Any], output_dir: Path
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    seen: set[tuple[str, str, str]] = set()
    for output_file in iter_output_files(history.get("outputs", {})):
        identity = (
            output_file["filename"],
            output_file.get("subfolder", ""),
            output_file.get("type", "output"),
        )
        if identity in seen:
            continue
        seen.add(identity)
        query = urllib.parse.urlencode(
            {
                "filename": identity[0],
                "subfolder": identity[1],
                "type": identity[2],
            }
        )
        with urllib.request.urlopen(f"{base_url}/view?{query}", timeout=300) as response:
            target = output_dir / Path(identity[0]).name
            target.write_bytes(response.read())
            saved.append(target)
    return saved


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-image", type=Path, required=True)
    prompt_group = parser.add_mutually_exclusive_group(required=True)
    prompt_group.add_argument("--prompt")
    prompt_group.add_argument("--prompt-file", type=Path)
    parser.add_argument("--width", type=int, default=1344)
    parser.add_argument("--height", type=int, default=768)
    parser.add_argument("--seconds", type=int, default=5)
    parser.add_argument("--steps", type=int, default=8)
    parser.add_argument("--seed", type=int, default=-1)
    parser.add_argument("--prefix", default="shuihu_video")
    parser.add_argument(
        "--output-dir", type=Path, default=PROJECT_ROOT / "assets" / "video"
    )
    parser.add_argument("--workflow-out", type=Path)
    parser.add_argument("--timeout", type=int, default=3600)
    parser.add_argument("--poll", type=float, default=3.0)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    prompt = (
        args.prompt
        if args.prompt is not None
        else args.prompt_file.read_text(encoding="utf-8").strip()
    )
    seed = args.seed if args.seed >= 0 else random.randint(0, 2**32 - 1)
    # MiniMax H3 uses 17k+5 frame grids at 24fps.
    frame_budget = max(5, round(args.seconds * 24))
    length = frame_budget + (5 - (frame_budget % 17)) % 17
    base_url = os.environ.get("COMFY_URL", DEFAULT_COMFY_URL).rstrip("/")
    image_name = (
        str(args.input_image)
        if args.dry_run
        else upload_image(base_url, args.input_image)
    )
    workflow = minimax_i2v(
        image_name=image_name,
        prompt=prompt,
        width=args.width,
        height=args.height,
        length=length,
        steps=args.steps,
        seed=seed,
        prefix=args.prefix,
    )

    if args.workflow_out:
        args.workflow_out.parent.mkdir(parents=True, exist_ok=True)
        args.workflow_out.write_text(
            json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    if args.dry_run:
        print(json.dumps(workflow, ensure_ascii=False, indent=2))
        return 0

    print(
        f"Submitting MiniMax H3: {args.width}x{args.height}, "
        f"{length} frames ({length / 24:.2f}s), {args.steps} steps, seed {seed}"
    )
    response = request_json(
        f"{base_url}/prompt", {"prompt": workflow, "client_id": "shuihu-video"}
    )
    prompt_id = response["prompt_id"]
    print(f"Prompt ID: {prompt_id}")
    history = wait_for_completion(base_url, prompt_id, args.timeout, args.poll)
    outputs = download_outputs(base_url, history, args.output_dir)
    if not outputs:
        print("No video outputs were returned by ComfyUI.")
        print(json.dumps(history, ensure_ascii=False, indent=2))
        return 2
    for path in outputs:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
