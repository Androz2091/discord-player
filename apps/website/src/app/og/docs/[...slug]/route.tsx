import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { createSocialImage } from '@/lib/og';
import { getPageImageUrl } from '@/lib/shared';

export const dynamic = 'force-static';

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));

  if (!page) notFound();

  return createSocialImage({
    title: page.data.title,
    description: page.data.description,
    section: 'V8 DOCUMENTATION',
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImageUrl(page).segments,
  }));
}
