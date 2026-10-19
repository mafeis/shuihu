#!/usr/bin/env python3
"""Rebuild character entries in the runtime manifest from shipped hero assets."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "manifest.json"
CHARACTER_TYPES = {
    "character_keyart",
    "character_turnaround",
    "character_cutout",
}


def hero_catalog() -> list[dict[str, Any]]:
    script = """
import { HEROES, HERO_ORDER } from "./src/data.js";
console.log(JSON.stringify(HERO_ORDER.map((id) => ({
  id,
  name: HEROES[id].name,
  nickname: HEROES[id].nickname,
}))));
""".strip()
    output = subprocess.check_output(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        text=True,
    )
    return json.loads(output)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_prompt(value: Any) -> str | None:
    if isinstance(value, dict):
        inputs = value.get("inputs", {})
        if isinstance(inputs, dict):
            prompt = inputs.get("prompt")
            if isinstance(prompt, str):
                return prompt
            text = inputs.get("text")
            if isinstance(text, str) and value.get("class_type") == "CLIPTextEncode":
                return text
        for child in value.values():
            prompt = find_prompt(child)
            if prompt:
                return prompt
    elif isinstance(value, list):
        for child in value:
            prompt = find_prompt(child)
            if prompt:
                return prompt
    return None


def find_seed(value: Any) -> int | None:
    if isinstance(value, dict):
        class_type = value.get("class_type")
        inputs = value.get("inputs", {})
        if class_type == "KSampler" and isinstance(inputs.get("seed"), int):
            return inputs["seed"]
        if class_type == "RandomNoise" and isinstance(
            inputs.get("noise_seed"), int
        ):
            return inputs["noise_seed"]
        for child in value.values():
            seed = find_seed(child)
            if seed is not None:
                return seed
    elif isinstance(value, list):
        for child in value:
            seed = find_seed(child)
            if seed is not None:
                return seed
    return None


def workflow_metadata(workflow_path: Path) -> dict[str, Any]:
    if not workflow_path.exists():
        return {}
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    metadata: dict[str, Any] = {}
    prompt = find_prompt(workflow)
    seed = find_seed(workflow)
    if prompt:
        metadata["prompt"] = prompt
    if seed is not None:
        metadata["seed"] = seed
    return metadata


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def image_metadata(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        metadata: dict[str, Any] = {
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
        }
        if image.mode == "RGBA":
            alpha = image.getchannel("A")
            metadata["alpha_range"] = list(alpha.getextrema())
            metadata["alpha_bbox"] = list(alpha.getbbox() or (0, 0, 0, 0))
    metadata["sha256"] = sha256(path)
    metadata["bytes"] = path.stat().st_size
    return metadata


def keyart_workflow(hero_id: str) -> Path:
    candidates = [
        ROOT / "workflows" / "api" / f"qwen_{hero_id}_keyart_v2_clean.json",
        ROOT / "workflows" / "api" / f"qwen_{hero_id}_keyart_v3_clean.json",
        ROOT / "workflows" / "api" / f"qwen_{hero_id}_keyart_v1.json",
        ROOT / "workflows" / "api" / f"qwen_{hero_id}_keyart_qwen_v1.json",
    ]
    return next((path for path in candidates if path.exists()), candidates[0])

def keyart_raw_path(hero_id: str) -> Path:
    raw_dir = ROOT / "assets" / "raw" / "heroes108"
    for suffix in ("v3_clean", "v2_clean"):
        candidate = raw_dir / f"shuihu_{hero_id}_keyart_{suffix}_00001_.png"
        if candidate.exists():
            return candidate
    return raw_dir / f"shuihu_{hero_id}_keyart_qwen_v1_00001_.png"

def turnaround_workflow(hero_id: str) -> Path:
    candidates = [
        ROOT / "workflows" / "api" / f"qwen_{hero_id}_turnaround_v2.json",
        ROOT / "workflows" / "api" / f"qwen_{hero_id}_turnaround_v1.json",
    ]
    return next((path for path in candidates if path.exists()), candidates[-1])


def character_entries(hero: dict[str, Any]) -> list[dict[str, Any]]:
    hero_id = hero["id"]
    character_dir = ROOT / "assets" / "characters" / hero_id
    keyart = character_dir / "keyart.png"
    turnaround = character_dir / "turnaround.png"
    cutout = character_dir / "cutout.png"
    thumb = character_dir / "thumb.webp"
    for path in (keyart, turnaround, cutout, thumb):
        if not path.exists():
            raise FileNotFoundError(path)

    keyart_workflow_path = keyart_workflow(hero_id)
    turnaround_workflow_path = turnaround_workflow(hero_id)
    keyart_raw = keyart_raw_path(hero_id)
    turnaround_raw = (
        ROOT
        / "assets"
        / "raw"
        / "heroes108"
        / f"shuihu_{hero_id}_turnaround_qwen_v2_00001_.png"
    )
    vision_raw = (
        ROOT
        / "assets"
        / "raw"
        / "heroes108"
        / f"shuihu_{hero_id}_vision_cutout_v1.png"
    )

    with Image.open(keyart) as image:
        if image.mode != "RGB":
            image.convert("RGB").save(keyart)

    common = {"character": hero["name"]}
    keyart_entry = {
        "id": f"{hero_id}_keyart",
        "type": "character_keyart",
        "file": relative(keyart),
        "character": hero["name"],
        **image_metadata(keyart),
    }
    if keyart_raw.exists():
        keyart_entry["source_raw"] = relative(keyart_raw)
    if keyart_workflow_path.exists():
        keyart_entry["workflow"] = relative(keyart_workflow_path)
        keyart_entry.update(workflow_metadata(keyart_workflow_path))

    turnaround_entry = {
        "id": f"{hero_id}_turnaround",
        "type": "character_turnaround",
        "file": relative(turnaround),
        **common,
        **image_metadata(turnaround),
    }
    if turnaround_raw.exists():
        turnaround_entry["source_raw"] = relative(turnaround_raw)
    if turnaround_workflow_path.exists():
        turnaround_entry["workflow"] = relative(turnaround_workflow_path)
        turnaround_entry.update(workflow_metadata(turnaround_workflow_path))

    cutout_entry = {
        "id": f"{hero_id}_cutout",
        "type": "character_cutout",
        "file": relative(cutout),
        **common,
        **image_metadata(cutout),
        "processing": (
            "Apple Vision foreground segmentation plus "
            "tools/fit_sprite_canvas.py at 896x1024 RGBA"
        ),
    }
    if keyart_raw.exists():
        cutout_entry["source_raw"] = relative(keyart_raw)
    if vision_raw.exists():
        cutout_entry["derived_raw"] = relative(vision_raw)
    if keyart_workflow_path.exists():
        cutout_entry["workflow"] = relative(keyart_workflow_path)
        cutout_entry.update(workflow_metadata(keyart_workflow_path))

    return [keyart_entry, turnaround_entry, cutout_entry]


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    retained = [
        asset
        for asset in manifest.get("assets", [])
        if asset.get("type") not in CHARACTER_TYPES
    ]
    characters: list[dict[str, Any]] = []
    for hero in hero_catalog():
        characters.extend(character_entries(hero))
    manifest["assets"] = characters + retained
    manifest["asset_count"] = len(manifest["assets"])
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {MANIFEST_PATH} with {len(characters)} character assets "
        f"across {len(characters) // 3} heroes"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
