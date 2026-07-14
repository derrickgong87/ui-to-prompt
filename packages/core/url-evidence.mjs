import { assertSafeUrl, createRequestGuard } from './url-safety.mjs';

export const PLAYWRIGHT_MISSING_ERROR =
  'Playwright is required for URL evidence collection. Install it with "npm install playwright" or inject a collector.';

export class UrlEvidenceError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'UrlEvidenceError';
    this.code = code;
  }
}

const collapseWhitespace = (value) =>
  value == null ? null : String(value).trim().replace(/\s+/g, ' ');

const roundNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : null;
};

function normalizeRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, collapseWhitespace(value) ?? '']),
  );
}

function normalizeBox(box) {
  if (!box || typeof box !== 'object') return null;
  return {
    x: roundNumber(box.x),
    y: roundNumber(box.y),
    width: roundNumber(box.width),
    height: roundNumber(box.height),
  };
}

function normalizeScreenshot(screenshot) {
  if (Buffer.isBuffer(screenshot) || screenshot instanceof Uint8Array) {
    return {
      mimeType: 'image/png',
      base64: Buffer.from(screenshot).toString('base64'),
    };
  }
  if (!screenshot || typeof screenshot !== 'object') return null;
  const base64 = collapseWhitespace(screenshot.base64);
  if (!base64) return null;
  return {
    mimeType: collapseWhitespace(screenshot.mimeType) || 'image/png',
    base64,
  };
}

function normalizeElements(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.map((element, index) => ({
    id: collapseWhitespace(element?.id) || `element-${index + 1}`,
    tagName: collapseWhitespace(element?.tagName)?.toLowerCase() || null,
    role: collapseWhitespace(element?.role),
    name: collapseWhitespace(element?.name),
    text: collapseWhitespace(element?.text),
    attributes: normalizeRecord(element?.attributes),
    box: normalizeBox(element?.box),
    styles: normalizeRecord(element?.styles),
    evidenceStatus: 'observed',
    confidence: 1,
  }));
}

function normalizeAssets(assets, baseUrl) {
  if (!Array.isArray(assets)) return [];
  return assets.map((asset, index) => {
    let url = null;
    if (asset?.url) {
      try {
        url = new URL(asset.url, baseUrl).href;
      } catch {
        url = null;
      }
    }
    return {
      id: collapseWhitespace(asset?.id) || `asset-${index + 1}`,
      type: collapseWhitespace(asset?.type)?.toLowerCase() || 'unknown',
      url,
      alt: collapseWhitespace(asset?.alt),
      role: collapseWhitespace(asset?.role),
      width: roundNumber(asset?.width),
      height: roundNumber(asset?.height),
      evidenceStatus: 'observed',
      confidence: 1,
    };
  });
}

function normalizeAnimations(animations) {
  if (!Array.isArray(animations)) return [];
  return animations.map((animation, index) => ({
    id: collapseWhitespace(animation?.id) || `animation-${index + 1}`,
    name: collapseWhitespace(animation?.name),
    type: collapseWhitespace(animation?.type),
    target: collapseWhitespace(animation?.target),
    duration: roundNumber(animation?.duration),
    delay: roundNumber(animation?.delay),
    iterations: roundNumber(animation?.iterations),
    easing: collapseWhitespace(animation?.easing),
    keyframes: Array.isArray(animation?.keyframes) ? animation.keyframes : [],
    evidenceStatus: 'observed',
    confidence: 1,
  }));
}

function normalizeBlockedRequests(requests) {
  if (!Array.isArray(requests)) return [];
  return requests.map((request) => ({
    url: String(request?.url ?? ''),
    code: collapseWhitespace(request?.code) || 'URL_REQUEST_BLOCKED',
    message: collapseWhitespace(request?.message) || 'Request was blocked.',
  }));
}

export function normalizeUrlEvidence(raw, { sourceUrl } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('URL evidence collector must return an object.');
  }

  const requestedUrl = new URL(sourceUrl).href;
  const finalUrl = new URL(raw.finalUrl || requestedUrl, requestedUrl).href;
  const screenshot = normalizeScreenshot(raw.screenshot);
  const browser = raw.browser
    ? {
        name: collapseWhitespace(raw.browser.name),
        version: collapseWhitespace(raw.browser.version),
      }
    : null;
  const viewport = raw.viewport
    ? {
        width: roundNumber(raw.viewport.width),
        height: roundNumber(raw.viewport.height),
        deviceScaleFactor: roundNumber(raw.viewport.deviceScaleFactor),
      }
    : null;

  return {
    schemaVersion: '1.0',
    source: {
      kind: 'url',
      requestedUrl,
      finalUrl,
    },
    capture: {
      capturedAt: collapseWhitespace(raw.capturedAt),
      browser,
      viewport,
      screenshot,
    },
    document: {
      title: collapseWhitespace(raw.document?.title),
      language: collapseWhitespace(raw.document?.language)?.toLowerCase() || null,
    },
    elements: normalizeElements(raw.elements),
    assets: normalizeAssets(raw.assets, finalUrl),
    animations: normalizeAnimations(raw.animations),
    blockedRequests: normalizeBlockedRequests(raw.blockedRequests),
    warnings: Array.isArray(raw.warnings)
      ? [...new Set(raw.warnings.map(collapseWhitespace).filter(Boolean))]
      : [],
  };
}

