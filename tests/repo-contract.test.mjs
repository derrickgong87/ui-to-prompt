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
