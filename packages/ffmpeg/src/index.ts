export * from './FFmpeg';

export type ArgPrimitive = string | number | null;

/**
 * Create FFmpeg arguments from an object.
 * @param input The input object.
 * @param post Additional arguments to append.
 * @returns The FFmpeg arguments.
 * @example createFFmpegArgs({ i: 'input.mp3', af: ['bass=g=10','acompressor'] }, './out.mp3');
 * // => ['-i', 'input.mp3', '-af', 'bass=g=10,acompressor', './out.mp3']
 */
export const createFFmpegArgs = (
  input: Record<string, ArgPrimitive | ArgPrimitive[]>,
  post?: string | string[],
): string[] => {
  const args = [];

  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    args.push(`-${key}`, String(value));
  }

  if (post) {
    Array.isArray(post) ? args.push(...post) : args.push(post);
  }

  return args;
};

export * from './common';
export { version } from './version';
