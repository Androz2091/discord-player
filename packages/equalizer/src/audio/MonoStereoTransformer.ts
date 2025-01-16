import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';

/*
Mono: [0, 1, 2, 3, 4, 5]
Stereo: [0, 1, 0, 1, 2, 3, 2, 3, 4, 5, 4, 5]
*/

export type MSTStrategy = 'm2s' | 's2m';

export interface MonoStereoTransformerOptions extends PCMTransformerOptions {
  strategy: MSTStrategy;
}

export class MonoStereoTransformer extends PCMTransformer {
  public strategy: MSTStrategy;

  public constructor(options?: MonoStereoTransformerOptions) {
    super(options);
    if (!['m2s', 's2m'].includes(options?.strategy as MSTStrategy)) {
      throw new TypeError(`Strategy must be "m2s" or "s2m"`);
    }

    this.strategy = options!.strategy;
  }

  public setStrategy(strategy: MSTStrategy) {
    this.strategy = strategy;
  }

  public _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    if (this.disabled) {
      this.push(chunk);
      return callback();
    }

    const len = Math.floor(chunk.length / 2) * 2;

    if (this.strategy === 'm2s') {
      this.push(this.toStereo(chunk, len));
    } else {
      this.push(this.toMono(chunk, len));
    }

    return callback();
  }

  public toStereo(sample: Buffer, len: number) {
    const bytes = this.bytes;
    const stereoBuffer = Buffer.alloc(len * 2);

    for (let i = 0; i < len; i += bytes) {
      stereoBuffer[i * 2 + 0] = sample[i];
      stereoBuffer[i * 2 + 1] = sample[i + 1];
      stereoBuffer[i * 2 + 2] = sample[i];
      stereoBuffer[i * 2 + 3] = sample[i + 1];
    }

    return stereoBuffer;
  }

  public toMono(sample: Buffer, len: number) {
    const bytes = this.bytes;
    const monoBuffer = Buffer.alloc(Math.floor(len / 2));

    for (let i = 0; i < len; i += bytes) {
      monoBuffer[i] = sample[i * 2 + 0];
      monoBuffer[i + 1] = sample[i * 2 + 1];
    }

    return monoBuffer;
  }
}
