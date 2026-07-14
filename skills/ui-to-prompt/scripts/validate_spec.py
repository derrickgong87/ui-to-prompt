#!/usr/bin/env python3
"""Validate the portable UItoPrompt StyleSpec contract without extra dependencies."""

from __future__ import annotations

import argparse
import json
import math
import re
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
TOP_LEVEL_KEYS = REQUIRED
METADATA_KEYS = {"title", "rightsMode"}
SOURCE_KEYS = {"kind", "ref"}
TOKEN_GROUPS = {
    "colors", "spacing", "radii", "typography", "shadows", "borders",
    "durations", "easing",
}
TYPOGRAPHY_GROUPS = {
    "fontFamilies", "fontSizes", "fontWeights", "letterSpacing", "lineHeights",
}
SECTION_FIELDS = {
    "status", "confidence", "evidence", "summary", "details", "unknownReason",
}
EVIDENCE_FIELDS = {"label", "ref", "note"}
UNSAFE_CSS = re.compile(
    r"[;{}\x00-\x1f]|/\*|\*/|(?:url|expression)\s*\(|@import",
    re.IGNORECASE,
)


def reject_additional_properties(value, allowed, path, errors):
    if not isinstance(value, dict):
        return
    for key in sorted(set(value) - allowed):
        errors.append(f"{path}.{key} is not supported")


def validate_token_map(value, path, errors):
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return
    for name, token in value.items():
        token_path = f"{path}.{name}"
        if token is None:
            continue
        if isinstance(token, (int, float)) and not isinstance(token, bool) and math.isfinite(token):
            continue
        if isinstance(token, str) and token.strip():
            if UNSAFE_CSS.search(token):
                errors.append(f"{token_path} contains unsafe CSS syntax")
            continue
        errors.append(f"{token_path} must be a finite number, non-empty string, or null")


def validate_tokens(tokens, errors):
    if not isinstance(tokens, dict):
        errors.append("$.tokens must be an object")
        return
    reject_additional_properties(tokens, TOKEN_GROUPS, "$.tokens", errors)
    for group in sorted(TOKEN_GROUPS & set(tokens)):
        if group != "typography":
            validate_token_map(tokens[group], f"$.tokens.{group}", errors)
            continue
        typography = tokens[group]
        if not isinstance(typography, dict):
            errors.append("$.tokens.typography must be an object")
            continue
        reject_additional_properties(
            typography, TYPOGRAPHY_GROUPS, "$.tokens.typography", errors
        )
        for typography_group in sorted(TYPOGRAPHY_GROUPS & set(typography)):
            validate_token_map(
                typography[typography_group],
                f"$.tokens.typography.{typography_group}",
                errors,
            )


def validate_section(section, path, errors):
    if not isinstance(section, dict):
        errors.append(f"{path} must be an object")
        return
    reject_additional_properties(section, SECTION_FIELDS, path, errors)
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
        reject_additional_properties(item, EVIDENCE_FIELDS, item_path, errors)
        if item.get("label") not in EVIDENCE_LABELS:
            errors.append(f"{item_path}.label is not supported")
        if not isinstance(item.get("ref"), str) or not item["ref"].strip():
            errors.append(f"{item_path}.ref must be a non-empty string")
        if "note" in item and not isinstance(item["note"], str):
            errors.append(f"{item_path}.note must be a string when provided")
    details = section.get("details")
    if details is not None and not isinstance(details, (dict, list)):
        errors.append(f"{path}.details must be an object or array when provided")


def validate_spec(spec: dict) -> list[str]:
    if not isinstance(spec, dict):
        return ["StyleSpec must be a JSON object"]
    errors = []
    reject_additional_properties(spec, TOP_LEVEL_KEYS, "$", errors)
    for key in sorted(REQUIRED - set(spec)):
        errors.append(f"$.{key} is required")
    if spec.get("schemaVersion") != "1.0":
        errors.append("$.schemaVersion must equal 1.0")
    metadata = spec.get("metadata")
    if not isinstance(metadata, dict):
        errors.append("$.metadata must be an object")
    else:
        reject_additional_properties(metadata, METADATA_KEYS, "$.metadata", errors)
        if not isinstance(metadata.get("title"), str) or not metadata["title"].strip():
            errors.append("$.metadata.title is required")
        if metadata.get("rightsMode") not in {"style-only", "authorized-reconstruction"}:
            errors.append("$.metadata.rightsMode is not supported")
    source = spec.get("source")
    if not isinstance(source, dict):
        errors.append("$.source must be an object")
    else:
        reject_additional_properties(source, SOURCE_KEYS, "$.source", errors)
        if source.get("kind") not in {"url", "image"}:
            errors.append("$.source.kind must be url or image")
        if not isinstance(source.get("ref"), str) or not source["ref"].strip():
            errors.append("$.source.ref is required")
    validate_tokens(spec.get("tokens"), errors)
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
