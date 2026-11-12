import { RedirectPage } from '@/components/redirect-page';
import { communityRoute } from '@/lib/shared';

export const metadata = { title: 'Community', alternates: { canonical: communityRoute } };

/** `/showcase` was the previous address of the Community page. */
export default function Page() {
  return <RedirectPage href={communityRoute} />;
}
