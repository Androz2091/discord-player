import { notFound } from 'next/navigation';
import { createSocialImage } from '@/lib/og';
import { getPage, getSource } from '@/lib/source';
import { getPageImageUrl } from '@/lib/shared';
import { getDocsVersion, getDocsVersions, isDocsVersionId } from '@/lib/versions';

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[version]/[...slug]'>) {
  const { version, slug } = await params;

  if (!isDocsVersionId(version)) notFound();

  const page = getPage(version, slug.slice(0, -1));

  if (!page) notFound();

  return createSocialImage({
    title: page.data.title,
    description: page.data.description,
    version: getDocsVersion(version),
  });
}

export function generateStaticParams() {
  return getDocsVersions().flatMap((version) =>
    getSource(version.id)
      .getPages()
      .map((page) => {
        const [, ...slug] = getPageImageUrl({ version: version.id, slugs: page.slugs }).segments;

        return { version: version.id, slug };
      }),
  );
}
