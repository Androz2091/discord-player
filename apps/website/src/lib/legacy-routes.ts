import { getPageSlugs, getPage } from './source';
import {
  defaultVersionId,
  getDocsVersion,
  getDocsVersions,
  getVersionBaseUrl,
  isDocsVersionId,
  type DocsVersionId,
} from './versions';

/**
 * Versions in the order unversioned URLs are matched against: the default version first,
 * then the remaining versions in configuration order.
 */
function getLookupOrder(): DocsVersionId[] {
  const others = getDocsVersions()
    .map((version) => version.id)
    .filter((id) => id !== defaultVersionId);

  return [defaultVersionId, ...others];
}

/**
 * Finds where an unversioned documentation path now lives.
 *
 * `/docs/faq/common_errors` and `/api/discord-player/classes/Player` predate versioned URLs. They resolve to the
 * default version when it has the page and otherwise to the first version that does.
 *
 * @param slugs Path segments after `/docs`. For `/api/...` paths, pass the full segments starting with `api`.
 * @returns The versioned URL, or `undefined` when no version has the page.
 */
export function resolveUnversionedPath(slugs: string[]): string | undefined {
  for (const id of getLookupOrder()) {
    const page = getPage(id, slugs);

    if (page) return page.url;
  }

  return undefined;
}

/**
 * Lists every unversioned path that should redirect to a versioned page, as slug arrays after `/docs`.
 * The documentation root is excluded because `/docs` redirects to the default version directly.
 */
export function getUnversionedPaths(): string[][] {
  const seen = new Set<string>();

  for (const id of getLookupOrder()) {
    for (const slug of getPageSlugs(id)) {
      if (slug === '') continue;

      const [first] = slug.split('/');

      if (isDocsVersionId(first)) continue;

      seen.add(slug);
    }
  }

  return [...seen].map((slug) => slug.split('/'));
}

/** URL of the default version's documentation root, used by `/docs`. */
export function getDefaultDocsUrl(): string {
  return getVersionBaseUrl(defaultVersionId);
}

/** Splits a version's API reference slug, for example `'api'` or `'reference'`, into segments. */
function getApiPrefix(id: DocsVersionId): string[] | undefined {
  const slug = getDocsVersion(id).apiReference;

  return slug ? slug.split('/') : undefined;
}

/**
 * Finds where an unversioned `/api/...` path now lives.
 *
 * Versions are tried in lookup order, so the default version's API reference wins. A version without a matching
 * page is skipped, which keeps old links to another version's pages working.
 *
 * @param rest Path segments after `/api`. Empty for the API reference root.
 * @returns The versioned URL, or `undefined` when no version has the page.
 */
export function resolveApiPath(rest: string[]): string | undefined {
  for (const id of getLookupOrder()) {
    const prefix = getApiPrefix(id);

    if (!prefix) continue;

    const page = getPage(id, [...prefix, ...rest]);

    if (page) return page.url;
  }

  return undefined;
}

/**
 * Lists every `/api/...` path that redirects somewhere, as segments after `/api`. The root is included.
 */
export function getApiPaths(): string[][] {
  const seen = new Set<string>();

  for (const id of getLookupOrder()) {
    const prefix = getApiPrefix(id);

    if (!prefix) continue;

    for (const slug of getPageSlugs(id)) {
      const segments = slug === '' ? [] : slug.split('/');

      if (prefix.some((part, index) => segments[index] !== part)) continue;

      seen.add(segments.slice(prefix.length).join('/'));
    }
  }

  return [...seen].map((path) => (path === '' ? [] : path.split('/')));
}
