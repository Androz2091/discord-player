import { Collection } from '@discordjs/collection';
import type { DiscordPlayer } from '../player.js';
import { GuildQueue, type GuildQueueOptions } from '../structures/guild-queue.js';

/** Guild ID or a structural guild-like object. */
export type GuildQueueResolvable = string | { id: string } | { guildId: string };

/** Cache and lifecycle manager for this Player's GuildQueue instances. */
export class GuildQueueManager {
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

  /**
   * Get a queue by guild ID, returning null when none exists.
   * @param guildId Guild ID used as the queue cache key.
   */
  public get<Metadata = unknown>(guildId: string): GuildQueue<Metadata> | null {
    return (this.cache.get(guildId) as GuildQueue<Metadata> | undefined) ?? null;
  }

  /**
   * Resolve a queue from a string guild ID or structural guild object.
   * @param guild Guild ID or object containing an `id` or `guildId` property.
   */
  public resolve<Metadata = unknown>(guild: GuildQueueResolvable): GuildQueue<Metadata> | null {
    const guildId = typeof guild === 'string' ? guild : 'guildId' in guild ? guild.guildId : guild.id;
    return this.get<Metadata>(guildId);
  }

  /**
   * Check whether a queue exists for a guild ID.
   * @param guildId Guild ID to check.
   */
  public has(guildId: string): boolean {
    return this.cache.has(guildId);
  }

  /**
   * Destroy and remove a queue by guild ID.
   * @param guildId Guild ID of the queue to remove.
   * @returns Whether a cached queue was found and destroyed.
   */
  public async delete(guildId: string): Promise<boolean> {
    const queue = this.cache.get(guildId);
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
    guildId: string,
    options: GuildQueueOptions<Metadata> = {},
  ): Promise<GuildQueue<Metadata>> {
    const existing = this.get<Metadata>(guildId);
    if (existing) return existing;
    const queue = new GuildQueue(this, guildId, options);
    this.cache.set(guildId, queue);
    return queue;
  }

  /** Destroy every currently cached queue. */
  public async clear(): Promise<void> {
    await Promise.all(Array.from(this.cache.values(), (queue) => queue.destroy()));
  }
}
