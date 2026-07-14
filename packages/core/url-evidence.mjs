import { assertSafeUrl, createRequestGuard } from './url-safety.mjs';

export const PLAYWRIGHT_MISSING_ERROR =
  'Playwright is required for URL evidence collection. Install it with "npm install playwright" or inject a collector.';

export const URL_EVIDENCE_LIMITS = Object.freeze({
  totalTimeoutMs: 45_000,
  elements: 2_000,
  attributesPerElement: 32,
  attributeCharacters: 256,
  textCharacters: 500,
  assets: 200,
  animations: 200,
  keyframesPerAnimation: 50,
  screenshotWidth: 1_440,
  screenshotHeight: 6_000,
});

export class UrlEvidenceError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'UrlEvidenceError';
    this.code = code;
  }
}

const collapseWhitespace = (value) =>
  value == null ? null : String(value).trim().replace(/\s+/g, ' ');

const truncate = (value, characters) => {
  const normalized = collapseWhitespace(value);
  return normalized == null ? null : normalized.slice(0, characters);
};

function resolveLimits(overrides = {}) {
  const limits = { ...URL_EVIDENCE_LIMITS };
  for (const key of Object.keys(limits)) {
    if (overrides[key] === undefined) continue;
    const value = Number(overrides[key]);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`URL evidence limit ${key} must be a positive integer.`);
    }
    limits[key] = value;
  }
  return limits;
}

const roundNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : null;
};

function normalizeRecord(record, limits) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limits.attributesPerElement)
      .map(([key, value]) => [
        truncate(key, limits.attributeCharacters) ?? '',
        truncate(value, limits.attributeCharacters) ?? '',
      ]),
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

function normalizeScreenshot(screenshot, limits) {
  if (Buffer.isBuffer(screenshot) || screenshot instanceof Uint8Array) {
    return {
      mimeType: 'image/png',
      base64: Buffer.from(screenshot).toString('base64'),
    };
  }
  if (!screenshot || typeof screenshot !== 'object') return null;
  const base64 = collapseWhitespace(screenshot.base64);
  if (!base64) return null;
  const width = roundNumber(screenshot.width);
  const height = roundNumber(screenshot.height);
  if (
    (width != null && width > limits.screenshotWidth) ||
    (height != null && height > limits.screenshotHeight)
  ) {
    throw new UrlEvidenceError(
      'URL_EVIDENCE_SCREENSHOT_TOO_LARGE',
      `Screenshot exceeds the ${limits.screenshotWidth}x${limits.screenshotHeight} pixel limit.`,
    );
  }
  return {
    mimeType: collapseWhitespace(screenshot.mimeType) || 'image/png',
    base64,
    ...(width == null ? {} : { width }),
    ...(height == null ? {} : { height }),
  };
}

function normalizeElements(elements, limits) {
  if (!Array.isArray(elements)) return [];
  return elements.slice(0, limits.elements).map((element, index) => ({
    id:
      truncate(element?.id, limits.attributeCharacters) || `element-${index + 1}`,
    tagName:
      truncate(element?.tagName, limits.attributeCharacters)?.toLowerCase() || null,
    role: truncate(element?.role, limits.attributeCharacters),
    name: truncate(element?.name, limits.textCharacters),
    text: truncate(element?.text, limits.textCharacters),
    attributes: normalizeRecord(element?.attributes, limits),
    box: normalizeBox(element?.box),
    styles: normalizeRecord(element?.styles, limits),
    evidenceStatus: 'observed',
    confidence: 1,
  }));
}

function normalizeAssets(assets, baseUrl, limits) {
  if (!Array.isArray(assets)) return [];
  return assets.slice(0, limits.assets).map((asset, index) => {
    let url = null;
    const boundedUrl = truncate(asset?.url, limits.attributeCharacters);
    if (boundedUrl) {
      try {
        url = new URL(boundedUrl, baseUrl).href;
      } catch {
        url = null;
      }
    }
    return {
      id:
        truncate(asset?.id, limits.attributeCharacters) || `asset-${index + 1}`,
      type:
        truncate(asset?.type, limits.attributeCharacters)?.toLowerCase() ||
        'unknown',
      url,
      alt: truncate(asset?.alt, limits.textCharacters),
      role: truncate(asset?.role, limits.attributeCharacters),
      width: roundNumber(asset?.width),
      height: roundNumber(asset?.height),
      evidenceStatus: 'observed',
      confidence: 1,
    };
  });
}

