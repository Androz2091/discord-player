import { llms, loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { getDocsVersions, getVersionBaseUrl, type DocsVersionId } from './versions';

/**
 * Every version's content lives in `content/docs/<version id>/`.
 * The versions themselves are configured in `./versions.ts`.
 */
const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const allSource = docs.toFumadocsSource();
const allFiles = allSource.files;

const versionIds: string[] = getDocsVersions().map((version) => version.id);
const unconfiguredDirectories = new Set(
  allFiles
    .map((file) => file.path.split('/')[0] ?? '')
    .filter((directory) => directory !== '' && !versionIds.includes(directory)),
);

if (unconfiguredDirectories.size > 0) {
  throw new Error(
    `content/docs contains directories that are not listed in docsVersions: ${[...unconfiguredDirectories].join(', ')}`,
  );
}

function createVersionSource(id: DocsVersionId) {
  const prefix = `${id}/`;

  const files: typeof allFiles = allFiles
    .filter((file) => file.path.startsWith(prefix))
    .map((file) => ({ ...file, path: file.path.slice(prefix.length) }));

  return loader({
    baseUrl: getVersionBaseUrl(id),
    source: { ...allSource, files },
    plugins: [],
  });
}

/** A page source for one documentation version. */
export type VersionSource = ReturnType<typeof createVersionSource>;

const sources = Object.fromEntries(
  getDocsVersions().map((version) => [version.id, createVersionSource(version.id)]),
) as Record<DocsVersionId, VersionSource>;

/**
 * Returns the page source for a documentation version.
 *
 * @param id The version to read pages from.
 */
export function getSource(id: DocsVersionId): VersionSource {
  return sources[id];
}

/**
 * Returns the `llms.txt` generators for a documentation version.
 *
 * @param id The version to generate text exports for.
 */
export function getLlms(id: DocsVersionId) {
  return llms(sources[id], {
    renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
  });
}

/** Page slugs (`'guides/queues'`, with `''` for the version root) of every page in a version. */
export function getPageSlugs(id: DocsVersionId): string[] {
  return sources[id].getPages().map((page) => page.slugs.join('/'));
}

/**
 * Finds a page in a version from its slug.
 *
 * @param id Version to search.
 * @param slugs Page segments after the version, empty for the version root.
 */
export function getPage(id: DocsVersionId, slugs: string[] | undefined) {
  return sources[id].getPage(slugs);
}
