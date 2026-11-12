import type { Metadata } from 'next';
import { RedirectPage } from '@/components/redirect-page';
import { getDefaultDocsUrl } from '@/lib/legacy-routes';

export function generateMetadata(): Metadata {
  return { title: 'Documentation', alternates: { canonical: getDefaultDocsUrl() } };
}

export default function Page() {
  return <RedirectPage href={getDefaultDocsUrl()} />;
}
