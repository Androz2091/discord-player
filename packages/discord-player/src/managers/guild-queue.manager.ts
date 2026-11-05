import { Collection } from '@discordjs/collection';
import { GuildQueue, type GuildQueueOptions } from '../structures/guild-queue.js';
import type { DiscordPlayer } from '../player.js';

export class GuildQueueManager {
  /**
   * Collection of guild queues managed by this guild queue manager.
   */
  public cache: Collection<string, GuildQueue> = new Collection();

  /**
   * Creates a new instance of the GuildQueueManager class.
   * @param player The DiscordPlayer instance this guild queue manager is associated with.
   */
  public constructor(public readonly player: DiscordPlayer) {}

  /**
   * Retrieves the guild queue for the specified guild ID from the cache.
   * @param guildId The ID of the guild for which to retrieve the queue.
   * @returns The GuildQueue instance for the specified guild ID, or undefined if no queue exists.
   */
  public get<Metadata = any>(guildId: string): GuildQueue<Metadata> | null {
    return (this.cache.get(guildId) as GuildQueue<Metadata> | null) ?? null;
  }

  /**
   * Checks if a guild queue exists for the specified guild ID in the cache.
   * @param guildId The ID of the guild to check for an existing queue.
   * @returns True if a guild queue exists for the specified guild ID, false otherwise.
   */
  public has(guildId: string): boolean {
    return this.cache.has(guildId);
  }

  /**
   * Deletes the guild queue for the specified guild ID from the cache.
   * @param guildId The ID of the guild for which to delete the queue.
   * @returns True if the guild queue was successfully deleted, false if no queue existed for the specified guild ID.
   */
  public async delete(guildId: string): Promise<boolean> {
    const maybeQueue = this.cache.get(guildId);
    if (!maybeQueue) return false;
    await maybeQueue.destroy();
    return true;
  }

  /**
   * Creates a new guild queue for the specified guild ID and adds it to the cache.
   * @param guildId The ID of the guild for which to create a new queue.
   * @param options The options to use when creating the new guild queue.
   * @returns The newly created GuildQueue instance.
   */
  public async create<Metadata = any>(
    guildId: string,
    options: GuildQueueOptions<Metadata>,
  ): Promise<GuildQueue<Metadata>> {
    const maybeQueue = this.cache.get(guildId);
    if (maybeQueue) return maybeQueue as GuildQueue<Metadata>;

    const queue = new GuildQueue(this, guildId, options);
    this.cache.set(guildId, queue);
    return queue;
  }
}
