import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('canonical JSON Schema rejects whitespace-only required strings', async () => {
  const schema = JSON.parse(await readFile(new URL('../packages/core/style-spec.schema.json', import.meta.url), 'utf8'));

  assert.equal(schema.properties.metadata.properties.title.pattern, '\\S');
  assert.equal(schema.properties.source.properties.ref.pattern, '\\S');
  assert.equal(schema.$defs.evidence.properties.ref.pattern, '\\S');
  assert.equal(schema.$defs.section.properties.summary.pattern, '\\S');
  assert.equal(schema.$defs.section.properties.unknownReason.pattern, '\\S');
  assert.equal(schema.$defs.tokenValue.oneOf[0].pattern, '\\S');
});

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
    metadata: {
      title: 'Example editorial landing page',
      rightsMode: 'style-only',
    },
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

test('requires canonical metadata and constrains the rights mode', () => {
  const missingMetadata = makeValidSpec();
  delete missingMetadata.metadata;

  const missingResult = validateStyleSpec(missingMetadata);
  assert.equal(missingResult.valid, false);
  assert.match(missingResult.errors.join('\n'), /metadata is required/);

  const invalidRights = makeValidSpec();
  invalidRights.metadata.rightsMode = 'copy-anything';

  const rightsResult = validateStyleSpec(invalidRights);
  assert.equal(rightsResult.valid, false);
  assert.match(rightsResult.errors.join('\n'), /metadata\.rightsMode/);

  const authorized = makeValidSpec();
  authorized.metadata.rightsMode = 'authorized-reconstruction';
  assert.equal(validateStyleSpec(authorized).valid, true);
});

test('accepts all six canonical evidence statuses', () => {
  const statuses = ['observed', 'computed', 'inferred', 'translated', 'user', 'unknown'];

  for (const status of statuses) {
    const spec = makeValidSpec();
    spec.sections.layout.status = status;
    if (status === 'unknown') {
      spec.sections.layout.confidence = 0;
      spec.sections.layout.evidence = [];
      spec.sections.layout.unknownReason = 'No layout evidence was supplied.';
    }
    assert.equal(
      validateStyleSpec(spec).valid,
      true,
      `expected status ${status} to be valid`,
    );
  }
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

  assert.deepEqual(PROMPT_SECTION_ORDER.map(({ title }) => title), [
    'Mission and scope',
    'Authority and rights boundary',
    'Source-of-truth order',
    'Visual north star',
    'Non-negotiable invariants',
    'Design tokens',
    'Layout and responsive behavior',
    'Component grammar',
    'Content density and imagery',
    'Interaction and motion',
    'Accessibility and performance',
    'Negative constraints',
    'Unknown-handling rules',
    'Acceptance checklist',
    'Iteration protocol',
  ]);
  assert.equal((promptA.match(/^## \d+\. /gm) ?? []).length, 15);
  assert.equal(promptA, promptB);
  assert.match(promptA, /^## 1\. Mission and scope$/m);
  assert.match(promptA, /^## 15\. Iteration protocol$/m);
  assert.match(promptA, /Rights mode: style-only/);
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

test('rejects additional properties at every strict StyleSpec boundary', () => {
  const mutations = [
    ['top-level', (spec) => { spec.extra = true; }, /extra is not supported/],
    ['metadata', (spec) => { spec.metadata.extra = true; }, /metadata\.extra is not supported/],
    ['source', (spec) => { spec.source.extra = true; }, /source\.extra is not supported/],
    ['section', (spec) => { spec.sections.layout.extra = true; }, /sections\.layout\.extra is not supported/],
    ['evidence', (spec) => { spec.sections.layout.evidence[0].extra = true; }, /evidence\[0\]\.extra is not supported/],
  ];

  for (const [name, mutate, pattern] of mutations) {
    const spec = makeValidSpec();
    mutate(spec);
    const result = validateStyleSpec(spec);
    assert.equal(result.valid, false, `${name} additional property must be rejected`);
    assert.match(result.errors.join('\n'), pattern);
  }
});

test('rejects token shapes that are outside the canonical schema', () => {
  const unsupportedGroup = makeValidSpec();
  unsupportedGroup.tokens.unsupported = { value: 'x' };
  assert.match(
    validateStyleSpec(unsupportedGroup).errors.join('\n'),
    /tokens\.unsupported is not a supported token group/,
  );

  const nestedValue = makeValidSpec();
  nestedValue.tokens.colors.Accent = { value: '#3157f5' };
  assert.match(
    validateStyleSpec(nestedValue).errors.join('\n'),
    /tokens\.colors\.Accent must be a finite number, non-empty string, or null/,
  );
});

test('rejects token values that can escape a generated CSS declaration', () => {
  const payloads = [
    'red; } body { background: black',
    'url(https://attacker.example/beacon)',
    'red /* leave the rest commented',
    "red\n--injected: 1",
  ];

  for (const payload of payloads) {
    const spec = makeValidSpec();
    spec.tokens.colors.Attack = payload;
    const result = validateStyleSpec(spec);
    assert.equal(result.valid, false, payload);
    assert.match(result.errors.join('\n'), /unsafe CSS syntax/);
  }
});

test('CSS export refuses unsafe tokens even when called without StyleSpec validation', () => {
  assert.throws(
    () => exportCssVariables({
      colors: { attack: 'red; } body { background: black' },
    }),
    /unsafe CSS syntax/,
  );
});
