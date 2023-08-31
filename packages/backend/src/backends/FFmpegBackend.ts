import { Readable } from 'stream';
import { Backend, StreamableSource } from './Backend';
import { BackendProviderType } from './common';

export interface FFmpegOptions {
    /**
     * The arguments to pass to ffmpeg.
     * @example ['-i', 'pipe:0', '-f', 'mp3', '-']
     */
    args: string[];
}

export class FFmpegBackend extends Backend {
    public static readonly type = BackendProviderType.FFMPEG;

    public async processSource(source: StreamableSource<FFmpegOptions>): Promise<Readable> {
        void source;
        throw new Error('Method not implemented.');
    }
}
