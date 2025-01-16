// based on https://github.com/amishshah/prism-media/blob/4ef1d6f9f53042c085c1f68627e889003e248d77/src/core/WebmBase.js

import { Transform, TransformCallback } from 'node:stream';

export class WebmBaseDemuxer extends Transform {
  public static readonly TAGS = {
    // value is true if the element has children
    '1a45dfa3': true, // EBML
    '18538067': true, // Segment
    '1f43b675': true, // Cluster
    '1654ae6b': true, // Tracks
    ae: true, // TrackEntry
    d7: false, // TrackNumber
    '83': false, // TrackType
    a3: false, // SimpleBlock
    '63a2': false,
  };

  public static readonly TOO_SHORT = Symbol('TOO_SHORT');

  private _remainder: Buffer | null = null;
  private _length = 0;
  private _count = 0;
  private _skipUntil: number | null = null;
  private _track: { number: number; type: number } | null = null;
  private _incompleteTrack: { number?: number; type?: number } = {};
  private _ebmlFound = false;

  /**
   * Creates a new Webm demuxer.
   * @param {Object} [options] options that you would pass to a regular Transform stream.
   */
  constructor(options = {}) {
    super(Object.assign({ readableObjectMode: true }, options));
    this._remainder = null;
    this._length = 0;
    this._count = 0;
    this._skipUntil = null;
    this._track = null;
    this._incompleteTrack = {};
    this._ebmlFound = false;
  }

  public _checkHead(data: Buffer) {
    void data;
  }

  _transform(chunk: Buffer, encoding: BufferEncoding, done: TransformCallback) {
    this._length += chunk.length;
    if (this._remainder) {
      chunk = Buffer.concat([this._remainder, chunk]);
      this._remainder = null;
    }
    let offset = 0;
    if (this._skipUntil && this._length > this._skipUntil) {
      offset = this._skipUntil - this._count;
      this._skipUntil = null;
    } else if (this._skipUntil) {
      this._count += chunk.length;
      done();
      return;
    }

    let result;
    // @ts-ignore
    while (result !== WebmBaseDemuxer.TOO_SHORT) {
      try {
        result = this._readTag(chunk, offset);
      } catch (error) {
        done(error as Error);
        return;
      }
      if (result === WebmBaseDemuxer.TOO_SHORT) break;
      if (result._skipUntil) {
        this._skipUntil = result._skipUntil;
        break;
      }
      if (result.offset) offset = result.offset;
      else break;
    }
    this._count += offset;
    this._remainder = chunk.subarray(offset);
    done();
    return;
  }

  /**
   * Reads an EBML ID from a buffer.
   * @private
   * @param {Buffer} chunk the buffer to read from.
   * @param {number} offset the offset in the buffer.
   * @returns {Object|Symbol} contains an `id` property (buffer) and the new `offset` (number).
   * Returns the TOO_SHORT symbol if the data wasn't big enough to facilitate the request.
   */
  _readEBMLId(chunk: Buffer, offset: number) {
    const idLength = vintLength(chunk, offset);
    if (idLength === WebmBaseDemuxer.TOO_SHORT)
      return WebmBaseDemuxer.TOO_SHORT;
    return {
      id: chunk.subarray(offset, offset + idLength),
      offset: offset + idLength,
    };
  }

  /**
   * Reads a size variable-integer to calculate the length of the data of a tag.
   * @private
   * @param {Buffer} chunk the buffer to read from.
   * @param {number} offset the offset in the buffer.
   * @returns {Object|Symbol} contains property `offset` (number), `dataLength` (number) and `sizeLength` (number).
   * Returns the TOO_SHORT symbol if the data wasn't big enough to facilitate the request.
   */
  _readTagDataSize(chunk: Buffer, offset: number) {
    const sizeLength = vintLength(chunk, offset);
    if (sizeLength === WebmBaseDemuxer.TOO_SHORT)
      return WebmBaseDemuxer.TOO_SHORT;
    const dataLength = expandVint(chunk, offset, offset + sizeLength);
    return { offset: offset + sizeLength, dataLength, sizeLength };
  }

