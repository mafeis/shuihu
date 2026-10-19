#!/usr/bin/env python3
"""Queue ComfyUI jobs and download generated game assets.

The pipeline uses ComfyUI's HTTP API so it can run without the browser UI.
Configure the server with COMFY_URL when it is not available on localhost.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any


DEFAULT_COMFY_URL = "http://127.0.0.1:8188"
PROJECT_ROOT = Path(__file__).resolve().parents[1]


def request_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def qwen_t2i(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    steps: int,
    seed: int,
    prefix: str,
    input_images: list[str] | None = None,
) -> dict[str, Any]:
    _ = input_images
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "qwen_image_2.1_int8_convrot.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen3vl_8b_int8_convrot.safetensors",
                "type": "qwen_image",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"},
        },
        "4": {
            "class_type": "TextEncodeQwenImage21",
            "inputs": {
                "clip": ["2", 0],
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "resolution": 1024,
                "images": {},
                "vae": ["3", 0],
            },
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "6": {
            "class_type": "QwenImage21Cache",
            "inputs": {"model": ["1", 0], "device": "auto", "dtype": "default"},
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["6", 0],
                "seed": seed,
                "steps": steps,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "positive": ["4", 0],
                "negative": ["4", 1],
                "latent_image": ["5", 0],
                "denoise": 1.0,
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["7", 0], "vae": ["3", 0]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"images": ["8", 0], "filename_prefix": prefix},
        },
    }


def flux2_t2i(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    steps: int,
    seed: int,
    prefix: str,
    input_images: list[str] | None = None,
) -> dict[str, Any]:
    _ = input_images
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "flux-2-klein-9b-fp8.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_8b_fp8mixed.safetensors",
                "type": "flux2",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "flux2-vae.safetensors"},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["2", 0]},
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative_prompt, "clip": ["2", 0]},
        },
        "6": {
            "class_type": "EmptyFlux2LatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "7": {
            "class_type": "RandomNoise",
            "inputs": {"noise_seed": seed},
        },
        "8": {
            "class_type": "KSamplerSelect",
            "inputs": {"sampler_name": "euler"},
        },
        "9": {
            "class_type": "Flux2Scheduler",
            "inputs": {"steps": steps, "width": width, "height": height},
        },
        "10": {
            "class_type": "CFGGuider",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["5", 0],
                "cfg": 5.0,
            },
        },
        "11": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["7", 0],
                "guider": ["10", 0],
                "sampler": ["8", 0],
                "sigmas": ["9", 0],
                "latent_image": ["6", 0],
            },
        },
        "12": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["11", 0], "vae": ["3", 0]},
        },
        "13": {
            "class_type": "SaveImage",
            "inputs": {"images": ["12", 0], "filename_prefix": prefix},
        },
    }


def zimage_t2i(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    steps: int,
    seed: int,
    prefix: str,
    input_images: list[str] | None = None,
) -> dict[str, Any]:
    _ = input_images
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "z_image_turbo_int8_convrot.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_4b_fp8_mixed.safetensors",
                "type": "lumina2",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "ae.safetensors"},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["2", 0]},
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative_prompt, "clip": ["2", 0]},
        },
        "6": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["5", 0]},
        },
        "7": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "8": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {"model": ["1", 0], "shift": 3.0},
        },
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["8", 0],
                "seed": seed,
                "steps": steps,
                "cfg": 1.0,
                "sampler_name": "res_multistep",
                "scheduler": "simple",
                "positive": ["4", 0],
                "negative": ["6", 0],
                "latent_image": ["7", 0],
                "denoise": 1.0,
            },
        },
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["3", 0]},
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["10", 0], "filename_prefix": prefix},
        },
    }


def qwen_edit(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    steps: int,
    seed: int,
    prefix: str,
    input_images: list[str] | None = None,
) -> dict[str, Any]:
    if not input_images:
        raise ValueError("Qwen edit requires at least one --input-image")
    workflow: dict[str, Any] = {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "qwen_image_2.1_int8_convrot.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen3vl_8b_int8_convrot.safetensors",
                "type": "qwen_image",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"},
        },
    }
    image_inputs: dict[str, list[Any]] = {}
    for index, filename in enumerate(input_images[:16], start=1):
        node_id = str(100 + index)
        workflow[node_id] = {
            "class_type": "LoadImage",
            "inputs": {"image": filename},
        }
        image_inputs[f"images.image_{index}"] = [node_id, 0]
    workflow.update(
        {
            "4": {
                "class_type": "TextEncodeQwenImage21",
                "inputs": {
                    "clip": ["2", 0],
                    "prompt": prompt,
                    "negative_prompt": negative_prompt,
                    "resolution": 1024,
                    "vae": ["3", 0],
                    **image_inputs,
                },
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {"width": width, "height": height, "batch_size": 1},
            },
            "6": {
                "class_type": "QwenImage21Cache",
                "inputs": {"model": ["1", 0], "device": "auto", "dtype": "default"},
            },
            "7": {
                "class_type": "KSampler",
                "inputs": {
                    "model": ["6", 0],
                    "seed": seed,
                    "steps": steps,
                    "cfg": 1.0,
                    "sampler_name": "euler",
                    "scheduler": "simple",
                    "positive": ["4", 0],
                    "negative": ["4", 1],
                    "latent_image": ["5", 0],
                    "denoise": 1.0,
                },
            },
            "8": {
                "class_type": "VAEDecode",
                "inputs": {"samples": ["7", 0], "vae": ["3", 0]},
            },
            "9": {
                "class_type": "SaveImage",
                "inputs": {"images": ["8", 0], "filename_prefix": prefix},
            },
        }
    )
    return workflow


BUILDERS = {
    "qwen": qwen_t2i,
    "qwen-edit": qwen_edit,
    "flux2": flux2_t2i,
    "zimage": zimage_t2i,
}


def upload_image(base_url: str, image_path: Path) -> str:
    boundary = f"----shuihu-{uuid.uuid4().hex}"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        (
            'Content-Disposition: form-data; name="image"; '
            f'filename="{image_path.name}"\r\n'
        ).encode("utf-8")
    )
    body.extend(b"Content-Type: application/octet-stream\r\n\r\n")
    body.extend(image_path.read_bytes())
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    request = urllib.request.Request(
        f"{base_url}/upload/image",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.loads(response.read().decode("utf-8"))
    subfolder = result.get("subfolder", "")
    return f"{subfolder}/{result['name']}".lstrip("/")


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


def download_images(
    base_url: str, history: dict[str, Any], output_dir: Path
) -> list[Path]:
    saved: list[Path] = []
    output_dir.mkdir(parents=True, exist_ok=True)
    for node_output in history.get("outputs", {}).values():
        for image in node_output.get("images", []):
            query = urllib.parse.urlencode(
                {
                    "filename": image["filename"],
                    "subfolder": image.get("subfolder", ""),
                    "type": image.get("type", "output"),
                }
            )
            with urllib.request.urlopen(
                f"{base_url}/view?{query}", timeout=120
            ) as response:
                target = output_dir / image["filename"]
                target.write_bytes(response.read())
                saved.append(target)
    return saved


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and download assets from the project ComfyUI server."
    )
    parser.add_argument("--model", choices=sorted(BUILDERS), required=True)
    prompt_group = parser.add_mutually_exclusive_group(required=True)
    prompt_group.add_argument("--prompt")
    prompt_group.add_argument("--prompt-file", type=Path)
    parser.add_argument("--input-image", type=Path, action="append", default=[])
    parser.add_argument("--negative", default="")
    parser.add_argument("--width", type=int, default=832)
    parser.add_argument("--height", type=int, default=1216)
    parser.add_argument("--steps", type=int)
    parser.add_argument("--seed", type=int, default=-1)
    parser.add_argument("--prefix", default="shuihu")
    parser.add_argument(
        "--output-dir", type=Path, default=PROJECT_ROOT / "assets" / "raw"
    )
    parser.add_argument(
        "--workflow-out",
        type=Path,
        help="Optional path for a copy of the API workflow JSON.",
    )
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument("--poll", type=float, default=2.0)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Save the API workflow without submitting it.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    prompt = (
        args.prompt
        if args.prompt is not None
        else args.prompt_file.read_text(encoding="utf-8").strip()
    )
    seed = args.seed if args.seed >= 0 else random.randint(0, 2**32 - 1)
    default_steps = {"qwen": 25, "qwen-edit": 25, "flux2": 20, "zimage": 8}
    steps = args.steps or default_steps[args.model]
    base_url = os.environ.get("COMFY_URL", DEFAULT_COMFY_URL).rstrip("/")
    if args.model == "qwen-edit" and not args.input_image:
        print("qwen-edit requires at least one --input-image", file=sys.stderr)
        return 2
    uploaded_images = (
        [str(path) for path in args.input_image]
        if args.dry_run
        else [upload_image(base_url, path) for path in args.input_image]
    )
    workflow = BUILDERS[args.model](
        prompt=prompt,
        negative_prompt=args.negative,
        width=args.width,
        height=args.height,
        steps=steps,
        seed=seed,
        prefix=args.prefix,
        input_images=uploaded_images,
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
        f"Submitting {args.model}: {args.width}x{args.height}, "
        f"{steps} steps, seed {seed}"
    )
    response = request_json(
        f"{base_url}/prompt", {"prompt": workflow, "client_id": "shuihu-assets"}
    )
    prompt_id = response["prompt_id"]
    print(f"Prompt ID: {prompt_id}")
    history = wait_for_completion(base_url, prompt_id, args.timeout, args.poll)
    images = download_images(base_url, history, args.output_dir)
    if not images:
        print("No images were returned by ComfyUI.", file=sys.stderr)
        print(json.dumps(history, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    for path in images:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
