import { describe, expect, it } from 'vitest';
import {
  BiquadFilter,
  BiquadFilters,
  Coefficients,
  FilterType,
  Q_BUTTERWORTH,
} from '..';

describe('Biquad', () => {
  const getCoeff = (filter: BiquadFilters) =>
    Coefficients.from(filter, 48000, 20, Q_BUTTERWORTH, 10);

  it('should apply LowPass filter', () => {
    const coefficients = getCoeff(FilterType.LowPass);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply HighPass filter', () => {
    const coefficients = getCoeff(FilterType.HighPass);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply AllPass filter', () => {
    const coefficients = getCoeff(FilterType.AllPass);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply BandPass filter', () => {
    const coefficients = getCoeff(FilterType.BandPass);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply HighShelf filter', () => {
    const coefficients = getCoeff(FilterType.HighShelf);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply LowShelf filter', () => {
    const coefficients = getCoeff(FilterType.LowShelf);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply Notch filter', () => {
    const coefficients = getCoeff(FilterType.Notch);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply PeakingEQ filter', () => {
    const coefficients = getCoeff(FilterType.PeakingEQ);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply SinglePoleLowPass filter', () => {
    const coefficients = getCoeff(FilterType.SinglePoleLowPass);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });

  it('should apply SinglePoleLowPassApprox filter', () => {
    const coefficients = getCoeff(FilterType.SinglePoleLowPassApprox);
    const biquad = new BiquadFilter(coefficients);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    const output = input.map((i) => biquad.run(i));

    expect(output).not.toStrictEqual(input);
  });
});
