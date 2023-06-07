import childProcess from 'child_process';
import { Duplex, DuplexOptions } from 'stream';
import { TypeUtil } from './TypeUtil';
import { Util } from './Util';

type Callback<Args extends Array<unknown>> = (...args: Args) => unknown;

const validatePathParam = (t: unknown) => {
    if (!TypeUtil.isString(t) || !t) throw new Error('failed to parse arg as a valid string');
    return t;
};

export interface FFmpegInfo {
    command: string | null;
    metadata: string | null;
    version: string | null;
    isStatic: boolean;
}

export interface FFmpegOptions extends DuplexOptions {
    args?: string[];
    shell?: boolean;
}

const ffmpegInfo: FFmpegInfo = {
    command: null,
    metadata: null,
    version: null,
    isStatic: false
};

interface FFmpegLocation {
    displayName: string;
    getPath: () => string;
}

const isWindows = process.platform === 'win32';

/* eslint-disable @typescript-eslint/no-var-requires */
// prettier-ignore
const FFmpegPossibleLocations: FFmpegLocation[] = [
    {
        getPath() {
            return validatePathParam(process.env.FFMPEG_PATH);
        },
        displayName: 'spawn process.env.FFMPEG_PATH'
    },
    {
        getPath() {
            return 'ffmpeg';
        },
        displayName: 'spawn ffmpeg'
    },
    {
        getPath() {
            return 'avconv';
        },
        displayName: 'spawn avconv'
    },
    {
        getPath() {
            const loc = './ffmpeg';
            if (isWindows) return loc.concat('.exe');
            return loc;
        },
        displayName: 'spawn ./ffmpeg'
    },
    {
        getPath() {
            const loc = './avconv';
            if (isWindows) return loc.concat('.exe');
            return loc;
        },
        displayName: 'spawn ./avconv'
    },
    {
        getPath() {
            const mod = require('@ffmpeg-installer/ffmpeg');
            return validatePathParam(mod.default?.path || mod.path || mod);
        },
        displayName: 'require("@ffmpeg-installer/ffmpeg")'
    },
    {
        getPath() {
            const mod = require('ffmpeg-static');
            return validatePathParam(mod.default?.path || mod.path || mod);
        },
        displayName: 'require("ffmpeg-static")'
    },
    {
        getPath() {
            const mod = require('@node-ffmpeg/node-ffmpeg-installer');
            return validatePathParam(mod.default?.path || mod.path || mod);
        },
        displayName: 'require("@node-ffmpeg/node-ffmpeg-installer")'
    },
    {
        getPath() {
            const mod = require('ffmpeg-binaries');
            return validatePathParam(mod.default || mod);
        },
        displayName: 'require("ffmpeg-binaries")'
    }
];
/* eslint-enable @typescript-eslint/no-var-requires */

export class FFmpeg extends Duplex {
    /**
     * FFmpeg version regex
     */
    public static VersionRegex = /version (.+) Copyright/im;

    /**
     * Spawns ffmpeg process
     * @param options Spawn options
     */
    public static spawn({ args = [] as string[], shell = false } = {}) {
        if (!args.includes('-i')) args.unshift('-i', '-');

        return childProcess.spawn(this.locate()!.command!, args.concat(['pipe:1']), { windowsHide: true, shell });
    }

    /**
     * Check if ffmpeg is available
     */
    public static isAvailable() {
        return typeof this.locateSafe(false)?.command === 'string';
    }

    /**
     * Safe locate ffmpeg
     * @param force if it should relocate the command
     */
    public static locateSafe(force = false) {
        try {
            return this.locate(force);
        } catch {
            return null;
        }
    }

    /**
     * Locate ffmpeg command. Throws error if ffmpeg is not found.
     * @param force Forcefully reload
     */
    public static locate(force = false): FFmpegInfo | undefined {
        if (ffmpegInfo.command && !force) return ffmpegInfo;

        const errStacks: Error[] = new Array(FFmpegPossibleLocations.length);

        for (const locator of FFmpegPossibleLocations) {
            if (locator == null) continue;
            try {
                const command = locator.getPath();

                const result = childProcess.spawnSync(command, ['-h'], {
                    windowsHide: true
                });

                if (result.error) throw result.error;

                ffmpegInfo.command = command;
                ffmpegInfo.metadata = Buffer.concat(result.output.filter(Boolean) as Buffer[]).toString();
                ffmpegInfo.isStatic = locator.displayName.startsWith('require("');
                ffmpegInfo.version = FFmpeg.VersionRegex.exec(ffmpegInfo.metadata || '')?.[1] || null;

                if (ffmpegInfo.isStatic && !('DP_NO_FFMPEG_WARN' in process.env)) {
                    Util.warn('Found ffmpeg-static which is known to be unstable.', 'FFmpegStaticWarning');
                }

                return ffmpegInfo;
            } catch (e) {
                errStacks.push(e as Error);
            }
        }

        // prettier-ignore
        throw new Error([
            'Could not locate ffmpeg. Tried:\n',
            ...FFmpegPossibleLocations.map((loc, i) => `  ${++i}. ${loc.displayName}`),
            '\n',
            `${'='.repeat(5)}Full Stacktrace${'='.repeat(5)}`,
            ...errStacks.map((e) => e.stack || e.message)
        ].join('\n'));
    }

    /**
     * Current FFmpeg process
     */
    public process: childProcess.ChildProcessWithoutNullStreams;

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
            drain: this._writer
        } as const;

        // @ts-expect-error
        this._readableState = this._reader._readableState;
        // @ts-expect-error
        this._writableState = this._writer._writableState;

        this._copy(['write', 'end'], this._writer);
        this._copy(['read', 'setEncoding', 'pipe', 'unpipe'], this._reader);

        for (const method of ['on', 'once', 'removeListener', 'removeAllListeners', 'listeners'] as const) {
            // @ts-expect-error
            this[method] = (ev, fn) => (EVENTS[ev] ? EVENTS[ev][method](ev, fn) : Duplex.prototype[method].call(this, ev, fn));
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

    public _destroy(err: Error | null, cb: Callback<[Error | null]>) {
        this._cleanup();
        if (cb) return cb(err);
    }

    public _final(cb: Callback<[]>) {
        this._cleanup();
        cb();
    }

    private _cleanup() {
        if (this.process) {
            this.once('error', () => {
                //
            });
            this.process.kill('SIGKILL');
            this.process = null as unknown as childProcess.ChildProcessWithoutNullStreams;
        }
    }

    public toString() {
        if (!ffmpegInfo.metadata) return 'FFmpeg';

        return ffmpegInfo.metadata;
    }
}

export const findFFmpeg = FFmpeg.locate;