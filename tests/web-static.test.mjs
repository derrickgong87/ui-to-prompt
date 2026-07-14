import assert from 'node:assert/strict';
import { readFile, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { validateStyleSpec } from '../packages/core/style-spec.mjs';

const readFileAsync = promisify(readFile);
const publicDir = new URL('../apps/web/public/', import.meta.url);

async function source(name) {
  return readFileAsync(new URL(name, publicDir), 'utf8');
}

function loadClassicScript(name) {
  const code = readFileSync(fileURLToPath(new URL(name, publicDir)), 'utf8');
  const context = { module: { exports: {} } };
  context.globalThis = context;
  vm.runInNewContext(code, context, { filename: name });
  return context.module.exports;
}

test('static entry exposes the complete capture-to-export journey without external assets', async () => {
  const html = await source('index.html');

  assert.match(html, /<link[^>]+href="\.\/styles\.css"/);
  assert.match(html, /<script[^>]+src="\.\/sample-data\.js"/);
  assert.match(html, /<script[^>]+src="\.\/app\.js"/);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);

  for (const sourceType of ['url', 'screenshot', 'visual']) {
    assert.match(html, new RegExp(`data-source-tab="${sourceType}"`));
  }
  for (const mode of ['style', 'rebuild']) {
    assert.match(html, new RegExp(`value="${mode}"`));
  }
  for (const tab of ['brief', 'style-system', 'systematic-prompt', 'validate', 'export']) {
    assert.match(html, new RegExp(`data-workspace-tab="${tab}"`));
  }
});

test('static entry includes evidence language, dual prompt views, example analysis and local canvas art', async () => {
  const html = await source('index.html');

  for (const label of ['Observed', 'Computed', 'Inferred', 'Unknown']) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  assert.match(html, /data-prompt-view="use-now"/);
  assert.match(html, /data-prompt-view="inspect-system"/);
  assert.match(html, /data-action="load-example"/);
  assert.match(html, /<canvas[^>]+id="reference-art"[^>]+aria-label=/);
  assert.match(html, /正在获取可见证据/);
  assert.match(html, /颜色样本已合并为/);
  assert.match(html, /响应式规则仅由单张桌面截图推断/);
});

