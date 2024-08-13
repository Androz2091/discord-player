import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';
import { Collection, QueueStrategy } from '@discord-player/utils';
import { Snowflake } from 'discord-api-types/globals';
import { Exceptions } from '../errors';
import { Player } from '../Player';
import { FiltersName, QueueRepeatMode } from '../types/types';
import { getGlobalRegistry } from '../utils/__internal__';
import { GuildQueue, OnAfterCreateStreamHandler, OnBeforeCreateStreamHandler } from './GuildQueue';

export interface GuildNodeCreateOptions<T = unknown> {
    strategy?: QueueStrategy;
    volume?: number;
    equalizer?: EqualizerBand[];
    a_filter?: PCMFilters[];
    biquad?: BiquadFilters;
    resampler?: number;
    disableHistory?: boolean;
    onBeforeCreateStream?: OnBeforeCreateStreamHandler;
    onAfterCreateStream?: OnAfterCreateStreamHandler;
    repeatMode?: QueueRepeatMode;
    pauseOnEmpty?: boolean;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    leaveOnEnd?: boolean;
    leaveOnEndCooldown?: number;
    leaveOnStop?: boolean;
    leaveOnStopCooldown?: number;
    metadata?: T | null;
    selfDeaf?: boolean;
    connectionTimeout?: number;
    defaultFFmpegFilters?: FiltersName[];
    bufferingTimeout?: number;
    noEmitInsert?: boolean;
    maxSize?: number;
    maxHistorySize?: number;
    preferBridgedMetadata?: boolean;
    disableVolume?: boolean;
    disableEqualizer?: boolean;
    disableFilterer?: boolean;
    disableBiquad?: boolean;
    disableResampler?: boolean;
}

export type NodeResolvable = Snowflake;

export class GuildNodeManager<Meta = unknown> {
    public cache = new Collection<string, GuildQueue>();
    public constructor(public player: Player) { }

    /**
     * Create guild queue if it does not exist
     * @param guild The guild which will be the owner of the queue
     * @param options Queue initializer options
     */
    public create<T = Meta>(guildId: Snowflake, options: GuildNodeCreateOptions<T> = {}): GuildQueue<T> {
        const guild = this.player.clientAdapter.getGuild(guildId);
        if (!guild) {
            throw Exceptions.ERR_NO_GUILD('Invalid or unknown guild');
        }

        if (this.cache.has(guild.id)) {
            return this.cache.get(guild.id) as GuildQueue<T>;
        }

        options.strategy ??= 'FIFO';
        options.volume ??= 100;
        options.equalizer ??= [];
        options.a_filter ??= [];
        options.disableHistory ??= false;
        options.leaveOnEmpty ??= true;
        options.leaveOnEmptyCooldown ??= 0;
        options.leaveOnEnd ??= true;
        options.leaveOnEndCooldown ??= 0;
        options.leaveOnStop ??= true;
        options.leaveOnStopCooldown ??= 0;
        options.resampler ??= 48000;
        options.selfDeaf ??= true;
        options.connectionTimeout ??= this.player.options.connectionTimeout;
        options.bufferingTimeout ??= 1000;
        options.maxSize ??= Infinity;
        options.maxHistorySize ??= Infinity;
        options.preferBridgedMetadata ??= true;
        options.pauseOnEmpty ??= true;
        // todo(twlite): maybe disable these by default?
        options.disableBiquad ??= false;
        options.disableEqualizer ??= false;
        options.disableFilterer ??= false;
        options.disableVolume ??= false;
        options.disableResampler ??= true;

        if (getGlobalRegistry().has('@[onBeforeCreateStream]') && !options.onBeforeCreateStream) {
            options.onBeforeCreateStream = getGlobalRegistry().get('@[onBeforeCreateStream]') as OnBeforeCreateStreamHandler;
        }

        if (getGlobalRegistry().has('@[onAfterCreateStream]') && !options.onAfterCreateStream) {
            options.onAfterCreateStream = getGlobalRegistry().get('@[onAfterCreateStream]') as OnAfterCreateStreamHandler;
        }

        const queue = new GuildQueue<T>(this.player, {
            guild: guild,
            queueStrategy: options.strategy,
            volume: options.volume,
            equalizer: options.equalizer,
            filterer: options.a_filter,
            biquad: options.biquad,
            resampler: options.resampler,
            disableHistory: options.disableHistory,
            onBeforeCreateStream: options.onBeforeCreateStream,
            onAfterCreateStream: options.onAfterCreateStream,
            repeatMode: options.repeatMode,
            leaveOnEmpty: options.leaveOnEmpty,
            leaveOnEmptyCooldown: options.leaveOnEmptyCooldown,
            leaveOnEnd: options.leaveOnEnd,
            leaveOnEndCooldown: options.leaveOnEndCooldown,
            leaveOnStop: options.leaveOnStop,
            leaveOnStopCooldown: options.leaveOnStopCooldown,
            metadata: options.metadata,
            connectionTimeout: options.connectionTimeout ?? 120_000,
            selfDeaf: options.selfDeaf,
            ffmpegFilters: options.defaultFFmpegFilters ?? [],
            bufferingTimeout: options.bufferingTimeout,
            noEmitInsert: options.noEmitInsert ?? false,
            preferBridgedMetadata: options.preferBridgedMetadata,
            maxHistorySize: options.maxHistorySize,
            maxSize: options.maxSize,
            pauseOnEmpty: options.pauseOnEmpty,
            disableBiquad: options.disableBiquad,
            disableEqualizer: options.disableEqualizer,
            disableFilterer: options.disableFilterer,
            disableResampler: options.disableResampler,
            disableVolume: options.disableVolume
        });

        this.cache.set(guild.id, queue);

        return queue;
    }

    /**
     * Get existing queue
     * @param node Queue resolvable
     */
    public get<T = Meta>(node: NodeResolvable) {
        const queue = this.resolve(node);
        if (!queue) return null;

        return (this.cache.get(node) as GuildQueue<T>) || null;
    }

    /**
     * Check if a queue exists
     * @param node Queue resolvable
     */
    public has(node: NodeResolvable) {
        return this.cache.has(node);
    }

    /**
     * Delete queue
     * @param node Queue resolvable
     */
    public delete(node: NodeResolvable) {
        const queue = this.resolve(node);
        if (!queue) {
            throw Exceptions.ERR_NO_GUILD_QUEUE('Cannot delete non-existing queue');
        }

        queue.setTransitioning(true);
        queue.node.stop(true);
        //queue.connection?.removeAllListeners();
        queue.dispatcher?.removeAllListeners();
        queue.dispatcher?.disconnect();
        queue.timeouts.forEach((tm) => clearTimeout(tm));
        queue.history.clear();
        queue.tracks.clear();

        return this.cache.delete(queue.id);
    }

    /**
     * Resolve queue
     * @param node Queue resolvable
     */
    public resolve<T = Meta>(node: NodeResolvable) {
        return this.cache.get(node) as GuildQueue<T> | undefined;
    }

    /**
     * Resolve queue id
     * @param node Queue resolvable
     */
    public resolveId(node: NodeResolvable) {
        const q = this.resolve(node);
        return q?.id || null;
    }
}
