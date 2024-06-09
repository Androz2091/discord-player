import type { Duplex, Readable } from 'stream';
import * as prism from 'prism-media';
import { FFmpeg } from '@discord-player/ffmpeg';

export interface FFmpegStreamOptions {
    fmt?: string;
    encoderArgs?: string[];
    seek?: number;
    skip?: boolean;
    cookies?: string;
    useLegacyFFmpeg?: boolean;
}

const getFFmpegProvider = (legacy = false) => (legacy ? (prism as typeof prism & { default: typeof prism }).default?.FFmpeg || prism.FFmpeg : FFmpeg);

const resolveArgs = (config: Record<string, string | number | null | undefined>): string[] => {
    return Object.entries(config).reduce((acc, [key, value]) => {
        if (value == null) return acc;
        acc.push(`-${key}`, String(value));
        return acc;
    }, [] as string[]);
};

export function FFMPEG_ARGS_STRING(stream: string, fmt?: string, cookies?: string) {
    const args = resolveArgs({
        reconnect: 1,
        reconnect_streamed: 1,
        reconnect_delay_max: 5,
        i: stream,
        analyzeduration: 0,
        loglevel: 0,
        ar: 48000,
        ac: 2,
        f: `${typeof fmt === 'string' ? fmt : 's16le'}`,
        acodec: fmt === 'opus' ? 'libopus' : null,
        cookies: typeof cookies === 'string' ? (!cookies.includes(' ') ? cookies : `"${cookies}"`) : null
    });

    return args;
}

export function FFMPEG_ARGS_PIPED(fmt?: string) {
    const args = resolveArgs({
        analyzeduration: 0,
        loglevel: 0,
        ar: 48000,
        ac: 2,
        f: `${typeof fmt === 'string' ? fmt : 's16le'}`,
        acodec: fmt === 'opus' ? 'libopus' : null
    });

    return args;
}

/**
 * Creates FFmpeg stream
 * @param stream The source stream
 * @param options FFmpeg stream options
 */
export function createFFmpegStream(stream: Readable | Duplex | string, options?: FFmpegStreamOptions) {
    if (options?.skip && typeof stream !== 'string') return stream;
    options ??= {};
    const args = typeof stream === 'string' ? FFMPEG_ARGS_STRING(stream, options.fmt, options.cookies) : FFMPEG_ARGS_PIPED(options.fmt);

    if (!Number.isNaN(options.seek)) args.unshift('-ss', String(options.seek));
    if (Array.isArray(options.encoderArgs)) args.push(...options.encoderArgs);

    const FFMPEG = getFFmpegProvider(!!options.useLegacyFFmpeg);

    const transcoder = new FFMPEG({ shell: false, args });

    transcoder.on('close', () => transcoder.destroy());

    if (typeof stream !== 'string') {
        stream.on('error', () => transcoder.destroy());
        stream.pipe(transcoder);
    }

    return transcoder;
}
