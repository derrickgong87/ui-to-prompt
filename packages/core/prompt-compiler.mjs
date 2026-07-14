import {
  exportCssVariables,
  normalizeTokens,
  validateStyleSpec,
} from './style-spec.mjs';

export const PROMPT_SECTION_ORDER = Object.freeze([
  Object.freeze({ key: 'visualIntent', title: 'Visual intent' }),
  Object.freeze({ key: 'layout', title: 'Layout system' }),
  Object.freeze({ key: 'color', title: 'Color system' }),
  Object.freeze({ key: 'typography', title: 'Typography' }),
  Object.freeze({ key: 'spacing', title: 'Spacing and sizing' }),
  Object.freeze({ key: 'surfaces', title: 'Surfaces, borders, and effects' }),
  Object.freeze({ key: 'components', title: 'Component grammar' }),
  Object.freeze({ key: 'imagery', title: 'Imagery' }),
  Object.freeze({ key: 'iconography', title: 'Iconography' }),
  Object.freeze({ key: 'responsiveness', title: 'Responsive behavior' }),
  Object.freeze({ key: 'interactions', title: 'Interaction states' }),
  Object.freeze({ key: 'motion', title: 'Motion' }),
  Object.freeze({ key: 'accessibility', title: 'Accessibility' }),
  Object.freeze({ key: 'content', title: 'Content direction' }),
  Object.freeze({ key: 'constraints', title: 'Constraints, unknowns, and acceptance' }),
]);

const TOKEN_SECTIONS = Object.freeze({
  color: ['colors'],
  typography: ['typography'],
  spacing: ['spacing'],
  surfaces: ['borders', 'radii', 'shadows'],
  motion: ['durations', 'easing'],
});

const UNKNOWN_GROUP_NAMES = Object.freeze({
  colors: 'color',
  spacing: 'spacing',
  radii: 'radius',
  shadows: 'shadow',
  borders: 'border',
  durations: 'duration',
  easing: 'easing',
});

function inline(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value), null, 2);
}

function sentence(value) {
  const text = inline(value).replace(/[.!?]+$/u, '');
  return `${text}.`;
}

function formatEvidence(evidence) {
  if (evidence.length === 0) return 'None supplied; treat the section as unresolved.';
  return [...evidence]
    .sort((left, right) => {
      const leftKey = `${left.label}\u0000${left.ref}\u0000${left.note ?? ''}`;
      const rightKey = `${right.label}\u0000${right.ref}\u0000${right.note ?? ''}`;
      return leftKey.localeCompare(rightKey);
    })
    .map((item) => {
      const note = item.note ? ` — ${inline(item.note)}` : '';
      return `[${inline(item.label)}] ${inline(item.ref)}${note}`;
    })
    .join('; ');
}

function tokenSubset(tokens, groups) {
  const subset = {};
  for (const group of groups) {
    if (tokens[group] !== undefined) subset[group] = tokens[group];
  }
  return subset;
}

function cssForSection(sectionKey, normalizedTokens) {
  const groups = TOKEN_SECTIONS[sectionKey];
  if (!groups) return '';
  const subset = tokenSubset(normalizedTokens, groups);
  if (Object.keys(subset).length === 0) return '';
  return exportCssVariables(subset).trimEnd();
}

function findUnknownTokens(tokens) {
  const unknowns = [];
  const visit = (value, path) => {
    if (value === 'unknown') {
      unknowns.push(`Token ${path.join('.')} is unknown.`);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const key of Object.keys(value).sort()) visit(value[key], [...path, key]);
  };

  for (const group of Object.keys(tokens).sort()) {
    if (group === 'typography') {
      visit(tokens[group], ['typography']);
    } else {
      visit(tokens[group], [UNKNOWN_GROUP_NAMES[group] ?? group]);
    }
  }
  return unknowns;
}

function unknownRegister(spec, normalizedTokens) {
  const unknowns = [];
  for (const { key, title } of PROMPT_SECTION_ORDER) {
    const section = spec.sections[key];
    if (section.status === 'unknown') {
      unknowns.push(`${title}: ${sentence(section.unknownReason)}`);
    }
  }
  unknowns.push(...findUnknownTokens(normalizedTokens));
  return unknowns;
}

function renderSection(index, descriptor, section, normalizedTokens, register) {
  const lines = [
    `## ${index + 1}. ${descriptor.title}`,
    '',
    `Status: ${section.status.toUpperCase()}`,
    `Confidence: ${Math.round(section.confidence * 100)}%`,
    `Evidence: ${formatEvidence(section.evidence)}`,
    `Directive: ${inline(section.summary)}`,
  ];

  if (section.status === 'unknown') {
    lines.push(
      `Unknown handling: ${sentence(section.unknownReason)} Do not invent source-specific values; use a conservative, replaceable placeholder and label the assumption.`,
    );
  }

  if (section.details !== undefined && Object.keys(section.details).length > 0) {
    lines.push('', 'Structured details:', '```json', stableJson(section.details), '```');
  }

  const css = cssForSection(descriptor.key, normalizedTokens);
  if (css) lines.push('', 'Normalized CSS variables:', '```css', css, '```');

  if (descriptor.key === 'constraints') {
    lines.push('', 'Unresolved unknown register:');
    if (register.length === 0) {
      lines.push('- No unresolved unknowns.');
    } else {
      lines.push(...register.map((item) => `- ${item}`));
    }
    lines.push(
      '',
      'Acceptance rule: satisfy every observed constraint, preserve inferred constraints in proportion to their confidence, and never hide an unknown behind an unsupported exact value.',
    );
  }

  return lines.join('\n');
}

export function compileSystematicPrompt(spec) {
  const validation = validateStyleSpec(spec);
  if (!validation.valid) {
    throw new Error(`Invalid StyleSpec: ${validation.errors.join('; ')}`);
  }

  const normalizedTokens = normalizeTokens(spec.tokens);
  const register = unknownRegister(spec, normalizedTokens);
  const source = `${inline(spec.source.kind)} — ${inline(spec.source.ref)}`;

  const preamble = [
    '# Systematic UI Reconstruction Prompt',
    '',
    `Source: ${source}`,
    `StyleSpec: ${inline(spec.schemaVersion)}`,
    '',
    'Recreate the source style as an original, production-ready interface. Treat labelled evidence as fact, inferred observations as confidence-weighted guidance, and unknowns as explicit constraints. Do not copy proprietary logos, source text, or assets unless separately authorized.',
  ].join('\n');

  const sections = PROMPT_SECTION_ORDER.map((descriptor, index) => renderSection(
    index,
    descriptor,
    spec.sections[descriptor.key],
    normalizedTokens,
    register,
  ));

  return `${preamble}\n\n${sections.join('\n\n')}\n`;
}
