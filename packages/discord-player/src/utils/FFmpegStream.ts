import type { Duplex, Readable } from 'stream';
import { FFmpeg, createFFmpegArgs } from '@discord-player/ffmpeg';
import type { RequestOptions } from 'http';

export interface FFmpegStreamOptions {
  fmt?: string;
  encoderArgs?: string[];
  seek?: number;
  skip?: boolean;
  cookies?: string;
  requestOptions?: RequestOptions;
}

export function FFMPEG_ARGS_STRING(
  stream: string,
  fmt?: string,
  cookies?: string,
  requestOptions?: RequestOptions,
) {
  // Build array manually to handle HTTP options properly
  const args: string[] = [];

  // Add reconnection options
  args.push('-reconnect', '1');
  args.push('-reconnect_streamed', '1');
  args.push('-reconnect_delay_max', '5');

  // Add HTTP headers if provided - FFmpeg HTTP protocol format, thank god it started working...
  if (requestOptions?.headers) {
    const userAgent = requestOptions.headers['user-agent'] || requestOptions.headers['User-Agent'];
    if (userAgent) {
      args.push('-user_agent', String(userAgent));
    }

    // Add other headers using FFmpeg's headers option
    const formattedHeaders = formatFFmpegHeaders(requestOptions.headers as NodeJS.Dict<string | string[]>);
    if (formattedHeaders) {
      args.push('-headers', formattedHeaders);
    }
  }

  // Add cookies if provided
  if (typeof cookies === 'string') {
    const cookieValue = !cookies.includes(' ') ? cookies : `"${cookies}"`;
    args.push('-cookies', cookieValue);
  }

  // Add input URL
  args.push('-i', stream);

  // Add audio processing options
  args.push('-analyzeduration', '0');
  args.push('-loglevel', '0');
  args.push('-ar', '48000');
  args.push('-ac', '2');
  args.push('-f', typeof fmt === 'string' ? fmt : 's16le');
  
  if (fmt === 'opus') {
    args.push('-acodec', 'libopus');
  }
  return args;
}

function formatFFmpegHeaders(headers: NodeJS.Dict<string | string[]>): string | null {
  const headerPairs: string[] = [];
  
  for (const [name, value] of Object.entries(headers)) {
    if (value && name.toLowerCase() !== 'user-agent') {
      const valueStr = Array.isArray(value) ? value.join(', ') : String(value);
      headerPairs.push(`${name}: ${valueStr}`);
    }
  }
  
  return headerPairs.length > 0 ? headerPairs.join('\r\n') : null;
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
      ? FFMPEG_ARGS_STRING(stream, options.fmt, options.cookies, options.requestOptions)
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
