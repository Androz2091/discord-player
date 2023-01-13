import { FFmpeg } from 'prism-media';
import type { Duplex, Readable } from 'stream';

export interface FFmpegStreamOptions {
    fmt?: string;
    encoderArgs?: string[];
    seek?: number;
    skip?: boolean;
}

export function FFMPEG_ARGS_STRING(stream: string, fmt?: string) {
    // prettier-ignore
    return [
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        "-i", stream,
        "-analyzeduration", "0",
        "-loglevel", "0",
        "-f", `${typeof fmt === "string" ? fmt : "s16le"}`,
        "-ar", "48000",
        "-ac", "2"
    ];
}

export function FFMPEG_ARGS_PIPED(fmt?: string) {
    // prettier-ignore
    return [
        "-analyzeduration", "0",
        "-loglevel", "0",
        "-f", `${typeof fmt === "string" ? fmt : "s16le"}`,
        "-ar", "48000",
        "-ac", "2"
    ];
}

/**
 * Creates FFmpeg stream
 * @param stream The source stream
 * @param options FFmpeg stream options
 */
export function createFFmpegStream(stream: Readable | Duplex | string, options?: FFmpegStreamOptions) {
    if (options?.skip && typeof stream !== 'string') return stream;
    options ??= {};
    const args = typeof stream === 'string' ? FFMPEG_ARGS_STRING(stream, options.fmt) : FFMPEG_ARGS_PIPED(options.fmt);

    if (!Number.isNaN(options.seek)) args.unshift('-ss', String(options.seek));
    if (Array.isArray(options.encoderArgs)) args.push(...options.encoderArgs);

    const transcoder = new FFmpeg({ shell: false, args });
    transcoder.on('close', () => transcoder.destroy());

    if (typeof stream !== 'string') {
        stream.on('error', () => transcoder.destroy());
        stream.pipe(transcoder);
    }

    return transcoder;
}
