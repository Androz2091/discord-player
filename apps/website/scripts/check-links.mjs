import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Validate the exported site, including generated heading IDs and compatibility anchors.
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] ?? join(app, 'out'));
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
const documents = new Map();

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
      documents.set(path, {
        ids: new Set([...html.matchAll(/<[a-z][^>]*\sid="([^"]+)"/g)].map((match) => match[1])),
        links: [...html.matchAll(/<(?:a|link)\b[^>]*?\bhref="([^"]+)"/g)].map((match) =>
          match[1].replaceAll('&amp;', '&'),
        ),
      });
    }
  }
}

await scan(output);
if (documents.size === 0) throw new Error('No exported HTML found. Build the docs before checking links.');
const failures = new Set();
let checked = 0;

for (const [file, document] of documents) {
  const route = `${basePath}/${relative(output, file)
    .replaceAll('\\', '/')
    .replace(/index\.html$/, '')}`;
  for (const href of document.links) {
    const url = new URL(href, `https://docs.local${route}`);
    if (!['docs.local', 'discord-player.js.org'].includes(url.hostname)) continue;
    if (!['https:', 'http:'].includes(url.protocol)) continue;
    const pathname = decodeURIComponent(url.pathname);
    const localPath =
      basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))
        ? pathname.slice(basePath.length) || '/'
        : pathname;
    const path = resolve(output, `.${localPath}`);
    let target = path;
    try {
      if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
      await stat(target);
    } catch {
      failures.add(`${route}: missing target ${href}`);
      continue;
    }
    if (url.hash && documents.has(target)) {
      const anchor = decodeURIComponent(url.hash.slice(1));
      if (!documents.get(target).ids.has(anchor)) failures.add(`${route}: missing anchor ${href}`);
    }
    checked += 1;
  }
}

if (failures.size) {
  console.error([...failures].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} local links across ${documents.size} exported HTML pages.`);
}
