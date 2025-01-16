import { Readable } from 'stream';
import http from 'http';
import https from 'https';
import { fetch } from './helper';

class Vimeo {
  constructor() {
    throw new Error(
      `The ${this.constructor.name} class may not be instantiated!`,
    );
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

      const downloader = info.stream.startsWith('https://') ? https : http;

      downloader.get(info.stream, (res) => {
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
      const json = JSON.parse(
        data.split('window.playerConfig =')[1].split(';')[0].trim(),
      );

      const obj = {
        id: json.video.id,
        duration: json.video.duration * 1000,
        title: json.video.title,
        url: json.video.url,
        thumbnail: json.video.thumbs['1280'] || json.video.thumbs.base,
        stream: json.request.files.progressive[0].url,
        author: {
          id: json.video.owner.id,
          name: json.video.owner.name,
          url: json.video.owner.url,
          avatar: json.video.owner.img_2x || json.video.owner.img,
        },
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
  stream: string;
  author: {
    id: number;
    name: string;
    url: string;
    avatar: string;
  };
}

export { Vimeo };
