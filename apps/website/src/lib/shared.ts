import type { DocsVersionId } from './versions';

export const discordInviteUrl = 'https://androz2091.fr/discord';
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://discord-player.js.org';
export const docsRoute = '/docs';
export const communityRoute = '/community';

export const gitConfig = {
  user: 'Androz2091',
  repo: 'discord-player',
  branch: 'v8',
};

/** Generated per-page routes that exist for every documentation version. */
const generatedRoutes = {
  markdown: '/llms.mdx/docs',
  image: '/og/docs',
} as const;

interface PageLocation {
  version: DocsVersionId;
  slugs: string[];
}

/** Returns the Markdown export of a page, for example for `llms.txt` consumers and the copy button. */
export function getPageMarkdownUrl({ version, slugs }: PageLocation) {
  const segments = [version, ...slugs, 'content.md'];

  return { segments, url: `${generatedRoutes.markdown}/${segments.join('/')}` };
}

/** Returns the social preview image of a page. */
export function getPageImageUrl({ version, slugs }: PageLocation) {
  const segments = [version, ...slugs, 'image.png'];

  return { segments, url: `${generatedRoutes.image}/${segments.join('/')}` };
}

/** Returns the location of a page's source file in the repository. */
export function getPageSourceUrl(version: DocsVersionId, path: string) {
  return `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/website/content/docs/${version}/${path}`;
}
