import fetch from 'node-fetch';
import { Readable } from 'stream';
import http from 'http';
import https from 'https';

class Vimeo {
    constructor() {
        throw new Error(`The ${this.constructor.name} class may not be instantiated!`);
    }

    /**
     * @typedef {Readable} Readable
     */

    /**
     * Downloads from vimeo
     * @param {number} id Vimeo video id
     * @returns {Promise<Readable>}
     */
    static download(id: number | string): Promise<Readable> {
        return new Promise(async (resolve) => {
            const info = await Vimeo.getInfo(id);
            if (!info) return null;

            const downloader = info.stream.url.startsWith('https://') ? https : http;

            downloader.get(info.stream.url, (res) => {
                resolve(res);
            });
        });
    }

    /**
     * Returns video info
     * @param {number} id Video id
     */
    static async getInfo(id: number | string): Promise<VimeoInfo | null> {
        if (!id) throw new Error('Invalid id');
        const url = `https://player.vimeo.com/video/${id}`;

        try {
            const res = await fetch(url);
            const data = await res.text();
            const json = JSON.parse(data.split('<script> (function(document, player) { var config = ')[1].split(';')[0]);

            const obj = {
                id: json.video.id,
                duration: json.video.duration,
                title: json.video.title,
                url: json.video.url,
                thumbnail: json.video.thumbs['1280'] || json.video.thumbs.base,
                width: json.video.width,
                height: json.video.height,
                stream: json.request.files.progressive[0],
                author: {
                    accountType: json.video.owner.account_type,
                    id: json.video.owner.id,
                    name: json.video.owner.name,
                    url: json.video.owner.url,
                    avatar: json.video.owner.img_2x || json.video.owner.img
                }
            };

            return obj;
        } catch {
            return null;
        }
    }
}

export interface VimeoInfo {
    id: number;
    duration: number;
    title: string;
    url: string;
    thumbnail: string;
    width: number;
    height: number;
    stream: {
        profile: number;
        width: number;
        mime: string;
        fps: number;
        url: string;
        cdn: string;
        quality: string;
        id: number;
        origin: string;
        height: number;
    };
    author: {
        accountType: string;
        id: number;
        name: string;
        url: string;
        avatar: string;
    };
}

export { Vimeo };
