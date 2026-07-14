#!/usr/bin/env python3
"""Validate the portable UItoPrompt StyleSpec contract without extra dependencies."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


STATUSES = {"observed", "computed", "inferred", "translated", "user", "unknown"}
EVIDENCE_LABELS = {
    "screenshot", "dom", "css", "font", "animation", "network",
    "ocr", "visual-model", "user", "derived",
}
SECTION_KEYS = {
    "visualIntent", "layout", "color", "typography", "spacing", "surfaces",
    "components", "imagery", "iconography", "responsiveness", "interactions",
    "motion", "accessibility", "content", "constraints",
}
REQUIRED = {"schemaVersion", "metadata", "source", "tokens", "sections"}


def validate_section(section, path, errors):
    if not isinstance(section, dict):
        errors.append(f"{path} must be an object")
        return
    status = section.get("status")
    if status not in STATUSES:
        errors.append(f"{path}.status must be one of {sorted(STATUSES)}")
    confidence = section.get("confidence")
    if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
        errors.append(f"{path}.confidence must be between 0 and 1")
    if not isinstance(section.get("summary"), str) or not section["summary"].strip():
        errors.append(f"{path}.summary must be a non-empty string")
    evidence = section.get("evidence")
    if not isinstance(evidence, list):
        errors.append(f"{path}.evidence must be an array")
        evidence = []
    if status != "unknown" and not evidence:
        errors.append(f"{path}.evidence is required for evidence-backed sections")
    if status == "unknown" and not str(section.get("unknownReason", "")).strip():
        errors.append(f"{path}.unknownReason is required when status is unknown")
    for index, item in enumerate(evidence):
        item_path = f"{path}.evidence[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{item_path} must be an object")
            continue
        if item.get("label") not in EVIDENCE_LABELS:
            errors.append(f"{item_path}.label is not supported")
        if not isinstance(item.get("ref"), str) or not item["ref"].strip():
            errors.append(f"{item_path}.ref must be a non-empty string")


def validate_spec(spec: dict) -> list[str]:
    if not isinstance(spec, dict):
        return ["StyleSpec must be a JSON object"]
    errors = []
    for key in sorted(REQUIRED - set(spec)):
        errors.append(f"$.{key} is required")
    if spec.get("schemaVersion") != "1.0":
        errors.append("$.schemaVersion must equal 1.0")
    metadata = spec.get("metadata")
    if not isinstance(metadata, dict):
        errors.append("$.metadata must be an object")
    else:
        if not isinstance(metadata.get("title"), str) or not metadata["title"].strip():
            errors.append("$.metadata.title is required")
        if metadata.get("rightsMode") not in {"style-only", "authorized-reconstruction"}:
            errors.append("$.metadata.rightsMode is not supported")
    source = spec.get("source")
    if not isinstance(source, dict):
        errors.append("$.source must be an object")
    else:
        if source.get("kind") not in {"url", "image"}:
            errors.append("$.source.kind must be url or image")
        if not isinstance(source.get("ref"), str) or not source["ref"].strip():
            errors.append("$.source.ref is required")
    if not isinstance(spec.get("tokens"), dict):
        errors.append("$.tokens must be an object")
    sections = spec.get("sections")
    if not isinstance(sections, dict):
        errors.append("$.sections must be an object")
    else:
        for key in sorted(SECTION_KEYS - set(sections)):
            errors.append(f"$.sections.{key} is required")
        for key in sorted(set(sections) - SECTION_KEYS):
            errors.append(f"$.sections.{key} is not supported")
        for key in sorted(SECTION_KEYS & set(sections)):
            validate_section(sections[key], f"$.sections.{key}", errors)
    return errors


def load_spec(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Unable to load StyleSpec: {error}") from error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    try:
        spec = load_spec(args.input)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    errors = validate_spec(spec)
    if errors:
        print("StyleSpec validation failed:\n- " + "\n- ".join(errors), file=sys.stderr)
        return 1
    print("StyleSpec is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
