import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  PLAYWRIGHT_MISSING_ERROR,
  collectUrlEvidence,
} from '../../packages/core/url-evidence.mjs';
import { validateImageInput } from '../../packages/core/image-input.mjs';
import { analyzeGeminiImage } from '../../packages/core/gemini-analysis.mjs';
import { readRuntimeConfig } from '../../packages/core/runtime-config.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const MAX_JSON_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_PIXELS = 20_000_000;
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  };
}

function sendJson(
  response,
  status,
  payload,
  { maxBytes = MAX_RESPONSE_BYTES, headers = {} } = {},
) {
  let body = `${JSON.stringify(payload)}\n`;
  if (Buffer.byteLength(body) > maxBytes) {
    status = 502;
    body = `${JSON.stringify({
      error: `URL analysis output exceeds the ${maxBytes}-byte response limit.`,
    })}\n`;
  }
  response.writeHead(status, {
    ...securityHeaders('application/json; charset=utf-8'),
    ...headers,
  });
  response.end(body);
}

async function readJsonBody(request, maxBytes = MAX_JSON_BYTES) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function sameOriginRequest(request, allowedOrigin) {
  const expectedOrigin = allowedOrigin ?? `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`;
  let requestOrigin;
  try {
    requestOrigin = new URL(request.headers.origin).origin;
  } catch {
    requestOrigin = null;
  }
  try {
    return requestOrigin === new URL(expectedOrigin).origin;
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

function imageJsonLimit(maxImageBytes) {
  return Math.ceil(maxImageBytes / 3) * 4 + 16 * 1024;
}

function publicFileFor(rawPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = resolve(PUBLIC_DIR, relative);
  const publicRoot = resolve(PUBLIC_DIR);
  if (candidate !== publicRoot && !candidate.startsWith(`${publicRoot}${sep}`)) return null;
  return candidate;
}

async function serveStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }
  const file = publicFileFor(pathname);
  if (!file) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  try {
    const body = await readFile(file);
    const contentType = MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
    response.writeHead(200, {
      ...securityHeaders(contentType),
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=300',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }
    sendJson(response, 500, { error: 'Unable to read the requested asset.' });
  }
}

export function createWebServer({
  analyzeUrl = collectUrlEvidence,
  analyzeVisual = async () => {
    throw Object.assign(new Error('Visual analysis is not configured on this deployment.'), { status: 503 });
  },
  allowedOrigin,
  urlAnalysisEnabled = true,
  maxConcurrentAnalyses = 1,
  maxConcurrentVisualAnalyses = 2,
  maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
  maxImagePixels = DEFAULT_MAX_IMAGE_PIXELS,
  maxResponseBytes = MAX_RESPONSE_BYTES,
} = {}) {
  if (!Number.isSafeInteger(maxConcurrentAnalyses) || maxConcurrentAnalyses < 1) {
    throw new TypeError('maxConcurrentAnalyses must be a positive integer.');
  }
  if (typeof urlAnalysisEnabled !== 'boolean') {
    throw new TypeError('urlAnalysisEnabled must be a boolean.');
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
    throw new TypeError('maxResponseBytes must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxConcurrentVisualAnalyses) || maxConcurrentVisualAnalyses < 1) {
    throw new TypeError('maxConcurrentVisualAnalyses must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxImageBytes) || maxImageBytes < 1) {
    throw new TypeError('maxImageBytes must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxImagePixels) || maxImagePixels < 1) {
    throw new TypeError('maxImagePixels must be a positive integer.');
  }
  let activeAnalyses = 0;
  let activeVisualAnalyses = 0;
  return createServer(async (request, response) => {
    const current = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (current.pathname === '/api/health') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }
      sendJson(response, 200, { ok: true, product: 'UItoPrompt', mode: 'review-build' });
      return;
    }

    if (current.pathname === '/api/analyze-url') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }
      if (!urlAnalysisEnabled) {
        sendJson(response, 503, { error: 'URL analysis is being hardened for public use. Use an image reference for now.' });
        return;
      }
      const contentType = request.headers['content-type']
        ?.split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (contentType !== 'application/json') {
        sendJson(response, 415, { error: 'Content-Type must be application/json.' });
        return;
      }
      if (!sameOriginRequest(request, allowedOrigin)) {
        sendJson(response, 403, { error: 'A same-origin Origin header is required.' });
        return;
      }
      try {
        const body = await readJsonBody(request);
        if (typeof body.url !== 'string' || body.url.trim() === '') {
          sendJson(response, 400, { error: 'url is required.' });
          return;
        }
        if (activeAnalyses >= maxConcurrentAnalyses) {
          sendJson(
            response,
            429,
            { error: 'URL analysis is busy. Retry later.' },
            { headers: { 'retry-after': '1' } },
          );
          return;
        }
        activeAnalyses += 1;
        try {
          const evidence = await analyzeUrl(body.url.trim());
          sendJson(response, 200, evidence, { maxBytes: maxResponseBytes });
        } finally {
          activeAnalyses -= 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'URL analysis failed.';
        const status = error?.status
          ?? (error?.code === 'URL_EVIDENCE_TIMEOUT'
            ? 504
            : message === PLAYWRIGHT_MISSING_ERROR
              ? 503
              : 400);
        sendJson(response, status, { error: message });
      }
      return;
    }

    if (current.pathname === '/api/analyze-image') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }
      const contentType = request.headers['content-type']
        ?.split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (contentType !== 'application/json') {
        sendJson(response, 415, { error: 'Content-Type must be application/json.' });
        return;
      }
      if (!sameOriginRequest(request, allowedOrigin)) {
        sendJson(response, 403, { error: 'A same-origin Origin header is required.' });
        return;
      }
      if (activeVisualAnalyses >= maxConcurrentVisualAnalyses) {
        sendJson(
          response,
          429,
          { error: 'Visual analysis is busy. Retry later.' },
          { headers: { 'retry-after': '1' } },
        );
        return;
      }
      try {
        const body = await readJsonBody(request, imageJsonLimit(maxImageBytes));
        const rightsMode = body.rightsMode ?? 'style-only';
        if (!['style-only', 'authorized-reconstruction'].includes(rightsMode)) {
          sendJson(response, 400, { error: 'rightsMode must be style-only or authorized-reconstruction.' });
          return;
        }
        const image = validateImageInput(body.image, { maxBytes: maxImageBytes, maxPixels: maxImagePixels });
        activeVisualAnalyses += 1;
        try {
          const result = await analyzeVisual({
            image,
            rightsMode,
            sourceRef: sourceRefFor(body.sourceName),
          });
          sendJson(response, 200, result, { maxBytes: maxResponseBytes });
        } finally {
          activeVisualAnalyses -= 1;
        }
      } catch (error) {
        const status = error?.status ?? 400;
        const message = status >= 500
          ? 'Visual analysis is temporarily unavailable. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Image analysis failed.';
        sendJson(response, status, { error: message });
      }
      return;
    }

    await serveStatic(request, response, current.pathname);
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const config = readRuntimeConfig(process.env);
  const port = Number.parseInt(process.env.PORT ?? '4173', 10);
  const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  const server = createWebServer({
    allowedOrigin: config.publicOrigin,
    urlAnalysisEnabled: config.urlAnalysisEnabled,
    maxImageBytes: config.maxImageBytes,
    maxImagePixels: config.maxImagePixels,
    analyzeVisual: (input) => analyzeGeminiImage({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      timeoutMs: config.geminiTimeoutMs,
      ...input,
    }),
  });
  server.listen(port, host, () => {
    console.log(`UItoPrompt server listening on http://${host}:${port}`);
  });
}
