/**
 * Documentation versions.
 *
 * This file is the single place that controls which documentation versions exist, their order, the default
 * version, and how each version is labelled. Each version's content lives in `content/docs/<id>/`.
 *
 * Common changes:
 * - Rename a badge: edit `badge.text` (for example `'Dev'` to `'Release Candidate'`).
 * - Change a badge colour: edit `badge.tone`.
 * - Make another version the default (the "latest" version): change `defaultVersionId`.
 *   Unversioned URLs such as `/docs` and `/api` then redirect to that version.
 * - Add a version: add an entry and create `content/docs/<id>/`.
 */

/** Colour treatment of a version badge. Each tone maps to a theme-aware style in `VersionBadge`. */
export type VersionBadgeTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

/** A short label displayed next to a version name. */
export interface VersionBadgeConfig {
  /** Text displayed inside the badge. */
  text: string;

  /** Colour treatment of the badge. */
  tone: VersionBadgeTone;
}

/** Configuration for one documentation version. */
export interface DocsVersionConfig {
  /** URL segment and content directory name. For example `v8` is served from `/docs/v8` and `content/docs/v8`. */
  id: string;

  /** Name displayed in the version selector, search, and metadata. */
  name: string;

  /** One-line summary shown under the name in the version selector. */
  description: string;

  /** Optional badge displayed next to the name. */
  badge?: VersionBadgeConfig;

  /**
   * Slug of this version's API reference section, relative to the version root.
   * The unversioned `/api` URLs redirect here when this version is the default.
   * Omit it when the version has no separate API reference.
   */
  apiReference?: string;

  /**
   * Path of this version's "getting started" page, relative to the version root and starting with a slash.
   * The home page links to it. Omit it to link to the version root.
   */
  startPath?: string;
}

/**
 * Available versions in the order they appear in the version selector.
 */
export const docsVersions = [
  {
    id: 'v7',
    name: 'v7',
    description: 'Stable release',
    apiReference: 'api',
    startPath: '/creating-a-music-bot/01_integrating',
  },
  {
    id: 'v8',
    name: 'v8',
    description: 'Development preview',
    badge: { text: 'Dev', tone: 'warning' },
    apiReference: 'api',
    startPath: '/getting-started',
  },
] as const satisfies readonly DocsVersionConfig[];

/** Identifier of a configured documentation version. */
export type DocsVersionId = (typeof docsVersions)[number]['id'];

/**
 * The default ("latest") version. Unversioned routes such as `/docs` and `/api` redirect to it.
 */
export const defaultVersionId: DocsVersionId = 'v7';

/** Version configuration widened so optional fields can be read without narrowing each entry. */
export type ResolvedDocsVersion = DocsVersionConfig & { id: DocsVersionId };

const versions: readonly ResolvedDocsVersion[] = docsVersions;

if (!versions.some((version) => version.id === defaultVersionId)) {
  throw new Error(`defaultVersionId "${defaultVersionId}" is not listed in docsVersions.`);
}

if (new Set(versions.map((version) => version.id)).size !== versions.length) {
  throw new Error('docsVersions contains duplicate version ids.');
}

/** All configured versions in display order. */
export function getDocsVersions(): readonly ResolvedDocsVersion[] {
  return versions;
}

/** Narrows an arbitrary string, such as a URL segment, to a configured version id. */
export function isDocsVersionId(value: string | undefined): value is DocsVersionId {
  return versions.some((version) => version.id === value);
}

/** Returns the configuration of a version. */
export function getDocsVersion(id: DocsVersionId): ResolvedDocsVersion {
  const version = versions.find((entry) => entry.id === id);

  if (!version) throw new Error(`Unknown documentation version "${id}".`);

  return version;
}

/** Returns the configuration of the default version. */
export function getDefaultDocsVersion(): ResolvedDocsVersion {
  return getDocsVersion(defaultVersionId);
}

/** Returns the base URL of a version, for example `/docs/v7`. */
export function getVersionBaseUrl(id: DocsVersionId): string {
  return `/docs/${id}`;
}

/** Documentation locations parsed from a URL path. */
export interface ParsedDocsPath {
  /** Version addressed by the path, or `undefined` when the path is not versioned. */
  version: DocsVersionId | undefined;

  /** Page segments after the version. */
  slugs: string[];
}

/**
 * Parses a pathname such as `/docs/v8/guides/queues`.
 * Paths that are not under `/docs/<version>` return `version: undefined`.
 */
export function parseDocsPath(pathname: string): ParsedDocsPath {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'docs' || !isDocsVersionId(segments[1])) {
    return { version: undefined, slugs: [] };
  }

  return { version: segments[1], slugs: segments.slice(2) };
}

/** Lists of page slugs, keyed by version. A page `guides/queues` is stored as `'guides/queues'` and the root page as `''`. */
export type VersionPageIndex = Partial<Record<DocsVersionId, readonly string[]>>;

/**
 * Finds the page in `target` that matches the page currently open.
 *
 * Returns the same slug when the target has it. Otherwise the closest existing parent section is used,
 * and the version root is the final fallback.
 */
export function resolveEquivalentSlug(slugs: readonly string[], targetPages: ReadonlySet<string>): string[] {
  for (let length = slugs.length; length > 0; length--) {
    const candidate = slugs.slice(0, length).join('/');

    if (targetPages.has(candidate)) return slugs.slice(0, length);
  }

  return [];
}

/**
 * Builds the URL for opening the page equivalent to `slugs` in another version.
 *
 * @param target The version being switched to.
 * @param slugs Page segments of the page currently open.
 * @param index Page lists of the target version.
 */
export function getEquivalentVersionUrl(
  target: DocsVersionId,
  slugs: readonly string[],
  index: VersionPageIndex,
): string {
  const pages = new Set(index[target] ?? []);
  const equivalent = resolveEquivalentSlug(slugs, pages);

  return [getVersionBaseUrl(target), ...equivalent].join('/');
}
