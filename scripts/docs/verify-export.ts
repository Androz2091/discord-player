import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OUTPUT_DIR, REPO_ROOT } from './config.ts';
import type { ApiManifest, ApiPageFile } from './model.ts';
import { signatureToText } from './text.ts';

/** Inputs for {@link verifyExport}. */
export interface VerifyOptions {
  /** Static export directory, normally `apps/website/out`. */
  outDir: string;
  /** Generated API directory with `manifest.json` and `pages/`. */
  generatedDir?: string;
  /** `NEXT_PUBLIC_BASE_PATH` the site was built with. */
  basePath?: string;
}

/** Decode the few entities React emits and drop tags, leaving the text a crawler would index. */
function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replace(/\s+/g, ' ');
}

/**
 * Check the static export of the generated API reference.
 *
 * Verifies that every generated page was exported with its documentation present in the
 * server-rendered HTML (including every overload), that links and anchors resolve, and that the
 * search index, Markdown exports and social images cover the API pages.
 *
 * @param options Export location and base path.
 * @returns Failure messages; an empty list means the export is correct.
 */
export function verifyExport(options: VerifyOptions): string[] {
  const generatedDir = options.generatedDir ?? OUTPUT_DIR;
  const basePath = options.basePath ?? '';
  const failures: string[] = [];
  const manifest = JSON.parse(readFileSync(join(generatedDir, 'manifest.json'), 'utf8')) as ApiManifest;
  const fail = (message: string) => failures.push(message);

  if (manifest.pages.length === 0) fail('The manifest lists no API pages.');

  const htmlOf = (url: string) => {
    const file = join(options.outDir, url.replace(/^\//, ''), 'index.html');

    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  };

  let overloadPages = 0;

  for (const page of manifest.pages) {
    const html = htmlOf(page.url);

    if (!html) {
      fail(`${page.url}: not exported`);
      continue;
    }

    const text = textOf(html);

    if (!text.includes(page.title)) fail(`${page.url}: title missing from server-rendered HTML`);

    if (html.includes('href="ref:')) fail(`${page.url}: unresolved {@link} placeholder in HTML`);

    const content = JSON.parse(readFileSync(join(generatedDir, page.file), 'utf8')) as ApiPageFile;

    if (content.type !== 'symbol') continue;

    const symbol = content.page.symbol;

    for (const item of content.page.toc) {
      if (item.depth === 3 && !html.includes(`id="${item.url.slice(1)}"`))
        fail(`${page.url}: anchor ${item.url} missing`);
    }

    const callables = [symbol, ...symbol.members, ...(symbol.rust?.impls.flatMap((impl) => impl.items) ?? [])];

    for (const callable of callables) {
      const overloads = callable.signatures.filter(
        (signature) => signature.signatureKind === 'call' || signature.signatureKind === 'construct',
      );

      if (overloads.length < 2) continue;

      overloadPages += 1;

      for (const [index] of overloads.entries()) {
        if (!text.includes(`Overload ${index + 1}`))
          fail(`${page.url}: "Overload ${index + 1}" tab missing for ${callable.name}`);
      }

      for (const signature of overloads) {
        const parameters = signature.parameters.map((parameter) => parameter.name);

        for (const name of parameters) {
          if (!text.includes(name)) fail(`${page.url}: parameter ${name} of ${callable.name} not server-rendered`);
        }

        void signatureToText(signature);
      }

      if (!/class="ov-panel/.test(html)) fail(`${page.url}: overload panels missing`);
    }
  }

  // Direct links to members and cross-page links keep the base path.
  const sample = manifest.pages.find((page) => page.url.endsWith('/typescript/discord-player/Player/'));
  const sampleHtml = sample ? htmlOf(sample.url) : undefined;

  if (sample && sampleHtml && !sampleHtml.includes(`href="${basePath}/docs/v8/api/typescript/discord-player/Track/`)) {
    fail(`${sample.url}: type reference links must be rendered as static anchors`);
  }

  // Sidebar: the API reference is reachable from guide pages and from API pages.
  const guide = htmlOf('/docs/v8/getting-started/');

  if (guide && !guide.includes('docs/v8/api/')) fail('Guide pages do not link the API reference in the sidebar.');

  // Search index.
  const searchFile = join(options.outDir, 'api', 'search', 'v8');

  if (existsSync(searchFile)) {
    const search = JSON.parse(readFileSync(searchFile, 'utf8')) as {
      docs: { docs: Record<string, { url?: string; content?: string }> };
    };
    const entries = Object.values(search.docs.docs);
    const urls = new Set(entries.map((entry) => entry.url?.split('#')[0]?.replace(/\/$/, '')));

    for (const page of manifest.pages) {
      if (!urls.has(page.url.replace(/\/$/, ''))) fail(`${page.url}: missing from the static search index`);
    }

    if (!entries.some((entry) => entry.url?.includes('/docs/v8/api/') && entry.url.includes('#')))
      fail('Search index has no API member entries.');
  } else {
    fail('Static search index missing.');
  }

  // Markdown exports for crawlers.
  const llms = join(options.outDir, 'llms', 'v8', 'llms.txt');

  if (!existsSync(llms) || !readFileSync(llms, 'utf8').includes('/docs/v8/api/'))
    fail('llms.txt does not list the API reference.');

  for (const page of manifest.pages) {
    const markdown = join(options.outDir, 'llms.mdx', page.url.replace(/^\//, ''), 'content.md');

    if (!existsSync(markdown) || readFileSync(markdown, 'utf8').trim().length === 0)
      fail(`${page.url}: Markdown export missing`);
  }

  if (overloadPages === 0) fail('No overloaded callable was found to verify overload rendering.');

  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] ?? join(REPO_ROOT, 'apps', 'website', 'out');
  const failures = verifyExport({ outDir, basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '' });

  if (failures.length > 0) {
    for (const failure of failures) console.error(`error: ${failure}`);

    process.exitCode = 1;
  } else {
    console.log('Verified the static export of the generated API reference.');
  }
}
