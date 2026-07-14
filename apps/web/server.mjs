import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  PLAYWRIGHT_MISSING_ERROR,
  collectUrlEvidence,
} from '../../packages/core/url-evidence.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const MAX_JSON_BYTES = 64 * 1024;
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
    'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders('application/json; charset=utf-8'));
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJsonBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_JSON_BYTES) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
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

export function createWebServer({ analyzeUrl = collectUrlEvidence } = {}) {
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
      try {
        const body = await readJsonBody(request);
        if (typeof body.url !== 'string' || body.url.trim() === '') {
          sendJson(response, 400, { error: 'url is required.' });
          return;
        }
        const evidence = await analyzeUrl(body.url.trim());
        sendJson(response, 200, evidence);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'URL analysis failed.';
        const status = error?.status
          ?? (message === PLAYWRIGHT_MISSING_ERROR ? 503 : 400);
        sendJson(response, status, { error: message });
      }
      return;
    }

    await serveStatic(request, response, current.pathname);
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const port = Number.parseInt(process.env.PORT ?? '4173', 10);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createWebServer();
  server.listen(port, host, () => {
    console.log(`UItoPrompt review build: http://${host}:${port}`);
  });
}
