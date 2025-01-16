export const FilterType = {
  SinglePoleLowPassApprox: 0,
  SinglePoleLowPass: 1,
  LowPass: 2,
  HighPass: 3,
  BandPass: 4,
  Notch: 5,
  AllPass: 6,
  LowShelf: 7,
  HighShelf: 8,
  PeakingEQ: 9,
} as const;

export type BiquadFilters =
  | keyof typeof FilterType
  | (typeof FilterType)[keyof typeof FilterType];

interface CoefficientsInit {
  a1: number;
  a2: number;
  b0: number;
  b1: number;
  b2: number;
}

export const Q_BUTTERWORTH = Math.SQRT1_2;

export class Coefficients {
  // Denominator coefficients
  public a1 = 0;
  public a2 = 0;

  // Nominator coefficients
  public b0 = 0;
  public b1 = 0;
  public b2 = 0;

  public constructor(data?: CoefficientsInit) {
    if (data) {
      this.a1 = data.a1;
      this.a2 = data.a2;
      this.b0 = data.b0;
      this.b1 = data.b1;
      this.b2 = data.b2;
    }
  }

  public static from(
    filter: BiquadFilters,
    samplingFreq: number,
    cutoffFreq: number,
    Q: number,
    dbGain = -10,
  ) {
    if (2.0 * cutoffFreq > samplingFreq) {
      throw new Error(`Cutoff frequency is too big!`);
    }

    if (Q < 0) {
      throw new Error(`Q may not be negative`);
    }

    const omega = (2.0 * Math.PI * cutoffFreq) / samplingFreq;

    const bqf = typeof filter === 'string' ? FilterType[filter] : filter;

    switch (bqf) {
      case FilterType.SinglePoleLowPassApprox: {
        const alpha = omega / (omega + 1.0);

        return new Coefficients({
          a1: alpha - 1.0,
          a2: 0.0,
          b0: alpha,
          b1: 0.0,
          b2: 0.0,
        });
      }
      case FilterType.SinglePoleLowPass: {
        const omega_t = Math.tan(omega / 2.0);
        const a0 = 1.0 + omega_t;

        return new Coefficients({
          a1: (omega_t - 1.0) / a0,
          a2: 0.0,
          b0: omega_t / a0,
          b1: omega_t / a0,
          b2: 0.0,
        });
      }
      case FilterType.LowPass: {
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 = (1.0 - omega_c) * 0.5;
        const b1 = 1.0 - omega_c;
        const b2 = (1.0 - omega_c) * 0.5;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * omega_c;
        const a2 = 1.0 - alpha;

        const div = 1.0 / a0;

        return new Coefficients({
          a1: a1 * div,
          a2: a2 * div,
          b0: b0 * div,
          b1: b1 * div,
          b2: b2 * div,
        });
      }
      case FilterType.HighPass: {
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 = (1.0 + omega_c) * 0.5;
        const b1 = -(1.0 + omega_c);
        const b2 = (1.0 + omega_c) * 0.5;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * omega_c;
        const a2 = 1.0 - alpha;

        const div = 1.0 / a0;

        return new Coefficients({
          a1: a1 * div,
          a2: a2 * div,
          b0: b0 * div,
          b1: b1 * div,
          b2: b2 * div,
        });
      }
      case FilterType.Notch: {
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 = 1.0;
        const b1 = -2.0 * omega_c;
        const b2 = 1.0;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * omega_c;
        const a2 = 1.0 - alpha;

        const div = 1.0 / a0;

        return new Coefficients({
          a1: a1 * div,
          a2: a2 * div,
          b0: b0 * div,
          b1: b1 * div,
          b2: b2 * div,
        });
      }
      case FilterType.BandPass: {
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 = omega_s / 2.0;
        const b1 = 0;
        const b2 = -(omega_s / 2.0);
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * omega_c;
        const a2 = 1.0 - alpha;

        const div = 1.0 / a0;

        return new Coefficients({
          a1: a1 * div,
          a2: a2 * div,
          b0: b0 * div,
          b1: b1 * div,
          b2: b2 * div,
        });
      }
      case FilterType.AllPass: {
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 = 1.0 - alpha;
        const b1 = -2.0 * omega_c;
        const b2 = 1.0 + alpha;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * omega_c;
        const a2 = 1.0 - alpha;

        return new Coefficients({
          a1: a1 / a0,
          a2: a2 / a0,
          b0: b0 / a0,
          b1: b1 / a0,
          b2: b2 / a0,
        });
      }
      case FilterType.LowShelf: {
        const a = Math.pow(10.0, dbGain / 40.0);
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 =
          a * (a + 1.0 - (a - 1.0) * omega_c + 2.0 * alpha * Math.sqrt(a));
        const b1 = 2.0 * a * (a - 1.0 - (a + 1.0) * omega_c);
        const b2 =
          a * (a + 1.0 - (a - 1.0) * omega_c - 2.0 * alpha * Math.sqrt(a));
        const a0 = a + 1.0 + (a - 1.0) * omega_c + 2.0 * alpha * Math.sqrt(a);
        const a1 = -2.0 * (a - 1.0 + (a + 1.0) * omega_c);
        const a2 = a + 1.0 + (a - 1.0) * omega_c - 2.0 * alpha * Math.sqrt(a);

        return new Coefficients({
          a1: a1 / a0,
          a2: a2 / a0,
          b0: b0 / a0,
          b1: b1 / a0,
          b2: b2 / a0,
        });
      }
      case FilterType.HighShelf: {
        const a = Math.pow(10.0, dbGain / 40.0);
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 =
          a * (a + 1.0 + (a - 1.0) * omega_c + 2.0 * alpha * Math.sqrt(a));
        const b1 = -2.0 * a * (a - 1.0 + (a + 1.0) * omega_c);
        const b2 =
          a * (a + 1.0 + (a - 1.0) * omega_c - 2.0 * alpha * Math.sqrt(a));
        const a0 = a + 1.0 - (a - 1.0) * omega_c + 2.0 * alpha * Math.sqrt(a);
        const a1 = 2.0 * (a - 1.0 - (a + 1.0) * omega_c);
        const a2 = a + 1.0 - (a - 1.0) * omega_c - 2.0 * alpha * Math.sqrt(a);

        return new Coefficients({
          a1: a1 / a0,
          a2: a2 / a0,
          b0: b0 / a0,
          b1: b1 / a0,
          b2: b2 / a0,
        });
      }
      case FilterType.PeakingEQ: {
        const a = Math.pow(10.0, dbGain / 40.0);
        const omega_s = Math.sin(omega);
        const omega_c = Math.cos(omega);
        const alpha = omega_s / (2.0 * Q);

        const b0 = 1.0 + alpha * a;
        const b1 = -2.0 * omega_c;
        const b2 = 1.0 - alpha * a;
        const a0 = 1.0 + alpha / a;
        const a1 = -2.0 * omega_c;
        const a2 = 1.0 - alpha / a;

        return new Coefficients({
          a1: a1 / a0,
          a2: a2 / a0,
          b0: b0 / a0,
          b1: b1 / a0,
          b2: b2 / a0,
        });
      }
      default:
        throw new TypeError(`Invalid filter type "${filter}"`);
    }
  }
}
