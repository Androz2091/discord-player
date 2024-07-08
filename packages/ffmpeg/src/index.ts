export * from './FFmpeg';

export type ArgPrimitive = string | number;

/**
 * Create FFmpeg arguments from an object.
 * @param input The input object.
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
        args.push(`-${key}`, String(value));
    }

    if (post) {
        Array.isArray(post) ? args.push(...post) : args.push(post);
    }

    return args;
};

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