  /**
   * Takes a buffer and attempts to read and process a tag.
   * @private
   * @param {Buffer} chunk the buffer to read from.
   * @param {number} offset the offset in the buffer.
   * @returns {Object|Symbol} contains the new `offset` (number) and optionally the `_skipUntil` property,
   * indicating that the stream should ignore any data until a certain length is reached.
   * Returns the TOO_SHORT symbol if the data wasn't big enough to facilitate the request.
   */
  _readTag(chunk: Buffer, offset: number) {
    const idData = this._readEBMLId(chunk, offset);
    if (idData === WebmBaseDemuxer.TOO_SHORT) return WebmBaseDemuxer.TOO_SHORT;
    const ebmlID = idData.id.toString('hex');
    if (!this._ebmlFound) {
      if (ebmlID === '1a45dfa3') this._ebmlFound = true;
      else throw Error('Did not find the EBML tag at the start of the stream');
    }
    offset = idData.offset;
    const sizeData = this._readTagDataSize(chunk, offset);
    if (sizeData === WebmBaseDemuxer.TOO_SHORT)
      return WebmBaseDemuxer.TOO_SHORT;
    const { dataLength } = sizeData;
    offset = sizeData.offset;
    // If this tag isn't useful, tell the stream to stop processing data until the tag ends
    if (
      typeof WebmBaseDemuxer.TAGS[
        ebmlID as keyof (typeof WebmBaseDemuxer)['TAGS']
      ] === 'undefined'
    ) {
      if (chunk.length > offset + (dataLength as number)) {
        return { offset: offset + (dataLength as number) };
      }
      return {
        offset,
        _skipUntil: this._count + (offset as number) + (dataLength as number),
      };
    }

    const tagHasChildren =
      WebmBaseDemuxer.TAGS[ebmlID as keyof (typeof WebmBaseDemuxer)['TAGS']];
    if (tagHasChildren) {
      return { offset };
    }

    if ((offset as number) + (dataLength as number) > chunk.length)
      return WebmBaseDemuxer.TOO_SHORT;
    const data = chunk.subarray(
      offset,
      (offset as number) + (dataLength as number),
    );
    if (!this._track) {
      if (ebmlID === 'ae') this._incompleteTrack = {};
      if (ebmlID === 'd7') this._incompleteTrack.number = data[0];
      if (ebmlID === '83') this._incompleteTrack.type = data[0];
      if (
        this._incompleteTrack.type === 2 &&
        typeof this._incompleteTrack.number !== 'undefined'
      ) {
        // @ts-ignore
        this._track = this._incompleteTrack;
      }
    }
    if (ebmlID === '63a2') {
      this._checkHead(data);
      this.emit('head', data);
    } else if (ebmlID === 'a3') {
      if (!this._track) throw Error('No audio track in this webm!');
      if ((data[0] & 0xf) === this._track.number) {
        this.push(data.subarray(4));
      }
    }
    return { offset: (offset as number) + (dataLength as number) };
  }

  _destroy(err: Error, cb: (error: Error | null) => void) {
    this._cleanup();
    return cb ? cb(err) : undefined;
  }

  _final(cb: TransformCallback) {
    this._cleanup();
    cb();
  }

  /**
   * Cleans up the demuxer when it is no longer required.
   * @private
   */
  _cleanup() {
    this._remainder = null;
    this._incompleteTrack = {};
  }
}

function vintLength(buffer: Buffer, index: number) {
  if (index < 0 || index > buffer.length - 1) {
    return WebmBaseDemuxer.TOO_SHORT;
  }
  let i = 0;
  for (; i < 8; i++) if ((1 << (7 - i)) & buffer[index]) break;
  i++;
  if (index + i > buffer.length) {
    return WebmBaseDemuxer.TOO_SHORT;
  }
  return i;
}

function expandVint(buffer: Buffer, start: number, end: number) {
  const length = vintLength(buffer, start);
  if (end > buffer.length || length === WebmBaseDemuxer.TOO_SHORT)
    return WebmBaseDemuxer.TOO_SHORT;
  // @ts-ignore
  const mask = (1 << (8 - length)) - 1;
  let value = buffer[start] & mask;
  for (let i = start + 1; i < end; i++) {
    value = (value << 8) + buffer[i];
  }
  return value;
}
