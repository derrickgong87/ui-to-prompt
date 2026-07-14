import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PLAYWRIGHT_MISSING_ERROR,
  URL_EVIDENCE_LIMITS,
  collectUrlEvidence,
  normalizeUrlEvidence,
} from '../packages/core/url-evidence.mjs';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

test('normalizes collector output into deterministic observed URL evidence', () => {
  const evidence = normalizeUrlEvidence(
    {
      finalUrl: 'https://example.com/final/',
      capturedAt: '2026-07-14T08:00:00.000Z',
      browser: { name: ' chromium ', version: ' 126.0 ' },
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      document: { title: '  Reference   page ', language: ' EN-us ' },
      elements: [
        {
          tagName: 'H1',
          role: 'heading',
          text: ' Hello\n world ',
          attributes: { class: ' hero   title ', 'aria-level': 1 },
          box: { x: 10.12345, y: 20, width: 700.98765, height: 80 },
          styles: { display: ' block ', color: ' rgb(1, 2, 3) ' },
        },
      ],
      assets: [
        {
          type: 'image',
          url: '/assets/hero.png',
          alt: ' Hero image ',
          role: 'hero',
          width: 1200,
          height: 800,
        },
      ],
      animations: [],
      screenshot: Buffer.from('png'),
    },
    { sourceUrl: 'https://example.com/start' },
  );

  assert.deepEqual(evidence, {
    schemaVersion: '1.0',
    source: {
      kind: 'url',
      requestedUrl: 'https://example.com/start',
      finalUrl: 'https://example.com/final/',
    },
    capture: {
      capturedAt: '2026-07-14T08:00:00.000Z',
      browser: { name: 'chromium', version: '126.0' },
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      screenshot: { mimeType: 'image/png', base64: 'cG5n' },
    },
    document: { title: 'Reference page', language: 'en-us' },
    elements: [
      {
        id: 'element-1',
        tagName: 'h1',
        role: 'heading',
        name: null,
        text: 'Hello world',
        attributes: { 'aria-level': '1', class: 'hero title' },
        box: { x: 10.123, y: 20, width: 700.988, height: 80 },
        styles: { color: 'rgb(1, 2, 3)', display: 'block' },
        evidenceStatus: 'observed',
        confidence: 1,
      },
    ],
    assets: [
      {
        id: 'asset-1',
        type: 'image',
        url: 'https://example.com/assets/hero.png',
        alt: 'Hero image',
        role: 'hero',
        width: 1200,
        height: 800,
        evidenceStatus: 'observed',
        confidence: 1,
      },
    ],
    animations: [],
    blockedRequests: [],
    warnings: [],
  });
});

test('uses an injected collector and revalidates its final URL', async () => {
  const guardedRequests = [];
  const evidence = await collectUrlEvidence('https://EXAMPLE.com/start', {
    lookup: publicLookup,
    collector: async ({ url, validateRequest }) => {
      assert.equal(url, 'https://example.com/start');
      guardedRequests.push((await validateRequest('https://cdn.example/app.css')).href);
      return {
        finalUrl: 'https://example.com/final',
        document: { title: 'Injected' },
      };
    },
  });

  assert.deepEqual(guardedRequests, ['https://cdn.example/app.css']);
  assert.equal(evidence.source.finalUrl, 'https://example.com/final');
  assert.equal(evidence.document.title, 'Injected');
});

test('rejects an unsafe final redirect even if an injected collector omits request guarding', async () => {
  await assert.rejects(
    collectUrlEvidence('https://example.com/start', {
      lookup: publicLookup,
      collector: async () => ({ finalUrl: 'http://127.0.0.1/admin' }),
    }),
    (error) => error?.code === 'URL_IP_NOT_ALLOWED',
  );
});

test('returns an exact actionable error when optional Playwright is unavailable', async () => {
  await assert.rejects(
    collectUrlEvidence('https://example.com/', {
      lookup: publicLookup,
      playwrightLoader: async () => {
        const error = new Error("Cannot find package 'playwright'");
        error.code = 'ERR_MODULE_NOT_FOUND';
        throw error;
      },
    }),
    (error) =>
      error?.code === 'URL_EVIDENCE_PLAYWRIGHT_MISSING' &&
      error?.message === PLAYWRIGHT_MISSING_ERROR,
  );
});

