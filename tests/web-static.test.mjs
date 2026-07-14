import assert from 'node:assert/strict';
import { readFile, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
  assert.ok(sample.promptSections.length >= 10);
  assert.ok(sample.promptSections.some((section) => section.id === 'acceptance-tests'));
  assert.ok(sample.promptSections.every((section) => section.evidenceType));
});

test('export helpers create portable JSON, Markdown and CSS artifacts', () => {
  const app = loadClassicScript('app.js');
  const sample = loadClassicScript('sample-data.js');

  const json = JSON.parse(app.createExport('json', sample));
  assert.equal(json.meta.title, sample.meta.title);
  assert.equal(json.promptSections.length, sample.promptSections.length);

  const markdown = app.createExport('markdown', sample);
  assert.match(markdown, /^# UItoPrompt Style Skill/m);
  assert.match(markdown, /## Acceptance tests/);
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
