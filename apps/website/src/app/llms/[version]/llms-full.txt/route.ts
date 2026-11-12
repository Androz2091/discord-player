import { notFound } from 'next/navigation';
import { getLlms } from '@/lib/source';
import { getDocsVersions, isDocsVersionId } from '@/lib/versions';

export const revalidate = false;
export const dynamicParams = false;

export async function GET(_req: Request, { params }: RouteContext<'/llms/[version]/llms-full.txt'>) {
  const { version } = await params;

  if (!isDocsVersionId(version)) notFound();

  return new Response(await getLlms(version).full());
}

export function generateStaticParams() {
  return getDocsVersions().map((version) => ({ version: version.id }));
}
