import { getLlms } from '@/lib/source';
import { defaultVersionId } from '@/lib/versions';

export const revalidate = false;

/** Full text of the default version's documentation. Other versions are served from `/llms/<version>/llms-full.txt`. */
export async function GET() {
  return new Response(await getLlms(defaultVersionId).full());
}
