import { notFound } from 'next/navigation';
import { getLlms, getPage, getSource } from '@/lib/source';
import { getPageMarkdownUrl } from '@/lib/shared';
import { getDocsVersions, isDocsVersionId } from '@/lib/versions';

export const revalidate = false;
export const dynamicParams = false;

export async function GET(_req: Request, { params }: RouteContext<'/llms.mdx/docs/[version]/[[...slug]]'>) {
  const { version, slug = [] } = await params;

  if (!isDocsVersionId(version)) notFound();

  // remove the appended "content.md"
  const page = getPage(version, slug.slice(0, -1));

  if (!page) notFound();

  return new Response(await getLlms(version).page(page), {
    headers: {
      'Content-Type': 'text/markdown',
    },
  });
}

export function generateStaticParams() {
  return getDocsVersions().flatMap((version) =>
    getSource(version.id)
      .getPages()
      .map((page) => {
        const [, ...slug] = getPageMarkdownUrl({ version: version.id, slugs: page.slugs }).segments;

        return { version: version.id, slug };
      }),
  );
}
