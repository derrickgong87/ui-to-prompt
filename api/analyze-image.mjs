import { analyzeGeminiImage } from '../packages/core/gemini-analysis.mjs';
import { validateImageInput } from '../packages/core/image-input.mjs';
import { readRuntimeConfig } from '../packages/core/runtime-config.mjs';

const MAX_FUNCTION_BODY_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const runtime = readRuntimeConfig(process.env);
const maxImageBytes = Math.min(runtime.maxImageBytes, 3 * 1024 * 1024);
let activeAnalyses = 0;

function json(status, payload, extraHeaders = {}) {
  const body = `${JSON.stringify(payload)}\n`;
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
    return json(502, { error: 'Visual analysis output exceeds the response limit.' });
  }
  return new Response(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function hasAllowedOrigin(request) {
  try {
    return new URL(request.headers.get('origin')).origin === runtime.publicOrigin;
  } catch {
    return false;
  }
}

function sourceRefFor(sourceName) {
  if (typeof sourceName !== 'string') return 'upload:local-image';
  const safe = sourceName
    .replace(/[\\/\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `upload:${safe || 'local-image'}`;
}

async function readJson(request) {
  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '', 10);
  if (Number.isSafeInteger(contentLength) && contentLength > MAX_FUNCTION_BODY_BYTES) {
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_FUNCTION_BODY_BYTES) {
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return json(415, { error: 'Content-Type must be application/json.' });
    }
    if (!hasAllowedOrigin(request)) {
      return json(403, { error: 'A same-origin Origin header is required.' });
    }
    if (activeAnalyses >= 2) {
      return json(429, { error: 'Visual analysis is busy. Retry later.' }, { 'retry-after': '1' });
    }

    try {
      const body = await readJson(request);
      const rightsMode = body.rightsMode ?? 'style-only';
      if (!['style-only', 'authorized-reconstruction'].includes(rightsMode)) {
        return json(400, { error: 'rightsMode must be style-only or authorized-reconstruction.' });
      }
      const image = validateImageInput(body.image, {
        maxBytes: maxImageBytes,
        maxPixels: runtime.maxImagePixels,
      });
      activeAnalyses += 1;
      try {
        const result = await analyzeGeminiImage({
          apiKey: runtime.geminiApiKey,
          model: runtime.geminiModel,
          timeoutMs: runtime.geminiTimeoutMs,
          image,
          rightsMode,
          sourceRef: sourceRefFor(body.sourceName),
        });
        return json(200, result);
      } finally {
        activeAnalyses -= 1;
      }
    } catch (error) {
      const status = error?.status ?? 400;
      return json(
        status,
        { error: status >= 500 ? 'Visual analysis is temporarily unavailable. Please try again.' : error instanceof Error ? error.message : 'Image analysis failed.' },
      );
    }
  },
};
