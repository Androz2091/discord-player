// based on https://github.com/amishshah/prism-media/blob/4ef1d6f9f53042c085c1f68627e889003e248d77/src/opus/Opus.js

import { Transform, type TransformCallback } from 'node:stream';

export type IEncoder = {
  new (rate: number, channels: number, application: number): {
    encode(buffer: Buffer): Buffer;
    encode(buffer: Buffer, frameSize: number): Buffer;
    encode(buffer: Buffer, frameSize?: number): Buffer;
    decode(buffer: Buffer): Buffer;
    decode(buffer: Buffer, frameSize: number): Buffer;
    decode(buffer: Buffer, frameSize?: number): Buffer;
    applyEncoderCTL?(ctl: number, value: number): void;
    encoderCTL?(ctl: number, value: number): void;
    delete?(): void;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Application?: any;
};

type IMod = [
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mod: any) => {
    Encoder: IEncoder;
  },
];

const loadModule = (
  modules: IMod[],
): {
  Encoder: IEncoder;
  name: string;
} => {
  const errors: string[] = [];

  for (const [name, fn] of modules) {
    try {
      return {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ...fn(require(name)),
        name,
      };
    } catch (e) {
      errors.push(`Failed to load ${name}: ${e}`);
      continue;
    }
  }

  throw new Error(
    `Could not load opus module, tried ${
      modules.length
    } different modules. Errors: ${errors.join('\n')}`,
  );
};

export const CTL = {
  BITRATE: 0xfa2,
  FEC: 0xfac,
  PLP: 0xfae,
} as const;

const OPUS_MOD_REGISTRY: IMod[] = [
  [
    'mediaplex',
    (mod) => {
      if (!mod.OpusEncoder) throw new Error('Unsupported mediaplex version');
      return { Encoder: mod.OpusEncoder };
    },
  ],
  ['@discordjs/opus', (opus) => ({ Encoder: opus.OpusEncoder })],
  ['opusscript', (opus) => ({ Encoder: opus })],
  [
    '@evan/opus',
    (opus) => {
      const { Encoder, Decoder } = opus as typeof import('@evan/opus');

      class OpusEncoder {
        private _encoder!: InstanceType<typeof Encoder> | null;
        private _decoder!: InstanceType<typeof Decoder> | null;

        public constructor(
          private _rate: number,
          private _channels: number,
          private _application: number,
        ) {}

        private _ensureEncoder() {
          if (this._encoder) return;
          this._encoder = new Encoder({
            channels: this._channels as 2,
            sample_rate: this._rate as 48000,
            application: (<const>{
              2048: 'voip',
              2049: 'audio',
              2051: 'restricted_lowdelay',
            })[this._application],
          });
        }

        private _ensureDecoder() {
          if (this._decoder) return;
          this._decoder = new Decoder({
            channels: this._channels as 2,
            sample_rate: this._rate as 48000,
          });
        }

        public encode(buffer: Buffer) {
          this._ensureEncoder();
          return Buffer.from(this._encoder!.encode(buffer));
        }

        public decode(buffer: Buffer) {
          this._ensureDecoder();
          return Buffer.from(this._decoder!.decode(buffer));
        }

        public applyEncoderCTL(ctl: number, value: number) {
          this._ensureEncoder();
          this._encoder!.ctl(ctl, value);
        }

        public delete() {
          this._encoder = null;
          this._decoder = null;
        }
      }

      return { Encoder: OpusEncoder };
    },
  ],
  ['node-opus', (opus) => ({ Encoder: opus.OpusEncoder })],
];

let Opus: { Encoder?: IEncoder; name?: string } = {};

/**
 * Add a new Opus provider to the registry. This will be tried to load in order at runtime.
 * @param provider - The provider to add
 */
export const addLibopusProvider = (provider: IMod) => {
  if (OPUS_MOD_REGISTRY.some(([, fn]) => fn === provider[1])) return;
  OPUS_MOD_REGISTRY.push(provider);
};

