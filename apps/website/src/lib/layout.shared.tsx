import { Heart } from 'lucide-react';
import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared';
import { BrandTitle } from '@/components/logo';
import { SponsorMenu } from '@/components/sponsor-menu';
import { VersionSelector } from '@/components/version-selector';
import { getFundingLinks } from './funding';
import { communityRoute, discordInviteUrl, gitConfig } from './shared';
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
 * Sponsor entry for the navigation. It links directly when there is one funding page and opens a menu otherwise.
 * The heart icon is only shown in the documentation sidebar.
 */
function getSponsorLink(showIcon: boolean): LinkItemType | null {
  const funding = getFundingLinks();
  const [only] = funding;

  if (!only) return null;

  if (funding.length === 1) {
    return {
      text: 'Sponsor',
      url: only.url,
      external: true,
      icon: showIcon ? <Heart className="size-4" aria-hidden="true" /> : undefined,
    };
  }

  return { type: 'custom', children: <SponsorMenu links={funding} icon={showIcon} /> };
}

/**
 * Options shared by every layout. The version selector is only added for documentation pages.
 *
 * @param version Documentation version being displayed. Omit it outside the documentation.
 */
export function baseOptions(version?: DocsVersionId): BaseLayoutProps {
  const sponsor = getSponsorLink(Boolean(version));

  return {
    nav: {
      title: <BrandTitle compact={Boolean(version)} />,
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
      ...(sponsor ? [sponsor] : []),
    ],
  };
}
