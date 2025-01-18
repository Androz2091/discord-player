import { TransformCallback } from 'stream';
import { PCMTransformer, PCMTransformerOptions } from '../utils';
import {
  AFPulsatorConfig,
  AFTremoloConfig,
  AFVibratoConfig,
  LR,
  applyPulsator,
  applyTremolo,
  applyVibrato,
} from './transformers';
import { EqualizerBand } from '../equalizer';

export const AudioFilters = {
  '8D': '8D',
  Tremolo: 'Tremolo',
  Vibrato: 'Vibrato',
} as const;

export type PCMFilters = keyof typeof AudioFilters;

export interface PCMFiltererOptions extends PCMTransformerOptions {
  filters?: PCMFilters[];
}

export const AF_NIGHTCORE_RATE = 1.3 as const;
export const AF_VAPORWAVE_RATE = 0.8 as const;

export const BASS_EQ_BANDS: EqualizerBand[] = Array.from(
  { length: 3 },
  (_, i) => ({
    band: i,
    gain: 0.25,
  }),
);

// based on lavadsp
export class AudioFilter extends PCMTransformer {
  public filters: PCMFilters[] = [];
  public targetSampleRate = this.sampleRate;

  public pulsatorConfig: AFPulsatorConfig = {
    hz: 0.02,
    x: 0,
    dI: 0.000003926990816987241,
  };

  public tremoloConfig: AFTremoloConfig = {
    phase: 0,
    depth: 0.5,
    frequency: 5.0,
  };

  public vibratoConfig: AFVibratoConfig = {
    phase: 0,
    depth: 0.5,
    frequency: 5.0,
  };

  public constructor(options?: PCMFiltererOptions) {
    super(options);

    if (options && Array.isArray(options.filters)) {
      this.setFilters(options.filters);
    }

    this.onUpdate?.();
  }

  public setTargetSampleRate(rate: number) {
    this.targetSampleRate = rate || this.sampleRate;
    return;
  }

  public setPulsator(hz: number) {
    hz /= 4; // match ffmpeg
    this.pulsatorConfig.hz = hz;
    const samplesPerCycle = this.targetSampleRate / (hz * 2 * Math.PI);
    this.pulsatorConfig.dI = hz === 0 ? 0 : 1 / samplesPerCycle;

    this.onUpdate?.();
  }

  public get pulsator() {
    return this.pulsatorConfig.hz;
  }

  public setTremolo({
    depth = this.tremoloConfig.depth,
    frequency = this.tremoloConfig.frequency,
    phase = this.tremoloConfig.phase,
  }: Partial<AFTremoloConfig>) {
    if (typeof depth === 'number') this.tremoloConfig.depth = depth;
    if (typeof frequency === 'number') this.tremoloConfig.frequency = frequency;
    if (typeof phase === 'number') this.tremoloConfig.phase = phase;

    this.onUpdate?.();
  }

  public setVibrato({
    depth = this.vibratoConfig.depth,
    frequency = this.vibratoConfig.frequency,
    phase = this.vibratoConfig.phase,
  }: Partial<AFVibratoConfig>) {
    if (typeof depth === 'number') this.vibratoConfig.depth = depth;
    if (typeof frequency === 'number') this.vibratoConfig.frequency = frequency;
    if (typeof phase === 'number') this.vibratoConfig.phase = phase;

    this.onUpdate?.();
  }

  public get tremolo() {
    return this.tremoloConfig;
  }

  public setFilters(filters: PCMFilters[]) {
    if (!Array.isArray(filters) || !filters.every((r) => r in AudioFilters)) {
      return false;
    }

    this.filters = filters;

    this.onUpdate?.();

    return true;
  }

  public _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    if (this.disabled || !this.filters.length) {
      return callback(null, chunk);
    }

    const len = Math.floor(chunk.length / 2) * 2;
    const { bytes } = this;

    // left-right channel
    let L = false;

    for (let i = 0; i < len; i += bytes) {
      const int = this._readInt(chunk, i);
      const value = this.applyFilters(int, +(L = !L) as LR);
      this._writeInt(chunk, this.clamp(value), i);
    }

    this.push(chunk);

    return callback();
  }

  public get currentSampleRate() {
    return this.targetSampleRate || this.sampleRate;
  }

  public applyFilters(byte: number, channel: LR) {
    if (this.filters.length) {
      for (const filter of this.filters) {
        if (filter === '8D') {
          byte = applyPulsator(this.pulsatorConfig, byte, channel);
        }

        if (filter === 'Tremolo') {
          byte = applyTremolo(this.tremoloConfig, byte, this.currentSampleRate);
        }

        if (filter === 'Vibrato') {
          byte = applyVibrato(this.vibratoConfig, byte, this.currentSampleRate);
        }
      }
    }

    return byte;
  }
}
