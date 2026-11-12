import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(process.argv[2] ?? fileURLToPath(new URL('../out', import.meta.url)));
const files = await readdir(output, { recursive: true });
const pages = files.filter((file) => file.endsWith('.html'));
const images = new Set();

assert.ok(pages.length, `No exported HTML pages found in ${output}`);

for (const page of pages) {
  const html = await readFile(resolve(output, page), 'utf8');
  const metadata = new Map();

  for (const tag of html.matchAll(/<meta\s[^>]*>/g)) {
    const attributes = Object.fromEntries(
      [...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
    );
    metadata.set(attributes.property ?? attributes.name, attributes.content);
  }

  for (const key of ['og:image', 'twitter:image']) {
    const value = metadata.get(key);
    assert.ok(value, `${page} is missing ${key}`);
    const url = new URL(value);
    assert.ok(['https:', 'http:'].includes(url.protocol), `${page} has an invalid ${key} URL`);
    images.add(decodeURIComponent(url.pathname).replace(/^\//, ''));
  }
}

for (const image of images) {
  const bytes = await readFile(resolve(output, image));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${image} must be an exported PNG`);
}

console.log(`Verified OG and Twitter images for ${pages.length} exported pages (${images.size} image files).`);
