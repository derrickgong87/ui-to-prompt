#!/usr/bin/env python3
"""Extract deterministic pixel evidence without pretending to recover hidden UI facts."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageStat, UnidentifiedImageError


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def inspect_image(path: Path) -> dict:
    try:
        with Image.open(path) as source:
            source.load()
            original_format = source.format or path.suffix.lstrip(".").upper()
            image = source.convert("RGB")
    except (FileNotFoundError, UnidentifiedImageError, OSError) as error:
        raise ValueError(f"Unable to read image: {error}") from error

    width, height = image.size
    sample = image.copy()
    sample.thumbnail((512, 512))
    quantized = sample.quantize(colors=8, method=Image.Quantize.MEDIANCUT).convert("RGB")
    color_counts = quantized.getcolors(maxcolors=sample.width * sample.height) or []
    total = max(1, sample.width * sample.height)
    palette = []
    for index, (count, rgb) in enumerate(sorted(color_counts, reverse=True)[:8]):
        palette.append(
            {
                "id": f"image.palette.{index}",
                "value": rgb_to_hex(rgb),
                "coverage": round(count / total, 4),
                "status": "computed",
                "confidence": 0.99,
                "evidence": [f"image.pixel-cluster.{index}"],
            }
        )

    stats = ImageStat.Stat(sample)
    mean = [round(value, 2) for value in stats.mean]
    luminance = round((0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]) / 255, 4)
    raw = path.read_bytes()

    return {
        "schema_version": "1.0.0",
        "source": {
            "kind": "image",
            "path": str(path.resolve()),
            "format": original_format,
            "width": width,
            "height": height,
            "aspect_ratio": round(width / height, 4) if height else None,
            "sha256": hashlib.sha256(raw).hexdigest(),
        },
        "palette": palette,
        "composition": {
            "mean_rgb": mean,
            "mean_luminance": luminance,
            "orientation": "landscape" if width > height else "portrait" if height > width else "square",
            "status": "computed",
            "confidence": 1.0,
            "evidence": ["image.dimensions", "image.pixel-statistics"],
        },
        "unknowns": {
            "font_family": "unknown",
            "responsive": "unknown",
            "dom_semantics": "unknown",
            "interaction_states": "unknown",
            "motion": "unknown",
        },
        "notes": [
            "Palette values are measured from a quantized pixel sample.",
            "Typography family, responsive rules, DOM semantics, hidden states, and motion cannot be proven from one image.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        evidence = inspect_image(args.input)
    except ValueError as error:
        parser.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
