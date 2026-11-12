import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RedirectPage } from '@/components/redirect-page';
import { getApiPaths, resolveApiPath } from '@/lib/legacy-routes';

export const dynamicParams = false;

/**
 * The API reference used to be served from `/api`. These URLs redirect to the API reference of the default version,
 * or to the version that owns the requested page when the default version does not have it.
 */
export default async function Page(props: PageProps<'/api/[[...slug]]'>) {
  const { slug = [] } = await props.params;
  const target = resolveApiPath(slug);

  if (!target) notFound();

  return <RedirectPage href={target} />;
}

export function generateStaticParams() {
  return getApiPaths().map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<'/api/[[...slug]]'>): Promise<Metadata> {
  const { slug = [] } = await props.params;
  const target = resolveApiPath(slug);

  return { title: 'API reference', alternates: target ? { canonical: target } : undefined };
}
