import { Collection } from '@discord-player/utils';
import type { Player } from '../../Player';
import { GuildQueue, GuildQueueAudioEffects, type GuildQueueOptions } from '../GuildQueue';
import type { DeepPartial } from '../../common/types';

export class GuildQueueManager {
    /**
     * The store of guild queues.
     */
    public store: Collection<string, GuildQueue> = new Collection();

    /**
     * Creates a new guild queue manager.
     * @param player The player to create the manager for
     */
    public constructor(public readonly player: Player) {}

    /**
     * Creates a new guild queue.
     * @param guild The guild to create the queue for
     */
    public create(guild: string, options: DeepPartial<Omit<GuildQueueOptions, 'guild'>>) {
        const effects: GuildQueueAudioEffects = {
            volume: options.effects?.volume ?? 50,
        };

        const queue = new GuildQueue(this.player, {
            guild,
            metadata: options.metadata,
            effects,
            history: {
                maxSize: options.history?.maxSize ?? 0,
                throwOnFull: options.history?.throwOnFull ?? false,
            },
            queue: {
                maxSize: options.queue?.maxSize ?? 0,
                throwOnFull: options.queue?.throwOnFull ?? false,
            },
            plugins: {
                allowed: options.plugins?.allowed ?? [],
                disallowed: options.plugins?.disallowed ?? [],
                exposeQueue: options.plugins?.exposeQueue ?? false,
                validate:
                    options.plugins?.validate ??
                    (() => {
                        return Promise.resolve(true);
                    }),
            },
        });

        this.store.set(guild, queue);

        return queue;
    }

    /**
     * Deletes the given guild queue.
     * @param guild The guild of the queue to delete
     */
    public delete(guild: string) {
        const queue = this.store.get(guild);

        if (!queue) return;

        this.store.delete(guild);
    }
}
