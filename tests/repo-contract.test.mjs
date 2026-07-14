import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');

test('repository ships the public open-source contract', () => {
  for (const file of [
    'README.md',
    'LICENSE',
    'CONTRIBUTING.md',
    'SECURITY.md',
    '.gitignore',
    'package.json',
  ]) {
    assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
  }
});

test('package scripts expose one-command verification and review', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.private, false);
  assert.match(pkg.license, /MIT/i);
  assert.equal(typeof pkg.scripts.test, 'string');
  assert.equal(typeof pkg.scripts.start, 'string');
  assert.equal(typeof pkg.scripts.verify, 'string');
});

test('readme states truthful capability and explicit non-goals', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /Systematic Prompt/i);
  assert.match(readme, /StyleSpec/i);
  assert.match(readme, /observed|computed/i);
  assert.match(readme, /single screenshot|单张截图/i);
  assert.match(readme, /does not generate application code|不生成应用代码/i);
});

test('launch copy starts with a human design-reference scenario', () => {
  const promo = readFileSync(join(root, 'docs', 'promo-cn.md'), 'utf8');
  assert.match(promo, /喜欢.*说不清/);
  assert.match(promo, /uitoprompt\.com/);
  assert.doesNotMatch(promo, /审核后上线/);
});

test('production artifacts keep Gemini secret server-side and URL capture disabled by default', () => {
  const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8');
  const envExample = readFileSync(join(root, '.env.example'), 'utf8');
  const manifest = readFileSync(join(root, 'deploy', 'cloudrun', 'public-service.yaml'), 'utf8');
  const runbook = readFileSync(join(root, 'deploy', 'README.md'), 'utf8');

  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HOST=0\.0\.0\.0/);
  assert.match(dockerfile, /URL_ANALYSIS_ENABLED=false/);
  assert.match(envExample, /^GEMINI_API_KEY=$/m);
  assert.match(manifest, /secretKeyRef:[\s\S]*?name: GEMINI_API_KEY/);
  assert.match(manifest, /URL_ANALYSIS_ENABLED[\s\S]*?value: "false"/);
  assert.match(runbook, /Do not turn on `URL_ANALYSIS_ENABLED`/);
});
