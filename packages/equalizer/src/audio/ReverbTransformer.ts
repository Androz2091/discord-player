import { PCMTransformer, PCMTransformerOptions } from '../utils';

export interface ReverbOptions extends PCMTransformerOptions {
  roomSize?: number;
  damping?: number;
  wetLevel?: number;
  dryLevel?: number;
}

export interface ReverbParameters {
  roomSize: number;
  damping: number;
  wetLevel: number;
  dryLevel: number;
}

export class ReverbTransformer extends PCMTransformer {
  private roomSize: number;
  private damping: number;
  private wetLevel: number;
  private dryLevel: number;

  private readonly delayLines: Float32Array[];
  private readonly delayLineLength: number;
  private delayIndices: number[];
  private readonly numDelayLines = 8;
  private readonly feedback: number = 0.84;

  constructor(options: ReverbOptions = {}) {
    super(options);

    this.roomSize = options.roomSize ?? 0.5;
    this.damping = options.damping ?? 0.5;
    this.wetLevel = options.wetLevel ?? 0.3;
    this.dryLevel = options.dryLevel ?? 0.7;

    this.delayLineLength = Math.floor(this.sampleRate * 0.05);
    this.delayLines = Array.from(
      { length: this.numDelayLines },
      () => new Float32Array(this.delayLineLength),
    );
    this.delayIndices = Array(this.numDelayLines).fill(0);
  }

  public setRoomSize(size: number) {
    this.roomSize = Math.max(0, Math.min(1, size));
    this.onUpdate();
  }

  public setDamping(damping: number) {
    this.damping = Math.max(0, Math.min(1, damping));
    this.onUpdate();
  }

  public setWetLevel(level: number) {
    this.wetLevel = Math.max(0, Math.min(1, level));
    this.onUpdate();
  }

  public setDryLevel(level: number) {
    this.dryLevel = Math.max(0, Math.min(1, level));
    this.onUpdate();
  }

  public setReverb(options: Partial<ReverbParameters>) {
    if (typeof options.roomSize === 'number') {
      this.setRoomSize(options.roomSize);
    }

    if (typeof options.damping === 'number') {
      this.setDamping(options.damping);
    }

    if (typeof options.wetLevel === 'number') {
      this.setWetLevel(options.wetLevel);
    }

    if (typeof options.dryLevel === 'number') {
      this.setDryLevel(options.dryLevel);
    }

    this.onUpdate();

    return this.getParameters();
  }

  public getParameters(): ReverbParameters {
    return {
      roomSize: this.roomSize,
      damping: this.damping,
      wetLevel: this.wetLevel,
      dryLevel: this.dryLevel,
    };
  }

  private processSample(input: number): number {
    if (this.disabled) return input;

    const inputFloat = input / this.extremum;
    let wet = 0;

    for (let i = 0; i < this.numDelayLines; i++) {
      const delayLine = this.delayLines[i];
      const delayIndex = this.delayIndices[i];

      const delayed = delayLine[delayIndex];

      const processed = delayed * this.roomSize * (1 - this.damping);

      delayLine[delayIndex] = inputFloat + processed * this.feedback;

      this.delayIndices[i] = (delayIndex + 1) % this.delayLineLength;

      wet += processed;
    }

    const output =
      inputFloat * this.dryLevel + (wet * this.wetLevel) / this.numDelayLines;

    return this.clamp(Math.floor(output * this.extremum));
  }

  public override _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    if (this.disabled) {
      callback(null, chunk);
      return;
    }

    const output = Buffer.alloc(chunk.length);

    for (let i = 0; i < chunk.length; i += this.bytes) {
      const sample = this._readInt(chunk, i);
      const processed = this.processSample(sample);
      this._writeInt(output, processed, i);
    }

    callback(null, output);
  }
}
