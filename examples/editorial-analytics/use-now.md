# Use now

Project: Atlas Notes editorial evidence workspace
Source: image — brand-neutral authored example

## Rights boundary

Rights mode: `style-only`. Extract visual grammar only. Exclude source logos, brand identifiers, copy, proprietary imagery, restricted fonts, and protected assets.

## Non-negotiable invariants

- Warm paper is the default canvas; white is reserved for focused work surfaces.
- Cobalt communicates action and selection; signal lime is limited to evidence marks.
- Structure comes from typography and rules, not glass effects or stacked shadows.
- Every inference exposes its confidence and source class.

## Design rules

- visualIntent [inferred, 88%]: Create a warm editorial evidence workspace that feels precise, inspectable, and actively composed rather than magically generated.
- color [computed, 99%]: Keep a warm neutral foundation with black ink, one cobalt action color, and a sparse lime evidence signal.
- typography [inferred, 76%]: Use a compact grotesk display face, a highly legible UI sans, and a mono face for provenance and machine evidence.
- layout [observed, 94%]: Use an asymmetric twelve-column editorial grid with a strict workbench grid after analysis begins.
- spacing [computed, 96%]: Use a four-pixel base with deliberate 8, 12, 16, 24, 32, 48, and 72 pixel steps.
- surfaces [observed, 93%]: Separate surfaces with fine rules, paper tone, and only one elevated panel shadow; use 4, 8, and 14 pixel radii.
- components [inferred, 85%]: Compose controls from an index, functional label, evidence class, primary content, and an explicit action or state.
- imagery [translated, 82%]: Use real interface captures or locally drawn neutral canvases; avoid generic AI characters, glowing orbs, and empty gray placeholders.
- responsiveness [inferred, 66%]: Collapse the hero and workspace to one column below 760 pixels; keep tabs horizontally scrollable and move dense comparison into a full-width panel.
- interactions [observed, 90%]: Make every source mode, rights choice, result tab, copy action, and export control keyboard reachable with a visible focus ring.
- motion [user, 100%]: Use 120–240ms causal transitions for capture, classification, validation, and export; remove movement when reduced motion is requested.
- accessibility [computed, 91%]: Preserve semantic landmarks, labelled tabs, 4.5:1 body contrast, visible focus, non-color status cues, touch targets, reflow, and reduced motion.
- content [user, 100%]: Use concrete Chinese product copy that explains evidence, confidence, limitations, and actions; avoid vague AI superlatives.

## Design tokens

- colors-canvas: #F4F1E8
- colors-surface: #FFFEFA
- colors-ink: #191A17
- colors-muted: #686A62
- colors-line: #D7D2C5
- colors-cobalt: #3157F5
- colors-signal: #DDF45A
- colors-coral: #F05A3C
- colors-success: #1E7A55
- spacing-unit: 4
- spacing-2xs: 8
- spacing-xs: 12
- spacing-sm: 16
- spacing-md: 24
- spacing-lg: 32
- spacing-xl: 48
- spacing-2xl: 72
- radii-control: 4
- radii-card: 8
- radii-panel: 14

## Negative constraints

- Do not copy source branding, text, images, or protected assets. Do not use purple gradients, glassmorphism, generic SaaS card rows, robots, or unverified pixel-perfect claims.

## Unknowns

- No unknowns are recorded; do not create new source-specific claims without evidence.

## Verification

- Implement from this rule set, then compare structure, typography, spacing, color roles, responsive behavior, focus, and motion separately.
- Fix StyleSpec-level causes before adding local patches, and report every remaining mismatch with its evidence boundary.
