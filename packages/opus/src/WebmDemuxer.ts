// based on https://github.com/amishshah/prism-media/blob/4ef1d6f9f53042c085c1f68627e889003e248d77/src/opus/WebmDemuxer.js

import { WebmBaseDemuxer } from './WebmBase';

const OPUS_HEAD = Buffer.from([...'OpusHead'].map((x) => x.charCodeAt(0)));

/**
 * Demuxes a Webm stream (containing Opus audio) to output an Opus stream.
 * @example
 * const fs = require('fs');
 * const file = fs.createReadStream('./audio.webm');
 * const demuxer = new WebmDemuxer();
 * const opus = file.pipe(demuxer);
 * // opus is now a ReadableStream in object mode outputting Opus packets
 */
export class WebmDemuxer extends WebmBaseDemuxer {
  _checkHead(data: Buffer) {
    if (!data.subarray(0, 8).equals(OPUS_HEAD)) {
      throw Error('Audio codec is not Opus!');
    }
  }
}
