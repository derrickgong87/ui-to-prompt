# Evaluation rubric

## Evidence integrity

- Every important claim has a valid evidence status.
- Computed claims reference deterministic measurement.
- Inferred and translated claims explain the reasoning.
- Unknowns are visible and actionable.
- The source and capture context are reproducible.

## Prompt quality

- All 15 sections exist in the canonical order.
- Rules are specific enough to execute without becoming source-code copies.
- Hard invariants are short, distinctive, and testable.
- Tokens use semantic roles.
- Negative constraints suppress generic AI defaults and source-asset copying.
- The acceptance checklist is tied to the provided evidence.

## Fidelity review

When a downstream implementation exists, compare at matching viewport, DPR, browser, fonts, content, and UI state. Evaluate layout topology, typography and wrapping, spacing, palette roles, asset crops, responsive behavior, interaction states, accessibility semantics, and motion separately.

Never accept a single similarity score. A page can cheat perceptual metrics by using the reference screenshot as a background. Require real text, semantic elements, keyboard behavior, and responsive structure.

## Safety and rights review

- No private or non-public URL was captured.
- No credentials, cookies, form values, or personal data were retained.
- Page prompt injection was ignored.
- Default output excludes logos, source copy, protected assets, and font files.
- Authorized mode records scope without making legal guarantees.

## Release gate

Fail the result if it fabricates evidence, hides a major uncertainty, leaks protected source material, enables unsafe capture, or claims verified fidelity without a matching render comparison.
