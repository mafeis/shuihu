#!/usr/bin/env python3
"""Build compact visual audit sheets for all runtime hero key art."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = ROOT / "artifacts" / "qa"
THUMB_WIDTH = 208
THUMB_HEIGHT = 304
WIDE_THUMB_WIDTH = 312
WIDE_THUMB_HEIGHT = 208
LABEL_HEIGHT = 16
COLUMNS = 9
ROWS = 4


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--heroes", help="Comma-separated hero ids")
    parser.add_argument("--columns", type=int, default=COLUMNS)
    parser.add_argument("--rows", type=int, default=ROWS)
    parser.add_argument(
        "--asset",
        choices=["keyart", "turnaround"],
        default="keyart",
    )
    return parser.parse_args()


def hero_catalog() -> list[dict[str, str]]:
    script = """
import { HEROES, HERO_ORDER } from "./src/data.js";
console.log(JSON.stringify(HERO_ORDER.map((id) => ({
  id, name: HEROES[id].name,
}))));
""".strip()
    output = subprocess.check_output(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        text=True,
    )
    return json.loads(output)


def main() -> int:
    args = parse_args()
    selected = set(filter(None, (args.heroes or "").split(",")))
    heroes = [
        hero for hero in hero_catalog() if not selected or hero["id"] in selected
    ]
    wide = args.asset == "turnaround"
    thumb_width = WIDE_THUMB_WIDTH if wide else THUMB_WIDTH
    thumb_height = WIDE_THUMB_HEIGHT if wide else THUMB_HEIGHT
    output_root = ARTIFACT_ROOT / f"hero-{args.asset}"
    output_root.mkdir(parents=True, exist_ok=True)
    for stale in output_root.glob("page-*.jpg"):
        stale.unlink()
    font = ImageFont.load_default()
    page_size = args.columns * args.rows
    pages = []
    for page_index in range(0, len(heroes), page_size):
        page = heroes[page_index : page_index + page_size]
        sheet = Image.new(
            "RGB",
            (
                args.columns * (thumb_width + 8),
                args.rows * (thumb_height + LABEL_HEIGHT + 8),
            ),
            (22, 26, 26),
        )
        draw = ImageDraw.Draw(sheet)
        for index, hero in enumerate(page):
            hero_id = hero["id"]
            image_path = (
                ROOT / "assets" / "characters" / hero_id / f"{args.asset}.png"
            )
            if not image_path.exists():
                image = Image.new(
                    "RGB",
                    (thumb_width, thumb_height),
                    (70, 20, 20),
                )
            else:
                with Image.open(image_path) as source:
                    fitted = source.convert("RGB")
                    fitted.thumbnail(
                        (thumb_width, thumb_height),
                        Image.Resampling.LANCZOS,
                    )
                    image = Image.new(
                        "RGB",
                        (thumb_width, thumb_height),
                        (22, 26, 26),
                    )
                    image.paste(
                        fitted,
                        (
                            (thumb_width - fitted.width) // 2,
                            (thumb_height - fitted.height) // 2,
                        ),
                    )
            x = (index % args.columns) * (thumb_width + 8) + 4
            y = (index // args.columns) * (thumb_height + LABEL_HEIGHT + 8) + 4
            sheet.paste(image, (x, y))
            draw.text(
                (x + 3, y + thumb_height + 1),
                f"{hero_id} · {hero['name']}",
                fill=(224, 217, 199),
                font=font,
            )
        output = output_root / f"page-{len(pages) + 1:02d}.jpg"
        sheet.save(output, quality=90, optimize=True)
        pages.append(output)
        print(output, flush=True)
    print(json.dumps({"status": "passed", "heroes": len(heroes), "pages": len(pages)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
