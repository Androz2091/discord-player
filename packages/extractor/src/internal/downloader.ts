import http from 'http';
import https from 'https';
import { Readable } from 'stream';

export function downloadStream(url: string) {
    return new Promise<Readable>((resolve, reject) => {
        const lib = url.startsWith('http://') ? http : https;

        lib.get(url, (res) => resolve(res)).once('error', reject);
    });
}
