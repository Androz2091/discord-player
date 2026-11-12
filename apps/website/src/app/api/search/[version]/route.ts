import { notFound } from 'next/navigation';
import { createFromSource } from 'fumadocs-core/search/server';
import { getSource } from '@/lib/source';
import { getDocsVersions, isDocsVersionId } from '@/lib/versions';

export const revalidate = false;
export const dynamicParams = false;

/**
 * Serves one static search index per documentation version, so search never returns pages from another version.
 */
export async function GET(_request: Request, { params }: RouteContext<'/api/search/[version]'>) {
  const { version } = await params;

  if (!isDocsVersionId(version)) notFound();

  return createFromSource(getSource(version), { language: 'english' }).staticGET();
}

export function generateStaticParams() {
  return getDocsVersions().map((version) => ({ version: version.id }));
}
