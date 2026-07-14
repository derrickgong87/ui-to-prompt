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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /url is required/i);

    const response = await fetch(`${baseUrl}/api/analyze-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.source.url, 'https://example.com/');
  });
});

test('does not expose arbitrary files through traversal paths', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/..%2F..%2Fpackage.json`);
    assert.equal(response.status, 404);
  });
});
