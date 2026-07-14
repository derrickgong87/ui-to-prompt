import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');

test('Vercel target stages only public assets and exposes server-side image and health functions', () => {
  const configFile = join(root, 'vercel.json');
  const buildFile = join(root, 'scripts', 'build-vercel.mjs');
  const imageFunction = join(root, 'api', 'analyze-image.mjs');
  const healthFunction = join(root, 'api', 'health.mjs');
  const urlFunction = join(root, 'api', 'analyze-url.mjs');

  for (const file of [configFile, buildFile, imageFunction, healthFunction, urlFunction]) {
    assert.equal(existsSync(file), true, `${file} must exist`);
  }

  const config = JSON.parse(readFileSync(configFile, 'utf8'));
  assert.equal(config.outputDirectory, 'dist/vercel-public');
  assert.equal(config.buildCommand, 'node scripts/build-vercel.mjs');
  assert.equal(config.functions['api/analyze-image.mjs'].maxDuration, 60);

  const functionSource = readFileSync(imageFunction, 'utf8');
  assert.match(functionSource, /analyzeGeminiImage/);
  assert.match(functionSource, /validateImageInput/);
  assert.match(functionSource, /same-origin Origin header/i);
  assert.doesNotMatch(functionSource, /AIza[0-9A-Za-z_-]{20,}/);
});

test('Vercel image function keeps the fixed-origin gate before provider work', async () => {
  process.env.NODE_ENV = 'production';
  process.env.PUBLIC_APP_ORIGIN = 'https://ui-to-prompt.vercel.app';
  process.env.GEMINI_API_KEY = 'test-key';
  const { default: imageFunction } = await import(`../api/analyze-image.mjs?test=${Date.now()}`);

  const wrongOrigin = await imageFunction.fetch(new Request('https://ui-to-prompt.vercel.app/api/analyze-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
    body: '{}',
  }));
  assert.equal(wrongOrigin.status, 403);

  const invalidImage = await imageFunction.fetch(new Request('https://ui-to-prompt.vercel.app/api/analyze-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://ui-to-prompt.vercel.app' },
    body: JSON.stringify({ image: { mimeType: 'image/png', base64: Buffer.from('not a png').toString('base64') } }),
  }));
  assert.equal(invalidImage.status, 400);
});
