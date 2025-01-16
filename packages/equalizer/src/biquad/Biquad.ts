import { BiquadFilters, Coefficients } from './Coefficients';

export interface BiquadSetFilterProps {
  f0: number;
  fs: number;
  Q: number;
  gain?: number;
}

export class BiquadFilter {
  public x1 = 0.0;
  public x2 = 0.0;
  public y1 = 0.0;
  public y2 = 0.0;
  public s1 = 0.0;
  public s2 = 0.0;

  public constructor(public coefficients: Coefficients) {}

  public setFilter(filter: BiquadFilters, options: BiquadSetFilterProps) {
    const coefficients = Coefficients.from(
      filter,
      options.fs,
      options.f0,
      options.Q,
      options.gain,
    );

    this.update(coefficients);
  }

  public update(coefficients: Coefficients) {
    this.coefficients = coefficients;
  }

  public replace(coefficients: Coefficients) {
    this.coefficients = coefficients;
  }

  public reset() {
    this.x1 = 0.0;
    this.x2 = 0.0;
    this.y1 = 0.0;
    this.y2 = 0.0;
    this.s1 = 0.0;
    this.s2 = 0.0;
  }

  public run(input: number) {
    const { a1, a2, b0, b1, b2 } = this.coefficients;

    const out =
      b0 * input + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;

    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = out;

    return out;
  }

  public runTransposed(input: number) {
    const { a1, a2, b0, b1, b2 } = this.coefficients;

    const out = this.s1 + b0 * input;

    this.s1 = this.s2 + b1 * input - a1 * out;
    this.s2 = b2 * input - a2 * out;

    return out;
  }
}
