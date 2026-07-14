export const STYLE_SPEC_VERSION = '1.0';

export const REQUIRED_STYLE_SECTIONS = Object.freeze([
  'visualIntent',
  'layout',
  'color',
  'typography',
  'spacing',
  'surfaces',
  'components',
  'imagery',
  'iconography',
  'responsiveness',
  'interactions',
  'motion',
  'accessibility',
  'content',
  'constraints',
]);

const VALID_SOURCE_KINDS = new Set(['url', 'image']);
const VALID_STATUSES = new Set(['observed', 'inferred', 'unknown']);
const VALID_EVIDENCE_LABELS = new Set([
  'screenshot',
  'dom',
  'css',
  'font',
  'animation',
  'network',
  'ocr',
  'visual-model',
  'user',
  'derived',
]);

const TOKEN_GROUPS = Object.freeze([
  'colors',
  'spacing',
  'radii',
  'typography',
  'shadows',
  'borders',
  'durations',
  'easing',
]);

const TYPOGRAPHY_GROUPS = Object.freeze([
  'fontFamilies',
  'fontSizes',
  'fontWeights',
  'letterSpacing',
  'lineHeights',
]);

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTokenMap(value, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  for (const [name, token] of Object.entries(value)) {
    const tokenPath = `${path}.${name}`;
    if (token === null) continue;
    if (typeof token === 'number' && Number.isFinite(token)) continue;
    if (isNonEmptyString(token)) continue;
    errors.push(`${tokenPath} must be a finite number, non-empty string, or null`);
  }
}

function validateTokens(tokens, errors) {
  if (!isPlainObject(tokens)) {
    errors.push('tokens must be an object');
    return;
  }

  for (const key of Object.keys(tokens)) {
    if (!TOKEN_GROUPS.includes(key)) {
      errors.push(`tokens.${key} is not a supported token group`);
    }
  }

  for (const group of TOKEN_GROUPS) {
    if (!(group in tokens)) continue;
    if (group !== 'typography') {
      validateTokenMap(tokens[group], `tokens.${group}`, errors);
      continue;
    }

    if (!isPlainObject(tokens.typography)) {
      errors.push('tokens.typography must be an object');
      continue;
    }

    for (const key of Object.keys(tokens.typography)) {
      if (!TYPOGRAPHY_GROUPS.includes(key)) {
        errors.push(`tokens.typography.${key} is not a supported typography group`);
      }
    }

    for (const typographyGroup of TYPOGRAPHY_GROUPS) {
      if (typographyGroup in tokens.typography) {
        validateTokenMap(
          tokens.typography[typographyGroup],
          `tokens.typography.${typographyGroup}`,
          errors,
        );
      }
    }
  }
}

function validateEvidence(items, path, status, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${path} must be an array`);
    return;
  }

  if (status !== 'unknown' && items.length === 0) {
    errors.push(`${path} must contain at least one labelled item`);
  }

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(item)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }

    if (!isNonEmptyString(item.label)) {
      errors.push(`${itemPath}.label must be a non-empty evidence label`);
    } else if (!VALID_EVIDENCE_LABELS.has(item.label)) {
      errors.push(`${itemPath}.label is not supported`);
    }

    if (!isNonEmptyString(item.ref)) {
      errors.push(`${itemPath}.ref must be a non-empty evidence reference`);
    }
  });
}

function validateSection(section, path, errors) {
  if (!isPlainObject(section)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (!VALID_STATUSES.has(section.status)) {
    errors.push(`${path}.status must be observed, inferred, or unknown`);
  }

  if (
    typeof section.confidence !== 'number'
    || !Number.isFinite(section.confidence)
    || section.confidence < 0
    || section.confidence > 1
  ) {
    errors.push(`${path}.confidence must be a finite number from 0 to 1`);
  }

  validateEvidence(section.evidence, `${path}.evidence`, section.status, errors);

  if (!isNonEmptyString(section.summary)) {
    errors.push(`${path}.summary must be a non-empty string`);
  }

  if (section.status === 'unknown' && !isNonEmptyString(section.unknownReason)) {
    errors.push(`${path}.unknownReason is required when status is unknown`);
  }

  if (
    section.details !== undefined
    && !isPlainObject(section.details)
    && !Array.isArray(section.details)
  ) {
    errors.push(`${path}.details must be an object or array when provided`);
  }
}

export function validateStyleSpec(spec) {
  const errors = [];

  if (!isPlainObject(spec)) {
    return { valid: false, errors: ['StyleSpec must be an object'] };
  }

  if (spec.schemaVersion !== STYLE_SPEC_VERSION) {
    errors.push(`schemaVersion must equal ${STYLE_SPEC_VERSION}`);
  }

  if (!isPlainObject(spec.source)) {
    errors.push('source must be an object');
  } else {
    if (!VALID_SOURCE_KINDS.has(spec.source.kind)) {
      errors.push('source.kind must be url or image');
    }
    if (!isNonEmptyString(spec.source.ref)) {
      errors.push('source.ref must be a non-empty string');
    }
  }

  validateTokens(spec.tokens, errors);

  if (!isPlainObject(spec.sections)) {
    errors.push('sections must be an object');
  } else {
    for (const sectionName of REQUIRED_STYLE_SECTIONS) {
      if (!(sectionName in spec.sections)) {
        errors.push(`sections.${sectionName} is required`);
        continue;
      }
      validateSection(spec.sections[sectionName], `sections.${sectionName}`, errors);
    }

    for (const sectionName of Object.keys(spec.sections)) {
      if (!REQUIRED_STYLE_SECTIONS.includes(sectionName)) {
        errors.push(`sections.${sectionName} is not a supported section`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function tokenName(value) {
  const normalized = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'token';
}

function expandHex(value) {
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4})$/i);
  if (!match) return value.toLowerCase();
  return `#${[...match[1]].map((part) => part.repeat(2)).join('').toLowerCase()}`;
}

