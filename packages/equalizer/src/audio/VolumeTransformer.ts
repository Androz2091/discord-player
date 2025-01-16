import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';

export interface VolumeTransformerOptions extends PCMTransformerOptions {
  volume?: number;
}

export class VolumeTransformer extends PCMTransformer {
  private _volume = 1;
  public constructor(options?: VolumeTransformerOptions) {
    super(options);

    if (typeof options?.volume === 'number') {
      this.setVolume(options.volume);
    }
  }

  public get volumeApprox() {
    return this._volume * 100;
  }

  public get volume() {
    return Math.floor(this.volumeApprox);
  }

  public set volume(volume: number) {
    this.setVolume(volume);
  }

  public setVolume(volume: number) {
    if (typeof volume !== 'number' || isNaN(volume))
      throw new Error(
        `Expected volume amount to be a number, received ${typeof volume}!`,
      );
    if (volume < 0) volume = 0;
    if (!isFinite(volume)) volume = 100;

    this._volume = volume / 100;

    this.onUpdate?.();

    return true;
  }

  public _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    if (this.disabled || this._volume === 1) {
      this.push(chunk);
      return callback();
    }

    const len = Math.floor(chunk.length / 2) * 2;
    const { bytes } = this;

    for (let i = 0; i < len; i += bytes) {
      const int = this._readInt(chunk, i);
      const amp = this.clamp(int * this._volume);
      this._writeInt(chunk, amp, i);
    }

    this.push(chunk);

    return callback();
  }

  public toString() {
    return `${this.volume}%`;
  }
}
