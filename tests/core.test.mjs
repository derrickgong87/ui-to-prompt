import test from 'node:test';
import assert from 'node:assert/strict';

import {
  exportCssVariables,
  normalizeTokens,
  validateStyleSpec,
} from '../packages/core/style-spec.mjs';
import {
  PROMPT_SECTION_ORDER,
  compileSystematicPrompt,
} from '../packages/core/prompt-compiler.mjs';

const evidence = (label, ref) => ({ label, ref });

function section(summary, details = {}) {
  return {
    status: 'observed',
    confidence: 0.9,
    evidence: [evidence('screenshot', 'capture://desktop/home')],
    summary,
    details,
  };
}

function makeValidSpec() {
  return {
    schemaVersion: '1.0',
    source: {
      kind: 'url',
      ref: 'https://example.com/',
    },
    tokens: {
      colors: {
        'Canvas BG': '#FFF',
        'Ink / Strong': ' #0F172A ',
      },
      spacing: {
        '2 XS': 4,
        Section: ' 48px ',
      },
      radii: {
        Card: 16,
      },
      typography: {
        fontFamilies: { Sans: ' Inter, sans-serif ' },
        fontSizes: { Body: 16 },
        fontWeights: { Semibold: 600 },
        lineHeights: { Body: 1.5 },
        letterSpacing: { Tight: -0.02 },
      },
      shadows: {
        Floating: ' 0 16px 48px rgb(15 23 42 / 0.12) ',
      },
      borders: {
        Subtle: ' 1px solid #E2E8F0 ',
      },
      durations: {
        Fast: 150,
      },
      easing: {
        Standard: ' cubic-bezier(0.2, 0, 0, 1) ',
      },
    },
    sections: {
      visualIntent: section('Quiet editorial confidence.', {
        adjectives: ['precise', 'calm'],
      }),
      layout: section('Centered twelve-column composition.', {
        maxWidth: '1200px',
      }),
      color: section('Neutral canvas with a dark ink color.'),
      typography: section('Grotesk sans with compact headings.'),
      spacing: section('Airy section rhythm on an eight-point grid.'),
      surfaces: section('Soft cards with restrained shadows.'),
      components: section('Rounded cards and quiet outline buttons.'),
      imagery: section('Large editorial product crops.'),
      iconography: section('Simple one-and-a-half pixel line icons.'),
      responsiveness: section('Stack the hero below 768px.'),
      interactions: section('Use visible hover and focus states.'),
      motion: section('Short ease-out entrances.'),
      accessibility: section('Preserve semantic landmarks and contrast.'),
      content: section('Use concise, benefit-led copy.'),
      constraints: section('Do not reuse source logos or proprietary assets.'),
    },
  };
}

test('validates evidence-labelled sections and confidence ranges', () => {
  const valid = validateStyleSpec(makeValidSpec());
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);

  const invalid = makeValidSpec();
  invalid.sections.layout.confidence = 1.2;
  invalid.sections.layout.evidence = [{ label: '', ref: '' }];

  const result = validateStyleSpec(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /sections\.layout\.confidence/);
  assert.match(result.errors.join('\n'), /sections\.layout\.evidence\[0\]\.label/);
  assert.match(result.errors.join('\n'), /sections\.layout\.evidence\[0\]\.ref/);
});

test('rejects a missing required section and requires an explicit reason for unknowns', () => {
  const invalid = makeValidSpec();
  delete invalid.sections.motion;
  invalid.sections.imagery = {
    status: 'unknown',
    confidence: 0,
    evidence: [],
    summary: 'The source did not expose image guidance.',
  };

  const result = validateStyleSpec(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /sections\.motion is required/);
  assert.match(result.errors.join('\n'), /sections\.imagery\.unknownReason is required/);
});