function isUnknown(value) {
  return value === null
    || value === undefined
    || (typeof value === 'string'
      && ['unknown', 'n/a', 'unavailable'].includes(value.trim().toLowerCase()));
}

function normalizeTokenValue(value, unit, color = false) {
  if (isUnknown(value)) return 'unknown';
  if (typeof value === 'number') return unit ? `${value}${unit}` : value;

  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  if (color && /^#[0-9a-f]{3,8}$/i.test(trimmed)) return expandHex(trimmed);
  if (unit && /^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return `${trimmed}${unit}`;
  return trimmed;
}

function normalizeTokenMap(map, unit, color = false) {
  if (!isPlainObject(map)) return {};
  const output = {};
  const entries = Object.entries(map)
    .map(([name, value]) => [tokenName(name), value])
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [name, value] of entries) {
    if (Object.hasOwn(output, name)) {
      throw new Error(`Token names collide after normalization: ${name}`);
    }
    output[name] = normalizeTokenValue(value, unit, color);
  }
  return output;
}

export function normalizeTokens(tokens = {}) {
  const source = isPlainObject(tokens) ? tokens : {};
  const output = {};

  if ('colors' in source) output.colors = normalizeTokenMap(source.colors, '', true);
  if ('spacing' in source) output.spacing = normalizeTokenMap(source.spacing, 'px');
  if ('radii' in source) output.radii = normalizeTokenMap(source.radii, 'px');

  if ('typography' in source && isPlainObject(source.typography)) {
    const typography = {};
    if ('fontFamilies' in source.typography) {
      typography.fontFamilies = normalizeTokenMap(source.typography.fontFamilies, '');
    }
    if ('fontSizes' in source.typography) {
      typography.fontSizes = normalizeTokenMap(source.typography.fontSizes, 'px');
    }
    if ('fontWeights' in source.typography) {
      typography.fontWeights = normalizeTokenMap(source.typography.fontWeights, '');
    }
    if ('letterSpacing' in source.typography) {
      typography.letterSpacing = normalizeTokenMap(source.typography.letterSpacing, 'em');
    }
    if ('lineHeights' in source.typography) {
      typography.lineHeights = normalizeTokenMap(source.typography.lineHeights, '');
    }
    output.typography = typography;
  }

  if ('shadows' in source) output.shadows = normalizeTokenMap(source.shadows, '');
  if ('borders' in source) output.borders = normalizeTokenMap(source.borders, '');
  if ('durations' in source) output.durations = normalizeTokenMap(source.durations, 'ms');
  if ('easing' in source) output.easing = normalizeTokenMap(source.easing, '');

  return output;
}

const CSS_TOKEN_GROUPS = Object.freeze([
  ['colors', 'color'],
  ['borders', 'border'],
  ['durations', 'duration'],
  ['easing', 'easing'],
  ['radii', 'radius'],
  ['shadows', 'shadow'],
  ['spacing', 'space'],
]);

const CSS_TYPOGRAPHY_GROUPS = Object.freeze([
  ['fontFamilies', 'font-family'],
  ['fontSizes', 'font-size'],
  ['fontWeights', 'font-weight'],
  ['letterSpacing', 'letter-spacing'],
  ['lineHeights', 'line-height'],
]);

function appendCssTokenLines(lines, map, prefix) {
  if (!isPlainObject(map)) return;
  for (const name of Object.keys(map).sort()) {
    const property = `--ui-${prefix}-${name}`;
    const value = map[name];
    if (isUnknown(value)) {
      lines.push(`  /* ${property}: unknown; */`);
    } else {
      lines.push(`  ${property}: ${value};`);
    }
  }
}

export function exportCssVariables(tokens = {}) {
  const normalized = normalizeTokens(tokens);
  const lines = [':root {'];

  for (const [group, prefix] of CSS_TOKEN_GROUPS) {
    appendCssTokenLines(lines, normalized[group], prefix);
  }

  for (const [group, prefix] of CSS_TYPOGRAPHY_GROUPS) {
    appendCssTokenLines(lines, normalized.typography?.[group], prefix);
  }

  lines.push('}', '');
  return lines.join('\n');
}
