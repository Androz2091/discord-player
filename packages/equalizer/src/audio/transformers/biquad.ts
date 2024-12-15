import { BiquadFilter, BiquadFilters, Coefficients } from '../../biquad';

export interface AFBiquadConfig {
  biquad: BiquadFilter;
  sample: number;
  cutoff: number;
  gain: number;
  filter: BiquadFilters;
  coefficient: Coefficients;
  Q: number;
}

export function applyBiquad(filterer: BiquadFilter, int: number) {
  return filterer.run(int);
}
