#!/usr/bin/env python3
"""Extract deterministic pixel evidence without pretending to recover hidden UI facts."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError


MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_image(
    path: Path,
    *,
    max_bytes: int = MAX_IMAGE_BYTES,
    max_pixels: int = MAX_IMAGE_PIXELS,
) -> dict:
    try:
        file_bytes = path.stat().st_size
    except OSError as error:
        raise ValueError(f"Unable to read image: {error}") from error
    if file_bytes > max_bytes:
        raise ValueError(
            f"Image exceeds the {max_bytes}-byte file-size limit ({file_bytes} bytes)."
        )

    try:
        with Image.open(path) as source:
            original_format = source.format or path.suffix.lstrip(".").upper()
            width, height = source.size
            pixels = width * height
            if pixels > max_pixels:
                raise ValueError(
                    f"Image exceeds the {max_pixels}-pixel limit ({pixels} pixels)."
                )
            oriented = ImageOps.exif_transpose(source)
            width, height = oriented.size
            oriented.thumbnail((512, 512), Image.Resampling.LANCZOS, reducing_gap=3.0)
            sample = oriented.convert("RGB")
    except ValueError:
        raise
    except (
        FileNotFoundError,
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
    ) as error:
        raise ValueError(f"Unable to read image: {error}") from error

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

    return {
        "schema_version": "1.0.0",
        "source": {
            "kind": "image",
            "path": path.name,
            "format": original_format,
            "width": width,
            "height": height,
            "aspect_ratio": round(width / height, 4) if height else None,
            "sha256": sha256_file(path),
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
