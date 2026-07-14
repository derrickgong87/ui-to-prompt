import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GEMINI_NOT_CONFIGURED,
  GEMINI_OUTPUT_INVALID,
  GEMINI_PROVIDER_FAILURE,
  GEMINI_TIMEOUT,
  analyzeGeminiImage,
} from '../packages/core/gemini-analysis.mjs';
import { readRuntimeConfig } from '../packages/core/runtime-config.mjs';

const IMAGE = {
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+S1cYVwAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
};

function modelReply(overrides = {}) {
  return {
    title: 'Editorial studio reference',
    northStar: 'Calm editorial hierarchy with generous whitespace.',
    sections: {
      visualIntent: 'Quiet, editorial and deliberate rather than decorative.',
      layout: 'A narrow reading column sits inside a broad, stable canvas.',
      color: 'Use a warm paper canvas with near-black type and one restrained accent.',
      typography: 'Pair a confident display face with a readable text face.',
      spacing: 'Use a small spacing scale and leave large breathing room between groups.',
      surfaces: 'Keep surfaces mostly flat; use borders before shadows.',
      components: 'Buttons and cards are restrained, dense and consistently aligned.',
      imagery: 'Treat imagery as an editorial crop, not a decorative fill.',
      iconography: 'Use simple geometric marks with consistent stroke weight.',
      responsiveness: 'Preserve hierarchy by stacking dense groups on narrow screens.',
      interactions: 'Make hover and focus states legible without changing layout.',
      motion: 'Use short, quiet transitions only when they clarify a state change.',
      accessibility: 'Keep type contrast, focus visibility and target sizes dependable.',
      content: 'Use concise, concrete copy with clear labels and a single next action.',
      constraints: 'Recreate the system, not logos, copy, imagery or proprietary assets.',
    },
    ...overrides,
  };
}

test('runtime config requires an explicit public origin in production and never returns the API key', () => {
  assert.throws(
    () => readRuntimeConfig({ NODE_ENV: 'production', GEMINI_API_KEY: 'secret' }),
    /PUBLIC_APP_ORIGIN/i,
  );

  const vercelConfig = readRuntimeConfig({
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_URL: 'ui-to-prompt-example.vercel.app',
  });
  assert.equal(vercelConfig.publicOrigin, 'https://ui-to-prompt-example.vercel.app');

  const config = readRuntimeConfig({
    NODE_ENV: 'production',
    PUBLIC_APP_ORIGIN: 'https://uitoprompt.com/',
    GEMINI_API_KEY: 'secret',
  });
  assert.equal(config.publicOrigin, 'https://uitoprompt.com');
  assert.equal(config.geminiApiKey, 'secret');
  assert.equal(config.urlAnalysisEnabled, false);
  assert.equal(config.geminiTimeoutMs, 60_000);
  assert.doesNotMatch(JSON.stringify(config.public), /secret/);
});

test('Gemini image analysis sends an inline image to the stable server SDK path and maps a constrained DTO to StyleSpec', async () => {
  const calls = [];
  const client = {
    models: {
      generateContent: async (request) => {
        calls.push(request);
        return { text: JSON.stringify(modelReply()) };
      },
    },
  };

  const result = await analyzeGeminiImage({
    apiKey: 'test-key',
    image: IMAGE,
    sourceRef: 'upload:example',
    client,
  });

  assert.equal(result.styleSpec.schemaVersion, '1.0');
  assert.equal(result.styleSpec.source.kind, 'image');
  assert.equal(result.styleSpec.source.ref, 'upload:example');
  assert.equal(result.styleSpec.sections.layout.status, 'inferred');
  assert.equal(result.styleSpec.sections.layout.evidence[0].label, 'visual-model');
  assert.equal(result.styleSpec.metadata.rightsMode, 'style-only');
  assert.equal(result.summary, 'Calm editorial hierarchy with generous whitespace.');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'gemini-flash-latest');
  assert.equal(calls[0].contents[0].inlineData.mimeType, 'image/png');
  assert.equal(calls[0].contents[0].inlineData.data, IMAGE.base64);
  assert.match(calls[0].contents[1].text, /do not reproduce logos/i);
  assert.equal(calls[0].config.responseMimeType, 'application/json');
  assert.equal(calls[0].config.responseJsonSchema.type, 'object');
  assert.equal(calls[0].config.maxOutputTokens, 2_048);
  assert.deepEqual(calls[0].config.thinkingConfig, {
    thinkingLevel: 'low',
  });
  assert.deepEqual(calls[0].config.httpOptions, {
    timeout: 20_000,
    retryOptions: { attempts: 3 },
  });
  assert.equal(calls[0].config.abortSignal.aborted, false);
});

test('Gemini analysis fails closed for missing credentials, invalid model output, and timeouts', async () => {
  await assert.rejects(
    () => analyzeGeminiImage({ image: IMAGE, client: {} }),
    (error) => error.code === GEMINI_NOT_CONFIGURED && error.status === 503,
  );

  await assert.rejects(
    () => analyzeGeminiImage({
      apiKey: 'test-key',
      image: IMAGE,
      client: { models: { generateContent: async () => ({ text: JSON.stringify({ title: 'Incomplete' }) }) } },
    }),
    (error) => error.code === GEMINI_OUTPUT_INVALID && error.status === 502,
  );

  await assert.rejects(
    () => analyzeGeminiImage({
      apiKey: 'test-key',
      image: IMAGE,
      timeoutMs: 5,
      client: { models: { generateContent: async () => new Promise(() => {}) } },
    }),
    (error) => error.code === GEMINI_TIMEOUT && error.status === 504,
  );
});

test('Gemini provider failures remain generic even when provider diagnostics are available', async () => {
  await assert.rejects(
    () => analyzeGeminiImage({
      apiKey: 'test-key',
      model: 'gemini-2.0-flash-001',
      image: IMAGE,
      client: {
        models: {
          generateContent: async () => {
            const error = new Error('provider diagnostic that must not reach the browser');
            error.status = 404;
            throw error;
          },
        },
      },
    }),
    (error) => error.code === GEMINI_PROVIDER_FAILURE
      && error.status === 502
      && error.message === 'The visual analysis provider is unavailable.',
  );
});

test('Gemini 2.0 fallback omits the unsupported thinking configuration', async () => {
  const calls = [];
  await analyzeGeminiImage({
    apiKey: 'test-key',
    model: 'gemini-2.0-flash',
    image: IMAGE,
    client: {
      models: {
        generateContent: async (request) => {
          calls.push(request);
          return { text: JSON.stringify(modelReply()) };
        },
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.thinkingConfig, undefined);
});
