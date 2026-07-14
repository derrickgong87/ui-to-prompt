import { DEFAULT_GEMINI_MODEL } from './gemini-analysis.mjs';
const DEFAULT_GEMINI_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_PIXELS = 20_000_000;

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseOrigin(value, { required = false, name = 'PUBLIC_APP_ORIGIN' } = {}) {
  if (value === undefined || value === '') {
    if (required) throw new Error(`${name} is required in production.`);
    return undefined;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) origin.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an absolute http(s) origin without a path, credentials, query, or fragment.`);
  }
  return url.origin;
}

function parseAdditionalOrigins(value) {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') throw new Error('ADDITIONAL_ALLOWED_ORIGINS must be a comma-separated list of origins.');
  return value.split(',').map((origin) => {
    const trimmed = origin.trim();
    if (!trimmed) throw new Error('ADDITIONAL_ALLOWED_ORIGINS must not contain empty origins.');
    return parseOrigin(trimmed, { required: true, name: 'ADDITIONAL_ALLOWED_ORIGINS' });
  });
}

export function readRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const vercelOrigin = env.VERCEL === '1' && typeof env.VERCEL_URL === 'string' && env.VERCEL_URL.trim()
    ? `https://${env.VERCEL_URL.trim()}`
    : undefined;
  const publicOrigin = parseOrigin(env.PUBLIC_APP_ORIGIN ?? vercelOrigin, { required: production });
  const allowedOrigins = Object.freeze([...new Set([publicOrigin, ...parseAdditionalOrigins(env.ADDITIONAL_ALLOWED_ORIGINS)].filter(Boolean))]);
  const geminiModel = (env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).trim();
  if (!geminiModel) throw new Error('GEMINI_MODEL must not be empty.');

  const geminiApiKey = typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim()
    ? env.GEMINI_API_KEY.trim()
    : undefined;
  const urlAnalysisEnabled = env.URL_ANALYSIS_ENABLED === undefined
    ? !production
    : env.URL_ANALYSIS_ENABLED === 'true';

  const maxImageBytes = positiveInteger(env.MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGE_BYTES, 'MAX_IMAGE_BYTES');
  const maxImagePixels = positiveInteger(env.MAX_IMAGE_PIXELS, DEFAULT_MAX_IMAGE_PIXELS, 'MAX_IMAGE_PIXELS');
  const geminiTimeoutMs = positiveInteger(env.GEMINI_TIMEOUT_MS, DEFAULT_GEMINI_TIMEOUT_MS, 'GEMINI_TIMEOUT_MS');

  return Object.freeze({
    publicOrigin,
    allowedOrigins,
    geminiApiKey,
    geminiModel,
    geminiTimeoutMs,
    maxImageBytes,
    maxImagePixels,
    urlAnalysisEnabled,
    public: Object.freeze({
      product: 'UItoPrompt',
      geminiEnabled: Boolean(geminiApiKey),
      maxImageBytes,
      maxImagePixels,
      urlAnalysisEnabled,
    }),
  });
}

export const RUNTIME_DEFAULTS = Object.freeze({
  geminiModel: DEFAULT_GEMINI_MODEL,
  geminiTimeoutMs: DEFAULT_GEMINI_TIMEOUT_MS,
  maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
  maxImagePixels: DEFAULT_MAX_IMAGE_PIXELS,
});
