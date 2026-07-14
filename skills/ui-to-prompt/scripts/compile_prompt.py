#!/usr/bin/env python3
"""Compile StyleSpec into deterministic prompt, token, and evidence artifacts."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from validate_spec import load_spec, validate_spec


SECTIONS = [
    "Mission and scope",
    "Authority and rights boundary",
    "Source-of-truth order",
    "Visual north star",
    "Non-negotiable invariants",
    "Design tokens",
    "Layout and responsive behavior",
    "Component grammar",
    "Content density and imagery",
    "Interaction and motion",
    "Accessibility and performance",
    "Negative constraints",
    "Unknown-handling rules",
    "Acceptance checklist",
    "Iteration protocol",
]


def value_of(item):
    return item.get("value") if isinstance(item, dict) else item


def bullet_list(items, fallback="No evidence-backed rules were available; preserve this as unknown."):
    if isinstance(items, dict):
        items = [f"{key}: {value_of(value)}" for key, value in items.items()]
    values = [value_of(item) for item in (items or [])]
    values = [str(value) for value in values if value not in (None, "")]
    return "\n".join(f"- {value}" for value in values) if values else f"- {fallback}"


def flatten_tokens(tokens, prefix=""):
    for key, value in (tokens or {}).items():
        name = f"{prefix}-{key}" if prefix else key
        if isinstance(value, dict) and "value" not in value:
            yield from flatten_tokens(value, name)
        else:
            yield name, value_of(value)


def compile_prompt(spec: dict) -> str:
    metadata = spec.get("metadata", {})
    rights = metadata.get("rights_mode", "style-only")
    title = metadata.get("title", "Untitled visual reference")
    tokens = list(flatten_tokens(spec.get("design_tokens", {})))
    uncertainties = [
        f"{item.get('field', 'Unspecified field')}: {item.get('reason', 'Unknown from available evidence')}"
        if isinstance(item, dict)
        else str(item)
        for item in spec.get("uncertainties", [])
    ]

    content = [
        f"Recreate the design language described by **{title}** as an original, semantic, editable interface. Follow the supplied rules rather than copying source code.",
        f"Rights mode: `{rights}`. In style-only mode, exclude source logos, brand names, long-form copy, proprietary imagery, restricted fonts, and distinctive protected assets.",
        "Resolve conflicts in this order: exact-context browser facts; matching screenshot; cross-viewport evidence; single-image inference; general design convention. Preserve unknowns instead of inventing facts.",
        bullet_list(spec.get("visual_principles")),
        bullet_list(spec.get("acceptance_targets"), "Keep only the evidence-backed invariants recorded in StyleSpec."),
        bullet_list([f"{name}: {value}" for name, value in tokens]),
        bullet_list([*spec.get("layout", []), *spec.get("responsive_rules", [])]),
        bullet_list(spec.get("components")),
        "Use original content with the same evidence-backed hierarchy, density, line-length rhythm, and image-role relationships. Do not reuse source copy or protected assets.",
        bullet_list(spec.get("interaction_motion"), "Do not invent hidden interaction or motion behavior; use restrained accessible defaults and mark them as implementation choices."),
        bullet_list(spec.get("accessibility"), "Use semantic HTML, visible keyboard focus, sufficient contrast, touch targets, reflow, and reduced-motion support."),
        bullet_list(spec.get("negative_constraints")),
        bullet_list(uncertainties, "No unresolved fields were recorded. Still do not claim facts beyond the StyleSpec."),
        bullet_list(spec.get("acceptance_targets")),
        "After the first implementation, compare structure, typography, wrapping, spacing, palette roles, responsive behavior, focus, and motion separately. Fix the StyleSpec-level cause before adding local patches. Never use the source screenshot as a background implementation.",
    ]
    lines = ["# Systematic Design Prompt", ""]
    for index, (title, body) in enumerate(zip(SECTIONS, content), start=1):
        lines.extend([f"## {index}. {title}", "", body, ""])
    return "\n".join(lines).rstrip() + "\n"


def css_name(name: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")


def compile_css(spec: dict) -> str:
    lines = [":root {"]
    for name, value in flatten_tokens(spec.get("design_tokens", {})):
        if isinstance(value, (str, int, float)) and value != "":
            lines.append(f"  --ui-{css_name(name)}: {value};")
    lines.append("}")
    return "\n".join(lines) + "\n"


def compile_evidence_report(spec: dict) -> str:
    metadata = spec.get("metadata", {})
    provenance = spec.get("provenance", {})
    lines = [
        "# Evidence and uncertainty report",
        "",
        f"- Title: {metadata.get('title', 'Untitled')}",
        f"- Source kind: {metadata.get('source_kind', 'unknown')}",
        f"- Rights mode: {metadata.get('rights_mode', 'style-only')}",
        f"- Source: {provenance.get('source', 'not recorded')}",
        f"- Captured at: {provenance.get('captured_at', 'not recorded')}",
        "",
        "## Uncertainties",
        "",
        bullet_list(
            [
                f"{item.get('field', 'Unspecified')}: {item.get('reason', 'No reason recorded')}"
                if isinstance(item, dict)
                else item
                for item in spec.get("uncertainties", [])
            ],
            "No uncertainties were recorded.",
        ),
        "",
        "## Evidence policy",
        "",
        "Observed and computed values outrank inferences. Unknown values must not be silently replaced with framework defaults.",
    ]
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
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

    args.output_dir.mkdir(parents=True, exist_ok=True)
    prompt = compile_prompt(spec)
    (args.output_dir / "systematic-prompt.md").write_text(prompt, encoding="utf-8")
    use_now = "# Use now\n\n" + "\n".join(prompt.splitlines()[4:32]).strip() + "\n"
    (args.output_dir / "use-now.md").write_text(use_now, encoding="utf-8")
    (args.output_dir / "variables.css").write_text(compile_css(spec), encoding="utf-8")
    (args.output_dir / "evidence-report.md").write_text(compile_evidence_report(spec), encoding="utf-8")
    (args.output_dir / "style-spec.json").write_text(
        json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
