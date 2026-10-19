#!/usr/bin/env python3
"""Fit a transparent character render into a consistent bottom-aligned canvas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=520)
    parser.add_argument("--height", type=int, default=860)
    parser.add_argument("--scale", type=float, default=0.92)
    parser.add_argument("--bottom-margin", type=int, default=12)
    parser.add_argument("--alpha-threshold", type=int, default=8)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    image = Image.open(args.input).convert("RGBA")
    alpha = image.getchannel("A")
    if args.alpha_threshold > 0:
        alpha = alpha.point(
            lambda value: value if value > args.alpha_threshold else 0
        )
        image.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise SystemExit("Input has no visible pixels.")
    figure = image.crop(bounds)

    available_width = max(1, round(args.width * args.scale))
    available_height = max(1, round(args.height * args.scale))
    scale = min(
        available_width / figure.width,
        available_height / figure.height,
    )
    resized = figure.resize(
        (
            max(1, round(figure.width * scale)),
            max(1, round(figure.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (args.width, args.height), (0, 0, 0, 0))
    x = (args.width - resized.width) // 2
    y = args.height - args.bottom_margin - resized.height
    canvas.alpha_composite(resized, (x, y))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, optimize=True)
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
