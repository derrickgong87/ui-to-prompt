# Systematic Design Prompt

## 1. Mission and scope

### visualIntent
Status: INFERRED
Confidence: 88%
Directive: Create a warm editorial evidence workspace that feels precise, inspectable, and actively composed rather than magically generated.
Structured details:
```json
{
  "invariants": [
    "Warm paper is the default canvas; white is reserved for focused work surfaces.",
    "Cobalt communicates action and selection; signal lime is limited to evidence marks.",
    "Structure comes from typography and rules, not glass effects or stacked shadows.",
    "Every inference exposes its confidence and source class."
  ]
}
```

## 2. Authority and rights boundary

Rights mode: `style-only`. In style-only mode, exclude source logos, brand names, long-form copy, proprietary imagery, restricted fonts, and distinctive protected assets.

## 3. Source-of-truth order

Resolve conflicts in this order: exact-context browser facts; matching screenshot; cross-viewport evidence; single-image inference; general design convention. Preserve unknowns instead of inventing facts.

## 4. Visual north star

### color
Status: COMPUTED
Confidence: 99%
Directive: Keep a warm neutral foundation with black ink, one cobalt action color, and a sparse lime evidence signal.

### typography
Status: INFERRED
Confidence: 76%
Directive: Use a compact grotesk display face, a highly legible UI sans, and a mono face for provenance and machine evidence.
Structured details:
```json
{
  "fallback": "Use open-source substitutes with similar width and x-height; record substitutions."
}
```

## 5. Non-negotiable invariants

- Warm paper is the default canvas; white is reserved for focused work surfaces.
- Cobalt communicates action and selection; signal lime is limited to evidence marks.
- Structure comes from typography and rules, not glass effects or stacked shadows.
- Every inference exposes its confidence and source class.

## 6. Design tokens

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
- typography-fontFamilies-display: General Sans, Source Han Sans SC, sans-serif
- typography-fontFamilies-body: Instrument Sans, Source Han Sans SC, sans-serif
- typography-fontFamilies-mono: IBM Plex Mono, Cascadia Code, monospace
- typography-fontSizes-meta: 12
- typography-fontSizes-body: 16
- typography-fontSizes-subhead: 22
- typography-fontSizes-section: 38
- typography-fontSizes-hero: 72
- typography-fontWeights-regular: 420
- typography-fontWeights-medium: 550
- typography-fontWeights-display: 650
- typography-letterSpacing-meta: 0.08
- typography-letterSpacing-display: -0.04
- typography-lineHeights-body: 1.5
- typography-lineHeights-display: 0.96
- shadows-floating-panel: 0 24px 64px rgb(25 26 23 / 0.10)
- borders-hairline: 1px solid #D7D2C5
- borders-ink: 1px solid #191A17
- durations-micro: 120
- durations-short: 180
- durations-medium: 240
- easing-standard: cubic-bezier(.2,.8,.2,1)

## 7. Layout and responsive behavior

### layout
Status: OBSERVED
Confidence: 94%
Directive: Use an asymmetric twelve-column editorial grid with a strict workbench grid after analysis begins.
Structured details:
```json
{
  "desktop": "4/8 hero split",
  "workspace": "summary header, tab rail, focused panel"
}
```

### responsiveness
Status: INFERRED
Confidence: 66%
Directive: Collapse the hero and workspace to one column below 760 pixels; keep tabs horizontally scrollable and move dense comparison into a full-width panel.
Structured details:
```json
{
  "boundary": "The exact source breakpoints are not claimed; 760px is an authored implementation rule."
}
```

## 8. Component grammar

### components
Status: INFERRED
Confidence: 85%
Directive: Compose controls from an index, functional label, evidence class, primary content, and an explicit action or state.

### iconography
Status: INFERRED
Confidence: 74%
Directive: Use sparse geometric arrows and status marks at a consistent optical weight; never substitute emoji.

## 9. Content density and imagery

### content
Status: USER
Confidence: 100%
Directive: Use concrete Chinese product copy that explains evidence, confidence, limitations, and actions; avoid vague AI superlatives.

### imagery
Status: TRANSLATED
Confidence: 82%
Directive: Use real interface captures or locally drawn neutral canvases; avoid generic AI characters, glowing orbs, and empty gray placeholders.

## 10. Interaction and motion

### interactions
Status: OBSERVED
Confidence: 90%
Directive: Make every source mode, rights choice, result tab, copy action, and export control keyboard reachable with a visible focus ring.

### motion
Status: USER
Confidence: 100%
Directive: Use 120–240ms causal transitions for capture, classification, validation, and export; remove movement when reduced motion is requested.

## 11. Accessibility and performance

### accessibility
Status: COMPUTED
Confidence: 91%
Directive: Preserve semantic landmarks, labelled tabs, 4.5:1 body contrast, visible focus, non-color status cues, touch targets, reflow, and reduced motion.

## 12. Negative constraints

- Do not copy source branding, text, images, or protected assets. Do not use purple gradients, glassmorphism, generic SaaS card rows, robots, or unverified pixel-perfect claims.

## 13. Unknown-handling rules

- No unresolved fields were recorded. Still do not claim facts beyond the StyleSpec.

## 14. Acceptance checklist

- Verify every observed and computed directive.
- Preserve inferred and translated guidance in proportion to confidence.
- Keep every unknown visible and replaceable.

## 15. Iteration protocol

After the first implementation, compare structure, typography, wrapping, spacing, palette roles, responsive behavior, focus, and motion separately. Fix the StyleSpec-level cause before adding local patches. Never use the source screenshot as a background implementation.
