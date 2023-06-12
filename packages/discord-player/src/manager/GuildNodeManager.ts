import { EqualizerBand, PCMFilters, BiquadFilters } from '@discord-player/equalizer';
import { Collection, QueueStrategy } from '@discord-player/utils';
import { GuildResolvable } from 'discord.js';
import { Player } from '../Player';
import { GuildQueue, OnAfterCreateStreamHandler, OnBeforeCreateStreamHandler } from './GuildQueue';
import { FiltersName, QueueRepeatMode } from '../types/types';
import { getGlobalRegistry } from '../utils/__internal__';
import { Exceptions } from '../errors';

export interface GuildNodeCreateOptions<T = unknown> {
    strategy?: QueueStrategy;
    volume?: number | boolean;
    equalizer?: EqualizerBand[] | boolean;
    a_filter?: PCMFilters[] | boolean;
    biquad?: BiquadFilters | boolean;
    resampler?: number | boolean;
    disableHistory?: boolean;
    skipOnNoStream?: boolean;
    onBeforeCreateStream?: OnBeforeCreateStreamHandler;
    onAfterCreateStream?: OnAfterCreateStreamHandler;
    repeatMode?: QueueRepeatMode;
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
    preferBridgedMetadata?: boolean;
}

export type NodeResolvable = GuildQueue | GuildResolvable;

export class GuildNodeManager<Meta = unknown> {
    public cache = new Collection<string, GuildQueue>();
    public constructor(public player: Player) {}

    /**
     * Create guild queue if it does not exist
     * @param guild The guild which will be the owner of the queue
     * @param options Queue initializer options
     */
    public create<T = Meta>(guild: GuildResolvable, options: GuildNodeCreateOptions<T> = {}): GuildQueue<T> {
        const server = this.player.client.guilds.resolve(guild);
        if (!server) {
            throw Exceptions.ERR_NO_GUILD('Invalid or unknown guild');
        }

        if (this.cache.has(server.id)) {
            return this.cache.get(server.id) as GuildQueue<T>;
        }

        options.strategy ??= 'FIFO';
        options.volume ??= 100;
        options.equalizer ??= [];
        options.a_filter ??= [];
        options.disableHistory ??= false;
        options.skipOnNoStream ??= false;
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
        options.preferBridgedMetadata = Boolean(options.preferBridgedMetadata);

        if (getGlobalRegistry().has('@[onBeforeCreateStream]') && !options.onBeforeCreateStream) {
            options.onBeforeCreateStream = getGlobalRegistry().get('@[onBeforeCreateStream]') as OnBeforeCreateStreamHandler;
        }

        if (getGlobalRegistry().has('@[onAfterCreateStream]') && !options.onAfterCreateStream) {
            options.onAfterCreateStream = getGlobalRegistry().get('@[onAfterCreateStream]') as OnAfterCreateStreamHandler;
        }

        const queue = new GuildQueue<T>(this.player, {
            guild: server,
            queueStrategy: options.strategy,
            volume: options.volume,
            equalizer: options.equalizer,
            filterer: options.a_filter,
            biquad: options.biquad,
            resampler: options.resampler,
            disableHistory: options.disableHistory,
            skipOnNoStream: options.skipOnNoStream,
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
            preferBridgedMetadata: options.preferBridgedMetadata
        });

        this.cache.set(server.id, queue);

        return queue;
    }

    /**
     * Get existing queue
     * @param node Queue resolvable
     */
    public get<T = Meta>(node: NodeResolvable) {
        const queue = this.resolve(node);
        if (!queue) return null;

        return (this.cache.get(queue.id) as GuildQueue<T>) || null;
    }

    /**
     * Check if a queue exists
     * @param node Queue resolvable
     */
    public has(node: NodeResolvable) {
        const id = node instanceof GuildQueue ? node.id : this.player.client.guilds.resolveId(node)!;
        return this.cache.has(id);
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

        queue.node.stop(true);
        queue.connection?.removeAllListeners();
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
        if (node instanceof GuildQueue) {
            return node;
        }

        return this.cache.get(this.player.client.guilds.resolveId(node)!) as GuildQueue<T> | undefined;
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
