#!/usr/bin/env python3
"""Post-process generated UI sheets into transparent, game-ready icons."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]


SHEETS = {
    "path": {
        "source": ROOT / "assets/raw/shuihu_ui_path_icons_transparent_v1_00001_.png",
        "columns": 2,
        "rows": 2,
        "names": ["gangmeng_spear", "lingqiao_blades", "taolue_scroll", "shouyu_shield"],
        "strip_uniform_background": True,
    },
    "status": {
        "source": ROOT / "assets/raw/shuihu_ui_status_icons_transparent_v1_00001_.png",
        "columns": 3,
        "rows": 2,
        "names": ["armor_break", "bleeding", "stun", "guard", "inspiration", "acupoint_seal"],
        "strip_uniform_background": False,
    },
    "resource": {
        "source": ROOT / "assets/raw/shuihu_ui_resource_icons_transparent_v1_00001_.png",
        "columns": 2,
        "rows": 2,
        "names": ["yiqi", "copper_coins", "heroic_star", "stance_break"],
        "strip_uniform_background": False,
    },
}


def remove_connected_background(
    image: Image.Image, tolerance: int = 18, feather_radius: float = 0.55
) -> Image.Image:
    """Remove only background-colored pixels connected to the image border."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    background = pixels[0, 0][:3]
    candidates = bytearray(width * height)

    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            if (
                abs(r - background[0]) <= tolerance
                and abs(g - background[1]) <= tolerance
                and abs(b - background[2]) <= tolerance
            ):
                candidates[y * width + x] = 1

    removed = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if removed[index] or not candidates[index]:
            continue
        removed[index] = 1
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if removed[y * width + x]:
                alpha_pixels[x, y] = 0

    # The tiny blur softens the model's one-pixel matte without eating the silhouette.
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather_radius))
    rgba.putalpha(alpha)
    return rgba


def crop_to_square_icon(image: Image.Image, size: int = 512, padding: int = 36) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Icon cell is fully transparent")
    subject = image.crop(bbox)
    available = size - padding * 2
    scale = min(available / subject.width, available / subject.height)
    resized = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - resized.width) // 2, (size - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def export_sheet(
    source: Path,
    output_dir: Path,
    columns: int,
    rows: int,
    names: list[str],
    strip_uniform_background: bool,
) -> list[Path]:
    image = Image.open(source).convert("RGBA")
    if strip_uniform_background:
        image = remove_connected_background(image)
    cell_width = image.width // columns
    cell_height = image.height // rows
    if len(names) != columns * rows:
        raise ValueError("Icon name count must match grid cell count")

    output_dir.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for index, name in enumerate(names):
        column = index % columns
        row = index // columns
        cell = image.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        icon_512 = crop_to_square_icon(cell, size=512, padding=34)
        path_512 = output_dir / f"{name}_512.png"
        icon_512.save(path_512)
        icon_512.resize((256, 256), Image.Resampling.LANCZOS).save(
            output_dir / f"{name}_256.png"
        )
        saved.append(path_512)
    return saved


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir", type=Path, default=ROOT / "assets/ui/icons"
    )
    parser.add_argument(
        "--sheets-dir", type=Path, default=ROOT / "assets/ui/sheets"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    for sheet_name, config in SHEETS.items():
        processed = Image.open(config["source"]).convert("RGBA")
        if config["strip_uniform_background"]:
            processed = remove_connected_background(processed)
        args.sheets_dir.mkdir(parents=True, exist_ok=True)
        processed.save(args.sheets_dir / f"{sheet_name}_icons_transparent.png")
        saved = export_sheet(
            source=config["source"],
            output_dir=args.output_dir,
            columns=config["columns"],
            rows=config["rows"],
            names=config["names"],
            strip_uniform_background=config["strip_uniform_background"],
        )
        for path in saved:
            print(f"{sheet_name}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
