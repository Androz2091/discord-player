import {
  ChildProcessWithoutNullStreams,
  spawn,
  spawnSync,
} from 'node:child_process';
import { Duplex, DuplexOptions } from 'node:stream';
import { FFmpegCallback, FFmpegSource, ResolvedFFmpegSource } from './common';

export interface FFmpegOptions extends DuplexOptions {
  args?: string[];
  shell?: boolean;
}

const VERSION_REGEX = /version (.+) Copyright/im;

const validatePathParam = (path: string, displayName: string) => {
  if (!path) throw new Error(`Failed to resolve ${displayName}`);
  return path;
};

export class FFmpeg extends Duplex {
  /**
   * Cached FFmpeg source.
   */
  private static cached: ResolvedFFmpegSource | null = null;
  /**
   * Supported FFmpeg sources.
   */
  public static sources: FFmpegSource[] = [
    // paths
    { name: 'ffmpeg', module: false },
    { name: './ffmpeg', module: false },
    { name: 'avconv', module: false },
    { name: './avconv', module: false },
    // modules
    { name: 'ffmpeg-static', module: true },
    { name: '@ffmpeg-installer/ffmpeg', module: true },
    { name: '@node-ffmpeg/node-ffmpeg-installer', module: true },
    { name: 'ffmpeg-binaries', module: true },
  ];

  /**
   * Checks if FFmpeg is loaded.
   */
  public static isLoaded() {
    return FFmpeg.cached != null;
  }

  /**
   * Adds a new FFmpeg source.
   * @param source FFmpeg source
   */
  public static addSource(source: FFmpegSource) {
    if (FFmpeg.sources.some((s) => s.name === source.name)) return false;
    FFmpeg.sources.push(source);
    return true;
  }

  /**
   * Removes a FFmpeg source.
   * @param source FFmpeg source
   */
  public static removeSource(source: FFmpegSource) {
    const index = FFmpeg.sources.findIndex((s) => s.name === source.name);
    if (index === -1) return false;
    FFmpeg.sources.splice(index, 1);
    return true;
  }

  /**
   * Resolves FFmpeg path. Throws an error if it fails to resolve.
   * @param force if it should relocate the command
   */
  public static resolve(force = false) {
    if (!force && FFmpeg.cached) return FFmpeg.cached;

    const errors: string[] = [];

    for (const source of FFmpeg.sources) {
      try {
        let path: string;

        if (source.module) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod = require(source.name);
          path = validatePathParam(
            mod.default?.path || mod.path || mod,
            source.name,
          );
        } else {
          path = source.name;
        }

        const result = spawnSync(path, ['-v'], { windowsHide: true });

        const resolved: ResolvedFFmpegSource = {
          result: result.stdout.toString(),
          command: path,
          module: source.module,
          name: source.name,
          path,
          version:
            VERSION_REGEX.exec(result.stderr.toString())?.[1] ?? 'unknown',
        };

        FFmpeg.cached = resolved;

        errors.length = 0;

        return resolved;
      } catch (e) {
        const err = e && e instanceof Error ? e.message : `${e}`;
        const msg = `Failed to load ffmpeg using ${
          source.module
            ? `require('${source.name}')`
            : `spawn('${source.name}')`
        }. Error: ${err}`;

        errors.push(msg);
      }
    }

    throw new Error(`Could not load ffmpeg. Errors:\n${errors.join('\n')}`);
  }

  /**
   * Resolves FFmpeg path safely. Returns null if it fails to resolve.
   * @param force if it should relocate the command
   */
  public static resolveSafe(force = false) {
    try {
      return FFmpeg.resolve(force);
    } catch {
      return null;
    }
  }

  /**
   * Spawns ffmpeg process
   * @param options Spawn options
   */
  public static spawn({ args = [] as string[], shell = false } = {}) {
    if (!args.includes('-i')) args.unshift('-i', '-');
    return spawn(FFmpeg.resolve().command, args.concat(['pipe:1']), {
      windowsHide: true,
      shell,
    });
  }

  /**
   * Current FFmpeg process
   */
  public process: ChildProcessWithoutNullStreams;

  /**
   * Create FFmpeg duplex stream
   * @param options Options to initialize ffmpeg
   * @example ```typescript
   * const ffmpeg = new FFmpeg({
   *   args: [
   *     '-analyzeduration', '0',
   *     '-loglevel', '0',
   *     '-f', 's16le',
   *     '-ar', '48000',
   *     '-ac', '2',
   *     '-af', 'bass=g=10,acompressor'
   *   ]
   * });
   *
   * const pcm = input.pipe(ffmpeg);
   *
   * pcm.pipe(fs.createWriteStream('./audio.pcm'));
   * ```
   */
  public constructor(options: FFmpegOptions = {}) {
    super(options);

    this.process = FFmpeg.spawn(options);

    const EVENTS = {
      readable: this._reader,
      data: this._reader,
      end: this._reader,
      unpipe: this._reader,
      finish: this._writer,
      drain: this._writer,
    } as const;

    // @ts-expect-error
    this._readableState = this._reader._readableState;
    // @ts-expect-error
    this._writableState = this._writer._writableState;

    this._copy(['write', 'end'], this._writer);
    this._copy(['read', 'setEncoding', 'pipe', 'unpipe'], this._reader);

    for (const method of [
      'on',
      'once',
      'removeListener',
      'removeAllListeners',
      'listeners',
    ] as const) {
      // @ts-expect-error
      this[method] = (ev, fn) =>
        // @ts-expect-error
        EVENTS[ev]
          ? // @ts-expect-error
            EVENTS[ev][method](ev, fn)
          : // @ts-expect-error
            Duplex.prototype[method].call(this, ev, fn);
    }

    const processError = (error: Error) => this.emit('error', error);

    this._reader.on('error', processError);
    this._writer.on('error', processError);
  }

  get _reader() {
    return this.process!.stdout;
  }
  get _writer() {
    return this.process!.stdin;
  }

  private _copy(methods: string[], target: unknown) {
    for (const method of methods) {
      // @ts-expect-error
      this[method] = target[method].bind(target);
    }
  }

  public _destroy(err: Error | null, cb: FFmpegCallback<[Error | null]>) {
    this._cleanup();
    if (cb) return cb(err);
  }

  public _final(cb: FFmpegCallback<[]>) {
    this._cleanup();
    cb();
  }

  private _cleanup() {
    if (this.process) {
      this.once('error', () => {
        //
      });
      this.process.kill('SIGKILL');
      this.process = null as unknown as ChildProcessWithoutNullStreams;
    }
  }
}