/**
 * Remove an Opus provider from the registry.
 * @param name - The name of the provider to remove
 */
export const removeLibopusProvider = (name: string) => {
  const index = OPUS_MOD_REGISTRY.findIndex((o) => o[0] === name);
  if (index === -1) return false;
  OPUS_MOD_REGISTRY.splice(index, 1);
  return true;
};

/**
 * Set the Opus provider to use. This will override the automatic provider selection.
 * @param provider - The provider to use
 */
export const setLibopusProvider = (provider: IEncoder, name: string) => {
  Opus = { Encoder: provider, name };
};

function loadOpus(refresh = false) {
  if (Opus.Encoder && !refresh) return Opus;

  Opus = loadModule(OPUS_MOD_REGISTRY);
  return Opus;
}

const charCode = (x: string) => x.charCodeAt(0);
const OPUS_HEAD = Buffer.from([...'OpusHead'].map(charCode));
const OPUS_TAGS = Buffer.from([...'OpusTags'].map(charCode));

export interface IOpusStreamInit {
  frameSize: number;
  channels: number;
  rate: number;
  application?: number;
}

// frame size = (channels * rate * frame_duration) / 1000

/**
 * Takes a stream of Opus data and outputs a stream of PCM data, or the inverse.
 * **You shouldn't directly instantiate this class, see opus.Encoder and opus.Decoder instead!**
 * @memberof opus
 * @extends TransformStream
 * @protected
 */
export class OpusStream extends Transform {
  public encoder: InstanceType<IEncoder> | null = null;
  public _options: IOpusStreamInit;
  public _required: number;
  /**
   * Creates a new Opus transformer.
   * @private
   * @memberof opus
   * @param {Object} [options] options that you would pass to a regular Transform stream
   */
  constructor(options = {} as IOpusStreamInit) {
    if (!loadOpus().Encoder) {
      throw Error(
        `Could not find an Opus module! Please install one of ${OPUS_MOD_REGISTRY.map(
          (o) => o[0],
        ).join(', ')}.`,
      );
    }
    super(Object.assign({ readableObjectMode: true }, options));

    const lib = Opus as Required<typeof Opus>;

    if (lib.name === 'opusscript') {
      options.application = lib.Encoder.Application![options.application!];
    }

    this.encoder = new lib.Encoder(
      options.rate,
      options.channels,
      options.application!,
    );

    this._options = options;
    this._required = this._options.frameSize * this._options.channels * 2;
  }

  _encode(buffer: Buffer) {
    if (Opus.name === 'opusscript') {
      return this.encoder!.encode(buffer, this._options.frameSize);
    } else {
      return this.encoder!.encode(buffer);
    }
  }

  _decode(buffer: Buffer) {
    if (Opus.name === 'opusscript') {
      return this.encoder!.decode(buffer, this._options.frameSize);
    } else {
      return this.encoder!.decode(buffer);
    }
  }

  /**
   * Returns the Opus module being used - `mediaplex`, `opusscript`, `node-opus`, or `@discordjs/opus`.
   * @type {string}
   * @readonly
   * @example
   * console.log(`Using Opus module ${OpusEncoder.type}`);
   */
  static get type() {
    return Opus.name;
  }

  /**
   * Sets the bitrate of the stream.
   * @param {number} bitrate the bitrate to use use, e.g. 48000
   * @public
   */
  setBitrate(bitrate: number) {
    (this.encoder!.applyEncoderCTL! || this.encoder!.encoderCTL).apply(
      this.encoder!,
      [CTL.BITRATE, Math.min(128e3, Math.max(16e3, bitrate))],
    );
  }

  /**
   * Enables or disables forward error correction.
   * @param {boolean} enabled whether or not to enable FEC.
   * @public
   */
  setFEC(enabled: boolean) {
    (this.encoder!.applyEncoderCTL! || this.encoder!.encoderCTL).apply(
      this.encoder!,
      [CTL.FEC, enabled ? 1 : 0],
    );
  }

