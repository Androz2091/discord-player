import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const directory = resolve(process.argv[2] ?? 'apps/website/out');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://discord-player.js.org');

function verifyLocalUrl(value) {
  const url = new URL(value, site);
  if (url.origin !== site.origin) return;
  assert.ok(url.pathname.startsWith(`${basePath}/`), `Missing base path: ${value}`);
  const path = join(directory, decodeURIComponent(url.pathname.slice(basePath.length)));
  assert.ok(
    (existsSync(path) && statSync(path).isFile()) || existsSync(join(path, 'index.html')),
    `Missing exported file: ${value}`,
  );
}

function verifyHtml(path) {
  const html = readFileSync(path, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (url.startsWith('/')) verifyLocalUrl(url);
  }
  const images = [...html.matchAll(/(?:property="og:image"|name="twitter:image") content="([^"]+)"/g)];
  assert.equal(images.length, 2, `Missing social image metadata: ${path}`);
  for (const [, url] of images) {
    assert.equal(new URL(url).origin, site.origin, `Incorrect social image origin: ${url}`);
    verifyLocalUrl(url);
    const imagePath = new URL(url).pathname.slice(basePath.length);
    const png = readFileSync(join(directory, imagePath));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
  }
}

verifyHtml(join(directory, 'index.html'));
const pages = readdirSync(join(directory, 'docs'), { recursive: true }).filter((path) => path.endsWith('index.html'));
assert.ok(pages.length > 1, 'Documentation pages must be exported');
for (const page of pages) verifyHtml(join(directory, 'docs', page));
const search = JSON.parse(readFileSync(join(directory, 'api/search/v8'), 'utf8'));
assert.equal(search.type, 'advanced');
assert.ok(Object.keys(search.docs).length > 0, 'Static search index must contain documents');
for (const path of ['llms.txt', 'llms-full.txt', 'llms.mdx/docs/v8/api/content.md']) {
  assert.ok(readFileSync(join(directory, path)).length > 0, `Missing Markdown export: ${path}`);
}
console.log(
  `Verified homepage, ${pages.length} documentation pages, local links/assets, social images, search index, and Markdown exports.`,
);
