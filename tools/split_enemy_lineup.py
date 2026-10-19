#!/usr/bin/env python3
"""Split the generated enemy lineup into equal-canvas transparent portraits."""

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "enemies" / "northern_song_enemy_lineup_cutout.png"
OUTPUT_DIR = SOURCE.parent
SPRITES = ["runner", "archer", "instructor", "captain"]
CANVAS_SIZE = (520, 860)


def alpha_groups(alpha: np.ndarray, gap: int = 8) -> list[tuple[int, int]]:
    occupied = np.where((alpha > 8).sum(axis=0) > 0)[0]
    if not len(occupied):
        return []
    groups: list[tuple[int, int]] = []
    start = previous = int(occupied[0])
    for value in occupied[1:]:
        current = int(value)
        if current - previous > gap:
            groups.append((start, previous))
            start = current
        previous = current
    groups.append((start, previous))
    return groups


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    pixels = np.array(image)
    groups = alpha_groups(pixels[:, :, 3])
    if len(groups) != len(SPRITES):
        raise RuntimeError(f"Expected {len(SPRITES)} figures, found {len(groups)}: {groups}")

    canvas_width, canvas_height = CANVAS_SIZE
    for sprite_id, (left, right) in zip(SPRITES, groups, strict=True):
        isolated = pixels.copy()
        isolated[:, :left, 3] = 0
        isolated[:, right + 1 :, 3] = 0
        figure = Image.fromarray(isolated, "RGBA")

        figure_alpha = np.array(figure)[:, :, 3]
        occupied_y = np.where((figure_alpha > 8).sum(axis=1) > 0)[0]
        top, bottom = int(occupied_y[0]), int(occupied_y[-1])
        center = round((left + right) / 2)
        crop_left = max(0, min(image.width - canvas_width, center - canvas_width // 2))
        if image.width < canvas_width:
            crop_left = 0

        crop = figure.crop(
            (
                crop_left,
                max(0, top - 18),
                min(image.width, crop_left + canvas_width),
                min(image.height, bottom + 19),
            )
        )
        canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
        paste_x = (canvas_width - crop.width) // 2
        paste_y = canvas_height - crop.height
        canvas.alpha_composite(crop, (max(0, paste_x), max(0, paste_y)))
        destination = OUTPUT_DIR / f"{sprite_id}.png"
        canvas.save(destination, optimize=True)
        print(f"Wrote {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
