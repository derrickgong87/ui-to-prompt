import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebServer } from '../apps/web/server.mjs';

async function withServer(options, fn) {
  const server = createWebServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('serves the product and reports a machine-readable health boundary', async () => {
  await withServer({}, async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(page.headers.get('content-security-policy'), /style-src-attr 'unsafe-inline'/);
    assert.doesNotMatch(page.headers.get('content-security-policy'), /style-src 'self' 'unsafe-inline'/);
    assert.match(await page.text(), /UItoPrompt/);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      product: 'UItoPrompt',
      mode: 'review-build',
    });
  });
});

test('analyze-url validates the request shape and returns injected evidence', async () => {
  const analyzeUrl = async (url) => ({
    source: { kind: 'url', url },
    evidence: { colors: ['#f4f1e8'] },
  });

  await withServer({ analyzeUrl }, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /url is required/i);

    const response = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.source.url, 'https://example.com/');
  });
});

test('analyze-url requires a same-origin JSON request', async () => {
  await withServer({ analyzeUrl: async () => ({ ok: true }) }, async (baseUrl) => {
    const noOrigin = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    assert.equal(noOrigin.status, 403);

    const crossOrigin = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    assert.equal(crossOrigin.status, 403);

    const wrongType = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: baseUrl },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    assert.equal(wrongType.status, 415);
  });
});

test('a public deployment can disable URL capture until it is isolated behind a hardened worker', async () => {
  await withServer({ urlAnalysisEnabled: false }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /hardened/i);
  });
});

test('analyze-url permits one active analysis and rejects excess work without queueing', async () => {
  let release;
  let calls = 0;
  const analyzeUrl = async () => {
    calls += 1;
    await new Promise((resolve) => { release = resolve; });
    return { ok: true };
  };

  await withServer({ analyzeUrl, maxConcurrentAnalyses: 1 }, async (baseUrl) => {
    const request = () => fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    const first = request();
    while (calls === 0) await new Promise((resolve) => setImmediate(resolve));
    const busy = await request();
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get('retry-after'), '1');
    assert.equal(calls, 1);
    release();
    assert.equal((await first).status, 200);
  });
});

test('analyze-url rejects JSON responses over the configured byte boundary', async () => {
  await withServer(
    {
      analyzeUrl: async () => ({ evidence: 'x'.repeat(512) }),
      maxResponseBytes: 128,
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/analyze-url`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: baseUrl },
        body: JSON.stringify({ url: 'https://example.com/' }),
      });
      assert.equal(response.status, 502);
      assert.match((await response.json()).error, /response limit/i);
    },
  );
});

test('analyze-image uses a fixed production origin and only passes bounded, verified image bytes to the analyzer', async () => {
  let received;
  const image = {
    mimeType: 'image/png',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+S1cYVwAAAABJRU5ErkJggg==',
  };

  await withServer(
    {
      allowedOrigin: ['https://uitoprompt.com', 'https://ui-to-prompt.vercel.app'],
      maxImageBytes: 1024,
      maxImagePixels: 4,
      analyzeVisual: async (input) => {
        received = input;
        return { styleSpec: { schemaVersion: '1.0' }, summary: 'A restrained visual system.' };
      },
    },
    async (baseUrl) => {
      const accepted = await fetch(`${baseUrl}/api/analyze-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://uitoprompt.com' },
        body: JSON.stringify({ image, rightsMode: 'style-only', sourceName: 'reference.png' }),
      });
      assert.equal(accepted.status, 200);
      assert.equal((await accepted.json()).summary, 'A restrained visual system.');
      assert.equal(received.image.mimeType, 'image/png');
      assert.equal(received.image.bytes, 70);
      assert.equal(received.sourceRef, 'upload:reference.png');

      const legacyAlias = await fetch(`${baseUrl}/api/analyze-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://ui-to-prompt.vercel.app' },
        body: JSON.stringify({ image, rightsMode: 'style-only', sourceName: 'reference.png' }),
      });
      assert.equal(legacyAlias.status, 200);

      const crossOrigin = await fetch(`${baseUrl}/api/analyze-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
        body: JSON.stringify({ image }),
      });
      assert.equal(crossOrigin.status, 403);

      const masquerading = await fetch(`${baseUrl}/api/analyze-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://uitoprompt.com' },
        body: JSON.stringify({ image: { mimeType: 'image/png', base64: Buffer.from('not a PNG').toString('base64') } }),
      });
      assert.equal(masquerading.status, 400);
      assert.match((await masquerading.json()).error, /valid png/i);

      const headerOnly = Buffer.alloc(24);
      headerOnly.set([137, 80, 78, 71, 13, 10, 26, 10]);
      headerOnly.writeUInt32BE(1, 16);
      headerOnly.writeUInt32BE(1, 20);
      const malformedPng = await fetch(`${baseUrl}/api/analyze-image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://uitoprompt.com' },
        body: JSON.stringify({ image: { mimeType: 'image/png', base64: headerOnly.toString('base64') } }),
      });
      assert.equal(malformedPng.status, 400);
      assert.match((await malformedPng.json()).error, /valid png/i);
    },
  );
});

test('does not expose arbitrary files through traversal paths', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/..%2F..%2Fpackage.json`);
    assert.equal(response.status, 404);
  });
});
