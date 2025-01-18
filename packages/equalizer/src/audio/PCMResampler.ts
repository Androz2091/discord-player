import { PCMTransformer, PCMTransformerOptions } from '../utils';

export interface PCMResamplerOptions extends PCMTransformerOptions {
  inputSampleRate: number;
  targetSampleRate: number;
  channels?: number;
}

export interface ResampleParameters {
  currentFilter: CommonResamplerFilterPreset | null;
  inputSampleRate: number;
  channels: number;
  sampleRate: number;
}

export type CommonResamplerFilterPreset = 'nightcore' | 'vaporwave';

export class PCMResampler extends PCMTransformer {
  private readonly inputSampleRate: number;
  private readonly channels: number;
  private buffer: Buffer;
  public currentFilter: CommonResamplerFilterPreset | null = null;

  public constructor(options?: PCMResamplerOptions) {
    super(options);

    this.inputSampleRate = options?.inputSampleRate ?? 48000;
    this.channels = options?.channels ?? 2;
    this.buffer = Buffer.alloc(0);

    if (this.inputSampleRate < 1) {
      this.inputSampleRate = 48000;
    }

    if (options?.targetSampleRate) {
      this.setSampleRate(options?.targetSampleRate);
    }
  }

  public setFilter(filter: CommonResamplerFilterPreset | null) {
    if (this.currentFilter === filter) return;

    switch (filter) {
      case 'nightcore':
        this.setSampleRate(this.inputSampleRate * 1.25);
        break;
      case 'vaporwave':
        this.setSampleRate(this.inputSampleRate * 0.8);
        break;
      default:
        this.setSampleRate(this.inputSampleRate);
        break;
    }

    this.currentFilter = filter;
  }

  public getParameters(): ResampleParameters {
    return {
      currentFilter: this.currentFilter,
      inputSampleRate: this.inputSampleRate,
      channels: this.channels,
      sampleRate: this.sampleRate,
    };
  }

  public toggleFilter(filter: CommonResamplerFilterPreset): boolean {
    const same = this.currentFilter === filter;
    this.setFilter(same ? null : filter);

    return !same;
  }

  public getRatio(): number {
    if (this.inputSampleRate === 0) return 1;

    return this.sampleRate / this.inputSampleRate;
  }

  private resample(input: Buffer): Buffer {
    const bytesPerFrame = this.bytes * this.channels;
    const inputFrames = Math.floor(input.length / bytesPerFrame);
    const outputFrames = Math.floor(
      (inputFrames * this.inputSampleRate) / this.sampleRate,
    );
    const output = Buffer.alloc(outputFrames * bytesPerFrame);

    for (let outFrame = 0; outFrame < outputFrames; outFrame++) {
      const inPos = (outFrame * this.sampleRate) / this.inputSampleRate;
      const inFrame = Math.floor(inPos);

      if (
        inFrame >= inputFrames - 1 ||
        (inFrame + 1) * bytesPerFrame + (this.channels - 1) * this.bytes >
          input.length
      ) {
        break;
      }

      const fraction = inPos - inFrame;

      for (let channel = 0; channel < this.channels; channel++) {
        const pos1 = inFrame * bytesPerFrame + channel * this.bytes;
        const pos2 = (inFrame + 1) * bytesPerFrame + channel * this.bytes;

        if (
          pos1 + this.bytes > input.length ||
          pos2 + this.bytes > input.length
        ) {
          continue;
        }

        const sample1 = this._readInt(input, pos1);
        const sample2 = this._readInt(input, pos2);

        const interpolated = sample1 + fraction * (sample2 - sample1);
        const clamped = this.clamp(Math.round(interpolated));

        const outPos = outFrame * bytesPerFrame + channel * this.bytes;
        this._writeInt(output, clamped, outPos);
      }
    }

    return output;
  }

  public override _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    if (this.disabled || this.sampleRate === this.inputSampleRate) {
      this.push(chunk);
      callback();
      return;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);

    const bytesPerFrame = this.bytes * this.channels;
    const minFramesNeeded = Math.ceil(
      bytesPerFrame * (this.inputSampleRate / this.sampleRate),
    );
    const completeFrames = Math.floor(this.buffer.length / bytesPerFrame) - 1;

    if (completeFrames >= minFramesNeeded) {
      const processSize = completeFrames * bytesPerFrame;
      const toProcess = this.buffer.slice(0, processSize);
      this.buffer = this.buffer.slice(processSize);

      const resampled = this.resample(toProcess);
      this.push(resampled);
    }

    callback();
  }

  public override _flush(
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    if (this.disabled) {
      callback();
      return;
    }

    if (this.buffer.length > 0) {
      const resampled = this.resample(this.buffer);
      this.push(resampled);
    }
    callback();
  }

  public override setSampleRate(rate: number): void {
    if (rate === this.sampleRate) return;

    if (rate < 1) {
      throw new RangeError('Sample rate must be greater than 0');
    }

    super.setSampleRate(rate);
    this.onUpdate();
  }
}
