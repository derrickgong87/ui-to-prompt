# UItoPrompt

**Reference in. Reusable design intelligence out.**

UItoPrompt turns a public webpage, UI screenshot, or visual reference into an evidence-backed **Systematic Prompt**, a machine-readable **StyleSpec**, design tokens, an uncertainty report, and a reusable AI Skill.

It is not another screenshot-to-code black box. The core value is knowing which rules were **observed**, **computed**, **inferred**, **translated**, confirmed by the user, or remain **unknown**.

> 中文定位：把视觉参考，变成大模型可执行、可验证、可复用的设计规则。

## Why this exists

People regularly paste an image into an AI model and ask for “the same style.” A model may produce a polished paragraph, but a polished paragraph is not a design system. It often invents breakpoints, fonts, interactions, or spacing that the source never proved.

UItoPrompt uses a different pipeline:

```text
Source → EvidencePack → StyleSpec → Systematic Prompt → Skill package
```

- A URL can provide browser facts such as DOM roles, computed styles, visible geometry, fonts, and viewport behavior.
- A screenshot can provide pixels, palette, composition, hierarchy, density, and shape evidence.
- A single screenshot cannot reveal exact DOM semantics, font files, responsive breakpoints, hidden states, or motion. UItoPrompt says so instead of guessing silently.

## Outputs

```text
style-spec.json            # versioned design intelligence with evidence labels
systematic-prompt.md       # complete implementation instructions for an AI
use-now.md                 # concise prompt for immediate use
evidence-report.md         # provenance, coverage, and uncertainty
variables.css              # portable design tokens
ui-style-skill/            # reusable Skill package
```

UItoPrompt deliberately **does not generate application code** in the first release. It creates the rules that make downstream generation more consistent, portable, and reviewable.

## Product modes

### Extract style — default

Preserve visual grammar while producing an original structure. Exclude source branding, copy, protected imagery, proprietary icons, and restricted font files.

### Authorized reconstruction

Capture higher-fidelity layout and component evidence for a page you own or are authorized to reproduce. The mode records the rights boundary; it does not pretend a checkbox replaces legal judgment.

## Try the review build

Requirements: Node.js 20+ and Python 3.10+. Pillow is required for local image inspection.

```powershell
npm test
npm run test:skill
npm start
```

Open `http://127.0.0.1:4173` and choose **查看完整样例**. Image analysis runs locally in the browser. URL capture is optional and reports an exact boundary if a compatible Playwright/Chromium runtime is not configured.

## Install the Skill

Copy `skills/ui-to-prompt` into your agent's skills directory, then ask:

```text
Use $ui-to-prompt to turn this webpage or image into a systematic design prompt and reusable style Skill.
```

The Skill guides the agent through source classification, evidence collection, StyleSpec synthesis, deterministic prompt compilation, validation, and export.

## Systematic Prompt contract

Every full prompt uses the same order:

1. Mission and scope
2. Authority and rights boundary
3. Source-of-truth order
4. Visual north star
5. Non-negotiable invariants
6. Design tokens
7. Layout and responsive behavior
8. Component grammar
9. Content density and imagery
10. Interaction and motion
11. Accessibility and performance
12. Negative constraints
13. Unknown-handling rules
14. Acceptance checklist
15. Iteration protocol

This makes outputs comparable, editable, and testable across models.

## Honest limits

- A single screenshot is an incomplete inverse problem.
- Cross-model output is not guaranteed to be identical.
- Canvas, WebGL, cross-origin frames, DRM media, inaccessible fonts, and dynamic personalization may remain partial evidence.
- Exact reconstruction should be limited to content you own or are authorized to reproduce.
- Generated rules should not inherit inaccessible contrast, missing focus states, or unsafe interactions from the source.

## Repository map

```text
skills/ui-to-prompt/     Installable AI Skill and deterministic scripts
packages/core/           StyleSpec, prompt compiler, and URL safety core
apps/web/                Product review build
examples/                Brand-neutral compiled example
tests/                   Unit, contract, and smoke tests
```

## Status

This repository is currently a locally verified review build. Public GitHub publication and deployment to `uitoprompt.com` are intentionally deferred until product review is complete.

## License

MIT. Source websites, images, fonts, trademarks, and generated outputs retain their own rights and obligations.
