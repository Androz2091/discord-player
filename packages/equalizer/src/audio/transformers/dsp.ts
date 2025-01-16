export interface AFPulsatorConfig {
  hz: number;
  x: number;
  dI: number;
}

export interface AFTremoloConfig {
  phase: number;
  depth: number;
  frequency: number;
}

export type AFVibratoConfig = AFTremoloConfig;

export type LR = 0 | 1;

export function applyPulsator(
  config: AFPulsatorConfig,
  int: number,
  channel: LR,
) {
  const sin = Math.sin(config.x);
  const currentChannelVal = channel === 0 ? sin : -sin;
  const res = (int * (currentChannelVal + 1.0)) / 2.0;

  config.x += config.dI;

  return res;
}

export function applyTremolo(
  config: AFTremoloConfig,
  int: number,
  sampleRate: number,
) {
  const fOffset = 1.0 - config.depth;
  const modSignal = fOffset + config.depth * Math.sin(config.phase);
  config.phase += ((2 * Math.PI) / sampleRate) * config.frequency;
  return modSignal * int;
}

export function applyVibrato(
  config: AFVibratoConfig,
  int: number,
  sampleRate: number,
) {
  const fOffset = 1.0 - config.depth;
  const modSignal =
    fOffset + config.depth * Math.sin(2 * Math.PI * config.phase);
  config.phase += ((2 * Math.PI) / sampleRate) * config.frequency;
  return modSignal * int;
}

export function applyVolume(vol: number, int: number) {
  return vol * int;
}
