import type { MetadataRoute } from 'next';
import { getSource } from '@/lib/source';
import { communityRoute, siteUrl } from '@/lib/shared';
import { getDocsVersions } from '@/lib/versions';

export const dynamic = 'force-static';

/** Lists the home page, Community, and every page of every documentation version by its canonical URL. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = getDocsVersions().flatMap((version) =>
    getSource(version.id)
      .getPages()
      .map((page) => page.url),
  );

  return ['/', communityRoute, ...pages].map((path) => ({ url: new URL(path, siteUrl).toString() }));
}