test('page structure contains keyboard and assistive-technology affordances', async () => {
  const [html, css] = await Promise.all([source('index.html'), source('styles.css')]);

  assert.match(html, /class="skip-link"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label[^>]+for="source-url"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
});

test('Visual Forensics design tokens avoid forbidden visual clichés', async () => {
  const css = await source('styles.css');

  for (const token of ['--canvas', '--surface', '--ink', '--line', '--cobalt', '--signal', '--coral']) {
    assert.match(css, new RegExp(`${token}:`));
  }
  assert.doesNotMatch(css, /#[a-f\d]{0,2}(?:7c3aed|8b5cf6|a855f7)/i);
  assert.doesNotMatch(css, /backdrop-filter/i);
  assert.doesNotMatch(css, /linear-gradient\([^)]*(?:purple|violet|#7c3aed|#8b5cf6)/i);
});

test('sample payload separates evidence classes and exposes complete prompt sections', () => {
  const sample = loadClassicScript('sample-data.js');

  assert.equal(sample.meta.sourceType, 'url');
  assert.deepEqual(Object.keys(sample.evidenceSummary), ['observed', 'computed', 'inferred', 'unknown']);
  assert.deepEqual(Array.from(sample.promptSections, (section) => section.title), [
    'Mission and scope',
    'Authority and rights boundary',
    'Source-of-truth order',
    'Visual north star',
    'Non-negotiable invariants',
    'Design tokens',
    'Layout and responsive behavior',
    'Component grammar',
    'Content density and imagery',
    'Interaction and motion',
    'Accessibility and performance',
    'Negative constraints',
    'Unknown-handling rules',
    'Acceptance checklist',
    'Iteration protocol',
  ]);
  assert.ok(sample.promptSections.some((section) => section.id === 'acceptance-checklist'));
  assert.ok(sample.promptSections.every((section) => section.evidenceType));
});

test('export helpers create portable JSON, Markdown and CSS artifacts', () => {
  const app = loadClassicScript('app.js');
  const sample = loadClassicScript('sample-data.js');

  const json = JSON.parse(app.createExport('json', sample));
  assert.equal(json.schemaVersion, '1.0');
  assert.equal(json.metadata.title, sample.meta.title);
  assert.equal(Object.keys(json.sections).length, 15);
  assert.equal(validateStyleSpec(json).valid, true);

  const markdown = app.createExport('markdown', sample);
  assert.match(markdown, /^# UItoPrompt Style Skill/m);
  assert.match(markdown, /## Acceptance checklist/);
  assert.match(markdown, /Evidence: Observed/);

  const css = app.createExport('css', sample);
  assert.match(css, /^:root\s*\{/);
  assert.match(css, /--color-cobalt:\s*#3157f5;/i);
  assert.match(css, /--radius-panel:/);
});

test('interaction helpers keep one active workspace tab and describe evidence limits', () => {
  const app = loadClassicScript('app.js');

  assert.deepEqual({ ...app.selectOne(['brief', 'style-system', 'export'], 'style-system') }, {
    brief: false,
    'style-system': true,
    export: false,
  });
  assert.throws(() => app.selectOne(['brief'], 'missing'), /Unknown selection/);

  const screenshotStages = app.createAnalysisStages('screenshot');
  assert.equal(screenshotStages.length, 6);
  assert.ok(screenshotStages.some((stage) => stage.evidenceType === 'unknown'));
  assert.match(app.modeNotice('style'), /移除原品牌/);
  assert.match(app.modeNotice('rebuild'), /拥有或已获授权/);
});

test('comparison helper clamps the reveal and keeps the divider aligned', () => {
  const app = loadClassicScript('app.js');

  assert.deepEqual({ ...app.comparisonPosition(54) }, {
    clipPath: 'inset(0 46% 0 0)',
    dividerLeft: 'calc(54% - 12px)',
    ariaText: '54% 显示验证结果',
  });
  assert.equal(app.comparisonPosition(140).clipPath, 'inset(0 0% 0 0)');
  assert.equal(app.comparisonPosition(-20).clipPath, 'inset(0 100% 0 0)');
});

test('prompt section copy uses delegation so regenerated sections remain interactive', async () => {
  const appSource = await source('app.js');

  assert.match(appSource, /#prompt-sections['"]\)\.addEventListener\(['"]click['"]/);
  assert.doesNotMatch(appSource, /workspaceRendered\)\s*\{[\s\S]*?data-copy-section/);
});

test('hero headline has an intentional break that prevents a mobile orphan and overflow', async () => {
  const html = await source('index.html');

  assert.match(html, /<em>可复用<\/em><br\s*\/>的设计规则。/);
});

test('launch poster tells the evidence-to-skill story without external assets', async () => {
  const [html, css] = await Promise.all([source('poster.html'), source('poster.css')]);

  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
  for (const message of ['给我一个界面', '视觉证据', 'StyleSpec', 'Systematic Prompt', 'SKILL.md']) {
    assert.match(html, new RegExp(message));
  }
  assert.match(css, /width:\s*1080px/);
  assert.match(css, /height:\s*1350px/);
  assert.match(css, /#3157f5/i);
  assert.match(css, /#ddf45a/i);
});

test('real URL evidence produces source-specific output instead of the bundled sample', () => {
  const app = loadClassicScript('app.js');
  const sample = loadClassicScript('sample-data.js');
  const result = app.buildUrlDataset(
    {
      source: { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/' },
      capture: { capturedAt: '2026-07-14T08:00:00.000Z', viewport: { width: 1280, height: 720 } },
      document: { title: 'A distinct source' },
      elements: [
        { tagName: 'body', styles: { color: 'rgb(17, 18, 19)', 'background-color': 'rgb(245, 244, 239)', 'font-family': 'Inter, sans-serif' } },
        { tagName: 'a', styles: { color: 'rgb(10, 90, 220)', 'background-color': 'rgba(0, 0, 0, 0)', 'font-family': 'Inter, sans-serif' } },
      ],
      assets: [],
      animations: [],
      blockedRequests: [],
      warnings: [],
    },
    sample,
    'style',
  );

  assert.equal(result.meta.sourceUrl, 'https://example.com/');
  assert.equal(result.meta.viewport, '1280 × 720');
  assert.notEqual(result.meta.title, sample.meta.title);
  assert.equal(result.tokens.colors.canvas, '#f5f4ef');
  assert.equal(result.tokens.colors.ink, '#111213');
  assert.equal(result.promptSections.length, 15);
  assert.match(result.promptSections[0].content, /1280 × 720/);
});

test('image evidence keeps pixel facts and makes hidden implementation details unknown', () => {
  const app = loadClassicScript('app.js');
  const sample = loadClassicScript('sample-data.js');
  const result = app.buildImageDataset(
    { width: 1600, height: 1000, colors: ['#efece3', '#171816', '#3157f5', '#ddf45a'] },
    sample,
    { sourceType: 'screenshot', filename: 'screen.png', mode: 'style' },
  );

  assert.equal(result.meta.sourceUrl, 'screen.png');
  assert.equal(result.meta.viewport, '1600 × 1000');
  assert.equal(result.tokens.colors.canvas, '#efece3');
  assert.equal(result.tokens.colors.ink, '#171816');
  assert.match(result.brief.limits.join(' '), /DOM/);
  assert.match(result.brief.limits.join(' '), /断点/);
  assert.equal(result.promptSections.length, 15);
  assert.equal(result.promptSections.find((section) => section.id === 'layout-responsive').evidenceType, 'Unknown');
});

test('analysis runtime reads URL and image inputs and rejects CSS token injection', async () => {
  const [appSource, html] = await Promise.all([source('app.js'), source('index.html')]);
  const app = loadClassicScript('app.js');
  const sample = loadClassicScript('sample-data.js');

  assert.match(appSource, /fetch\(['"]\/api\/analyze-url/);
  assert.match(appSource, /fetch\(['"]\/api\/analyze-image/);
  assert.match(appSource, /imageFileToBase64/);
  assert.match(appSource, /createImageBitmap/);
  assert.match(appSource, /getImageData/);
  assert.match(html, /id="ai-analysis-consent"/);
  assert.doesNotMatch(html, /本地文件不会离开此页面/);

  const hostile = JSON.parse(JSON.stringify(sample));
  hostile.tokens.colors.canvas = 'red; } body { display:none }';
  assert.throws(() => app.createExport('css', hostile), /Unsafe CSS token/);
});

test('Gemini image output is labelled as a single-image inference before it enters the systematic prompt', () => {
  const app = loadClassicScript('app.js');
  const sample = loadClassicScript('sample-data.js');
  const sections = Object.fromEntries([
    'visualIntent', 'layout', 'color', 'typography', 'spacing', 'surfaces', 'components', 'imagery', 'iconography', 'responsiveness', 'interactions', 'motion', 'accessibility', 'content', 'constraints',
  ].map((name) => [name, { summary: `${name} guidance` }]));

  const result = app.buildGeminiImageDataset(
    { styleSpec: { metadata: { title: 'Model visual direction' }, sections }, summary: 'A clear north star.' },
    { width: 1600, height: 1000, colors: ['#efece3', '#171816', '#3157f5'] },
    sample,
    { sourceType: 'screenshot', filename: 'screen.png', mode: 'style' },
  );

  assert.equal(result.meta.title, 'Model visual direction');
  assert.equal(result.evidenceSummary.inferred.label, '视觉模型推断');
  assert.match(result.promptSections.find((section) => section.id === 'design-tokens').content, /color guidance/);
  assert.match(result.brief.limits.join(' '), /单张静态图片/);
});

test('model-derived text is HTML escaped before the workspace uses innerHTML', async () => {
  const app = loadClassicScript('app.js');
  const appSource = await source('app.js');

  assert.equal(app.escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.match(appSource, /<p>\$\{escapeHtml\(section\.content\)\}<\/p>/);
  assert.match(appSource, /\$\{escapeHtml\(item\)\}/);
});

test('mobile result navigation exposes StyleSpec, centers the active tab and keeps 44px targets', async () => {
  const [html, css, appSource] = await Promise.all([source('index.html'), source('styles.css'), source('app.js')]);

  assert.match(html, /StyleSpec · Style System/);
  assert.match(html, /15 个可独立检查的段落/);
  assert.match(appSource, /scrollWidth\s*>\s*tabs\.clientWidth/);
  assert.match(appSource, /scrollIntoView\(\{[^}]*inline:\s*['"]center['"]/);
  assert.match(css, /\.source-tabs button,[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.site-nav a[\s\S]*?min-height:\s*44px/);
});

test('image dimensions are rejected from bounded headers before browser decode', async () => {
  const app = loadClassicScript('app.js');
  const appSource = await source('app.js');
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer);
  view.setUint32(16, 12000);
  view.setUint32(20, 8000);

  assert.deepEqual({ ...app.parseImageDimensions(png) }, { width: 12000, height: 8000, format: 'png' });
  assert.match(appSource, /await readImageDimensions\(file\)[\s\S]*?createImageBitmap\(file\)/);
});
