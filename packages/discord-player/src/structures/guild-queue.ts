import type { GuildQueueManager } from '../managers/guild-queue.manager.js';
import type { DiscordSession, NodeSelection } from '@remedia/client';
import { GuildQueueTracksManager } from '../managers/guild-queue-track.manager.js';
import { GuildQueueNode, type GuildQueueEventsMap, type GuildQueueNodeSessionCreateOptions } from '../index.js';
import { GuildQueueHistoryManager } from '../managers/guild-queue-history.manager.js';

export interface GuildQueueOptions<Metadata = any> {
  /**
   * The node selection strategy to use for this guild queue.
   */
  selectNode?: NodeSelection;
  /**
   * The arbitrary metadata associated with this guild queue.
   */
  metadata: Metadata;
  /**
   * The maximum number of tracks to keep in the history stack for this guild queue.
   * If not specified, defaults to 50.
   */
  maxHistorySize?: number;
}

type OmitFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

export class GuildQueue<Metadata = any> {
  /**
   * The tracks manager for this guild queue.
   */
  public tracks: GuildQueueTracksManager;

  /**
   * The node manager for this guild queue, responsible for handling node selection and session management.
   */
  public node: GuildQueueNode;

  /**
   * The history manager for this guild queue, responsible for managing the history of played tracks.
   */
  public history: GuildQueueHistoryManager;

  /**
   * Creates a new instance of the GuildQueue class, which represents a queue for a specific guild.
   * @param manager The GuildQueueManager instance that manages this guild queue.
   * @param guildId The ID of the guild for which this queue is created.
   * @param options The options to configure the guild queue, including node selection strategy and arbitrary metadata.
   */
  public constructor(
    public readonly manager: GuildQueueManager,
    public readonly guildId: string,
    public readonly options: GuildQueueOptions<Metadata>,
  ) {
    this.tracks = new GuildQueueTracksManager<Metadata>(this);
    this.node = new GuildQueueNode(this);
    this.history = new GuildQueueHistoryManager(this);
  }

  /**
   * Emits the given event into this guild queue's events channel.
   * @param event The event name to emit.
   * @param args The arguments to pass along with the event.
   */
  public emit<K extends keyof GuildQueueEventsMap>(event: K, ...args: OmitFirst<GuildQueueEventsMap[K]>): boolean {
    return this.manager.player.events.emit.apply(this.manager.player.events, [event, this, ...args]);
  }

  /**
   * The arbitrary metadata associated with this guild queue.
   */
  public get metadata(): Metadata {
    return this.options.metadata;
  }

  /**
   * Casts the current GuildQueue instance to a GuildQueue with a different metadata type.
   * @returns The current GuildQueue instance casted to a GuildQueue with the specified metadata type.
   */
  public asMetadata<M>(): GuildQueue<M> {
    return this as unknown as GuildQueue<M>;
  }

  /**
   * Sets the arbitrary metadata associated with this guild queue.
   * @param value The new metadata value to set.
   */
  public set metadata(value: Metadata) {
    this.options.metadata = value;
  }

  /**
   * Connects the guild queue to a voice channel by creating a new DiscordSession for the associated guild queue node.
   * @param options The options to use when creating the new DiscordSession.
   * @returns The newly created DiscordSession instance.
   */
  public async connect(options: GuildQueueNodeSessionCreateOptions): Promise<DiscordSession> {
    const session = await this.node.createSession(options);
    await session.connect();
    return session;
  }

  /**
   * Destroys the guild queue, performing any necessary cleanup and resource deallocation.
   * This method should be called when the guild queue is no longer needed.
   */
  public async destroy(): Promise<void> {
    await this.node.destroySession();
    this.manager.cache.delete(this.guildId);
  }
}
