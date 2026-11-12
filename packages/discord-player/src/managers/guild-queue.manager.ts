import { intercept } from '../plugins/capabilities.js';
import { Collection } from '@discordjs/collection';
import type { DiscordPlayer } from '../player.js';
import { GuildQueue, type GuildQueueOptions } from '../structures/guild-queue.js';

/** Guild ID or a structural guild-like object. */
export type GuildQueueResolvable = string | { id: string } | { guildId: string };

/** Cache and lifecycle manager for this Player's GuildQueue instances. */
export class GuildNodeManager {
  /** Cached queues indexed by guild ID. */
  public readonly cache = new Collection<string, GuildQueue>();

  /**
   * Create a manager owned by one Player.
   * @param player Player that owns the queue manager.
   */
  public constructor(
    /** Player that owns the queue manager. */
    public readonly player: DiscordPlayer,
  ) {}

  /** Normalize a v7-compatible structural queue or guild reference.
   * @param guild Guild ID, guild-like object or queue.
   * @returns Guild identifier.
   */
  public resolveId(guild: GuildQueueResolvable): string {
    return typeof guild === 'string' ? guild : 'guildId' in guild ? guild.guildId : guild.id;
  }

  /**
   * Get a queue by guild ID, returning null when none exists.
   * @param guildId Guild ID used as the queue cache key.
   */
  public get<Metadata = unknown>(guildId: GuildQueueResolvable): GuildQueue<Metadata> | null {
    return (this.cache.get(this.resolveId(guildId)) as GuildQueue<Metadata> | undefined) ?? null;
  }

  /**
   * Resolve a queue from a string guild ID or structural guild object.
   * @param guild Guild ID or object containing an `id` or `guildId` property.
   */
  public resolve<Metadata = unknown>(guild: GuildQueueResolvable): GuildQueue<Metadata> | null {
    return this.get<Metadata>(guild);
  }

  /**
   * Check whether a queue exists for a guild ID.
   * @param guildId Guild ID to check.
   */
  public has(guildId: GuildQueueResolvable): boolean {
    return this.cache.has(this.resolveId(guildId));
  }

  /**
   * Destroy and remove a queue by guild ID.
   * @param guildId Guild ID of the queue to remove.
   * @returns Whether a cached queue was found and destroyed.
   */
  public async delete(guildId: GuildQueueResolvable): Promise<boolean> {
    const queue = this.cache.get(this.resolveId(guildId));

    if (!queue) return false;

    await queue.destroy();

    return true;
  }

  /**
   * Get an existing queue or create and cache a new queue for a guild ID.
   * @param guildId Guild ID used as the queue cache key.
   * @param options Defaults applied only when a new queue is created.
   * @returns The existing or newly created queue.
   */
  public async create<Metadata = unknown>(
    guildId: GuildQueueResolvable,
    options: GuildQueueOptions<Metadata> = {},
  ): Promise<GuildQueue<Metadata>> {
    this.player.plugins.assertNotDispatching();
    await this.player.ready();
    this.player.signal.throwIfAborted();

    const existing = this.get<Metadata>(guildId);

    if (existing) return existing;

    const id = this.resolveId(guildId);
    if (this.player.plugins.hasCapability('queue.beforeCreate')) {
      const decision = intercept(this.player.plugins, 'queue.beforeCreate', {
        guildId: id,
        configuration: Object.freeze({
          volume: options.volume,
          maxSize: options.maxSize,
          maxHistorySize: options.maxHistorySize,
          repeatMode: options.repeatMode,
        }),
      });
      if (!decision.configuration || typeof decision.configuration !== 'object')
        throw new TypeError('Queue creation requires configuration defaults.');
      options = { ...options, ...decision.configuration };
    }
    const queue = new GuildQueue(this, id, options);

    this.cache.set(id, queue);
    try {
      this.player.plugins.executeSync('queue.created', { guildId: id });
    } catch (error) {
      this.player.emit('error', error instanceof Error ? error : new Error(String(error)));
    }

    return queue;
  }

  /** Destroy every currently cached queue. */
  public async clear(): Promise<void> {
    const results = await Promise.allSettled(Array.from(this.cache.values(), (queue) => queue.destroy()));
    const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Guild queue cleanup failed');
  }
}
