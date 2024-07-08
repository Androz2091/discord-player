import { unsafe } from '../common/types';
import { Player } from '../Player';
import { ArrayListLimitOptions } from '../structures/ArrayList';
import { Queue } from '../structures/Queue';
import { Stack } from '../structures/Stack';
import type { Plugin } from './Plugin';

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

    public get id() {
        return this.options.guild;
    }
}
