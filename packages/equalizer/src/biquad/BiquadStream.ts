import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';
import { BiquadFilter } from './Biquad';
import {
  BiquadFilters,
  Coefficients,
  FilterType,
  Q_BUTTERWORTH,
} from './Coefficients';

export interface BiquadStreamOptions extends PCMTransformerOptions {
  filter?: BiquadFilters;
  Q?: number;
  cutoff?: number;
  gain?: number;
}

export interface BiquadFilterUpdateData {
  filter?: BiquadFilters;
  Q?: number;
  cutoff?: number;
  gain?: number;
}

export class BiquadStream extends PCMTransformer {
  public biquad!: BiquadFilter;
  public cutoff = 80;
  public gain = 0;
  public biquadFilter!: BiquadFilters;
  public Q = Q_BUTTERWORTH;
  public constructor(options: BiquadStreamOptions = {}) {
    super(options);

    if ('cutoff' in options) this.cutoff = options.cutoff!;
    if ('gain' in options) this.gain = options.gain!;
    if ('Q' in options) this.Q = options.Q!;
    if ('biquadFilter' in options) {
      if (
        typeof options.biquadFilter === 'string' ||
        typeof options.biquadFilter === 'number'
      )
        this.biquadFilter = options.filter!;
      if (this.biquadFilter != null) {
        this.biquad = new BiquadFilter(
          Coefficients.from(
            this.biquadFilter,
            this.sampleRate,
            this.cutoff,
            this.Q,
            this.gain,
          ),
        );
      }
    }
  }

  public get filters() {
    return this.biquadFilter;
  }

  public set filters(f: BiquadFilters) {
    if (f == null || typeof f === 'string' || typeof f === 'number') {
      this.update({ filter: f });
    } else {
      throw new TypeError(`Invalid biquad filter type "${f}"`);
    }
  }

  public getFilterName() {
    if (this.biquadFilter == null) return null;
    if (typeof this.biquadFilter === 'string') return this.biquadFilter;
    return Object.entries(FilterType).find(
      (r) => r[1] === this.biquadFilter,
    )?.[0] as BiquadFilters;
  }

  public update(options: BiquadFilterUpdateData) {
    if ('cutoff' in options) this.cutoff = options.cutoff!;
    if ('gain' in options) this.gain = options.gain!;
    if ('Q' in options) this.Q = options.Q!;
    if ('filter' in options) this.biquadFilter = options.filter!;

    if (this.biquadFilter != null) {
      this.biquad = new BiquadFilter(
        Coefficients.from(
          this.biquadFilter,
          this.sampleRate,
          this.cutoff,
          this.Q,
          this.gain,
        ),
      );
    }

    this.onUpdate?.();
  }

  public setFilter(filter: BiquadFilters) {
    this.update({ filter });
  }

  public setQ(Q: number) {
    this.update({ Q });
  }

  public setCutoff(f0: number) {
    this.update({ cutoff: f0 });
  }

  public setGain(dB: number) {
    this.update({ gain: dB });
  }

  public _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    if (this.disabled || !this.biquad) {
      this.push(chunk);
      return callback();
    }

    const endIndex = Math.floor(chunk.length / 2) * 2;
    const { bytes } = this;

    for (let sampleIndex = 0; sampleIndex < endIndex; sampleIndex += bytes) {
      const int = this._readInt(chunk, sampleIndex);
      const result = this.biquad.run(int);
      this._writeInt(chunk, this.clamp(result), sampleIndex);
    }

    this.push(chunk);
    return callback();
  }
}