  /**
   * Sets the expected packet loss over network transmission.
   * @param {number} [percentage] a percentage (represented between 0 and 1)
   */
  setPLP(percentage: number) {
    (this.encoder!.applyEncoderCTL! || this.encoder!.encoderCTL).apply(
      this.encoder!,
      [CTL.PLP, Math.min(100, Math.max(0, percentage * 100))],
    );
  }

  _final(cb: () => void) {
    this._cleanup();
    cb();
  }

  _destroy(err: Error | null, cb: (err: Error | null) => void) {
    this._cleanup();
    return cb ? cb(err) : undefined;
  }

  /**
   * Cleans up the Opus stream when it is no longer needed
   * @private
   */
  _cleanup() {
    if (typeof this.encoder?.delete === 'function') this.encoder!.delete!();
    this.encoder = null;
  }
}

/**
 * An Opus encoder stream.
 *
 * Outputs opus packets in [object mode.](https://nodejs.org/api/stream.html#stream_object_mode)
 * @extends opus.OpusStream
 * @memberof opus
 * @example
 * const encoder = new prism.opus.Encoder({ frameSize: 960, channels: 2, rate: 48000 });
 * pcmAudio.pipe(encoder);
 * // encoder will now output Opus-encoded audio packets
 */
export class OpusEncoder extends OpusStream {
  _buffer: Buffer = Buffer.allocUnsafe(0);

  /**
   * Creates a new Opus encoder stream.
   * @memberof opus
   * @param {Object} options options that you would pass to a regular OpusStream, plus a few more:
   * @param {number} options.frameSize the frame size in bytes to use (e.g. 960 for stereo audio at 48KHz with a frame
   * duration of 20ms)
   * @param {number} options.channels the number of channels to use
   * @param {number} options.rate the sampling rate in Hz
   */
  constructor(options = {} as IOpusStreamInit) {
    super(options);
  }

  public _transform(
    newChunk: Buffer,
    encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    const chunk = Buffer.concat([this._buffer, newChunk]);

    let i = 0;
    while (chunk.length >= i + this._required) {
      const pcm = chunk.slice(i, i + this._required);
      let opus: Buffer | undefined;
      try {
        opus = this.encoder!.encode(pcm);
      } catch (error) {
        done(error as Error);
        return;
      }
      this.push(opus);
      i += this._required;
    }

    if (i > 0) this._buffer = chunk.slice(i);
    done();
  }

  _destroy(err: Error, cb: (err: Error | null) => void) {
    super._destroy(err, cb);
    this._buffer = Buffer.allocUnsafe(0);
  }
}

/**
 * An Opus decoder stream.
 *
 * Note that any stream you pipe into this must be in
 * [object mode](https://nodejs.org/api/stream.html#stream_object_mode) and should output Opus packets.
 * @extends opus.OpusStream
 * @memberof opus
 * @example
 * const decoder = new OpusDecoder({ frameSize: 960, channels: 2, rate: 48000 });
 * input.pipe(decoder);
 * // decoder will now output PCM audio
 */
export class OpusDecoder extends OpusStream {
  _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    done: (e?: Error | null, chunk?: Buffer) => void,
  ) {
    const signature = chunk.slice(0, 8);
    if (chunk.length >= 8 && signature.equals(OPUS_HEAD)) {
      this.emit('format', {
        channels: this._options.channels,
        sampleRate: this._options.rate,
        bitDepth: 16,
        float: false,
        signed: true,
        version: chunk.readUInt8(8),
        preSkip: chunk.readUInt16LE(10),
        gain: chunk.readUInt16LE(16),
      });
      return done();
    }
    if (chunk.length >= 8 && signature.equals(OPUS_TAGS)) {
      this.emit('tags', chunk);
      return done();
    }
    try {
      this.push(this._decode(chunk));
    } catch (e) {
      return done(e as Error);
    }
    return done();
  }
}
