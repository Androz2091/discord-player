import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiManifest, ApiPageFile, ManifestPage } from '@docs-scripts/model.ts';
import { MANIFEST_SCHEMA_VERSION } from '@docs-scripts/model.ts';

/** Directory written by `pnpm docs:api`. The docs scripts run with the app directory as the working directory. */
const GENERATED_DIR = join(process.cwd(), '.generated', 'api');

let manifest: ApiManifest | undefined;
let byUrl: Map<string, ManifestPage> | undefined;
const pageCache = new Map<string, ApiPageFile>();

/**
 * Read the generated API manifest.
 *
 * @returns The manifest produced by the generation pipeline.
 * @throws When the manifest is missing or was written by an incompatible generator version.
 */
export function getApiManifest(): ApiManifest {
  if (manifest) return manifest;

  const file = join(GENERATED_DIR, 'manifest.json');

  if (!existsSync(file)) {
    throw new Error(
      `Generated API documentation not found at ${file}. Run \`pnpm docs:api\` from the repository root (the docs build does this automatically).`,
    );
  }

  const parsed = JSON.parse(readFileSync(file, 'utf8')) as ApiManifest;

  if (parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `API manifest schema ${parsed.schemaVersion} does not match renderer schema ${MANIFEST_SCHEMA_VERSION}. Re-run \`pnpm docs:api\`.`,
    );
  }

  manifest = parsed;

  return parsed;
}

/** Page URL without a trailing slash, the form Fumadocs uses for page URLs. */
function canonical(url: string): string {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

/** Manifest record for a site-relative page URL such as `/docs/v8/api/rust/remedia-core`, with or without a trailing slash. */
export function getManifestPage(url: string): ManifestPage | undefined {
  byUrl ??= new Map(getApiManifest().pages.map((page) => [canonical(page.url), page]));

  return byUrl.get(canonical(url));
}

/**
 * Load the content of a generated API page.
 *
 * @param page Manifest record of the page.
 * @returns Parsed page content; repeated calls for the same page share one parsed object.
 */
export function loadApiPage(page: ManifestPage): ApiPageFile {
  const cached = pageCache.get(page.file);

  if (cached) return cached;

  const content = JSON.parse(readFileSync(join(GENERATED_DIR, page.file), 'utf8')) as ApiPageFile;

  pageCache.set(page.file, content);

  return content;
}

/** True for virtual content paths owned by the generated API reference. */
export function isApiPath(path: string): boolean {
  return path === 'api' || path.startsWith('api/');
}
