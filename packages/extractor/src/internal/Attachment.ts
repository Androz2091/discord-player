import http from 'http';
import https from 'https';

export function Attachment(url: string) {
    const _get = url.startsWith('http://') ? http : https;

    return new Promise<AttachmentRaw>((resolve, reject) => {
        _get.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Status code: ${res.statusCode}`));

            const obj = {
                stream: res,
                url: url,
                format: res.headers['content-type']
            } as AttachmentRaw;

            resolve(obj);
        });
    });
}

export interface AttachmentRaw {
    stream: http.IncomingMessage;
    url: string;
    format: string;
}
