import ytdl from 'youtube-dl-exec';

export interface Info {
    title: string;
    duration: number;
    thumbnail: string;
    views: number;
    author: string;
    description: string;
    url: string;
    source: string;
    engine: import('stream').Readable;
}

export class Downloader {
    constructor() {
        return Downloader;
    }

    /**
     * Downloads stream through youtube-dl
     * @param {string} url URL to download stream from
     */
    static download(url: string) {
        if (!url || typeof url !== 'string') throw new Error('Invalid url');

        const ytdlProcess = ytdl.exec(url, {
            output: '-',
            quiet: true,
            preferFreeFormats: true,
            limitRate: '100K'
        });

        if (!ytdlProcess.stdout) throw new Error('No stdout');
        const stream = ytdlProcess.stdout;

        stream.on('error', () => {
            if (!ytdlProcess.killed) ytdlProcess.kill();
            stream.resume();
        });

        return stream;
    }

    /**
     * Returns stream info
     * @param {string} url stream url
     */
    static getInfo(url: string) {
        // eslint-disable-next-line
        return new Promise<{ playlist: any; info: Info[] }>(async (resolve, reject) => {
            if (!url || typeof url !== 'string') reject(new Error('Invalid url'));

            const info = await ytdl(url, {
                dumpSingleJson: true,
                skipDownload: true,
                simulate: true
            }).catch(() => undefined);
            if (!info) return resolve({ playlist: null, info: [] });

            try {
                const data = {
                    title: info.fulltitle || info.title || 'Attachment',
                    duration: (info.duration || 0) * 1000,
                    thumbnail: info.thumbnails ? info.thumbnails[0].url : info.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png',
                    views: info.view_count || 0,
                    author: info.uploader || info.channel || 'YouTubeDL Media',
                    description: info.description || '',
                    url: url,
                    source: info.extractor,
                    get engine() {
                        return Downloader.download(url);
                    }
                } as Info;

                resolve({ playlist: null, info: [data] });
            } catch {
                resolve({ playlist: null, info: [] });
            }
        });
    }

    static validate(url: string) {
        const REGEX =
            /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/;
        return REGEX.test(url || '');
    }

    static get important() {
        return true;
    }
}