function normalizeKeyframe(keyframe, limits) {
  if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(keyframe)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limits.attributesPerElement)
      .map(([key, value]) => [
        truncate(key, limits.attributeCharacters) ?? '',
        typeof value === 'number'
          ? roundNumber(value)
          : truncate(value, limits.attributeCharacters),
      ]),
  );
}

function normalizeAnimations(animations, limits) {
  if (!Array.isArray(animations)) return [];
  return animations.slice(0, limits.animations).map((animation, index) => ({
    id:
      truncate(animation?.id, limits.attributeCharacters) ||
      `animation-${index + 1}`,
    name: truncate(animation?.name, limits.attributeCharacters),
    type: truncate(animation?.type, limits.attributeCharacters),
    target: truncate(animation?.target, limits.attributeCharacters),
    duration: roundNumber(animation?.duration),
    delay: roundNumber(animation?.delay),
    iterations: roundNumber(animation?.iterations),
    easing: truncate(animation?.easing, limits.attributeCharacters),
    keyframes: Array.isArray(animation?.keyframes)
      ? animation.keyframes
          .slice(0, limits.keyframesPerAnimation)
          .map((keyframe) => normalizeKeyframe(keyframe, limits))
      : [],
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

export function normalizeUrlEvidence(raw, { sourceUrl, limits: limitOverrides } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('URL evidence collector must return an object.');
  }

  const limits = resolveLimits(limitOverrides);

  const requestedUrl = new URL(sourceUrl).href;
  const finalUrl = new URL(raw.finalUrl || requestedUrl, requestedUrl).href;
  const screenshot = normalizeScreenshot(raw.screenshot, limits);
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

  const warnings = new Set(
    Array.isArray(raw.warnings)
      ? raw.warnings.map(collapseWhitespace).filter(Boolean)
      : [],
  );
  if (Array.isArray(raw.elements) && raw.elements.length > limits.elements) {
    warnings.add(`Elements were truncated at ${limits.elements}.`);
  }
  if (Array.isArray(raw.assets) && raw.assets.length > limits.assets) {
    warnings.add(`Assets were truncated at ${limits.assets}.`);
  }
  if (Array.isArray(raw.animations) && raw.animations.length > limits.animations) {
    warnings.add(`Animations were truncated at ${limits.animations}.`);
  }
  if (
    Array.isArray(raw.animations) &&
    raw.animations.some(
      (animation) =>
        Array.isArray(animation?.keyframes) &&
        animation.keyframes.length > limits.keyframesPerAnimation,
    )
  ) {
    warnings.add(
      `Animation keyframes were truncated at ${limits.keyframesPerAnimation}.`,
    );
  }

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
      title: truncate(raw.document?.title, limits.textCharacters),
      language:
        truncate(raw.document?.language, limits.attributeCharacters)?.toLowerCase() ||
        null,
    },
    elements: normalizeElements(raw.elements, limits),
    assets: normalizeAssets(raw.assets, finalUrl, limits),
    animations: normalizeAnimations(raw.animations, limits),
    blockedRequests: normalizeBlockedRequests(raw.blockedRequests),
    warnings: [...warnings],
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

async function collectPageSnapshot(page, limits) {
  return page.evaluate(async (captureLimits) => {
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
    const bounded = (value, characters) =>
      value == null ? null : String(value).slice(0, characters);

    const warnings = [];
    const nodeList = globalThis.document.querySelectorAll('*');
    if (nodeList.length > captureLimits.elements) {
      warnings.push(`Elements were truncated at ${captureLimits.elements}.`);
    }
    const elements = Array.from(
      { length: Math.min(nodeList.length, captureLimits.elements) },
      (_, index) => {
        const element = nodeList[index];
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        const attributes = Object.fromEntries(
          [...element.attributes]
            .slice(0, captureLimits.attributesPerElement)
            .map((attribute) => [
              attribute.name.slice(0, captureLimits.attributeCharacters),
              attribute.value.slice(0, captureLimits.attributeCharacters),
            ]),
        );
        let directText = '';
        for (const node of element.childNodes) {
          if (node.nodeType !== 3) continue;
          directText += `${node.textContent ?? ''} `;
          if (directText.length >= captureLimits.textCharacters) break;
        }
        return {
          id: `element-${index + 1}`,
          tagName: bounded(element.tagName, captureLimits.attributeCharacters),
          role: bounded(
            element.getAttribute('role'),
            captureLimits.attributeCharacters,
          ),
          name: bounded(
            element.getAttribute('aria-label') || element.getAttribute('alt'),
            captureLimits.textCharacters,
          ),
          text: directText.slice(0, captureLimits.textCharacters),
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

    const assetNodes = [...globalThis.document.querySelectorAll('img, video, source')];
    if (assetNodes.length > captureLimits.assets) {
      warnings.push(`Assets were truncated at ${captureLimits.assets}.`);
    }
    const assets = assetNodes.slice(0, captureLimits.assets).map(
      (element, index) => ({
        id: `asset-${index + 1}`,
        type: element.tagName.toLowerCase(),
        url:
          bounded(
            element.currentSrc ||
              element.src ||
              element.getAttribute('poster') ||
              element.getAttribute('src'),
            captureLimits.attributeCharacters,
          ),
        alt: bounded(element.getAttribute('alt'), captureLimits.textCharacters),
        role: bounded(
          element.getAttribute('role'),
          captureLimits.attributeCharacters,
        ),
        width: element.naturalWidth || element.videoWidth || element.width || null,
        height:
          element.naturalHeight || element.videoHeight || element.height || null,
      }),
    );

    const pageAnimations = globalThis.document.getAnimations();
    if (pageAnimations.length > captureLimits.animations) {
      warnings.push(`Animations were truncated at ${captureLimits.animations}.`);
    }
    let keyframesTruncated = false;
    const animations = pageAnimations
      .slice(0, captureLimits.animations)
      .map((animation, index) => {
      const effect = animation.effect;
      const timing = effect?.getTiming?.() ?? {};
      const keyframes = effect?.getKeyframes?.() ?? [];
      if (keyframes.length > captureLimits.keyframesPerAnimation) {
        keyframesTruncated = true;
      }
      return {
        id: `animation-${index + 1}`,
        name: bounded(
          animation.animationName || animation.id,
          captureLimits.attributeCharacters,
        ),
        type: bounded(
          animation.constructor?.name,
          captureLimits.attributeCharacters,
        ),
        target: bounded(
          effect?.target?.id || effect?.target?.tagName,
          captureLimits.attributeCharacters,
        ),
        duration: timing.duration,
        delay: timing.delay,
        iterations: timing.iterations,
        easing: bounded(timing.easing, captureLimits.attributeCharacters),
        keyframes: keyframes
          .slice(0, captureLimits.keyframesPerAnimation)
          .map((keyframe) =>
            Object.fromEntries(
              Object.entries(keyframe)
                .slice(0, captureLimits.attributesPerElement)
                .map(([key, value]) => [
                  bounded(key, captureLimits.attributeCharacters),
                  typeof value === 'number'
                    ? value
                    : bounded(value, captureLimits.attributeCharacters),
                ]),
            ),
          ),
      };
    });
    if (keyframesTruncated) {
      warnings.push(
        `Animation keyframes were truncated at ${captureLimits.keyframesPerAnimation}.`,
      );
    }

    const documentElement = globalThis.document.documentElement;
    const body = globalThis.document.body;

    return {
      document: {
        title: bounded(globalThis.document.title, captureLimits.textCharacters),
        language: bounded(
          globalThis.document.documentElement.lang,
          captureLimits.attributeCharacters,
        ),
      },
      viewport: {
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
        deviceScaleFactor: globalThis.devicePixelRatio,
      },
      pageSize: {
        width: Math.max(
          globalThis.innerWidth,
          documentElement?.scrollWidth ?? 0,
          body?.scrollWidth ?? 0,
        ),
        height: Math.max(
          globalThis.innerHeight,
          documentElement?.scrollHeight ?? 0,
          body?.scrollHeight ?? 0,
        ),
      },
      elements,
      assets,
      animations,
      warnings,
    };
  }, limits);
}

function withEvidenceTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new UrlEvidenceError(
          'URL_EVIDENCE_TIMEOUT',
          `URL evidence collection exceeded the ${timeoutMs}ms total timeout.`,
        ),
      );
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function collectWithPlaywright({
  url,
  validateRequest,
  playwrightLoader,
  now,
  limits,
}) {
  const blockedRequests = [];
  let blockedNavigationError = null;
  let browser;
  let context;
  try {
    return await withEvidenceTimeout(
      (async () => {
        const playwright = await loadPlaywright(playwrightLoader);
        if (!playwright?.chromium?.launch) {
          throw new UrlEvidenceError(
            'URL_EVIDENCE_PLAYWRIGHT_INVALID',
            'The loaded Playwright module does not expose chromium.launch().',
          );
        }

        browser = await playwright.chromium.launch({ headless: true });
        context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
          colorScheme: 'light',
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
          acceptDownloads: false,
        });

        await context.route('**/*', async (route) => {
          const request = route.request();
          const requestUrl = request.url();
          try {
            const method = request.method?.() ?? 'GET';
            if (method !== 'GET' && method !== 'HEAD') {
              throw new UrlEvidenceError(
                'URL_METHOD_NOT_ALLOWED',
                'Only GET and HEAD requests are allowed during capture.',
              );
            }
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
        await context.routeWebSocket?.('**/*', async (webSocket) => {
          await webSocket.close();
        });

        const page = await context.newPage();
        page.setDefaultTimeout?.(Math.min(10_000, limits.totalTimeoutMs));
        page.setDefaultNavigationTimeout?.(
          Math.min(30_000, limits.totalTimeoutMs),
        );
        page.on?.('download', async (download) => {
          try {
            await download.cancel();
          } catch {
            // The context also has acceptDownloads:false. Cancellation is best-effort.
          }
        });
        try {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: Math.min(30_000, limits.totalTimeoutMs),
          });
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
        const snapshot = await collectPageSnapshot(page, limits);
        const screenshotWidth = Math.max(
          1,
          Math.min(
            limits.screenshotWidth,
            roundNumber(snapshot.pageSize?.width) ??
              roundNumber(snapshot.viewport?.width) ??
              limits.screenshotWidth,
          ),
        );
        const screenshotHeight = Math.max(
          1,
          Math.min(
            limits.screenshotHeight,
            roundNumber(snapshot.pageSize?.height) ??
              roundNumber(snapshot.viewport?.height) ??
              limits.screenshotHeight,
          ),
        );
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          clip: {
            x: 0,
            y: 0,
            width: screenshotWidth,
            height: screenshotHeight,
          },
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
        });

        return {
          ...snapshot,
          finalUrl,
          capturedAt: now().toISOString(),
          browser: { name: 'chromium', version: browser.version() },
          screenshot: {
            mimeType: 'image/png',
            base64: Buffer.from(screenshotBuffer).toString('base64'),
            width: screenshotWidth,
            height: screenshotHeight,
          },
          blockedRequests,
        };
      })(),
      limits.totalTimeoutMs,
    );
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
    limits: limitOverrides,
  } = {},
) {
  const limits = resolveLimits(limitOverrides);
  const deadline = Date.now() + limits.totalTimeoutMs;
  const remainingMs = () => Math.max(1, deadline - Date.now());
  const requested = await withEvidenceTimeout(
    assertSafeUrl(input, { lookup }),
    remainingMs(),
  );
  const validateRequest = createRequestGuard({ lookup });
  const raw = collector
    ? await withEvidenceTimeout(
        Promise.resolve().then(() =>
          collector({ url: requested.href, validateRequest }),
        ),
        remainingMs(),
      )
    : await collectWithPlaywright({
        url: requested.href,
        validateRequest,
        playwrightLoader,
        now,
        limits: { ...limits, totalTimeoutMs: remainingMs() },
      });

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('URL evidence collector must return an object.');
  }

  const finalUrl = new URL(raw.finalUrl || requested.href, requested.href).href;
  await withEvidenceTimeout(validateRequest(finalUrl), remainingMs());
  return normalizeUrlEvidence(
    { ...raw, finalUrl },
    { sourceUrl: requested.href, limits },
  );
}