test('normalizes token names, colors, units and whitespace without mutating input', () => {
  const input = makeValidSpec().tokens;
  const snapshot = structuredClone(input);

  const normalized = normalizeTokens(input);

  assert.deepEqual(normalized.colors, {
    'canvas-bg': '#ffffff',
    'ink-strong': '#0f172a',
  });
  assert.deepEqual(normalized.spacing, {
    '2-xs': '4px',
    section: '48px',
  });
  assert.deepEqual(normalized.radii, { card: '16px' });
  assert.deepEqual(normalized.typography, {
    fontFamilies: { sans: 'Inter, sans-serif' },
    fontSizes: { body: '16px' },
    fontWeights: { semibold: 600 },
    letterSpacing: { tight: '-0.02em' },
    lineHeights: { body: 1.5 },
  });
  assert.deepEqual(normalized.durations, { fast: '150ms' });
  assert.deepEqual(input, snapshot);
});

test('exports deterministic CSS variables and comments out unknown values', () => {
  const tokens = makeValidSpec().tokens;
  tokens.colors.Accent = 'unknown';

  const css = exportCssVariables(tokens);

  assert.equal(css, [
    ':root {',
    '  /* --ui-color-accent: unknown; */',
    '  --ui-color-canvas-bg: #ffffff;',
    '  --ui-color-ink-strong: #0f172a;',
    '  --ui-border-subtle: 1px solid #E2E8F0;',
    '  --ui-duration-fast: 150ms;',
    '  --ui-easing-standard: cubic-bezier(0.2, 0, 0, 1);',
    '  --ui-radius-card: 16px;',
    '  --ui-shadow-floating: 0 16px 48px rgb(15 23 42 / 0.12);',
    '  --ui-space-2-xs: 4px;',
    '  --ui-space-section: 48px;',
    '  --ui-font-family-sans: Inter, sans-serif;',
    '  --ui-font-size-body: 16px;',
    '  --ui-font-weight-semibold: 600;',
    '  --ui-letter-spacing-tight: -0.02em;',
    '  --ui-line-height-body: 1.5;',
    '}',
    '',
  ].join('\n'));
});

test('compiles exactly fifteen deterministic systematic-prompt sections', () => {
  const first = makeValidSpec();
  const second = makeValidSpec();
  second.tokens.colors = {
    'Ink / Strong': ' #0F172A ',
    'Canvas BG': '#FFF',
  };
  second.sections.visualIntent.details = {
    adjectives: ['precise', 'calm'],
  };

  const promptA = compileSystematicPrompt(first);
  const promptB = compileSystematicPrompt(second);

  assert.equal(PROMPT_SECTION_ORDER.length, 15);
  assert.equal((promptA.match(/^## \d+\. /gm) ?? []).length, 15);
  assert.equal(promptA, promptB);
  assert.match(promptA, /Confidence: 90%/);
  assert.match(promptA, /Evidence: \[screenshot\] capture:\/\/desktop\/home/);
  assert.match(promptA, /--ui-color-canvas-bg: #ffffff/);
});

test('renders unknown sections explicitly instead of inventing missing source facts', () => {
  const spec = makeValidSpec();
  spec.sections.imagery = {
    status: 'unknown',
    confidence: 0,
    evidence: [],
    summary: 'No image treatment was observable.',
    unknownReason: 'The supplied crop contains no imagery.',
    details: {},
  };
  spec.tokens.colors.Accent = 'unknown';

  const prompt = compileSystematicPrompt(spec);

  assert.match(prompt, /Status: UNKNOWN/);
  assert.match(prompt, /Unknown handling: The supplied crop contains no imagery\. Do not invent source-specific values/);
  assert.match(prompt, /Token color\.accent is unknown/);
});

test('refuses to compile an invalid style spec', () => {
  const spec = makeValidSpec();
  delete spec.sections.accessibility;

  assert.throws(
    () => compileSystematicPrompt(spec),
    /Invalid StyleSpec: sections\.accessibility is required/,
  );
});
