import { Player } from '../Player';
import { Collection } from '@discord-player/utils';
import { BaseExtractor } from './BaseExtractor';
import { Util } from '../utils/Util';
import { PlayerEventsEmitter } from '../utils/PlayerEventsEmitter';
import { TypeUtil } from '../utils/TypeUtil';

// prettier-ignore
const knownExtractorKeys = [
    'SpotifyExtractor',
    'AppleMusicExtractor',
    'SoundCloudExtractor',
    'YouTubeExtractor',
    'VimeoExtractor',
    'ReverbnationExtractor',
    'AttachmentExtractor'
] as const;
const knownExtractorLib = '@discord-player/extractor';

export type ExtractorLoaderOptionDict = {
    // @ts-ignore types
    [K in (typeof knownExtractorKeys)[number]]?: ConstructorParameters<typeof import('@discord-player/extractor')[K]>[1];
};

export interface ExtractorExecutionEvents {
    /**
     * Emitted when a extractor is registered
     * @param context The context where extractor was registered
     * @param extractor The extractor that was registered
     */
    registered: (context: ExtractorExecutionContext, extractor: BaseExtractor) => unknown;
    /**
     * Emitted when a extractor is unregistered
     * @param context The context where extractor was unregistered
     * @param extractor The extractor that was unregistered
     */
    unregistered: (context: ExtractorExecutionContext, extractor: BaseExtractor) => unknown;
    /**
     * Emitted when a extractor is activated
     * @param context The context where this event occurred
     * @param extractor The extractor which was activated
     */
    activate: (context: ExtractorExecutionContext, extractor: BaseExtractor) => unknown;
    /**
     * Emitted when a extractor is deactivated
     * @param context The context where this event occurred
     * @param extractor The extractor which was deactivated
     */
    deactivate: (context: ExtractorExecutionContext, extractor: BaseExtractor) => unknown;
    /**
     * Emitted when a extractor fails to activate/deactivate
     * @param context The context where this event occurred
     * @param extractor The extractor which was deactivated
     */
    error: (context: ExtractorExecutionContext, extractor: BaseExtractor, error: Error) => unknown;
}

export class ExtractorExecutionContext extends PlayerEventsEmitter<ExtractorExecutionEvents> {
    public store = new Collection<string, BaseExtractor>();
    public constructor(public player: Player) {
        super(['error']);
    }

    /**
     * Load default extractors from `@discord-player/extractor`
     */
    public async loadDefault(filter?: (ext: (typeof knownExtractorKeys)[number]) => boolean | null, options?: ExtractorLoaderOptionDict) {
        const mod = await Util.import(knownExtractorLib);
        if (mod.error) return { success: false, error: mod.error as Error };

        (filter ? knownExtractorKeys.filter(filter) : knownExtractorKeys).forEach((key) => {
            if (!mod.module[key]) return;
            // @ts-ignore types
            this.register(<typeof BaseExtractor>mod.module[key], options?.[key] || {});
        });

        return { success: true, error: null };
    }

    /**
     * Validate if the given extractor is registered
     * @param identifier The extractor identifier
     */
    public isRegistered(identifier: string) {
        return this.store.has(identifier);
    }

    /**
     * The size of registered extractors
     */
    public get size() {
        return this.store.size;
    }

    /**
     * Get single extractor
     * @param identifier The extractor to get
     */
    public get(identifier: string) {
        return this.store.get(identifier);
    }

    /**
     * Register single extractor
     * @param _extractor The extractor to register
     * @param options Options supplied to the extractor
     */
    public async register<O extends object, T extends typeof BaseExtractor<O>>(_extractor: T, options: ConstructorParameters<T>['1']): Promise<InstanceType<T> | null> {
        if (typeof _extractor.identifier !== 'string' || this.store.has(_extractor.identifier)) return null;
        const extractor = new _extractor(this, options);

        // @ts-ignore
        if (this.player.options.bridgeProvider) options.bridgeProvider ??= this.player.options.bridgeProvider;

        try {
            this.store.set(_extractor.identifier, extractor);
            if (this.player.hasDebugger) this.player.debug(`${_extractor.identifier} extractor loaded!`);
            this.emit('registered', this, extractor);
            await extractor.activate();
            if (this.player.hasDebugger) this.player.debug(`${_extractor.identifier} extractor activated!`);
            this.emit('activate', this, extractor);
            return extractor as unknown as InstanceType<T>;
        } catch (e) {
            this.store.delete(_extractor.identifier);
            if (this.player.hasDebugger) this.player.debug(`${_extractor.identifier} extractor failed to activate! Error: ${e}`);
            this.emit('error', this, extractor, e as Error);
            return null;
        }
    }

    /**
     * Unregister single extractor
     * @param _extractor The extractor to unregister
     */
    public async unregister<K extends string | BaseExtractor>(_extractor: K) {
        const extractor = typeof _extractor === 'string' ? this.store.get(_extractor) : this.store.find((r) => r === _extractor);
        if (!extractor) return;

        try {
            const key = extractor.identifier || this.store.findKey((e) => e === extractor)!;
            this.store.delete(key);
            if (this.player.hasDebugger) this.player.debug(`${extractor.identifier} extractor disabled!`);
            this.emit('unregistered', this, extractor);
            await extractor.deactivate();
            if (this.player.hasDebugger) this.player.debug(`${extractor.identifier} extractor deactivated!`);
            this.emit('deactivate', this, extractor);
        } catch (e) {
            if (this.player.hasDebugger) this.player.debug(`${extractor.identifier} extractor failed to deactivate!`);
            this.emit('error', this, extractor, e as Error);
        }
    }

    /**
     * Unregister all extractors
     */
    public async unregisterAll() {
        try {
            await Promise.all(this.store.map((e) => this.unregister(e)));
        } catch {
            // do nothing
        }
    }

    /**
     * Run all the extractors
     * @param fn The runner function
     * @param filterBlocked Filter blocked extractors
     */
    public async run<T = unknown>(fn: ExtractorExecutionFN<T>, filterBlocked = true) {
        const blocked = this.player.options.blockExtractors ?? [];

        if (!this.store.size) {
            Util.warn('Skipping extractors execution since zero extractors were registered', 'NoExtractors');
            return;
        }

        let err: Error | null = null,
            lastExt: BaseExtractor | null = null;

        for (const ext of this.store.values()) {
            if (filterBlocked && blocked.some((e) => e === ext.identifier)) continue;
            if (this.player.hasDebugger) this.player.debug(`Executing extractor ${ext.identifier}...`);
            const result = await fn(ext).then(
                (res) => {
                    return res;
                },
                (e) => {
                    if (this.player.hasDebugger) this.player.debug(`Extractor ${ext.identifier} failed with error: ${e}`);

                    return TypeUtil.isError(e) ? e : new Error(`${e}`);
                }
            );

            lastExt = ext;

            if (result && !TypeUtil.isError(result)) {
                if (this.player.hasDebugger) this.player.debug(`Extractor ${ext.identifier} executed successfully!`);

                return {
                    extractor: ext,
                    error: null,
                    result
                } as ExtractorExecutionResult<T>;
            } else if (TypeUtil.isError(result)) {
                err = result;
            }
        }

        if (err)
            return {
                extractor: lastExt!,
                error: err,
                result: false
            } as ExtractorExecutionResult<false>;
    }
}

export interface ExtractorExecutionResult<T = unknown> {
    extractor: BaseExtractor;
    error: Error | null;
    result: T;
}

export type ExtractorExecutionFN<T = unknown> = (extractor: BaseExtractor) => Promise<T | boolean>;