test('default collector guards every navigation, redirect, and subresource request', async () => {
  const actions = [];
  let routeHandler;
  let webSocketHandler;
  let contextOptions;

  const dispatch = async (url, navigation = false, method = 'GET') => {
    const request = {
      url: () => url,
      method: () => method,
      isNavigationRequest: () => navigation,
    };
    await routeHandler({
      request: () => request,
      continue: async () => actions.push(['continue', url]),
      abort: async () => actions.push(['abort', url]),
    });
  };

  const page = {
    goto: async () => {
      await dispatch('https://example.com/', true);
      await dispatch('https://www.example.com/final', true);
      await dispatch('https://cdn.example.com/site.css');
      await dispatch('https://example.com/form', false, 'POST');
      await dispatch('http://127.0.0.1/internal.json');
    },
    url: () => 'https://www.example.com/final',
    evaluate: async () => ({
      document: { title: 'Captured', language: 'en' },
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
      elements: [],
      assets: [],
      animations: [],
    }),
    screenshot: async () => Buffer.from('fake-png'),
  };
  const context = {
    route: async (_pattern, handler) => {
      routeHandler = handler;
    },
    routeWebSocket: async (_pattern, handler) => {
      webSocketHandler = handler;
    },
    newPage: async () => {
      await webSocketHandler?.({ close: async () => actions.push(['websocket-close']) });
      return page;
    },
    close: async () => actions.push(['context-close']),
  };
  const browser = {
    newContext: async (options) => {
      contextOptions = options;
      return context;
    },
    version: () => '126.0',
    close: async () => actions.push(['browser-close']),
  };

  const evidence = await collectUrlEvidence('https://example.com/', {
    lookup: publicLookup,
    now: () => new Date('2026-07-14T08:00:00.000Z'),
    playwrightLoader: async () => ({
      chromium: { launch: async () => browser },
    }),
  });

  assert.equal(contextOptions.serviceWorkers, 'block');
  assert.equal(contextOptions.acceptDownloads, false);
  assert.ok(actions.some(([action]) => action === 'websocket-close'));
  const requestActions = actions.filter(([action]) =>
    ['continue', 'abort'].includes(action),
  );
  assert.deepEqual(requestActions, [
    ['continue', 'https://example.com/'],
    ['continue', 'https://www.example.com/final'],
    ['continue', 'https://cdn.example.com/site.css'],
    ['abort', 'https://example.com/form'],
    ['abort', 'http://127.0.0.1/internal.json'],
  ]);
  assert.deepEqual(evidence.blockedRequests, [
    {
      url: 'https://example.com/form',
      code: 'URL_METHOD_NOT_ALLOWED',
      message: 'Only GET and HEAD requests are allowed during capture.',
    },
    {
      url: 'http://127.0.0.1/internal.json',
      code: 'URL_IP_NOT_ALLOWED',
      message: 'IP address is not publicly routable: 127.0.0.1',
    },
  ]);
  assert.equal(evidence.source.finalUrl, 'https://www.example.com/final');
  assert.deepEqual(actions.slice(-2), [['context-close'], ['browser-close']]);
});

test('cancels page downloads and caps screenshot dimensions', async () => {
  let downloadHandler;
  let screenshotOptions;
  let contextOptions;
  const actions = [];
  const page = {
    on: (event, handler) => {
      if (event === 'download') downloadHandler = handler;
    },
    goto: async () => {},
    url: () => 'https://example.com/',
    evaluate: async () => ({
      document: { title: 'Tall page', language: 'en' },
      viewport: { width: 1920, height: 900, deviceScaleFactor: 1 },
      pageSize: { width: 1920, height: 50_000 },
      elements: [],
      assets: [],
      animations: [],
    }),
    screenshot: async (options) => {
      screenshotOptions = options;
      return Buffer.from('fake-png');
    },
  };
  const context = {
    route: async () => {},
    newPage: async () => page,
    close: async () => actions.push('context-close'),
  };
  const browser = {
    newContext: async (options) => {
      contextOptions = options;
      return context;
    },
    version: () => '126.0',
    close: async () => actions.push('browser-close'),
  };

  const evidence = await collectUrlEvidence('https://example.com/', {
    lookup: publicLookup,
    playwrightLoader: async () => ({ chromium: { launch: async () => browser } }),
  });
  await downloadHandler({ cancel: async () => actions.push('download-cancel') });

  assert.equal(contextOptions.acceptDownloads, false);
  assert.equal(typeof downloadHandler, 'function');
  assert.deepEqual(screenshotOptions.clip, {
    x: 0,
    y: 0,
    width: URL_EVIDENCE_LIMITS.screenshotWidth,
    height: URL_EVIDENCE_LIMITS.screenshotHeight,
  });
  assert.equal(evidence.capture.screenshot.width, URL_EVIDENCE_LIMITS.screenshotWidth);
  assert.equal(evidence.capture.screenshot.height, URL_EVIDENCE_LIMITS.screenshotHeight);
  assert.ok(actions.includes('download-cancel'));
});

