import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [relative(root, p).replaceAll('\\', '/')];
  });
}

const EXCLUDED = new Set(['icons/club-logo-source.png']);

test('every precached asset exists', () => {
  for (const a of assets.filter((a) => a !== './')) assert.ok(existsSync(join(root, a)), `missing: ${a}`);
});

test('every app file is precached (offline completeness)', () => {
  const files = [...walk(join(root, 'js')), ...walk(join(root, 'css')), ...walk(join(root, 'icons')), ...walk(join(root, 'fonts'))]
    .filter((f) => !EXCLUDED.has(f) && !f.endsWith('.txt'));
  for (const f of files) assert.ok(assets.includes(f), `not in sw.js ASSETS: ${f}`);
});

test('manifest uses the agreed names and relative URLs', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Football Manager');
  assert.equal(m.short_name, 'Football');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  for (const icon of m.icons) assert.ok(assets.includes(icon.src), icon.src);
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /<title>Football Manager<\/title>/);
  assert.match(html, /apple-mobile-web-app-title" content="Football"/);
});

test('UI text and code say "football", never "soccer"', () => {
  const files = ['index.html', 'manifest.webmanifest', 'sw.js', ...walk(join(root, 'js')).filter((f) => !f.includes('vendor/'))];
  for (const f of files) assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /soccer/i, f);
});
