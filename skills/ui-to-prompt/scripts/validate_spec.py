#!/usr/bin/env python3
"""Validate the portable UItoPrompt StyleSpec contract without extra dependencies."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


STATUSES = {"observed", "computed", "inferred", "translated", "user", "unknown"}
REQUIRED = {
    "schema_version",
    "metadata",
    "provenance",
    "visual_principles",
    "design_tokens",
    "layout",
    "components",
    "responsive_rules",
    "interaction_motion",
    "accessibility",
    "negative_constraints",
    "uncertainties",
    "acceptance_targets",
}


def validate_node(node, path="$", errors=None):
    errors = [] if errors is None else errors
    if isinstance(node, dict):
        if "status" in node and node["status"] not in STATUSES:
            errors.append(f"{path}.status must be one of {sorted(STATUSES)}")
        if "confidence" in node:
            value = node["confidence"]
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 1:
                errors.append(f"{path}.confidence must be between 0 and 1")
        if "status" in node and node["status"] != "unknown":
            evidence = node.get("evidence")
            if "value" in node and (not isinstance(evidence, list) or not evidence):
                errors.append(f"{path}.evidence is required for evidence-backed values")
        for key, value in node.items():
            validate_node(value, f"{path}.{key}", errors)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            validate_node(value, f"{path}[{index}]", errors)
    return errors


def validate_spec(spec: dict) -> list[str]:
    if not isinstance(spec, dict):
        return ["StyleSpec must be a JSON object"]
    errors = []
    for key in sorted(REQUIRED - set(spec)):
        errors.append(f"$.{key} is required")
    if spec.get("schema_version") != "1.0.0":
        errors.append("$.schema_version must equal 1.0.0")
    errors.extend(validate_node(spec))
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
