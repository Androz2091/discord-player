import type internal from 'stream';
import type { BackendProviderType } from './common';

export interface IBackendConfig {
    /**
     * Whether to utilize multiple threads for processing. Defaults to `true`.
     */
    async: boolean;
    /**
     * The maximum number of items to keep in the queue while parallel processing. Value must be `>=1`. This option is only applicable if `async` is set to true. Defaults to `10`.
     */
    maxQueueSize: number;
    /**
     * The max number of threads to use for processing. Value must be >= 1. Defaults to `1`. This option is only applicable if `async` is set to true.
     */
    threads: number;
}

export interface StreamableSource<Options extends object> {
    /**
     * A streamable source.
     */
    source: internal.Readable | string;
    /**
     * The options for the source.
     */
    options: Options;
}

export abstract class Backend {
    static readonly type: BackendProviderType;
    public constructor(public options: IBackendConfig) {}

    public abstract processSource(source: StreamableSource<object>): Promise<internal.Readable>;
}
