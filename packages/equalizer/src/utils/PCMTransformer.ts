import { Transform, TransformOptions } from 'stream';

export type PCMType = `s${16 | 32}${'l' | 'b'}e`;

export interface PCMTransformerOptions extends TransformOptions {
  type?: PCMType;
  disabled?: boolean;
  sampleRate?: number;
}

export class PCMTransformer extends Transform {
  public readonly type: PCMType = 's16le';
  public bits: number;
  public bytes: number;
  public extremum: number;
  public disabled = false;
  public sampleRate = 48000;
  public onUpdate = (): void => {
    /* noop */
  };

  public constructor(options: PCMTransformerOptions = {}) {
    super(options);

    options.type ??= 's16le';
    this.disabled = !!options.disabled;
    if (typeof options.sampleRate === 'number' && options.sampleRate > 0) {
      this.sampleRate = options.sampleRate;
    }

    switch (options.type) {
      case 's16be':
      case 's16le':
        this.type = options.type;
        this.bits = 16;
        break;
      case 's32be':
      case 's32le':
        this.type = options.type;
        this.bits = 32;
        break;
      default:
        throw new TypeError(
          `Expected type to be one of ${(
            ['s16be', 's16le', 's32be', 's32le'] as PCMType[]
          ).join(', ')}, got "${options.type}"`,
        );
    }

    this.bytes = this.bits / 8;
    this.extremum = Math.pow(2, this.bits - 1);
  }

  public disable() {
    this.disabled = true;
  }

  public enable() {
    this.disabled = false;
  }

  public toggle() {
    this.disabled = !this.disabled;

    return this.disabled;
  }

  public _readInt(buffer: Buffer, index: number) {
    const method = `readInt${this.type
      .substring(1)
      .toUpperCase()}` as `readInt${16 | 32}${'L' | 'B'}E`;
    return buffer[method](index);
  }

  public _writeInt(buffer: Buffer, int: number, index: number) {
    const method = `writeInt${this.type
      .substring(1)
      .toUpperCase()}` as `writeInt${16 | 32}${'L' | 'B'}E`;
    return buffer[method](int, index);
  }

  public clamp(val: number, max = this.extremum - 1, min = -this.extremum) {
    return Math.min(max, Math.max(min, val));
  }

  public setSampleRate(rate: number) {
    this.sampleRate = rate;
    return;
  }
}