test('bounds normalized DOM, attributes, text, assets, animations, and keyframes', () => {
  const limits = {
    ...URL_EVIDENCE_LIMITS,
    elements: 2,
    attributesPerElement: 2,
    attributeCharacters: 4,
    textCharacters: 5,
    assets: 1,
    animations: 1,
    keyframesPerAnimation: 2,
  };
  const evidence = normalizeUrlEvidence(
    {
      finalUrl: 'https://example.com/',
      document: { title: 'title-too-long', language: 'EN-us-extra' },
      elements: Array.from({ length: 3 }, (_, index) => ({
        id: 'identifier',
        tagName: 'DIV',
        role: 'presentation',
        name: 'accessible-name',
        text: `text-${index}`,
        attributes: { alphabet: '123456', beta: 'abcdef', gamma: 'ignored' },
      })),
      assets: [
        { url: '/one.png', alt: 'asset-description', role: 'presentation' },
        { url: '/two.png' },
      ],
      animations: [
        { keyframes: [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.5 }] },
        { keyframes: [] },
      ],
    },
    { sourceUrl: 'https://example.com/', limits },
  );

  assert.equal(evidence.elements.length, 2);
  assert.equal(evidence.document.title, 'title');
  assert.equal(evidence.document.language, 'en-u');
  assert.equal(evidence.elements[0].id, 'iden');
  assert.equal(evidence.elements[0].role, 'pres');
  assert.equal(evidence.elements[0].name, 'acces');
  assert.equal(evidence.elements[0].text, 'text-');
  assert.deepEqual(evidence.elements[0].attributes, { alph: '1234', beta: 'abcd' });
  assert.equal(evidence.assets.length, 1);
  assert.equal(evidence.assets[0].alt, 'asset');
  assert.equal(evidence.assets[0].role, 'pres');
  assert.equal(evidence.animations.length, 1);
  assert.equal(evidence.animations[0].keyframes.length, 2);
  assert.ok(evidence.warnings.includes('Elements were truncated at 2.'));
  assert.ok(evidence.warnings.includes('Assets were truncated at 1.'));
  assert.ok(evidence.warnings.includes('Animations were truncated at 1.'));
  assert.ok(evidence.warnings.includes('Animation keyframes were truncated at 2.'));
});

test('enforces a total evidence collection timeout', async () => {
  await assert.rejects(
    collectUrlEvidence('https://example.com/', {
      lookup: publicLookup,
      limits: { ...URL_EVIDENCE_LIMITS, totalTimeoutMs: 10 },
      collector: async () => new Promise(() => {}),
    }),
    (error) => error?.code === 'URL_EVIDENCE_TIMEOUT',
  );
});

test('includes DNS validation inside the total evidence timeout', async () => {
  await assert.rejects(
    collectUrlEvidence('https://example.com/', {
      lookup: async () => new Promise(() => {}),
      limits: { ...URL_EVIDENCE_LIMITS, totalTimeoutMs: 10 },
      collector: async () => ({ finalUrl: 'https://example.com/' }),
    }),
    (error) => error?.code === 'URL_EVIDENCE_TIMEOUT',
  );
});

test('reference fixture is deterministic and contains representative states', async () => {
  const fixture = await readFile(
    new URL('./fixtures/reference-page.html', import.meta.url),
    'utf8',
  );

  assert.match(fixture, /data-testid="hero"/);
  assert.match(fixture, /:focus-visible/);
  assert.match(fixture, /@media \(max-width: 700px\)/);
  assert.match(fixture, /prefers-reduced-motion/);
});
