import { Player } from '../Player';
import { Collection } from '@discord-player/utils';
import { BaseExtractor } from './BaseExtractor';
import { Util } from '../utils/Util';
import { PlayerEventsEmitter } from '../utils/PlayerEventsEmitter';

// prettier-ignore
const knownExtractorKeys = [
    'SoundCloudExtractor',
    'AppleMusicExtractor',
    'SpotifyExtractor',
    'VimeoExtractor',
    'YouTubeExtractor',
    'ReverbnationExtractor',
    'AttachmentExtractor'
];
const knownExtractorLib = '@discord-player/extractor';

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

    public async loadDefault() {
        const mod = await Util.import(knownExtractorLib);
        if (mod.error) return { success: false, error: mod.error as Error };

        knownExtractorKeys.forEach((key) => {
            if (!mod.module[key]) return;
            this.register(mod.module[key]);
        });

        return { success: true, error: null };
    }

    public isRegistered(identifier: string) {
        return this.store.has(identifier);
    }

    public get size() {
        return this.store.size;
    }

    public get(identifier: string) {
        return this.store.get(identifier);
    }

    public async register(_extractor: typeof BaseExtractor) {
        if (typeof _extractor.identifier !== 'string' || this.store.has(_extractor.identifier)) return;
        const extractor = new _extractor(this);

        try {
            this.store.set(_extractor.identifier, extractor);
            this.player.debug(`${_extractor.identifier} extractor loaded!`);
            this.emit('registered', this, extractor);
            await extractor.activate();
            this.player.debug(`${_extractor.identifier} extractor activated!`);
            this.emit('activate', this, extractor);
        } catch (e) {
            this.store.delete(_extractor.identifier);
            this.player.debug(`${_extractor.identifier} extractor failed to activate! Error: ${e}`);
            this.emit('error', this, extractor, e as Error);
        }
    }

    public async unregister<K extends string | BaseExtractor>(_extractor: K) {
        const extractor = typeof _extractor === 'string' ? this.store.get(_extractor) : this.store.find((r) => r === _extractor);
        if (!extractor) return;

        try {
            const key = extractor.identifier || this.store.findKey((e) => e === extractor)!;
            this.store.delete(key);
            this.player.debug(`${extractor.identifier} extractor disabled!`);
            this.emit('unregistered', this, extractor);
            await extractor.deactivate();
            this.player.debug(`${extractor.identifier} extractor deactivated!`);
            this.emit('deactivate', this, extractor);
        } catch (e) {
            this.player.debug(`${extractor.identifier} extractor failed to deactivate!`);
            this.emit('error', this, extractor, e as Error);
        }
    }

    public async unregisterAll() {
        try {
            await Promise.all(this.store.map((e) => this.unregister(e)));
        } catch {
            // do nothing
        }
    }

    public async run<T = unknown>(fn: ExtractorExecutionFN<T>, filterBlocked = true) {
        const blocked = this.player.options.blockExtractors ?? [];
        for (const ext of this.store.values()) {
            if (filterBlocked && blocked.some((e) => e === ext.identifier)) continue;
            const result = await fn(ext).catch(() => {
                return false;
            });
            if (result)
                return {
                    extractor: ext,
                    result
                } as ExtractorExecutionResult<T>;
        }

        return null;
    }
}

export interface ExtractorExecutionResult<T = unknown> {
    extractor: BaseExtractor;
    result: T;
}
export type ExtractorExecutionFN<T = unknown> = (extractor: BaseExtractor) => Promise<T | boolean>;
