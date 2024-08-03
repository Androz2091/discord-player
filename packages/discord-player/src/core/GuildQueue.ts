import { ClientMessage, WsIncomingCodes } from '@discord-player/server';
import { unsafe } from '../common/types';
import { Player } from '../Player';
import { ArrayListLimitOptions } from '../structures/ArrayList';
import { Queue } from '../structures/Queue';
import { Stack } from '../structures/Stack';
import type { Plugin } from './Plugin';
import { AnyWorkerPayload, WorkerOp, VoiceConnectionCreateOptions } from '@discord-player/core';
import { PlayerNode } from '@discord-player/client';

export interface ConnectOptions extends Omit<VoiceConnectionCreateOptions, 'guildId' | 'clientId'> {}

export interface GuildQueueAudioEffects {
    /**
     * The audio volume for this queue.
     */
    volume: number;
}

export interface GuildQueuePluginConfiguration {
    /**
     * The plugins allowed to be used in this queue.
     */
    allowed: string[];
    /**
     * The plugins disallowed to be used in this queue.
     */
    disallowed: string[];
    /**
     * Whether to expose the queue to the plugins.
     */
    exposeQueue: boolean;
    /**
     * Validate the given plugin to either allow or disallow it. This method is an alternative to the `allowed` and `disallowed` arrays.
     * If the plugin is not specified in the `allowed` or `disallowed` arrays, this method will be called.
     * @param plugin The plugin to validate
     */
    validate(plugin: Plugin): Promise<boolean>;
}

export interface GuildQueueOptions {
    /**
     * The guild ID.
     */
    guild: string;

    /**
     * The metadata of the queue.
     */
    metadata: unsafe;

    /**
     * The default audio effects of the queue.
     */
    effects: GuildQueueAudioEffects;

    /**
     * The history options.
     */
    history: Omit<ArrayListLimitOptions, 'name'>;

    /**
     * The queue options.
     */
    queue: Omit<ArrayListLimitOptions, 'name'>;

    /**
     * The plugins configuration for this queue.
     */
    plugins: GuildQueuePluginConfiguration;
}

export class GuildQueue {
    /**
     * The queue of tracks associated with this guild.
     */
    public readonly tracks: Queue<unsafe>;

    /**
     * The history of previous tracks associated with this guild.
     */
    public readonly history: Stack<unsafe>;

    /**
     * The associated node of this queue
     */
    public node: PlayerNode | null = null;

    /**
     * Creates a new guild queue.
     * @param player The player to create the queue for
     * @param options The options to use
     */
    public constructor(public readonly player: Player, private readonly options: GuildQueueOptions) {
        if (!this.options.guild) {
            throw new Error('Expected key "GuildQueueOptions.guild" to be a string.');
        }

        this.tracks = new Queue({
            name: 'TracksQueue',
            maxSize: this.options.queue.maxSize,
            throwOnFull: this.options.queue.throwOnFull,
        });

        this.history = new Stack({
            name: 'QueueHistory',
            maxSize: this.options.history.maxSize,
            throwOnFull: this.options.history.throwOnFull,
        });
    }

    /**
     * Send a message to the associated node
     * @param data The message payload
     */
    public send(data: AnyWorkerPayload) {
        if (!this.node) {
            const node = this.player.nodes.getOptimalNode();

            if (!node) throw new Error('Could not find a player node.');

            this.node = node;
        }

        const request: ClientMessage<unsafe> = {
            op: WsIncomingCodes.Request,
            d: data,
        };

        return this.node.connector.send(request);
    }

    /**
     * Connect to a voice channel
     * @param options The connection options
     */
    public connect(options: ConnectOptions) {
        const guild = this.options.guild;
        const adapter = this.player.adapter;
        const channel = adapter.resolveChannel(options.channelId);

        if (!adapter.isVoiceChannel(guild, channel) && !adapter.isStageChannel(guild, channel)) {
            throw new TypeError('Expected voice based channel');
        }

        return this.send({
            metadata: {
                channelId: channel,
                guildId: guild,
                clientId: channel,
            },
            payload: {
                op: WorkerOp.OP_JOIN_VOICE_CHANNEL,
                d: {
                    ...options,
                    channelId: channel,
                    guildId: guild,
                    clientId: adapter.getClientId(),
                } satisfies VoiceConnectionCreateOptions,
            },
        });
    }

    public get id() {
        return this.options.guild;
    }
}
