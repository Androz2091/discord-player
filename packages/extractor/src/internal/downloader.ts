import http, { RequestOptions } from 'http';
import https from 'https';
import { Readable } from 'stream';

export function downloadStream(url: string, opts: RequestOptions = {}) {
  return new Promise<Readable>((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;

    lib.get(url, opts, (res) => resolve(res)).once('error', reject);
  });
}