async function loadPlaywright(playwrightLoader) {
  try {
    const module = await playwrightLoader();
    return module.default ?? module;
  } catch (cause) {
    const missing =
      cause?.code === 'ERR_MODULE_NOT_FOUND' || cause?.code === 'MODULE_NOT_FOUND';
    if (missing && /playwright/i.test(cause?.message ?? '')) {
      throw new UrlEvidenceError(
        'URL_EVIDENCE_PLAYWRIGHT_MISSING',
        PLAYWRIGHT_MISSING_ERROR,
        { cause },
      );
    }
    throw cause;
  }
}

async function collectPageSnapshot(page) {
  return page.evaluate(async () => {
    if (globalThis.document?.fonts?.ready) {
      await globalThis.document.fonts.ready;
    }

    const styleProperties = [
      'display',
      'position',
      'z-index',
      'color',
      'background-color',
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'letter-spacing',
      'text-align',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'gap',
      'border-radius',
      'border-width',
      'border-color',
      'box-shadow',
      'opacity',
      'transform',
      'overflow',
    ];

    const elements = [...globalThis.document.querySelectorAll('*')].map(
      (element, index) => {
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        const attributes = Object.fromEntries(
          [...element.attributes].map((attribute) => [
            attribute.name,
            attribute.value,
          ]),
        );
        const directText = [...element.childNodes]
          .filter((node) => node.nodeType === 3)
          .map((node) => node.textContent)
          .join(' ');
        return {
          id: `element-${index + 1}`,
          tagName: element.tagName,
          role: element.getAttribute('role'),
          name:
            element.getAttribute('aria-label') ||
            element.getAttribute('alt') ||
            null,
          text: directText,
          attributes,
          box: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          styles: Object.fromEntries(
            styleProperties.map((property) => [
              property,
              style.getPropertyValue(property),
            ]),
          ),
        };
      },
    );

    const assets = [...globalThis.document.querySelectorAll('img, video, source')].map(
      (element, index) => ({
        id: `asset-${index + 1}`,
        type: element.tagName.toLowerCase(),
        url:
          element.currentSrc ||
          element.src ||
          element.getAttribute('poster') ||
          element.getAttribute('src'),
        alt: element.getAttribute('alt'),
        role: element.getAttribute('role'),
        width: element.naturalWidth || element.videoWidth || element.width || null,
        height:
          element.naturalHeight || element.videoHeight || element.height || null,
      }),
    );

    const animations = globalThis.document.getAnimations().map((animation, index) => {
      const effect = animation.effect;
      const timing = effect?.getTiming?.() ?? {};
      return {
        id: `animation-${index + 1}`,
        name: animation.animationName || animation.id || null,
        type: animation.constructor?.name || null,
        target: effect?.target?.id || effect?.target?.tagName || null,
        duration: timing.duration,
        delay: timing.delay,
        iterations: timing.iterations,
        easing: timing.easing,
        keyframes: effect?.getKeyframes?.() ?? [],
      };
    });

    return {
      document: {
        title: globalThis.document.title,
        language: globalThis.document.documentElement.lang,
      },
      viewport: {
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
        deviceScaleFactor: globalThis.devicePixelRatio,
      },
      elements,
      assets,
      animations,
    };
  });
}

async function collectWithPlaywright({
  url,
  validateRequest,
  playwrightLoader,
  now,
}) {
  const playwright = await loadPlaywright(playwrightLoader);
  if (!playwright?.chromium?.launch) {
    throw new UrlEvidenceError(
      'URL_EVIDENCE_PLAYWRIGHT_INVALID',
      'The loaded Playwright module does not expose chromium.launch().',
    );
  }

  const blockedRequests = [];
  let blockedNavigationError = null;
  let browser;
  let context;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });

    await context.route('**/*', async (route) => {
      const request = route.request();
      const requestUrl = request.url();
      try {
        await validateRequest(requestUrl);
        await route.continue();
      } catch (error) {
        blockedRequests.push({
          url: requestUrl,
          code: error?.code || 'URL_REQUEST_BLOCKED',
          message: error?.message || 'Request was blocked.',
        });
        if (request.isNavigationRequest?.()) blockedNavigationError ??= error;
        await route.abort('blockedbyclient');
      }
    });

    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (cause) {
      if (blockedNavigationError) throw blockedNavigationError;
      throw new UrlEvidenceError(
        'URL_EVIDENCE_NAVIGATION_FAILED',
        `Unable to navigate to ${url}.`,
        { cause },
      );
    }
    if (blockedNavigationError) throw blockedNavigationError;

    const finalUrl = page.url();
    await validateRequest(finalUrl);
    const snapshot = await collectPageSnapshot(page);
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });

    return {
      ...snapshot,
      finalUrl,
      capturedAt: now().toISOString(),
      browser: { name: 'chromium', version: browser.version() },
      screenshot,
      blockedRequests,
    };
  } finally {
    await context?.close();
    await browser?.close();
  }
}

export async function collectUrlEvidence(
  input,
  {
    collector,
    lookup,
    now = () => new Date(),
    playwrightLoader = () => import('playwright'),
  } = {},
) {
  const requested = await assertSafeUrl(input, { lookup });
  const validateRequest = createRequestGuard({ lookup });
  const raw = collector
    ? await collector({ url: requested.href, validateRequest })
    : await collectWithPlaywright({
        url: requested.href,
        validateRequest,
        playwrightLoader,
        now,
      });

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('URL evidence collector must return an object.');
  }

  const finalUrl = new URL(raw.finalUrl || requested.href, requested.href).href;
  await validateRequest(finalUrl);
  return normalizeUrlEvidence({ ...raw, finalUrl }, { sourceUrl: requested.href });
}
