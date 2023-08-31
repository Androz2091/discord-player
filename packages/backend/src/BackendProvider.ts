import { Backend, IBackendConfig } from './backends/Backend';
import { BackendProviderType } from './backends/common';
import { FFmpegBackend } from './backends/FFmpegBackend';

export class BackendProvider<T = BackendProviderType> {
    /**
     * The options for the backend provider.
     */
    public options: IBackendConfig;

    /**
     * The backend instance.
     */
    public backend!: Backend;

    /**
     * Creates a new ffmpeg backend provider.
     * @param options The options for the backend provider.
     */
    public static createFFmpegBackend(options: Partial<IBackendConfig> = {}) {
        return new BackendProvider(BackendProviderType.FFMPEG, options);
    }

    /**
     * Creates a new backend provider.
     * @param type The type of backend to use.
     * @param options The options for the backend provider.
     */
    public constructor(public readonly type: T, options: Partial<IBackendConfig>) {
        this.options = {
            maxQueueSize: 10,
            async: true,
            threads: 1,
            ...options
        };

        if (this.options.threads < 1) {
            throw new RangeError('Invalid number of threads specified. Must be >= 1.');
        }

        if (this.options.maxQueueSize < 1) {
            throw new RangeError('Invalid max queue size specified. Must be >= 1.');
        }

        if (this.options.threads > 1 && !this.options.async) {
            throw new Error('Cannot use multiple threads without async mode enabled.');
        }

        this.#initializeBackend();
    }

    #initializeBackend() {
        switch (this.type) {
            case BackendProviderType.FFMPEG:
                {
                    this.backend = new FFmpegBackend(this.options);
                }
                break;
            default:
                throw new Error(`Invalid backend type specified: ${this.type}`);
        }
    }
}
