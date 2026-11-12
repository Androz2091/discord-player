import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { VersionSelector } from '@/components/version-selector';
import { appName, communityRoute, discordInviteUrl, gitConfig } from './shared';
import { getPageSlugs } from './source';
import {
  defaultVersionId,
  getDocsVersions,
  getVersionBaseUrl,
  type DocsVersionId,
  type VersionPageIndex,
} from './versions';

/** Page lists of every version except `current`, used by the version selector to find equivalent pages. */
function getPageIndex(current: DocsVersionId): VersionPageIndex {
  const index: VersionPageIndex = {};

  for (const version of getDocsVersions()) {
    index[version.id] = version.id === current ? [] : getPageSlugs(version.id);
  }

  return index;
}

/**
 * Options shared by every layout. The version selector is only added for documentation pages.
 *
 * @param version Documentation version being displayed. Omit it outside the documentation.
 */
export function baseOptions(version?: DocsVersionId): BaseLayoutProps {
  return {
    nav: {
      title: appName,
      children: version ? <VersionSelector current={version} pageIndex={getPageIndex(version)} /> : undefined,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      ...(version
        ? []
        : [{ text: 'Documentation', url: getVersionBaseUrl(defaultVersionId), active: 'nested-url' as const }]),
      {
        text: 'Community',
        url: communityRoute,
        active: 'nested-url',
      },
      {
        text: 'Discord',
        url: discordInviteUrl,
        external: true,
      },
    ],
  };
}
