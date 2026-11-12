import { getLlms } from '@/lib/source';
import { defaultVersionId } from '@/lib/versions';

export const revalidate = false;

/** Index of the default version's documentation. Other versions are served from `/llms/<version>/llms.txt`. */
export async function GET() {
  return new Response(await getLlms(defaultVersionId).index());
}
