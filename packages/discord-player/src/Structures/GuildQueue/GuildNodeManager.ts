import { EqualizerBand, PCMFilters, BiquadFilters } from '@discord-player/equalizer';
import { Collection, QueueStrategy } from '@discord-player/utils';
import { GuildResolvable } from 'discord.js';
import { Player } from '../../Player';
import { GuildQueue, OnBeforeCreateStreamHandler } from './GuildQueue';
import { QueueRepeatMode } from '../../types/types';

export interface GuildNodeCreateOptions {
    strategy?: QueueStrategy;
    volume?: number | boolean;
    equalizer?: EqualizerBand[] | boolean;
    a_filter?: PCMFilters[] | boolean;
    biquad?: BiquadFilters | boolean;
    disableHistory?: boolean;
    skipOnNoStream?: boolean;
    onBeforeCreateStream?: OnBeforeCreateStreamHandler;
    repeatMode?: QueueRepeatMode;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    leaveOnEnd?: boolean;
    leaveOnEndCooldown?: number;
    leaveOnStop?: boolean;
    leaveOnStopCooldown?: number;
}

export type NodeResolvable = GuildQueue | GuildResolvable;

export class GuildNodeManager {
    public cache = new Collection<string, GuildQueue>();
    public constructor(public player: Player) {}

    public create(guild: GuildResolvable, options: GuildNodeCreateOptions = {}) {
        const server = this.player.client.guilds.resolve(guild);
        if (!server) {
            throw new Error('Invalid or unknown guild');
        }

        if (this.cache.has(server.id)) {
            return this.cache.get(server.id)!;
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

        const queue = new GuildQueue(this.player, {
            guild: server,
            queueStrategy: options.strategy,
            volume: options.volume,
            equalizer: options.equalizer,
            filterer: options.a_filter,
            biquad: options.biquad,
            disableHistory: options.disableHistory,
            skipOnNoStream: options.skipOnNoStream,
            onBeforeCreateStream: options.onBeforeCreateStream,
            repeatMode: options.repeatMode,
            leaveOnEmpty: options.leaveOnEmpty,
            leaveOnEmptyCooldown: options.leaveOnEmptyCooldown,
            leaveOnEnd: options.leaveOnEnd,
            leaveOnEndCooldown: options.leaveOnEndCooldown,
            leaveOnStop: options.leaveOnStop,
            leaveOnStopCooldown: options.leaveOnStopCooldown
        });

        this.cache.set(server.id, queue);

        return queue;
    }

    public get(node: NodeResolvable) {
        const queue = this.resolve(node);
        if (!queue) return null;

        return this.cache.get(queue.id) || null;
    }

    public delete(node: NodeResolvable) {
        const queue = this.resolve(node);
        if (!queue) throw new Error('Cannot delete non-existing queue');

        queue.node.stop(true);

        return this.cache.delete(queue.id);
    }

    public resolve(node: NodeResolvable) {
        if (node instanceof GuildQueue) {
            return node;
        }

        return this.cache.get(this.player.client.guilds.resolveId(node)!);
    }

    public resolveId(node: NodeResolvable) {
        const q = this.resolve(node);
        return q?.id || null;
    }
}
