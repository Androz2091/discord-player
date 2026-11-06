import { Readable } from 'node:stream';
import type { RequestOptions } from 'node:http';
/** Offline replacement for the official downloader dependency. */
export async function downloadStream(query: string, options?: RequestOptions) {
  void options;
  return Object.assign(Readable.from([]), { headers: { 'content-type': 'audio/mpeg' }, url: query });
}
/** Offline MIME probe; the real dependency is outside the compatibility contract. */
export const fileType = {
  async fromFile(file: string) {
    return { mime: file.endsWith('.pcm') ? 'raw/pcm' : 'audio/mpeg' };
  },
};
