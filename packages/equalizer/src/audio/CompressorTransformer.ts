import { PCMTransformer, PCMTransformerOptions } from '../utils/PCMTransformer';

export interface CompressorOptions extends PCMTransformerOptions {
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  makeupGain?: number;
  kneeWidth?: number;
}

export interface CompressorParameters {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  kneeWidth: number;
}

export class CompressorTransformer extends PCMTransformer {
  private threshold: number;
  private ratio: number;
  private attack: number;
  private release: number;
  private makeupGain: number;
  private kneeWidth: number;
  private envelope: number = 0;
  private gainReduction: number = 1;
  private previousGainReduction: number = 1;

  constructor(options: CompressorOptions = {}) {
    super(options);

    this.threshold = options.threshold ?? -20;
    this.ratio = options.ratio ?? 4;
    this.attack = options.attack ?? 20;
    this.release = options.release ?? 100;
    this.makeupGain = options.makeupGain ?? 0;
    this.kneeWidth = options.kneeWidth ?? 6;
    this.attack = Math.exp(-1 / ((this.sampleRate * this.attack) / 1000));
    this.release = Math.exp(-1 / ((this.sampleRate * this.release) / 1000));
  }

  private linearToDb(linear: number): number {
    const val = 20 * Math.log10(Math.max(linear, 1e-6));
    return val;
  }

  private dbToLinear(db: number): number {
    const val = Math.pow(10, db / 20);
    return val;
  }

  public setThreshold(db: number) {
    this.threshold = Math.max(-100, Math.min(0, db));
    this.onUpdate();
  }

  public setRatio(ratio: number) {
    this.ratio = Math.max(1, ratio);
    this.onUpdate();
  }

  public setAttack(ms: number) {
    this.attack = Math.exp(-1 / ((this.sampleRate * Math.max(0.1, ms)) / 1000));
    this.onUpdate();
  }

  public setRelease(ms: number) {
    this.release = Math.exp(
      -1 / ((this.sampleRate * Math.max(0.1, ms)) / 1000),
    );
    this.onUpdate();
  }

  public setMakeupGain(db: number) {
    this.makeupGain = Math.max(-20, Math.min(20, db));
    this.onUpdate();
  }

  public setKneeWidth(db: number) {
    this.kneeWidth = Math.max(0, Math.min(20, db));
    this.onUpdate();
  }

  public setCompressor(options: Partial<CompressorParameters>) {
    if (typeof options.threshold === 'number') {
      this.setThreshold(options.threshold);
    }

    if (typeof options.ratio === 'number') {
      this.setRatio(options.ratio);
    }

    if (typeof options.attack === 'number') {
      this.setAttack(options.attack);
    }

    if (typeof options.release === 'number') {
      this.setRelease(options.release);
    }

    if (typeof options.makeupGain === 'number') {
      this.setMakeupGain(options.makeupGain);
    }

    if (typeof options.kneeWidth === 'number') {
      this.setKneeWidth(options.kneeWidth);
    }

    this.onUpdate();

    return this.getParameters();
  }

  public getParameters(): CompressorParameters {
    return {
      threshold: this.threshold,
      ratio: this.ratio,
      attack: this.attack,
      release: this.release,
      makeupGain: this.makeupGain,
      kneeWidth: this.kneeWidth,
    };
  }

  private computeGainReduction(inputLevel: number): number {
    const inputDb = this.linearToDb(inputLevel);

    let gainReductionDb = 0;

    if (2 * (inputDb - this.threshold) < -this.kneeWidth) {
      gainReductionDb = 0;
    } else if (2 * Math.abs(inputDb - this.threshold) <= this.kneeWidth) {
      const x = inputDb - this.threshold + this.kneeWidth / 2;
      gainReductionDb =
        ((1 / this.ratio - 1) * Math.pow(x, 2)) / (2 * this.kneeWidth);
    } else {
      gainReductionDb = (inputDb - this.threshold) * (1 - 1 / this.ratio);
    }

    return this.dbToLinear(-gainReductionDb + this.makeupGain);
  }

  private processSample(input: number): number {
    if (this.disabled) return input;

    const inputFloat = input / this.extremum;

    const inputLevel = Math.abs(inputFloat);
    const coeff = inputLevel > this.envelope ? this.attack : this.release;
    this.envelope = coeff * this.envelope + (1 - coeff) * inputLevel;

    const targetGainReduction = this.computeGainReduction(this.envelope);

    this.gainReduction = Math.min(
      this.previousGainReduction * this.attack +
        targetGainReduction * (1 - this.attack),
      targetGainReduction,
    );
    this.previousGainReduction = this.gainReduction;

    const outputFloat = inputFloat * this.gainReduction;

    return this.clamp(Math.floor(outputFloat * this.extremum));
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
