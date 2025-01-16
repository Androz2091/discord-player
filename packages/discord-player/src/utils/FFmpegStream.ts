import type { Duplex, Readable } from 'stream';
import { FFmpeg, createFFmpegArgs } from '@discord-player/ffmpeg';

export interface FFmpegStreamOptions {
  fmt?: string;
  encoderArgs?: string[];
  seek?: number;
  skip?: boolean;
  cookies?: string;
}

export function FFMPEG_ARGS_STRING(
  stream: string,
  fmt?: string,
  cookies?: string,
) {
  const args = createFFmpegArgs({
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
    cookies:
      typeof cookies === 'string'
        ? !cookies.includes(' ')
          ? cookies
          : `"${cookies}"`
        : null,
  });

  return args;
}

export function FFMPEG_ARGS_PIPED(fmt?: string) {
  const args = createFFmpegArgs({
    analyzeduration: 0,
    loglevel: 0,
    ar: 48000,
    ac: 2,
    f: `${typeof fmt === 'string' ? fmt : 's16le'}`,
    acodec: fmt === 'opus' ? 'libopus' : null,
  });

  return args;
}

/**
 * Creates FFmpeg stream
 * @param stream The source stream
 * @param options FFmpeg stream options
 */
export function createFFmpegStream(
  stream: Readable | Duplex | string,
  options?: FFmpegStreamOptions,
): Readable {
  if (options?.skip && typeof stream !== 'string') return stream;
  options ??= {};
  const args =
    typeof stream === 'string'
      ? FFMPEG_ARGS_STRING(stream, options.fmt, options.cookies)
      : FFMPEG_ARGS_PIPED(options.fmt);

  if (!Number.isNaN(options.seek)) args.unshift('-ss', String(options.seek));
  if (Array.isArray(options.encoderArgs)) args.push(...options.encoderArgs);

  const transcoder = new FFmpeg({ shell: false, args });

  transcoder.on('close', () => transcoder.destroy());

  if (typeof stream !== 'string') {
    stream.on('error', () => transcoder.destroy());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream.pipe(transcoder as any);
  }

  return transcoder;
}
