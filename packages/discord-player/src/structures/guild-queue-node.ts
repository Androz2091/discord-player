import type { DiscordPlayer } from '../player.js';
import { GuildQueueEvents } from './common/guild-queue-events.js';
import type { GuildQueue } from './guild-queue.js';
import type { AudioStreamInfo, DiscordSession, DiscordSessionOptions, MediaSource, PlayOptions } from '@remedia/client';

export interface GuildQueueNodeSessionCreateOptions extends Omit<DiscordSessionOptions, 'guildId' | 'userId'> {}

export class GuildQueueNode<Metadata = any> {
  /**
   * The DiscordSession associated with this guild queue node, or null if no session is currently active.
   */
  public session: DiscordSession | null = null;
  /**
   * The DiscordPlayer instance associated with this guild queue node, which is derived from the guild queue's manager.
   */
  public readonly player: DiscordPlayer;

  /**
   * Creates a new instance of the GuildQueueNode class, which represents a node associated with a specific guild queue.
   * @param queue The GuildQueue instance that this node is associated with.
   */
  public constructor(public readonly queue: GuildQueue<Metadata>) {
    this.player = queue.manager.player;
  }

  /**
   * Retrieves the current DiscordSession associated with this guild queue node, throwing an error if it is not initialized.
   */
  public getSessionOrThrow<M = unknown>(): DiscordSession<M> {
    if (!this.session) {
      throw new Error('DiscordSession is not initialized. Please call <GuildQueueNode>.createSession() first.');
    }

    return this.session as DiscordSession<M>;
  }

  /**
   * Attaches event listeners to the provided DiscordSession, allowing the guild queue node to respond to playback events such as seeking and pausing.
   * @param session The DiscordSession instance to which event listeners will be attached.
   * @remarks This method is called internally when a new session is created, and it sets up event forwarding to the guild queue's manager.
   */
  private attachSessionListeners(session: DiscordSession): void {
    session.on('playbackSeeked', (event) => {
      this.queue.emit(GuildQueueEvents.PlayerSeek, event);
    });

    session.on('playbackPaused', (event) => {
      this.queue.emit(GuildQueueEvents.PlayerPause, event);
    });

    session.on('playbackStarted', (event) => {
      this.queue.emit(GuildQueueEvents.PlayerStart, event);
    });

    session.on('playbackCompleted', (event) => {
      this.queue.emit(GuildQueueEvents.PlayerFinish, event);
    });

    session.on('playbackFailed', (event) => {
      this.queue.emit(GuildQueueEvents.PlayerError, event);
    });

    session.on('playbackStopped', (event) => {
      this.queue.emit(GuildQueueEvents.PlayerStop, event);
    });
  }

  /**
   * Creates a new DiscordSession for this guild queue node, replacing any existing session if it exists.
   * @param options The options to use when creating the new DiscordSession.
   * @returns The newly created DiscordSession instance.
   */
  public async createSession(options: GuildQueueNodeSessionCreateOptions): Promise<DiscordSession> {
    await this.destroySession();

    const session = this.player.getRemedia().createDiscordSession({
      ...options,
      guildId: this.queue.guildId,
      userId: this.player.getClientId(),
    });

    this.attachSessionListeners(session);

    this.session = session;

    return session;
  }

  /**
   * Destroys the current DiscordSession associated with this guild queue node, if it exists.
   */
  public async destroySession(): Promise<void> {
    const session = this.session;
    if (!session) return;
    await session.disconnect();
    session.removeAllListeners();
    this.session = null;
  }

  /**
   * Sets the volume of this guild queue node's session.
   * @param volumePercentage The volume percentage to set, where 0 is muted and 100 is the maximum volume.
   * @returns The new volume percentage after setting it.
   */
  public async setVolume(volumePercentage: number): Promise<number> {
    await this.getSessionOrThrow().setVolume(volumePercentage / 100);
    return this.volume;
  }

  /**
   * Seeks to a specific position in the currently playing track of this guild queue node.
   * @param positionMs The position in milliseconds to seek to within the track.
   */
  public async seek(positionMs: number): Promise<void> {
    await this.getSessionOrThrow().seek(positionMs);
  }

  /**
   * Pauses playback of the current track in this guild queue node.
   */
  public async pause(): Promise<void> {
    await this.getSessionOrThrow().pause();
  }

  /**
   * Resumes playback of the current track in this guild queue node.
   */
  public async resume(): Promise<void> {
    await this.getSessionOrThrow().resume();
  }

  /**
   * The current volume of this guild queue node, represented as a percentage.
   */
  public get volume(): number {
    return this.getSessionOrThrow().volume * 100;
  }

  /**
   * Plays the given resource in this node's session.
   */
  public async play<M = unknown>(resource: MediaSource, options?: PlayOptions<M>): Promise<AudioStreamInfo> {
    const session = this.getSessionOrThrow<M>();
    const streamInfo = await session.play(resource, options);
    return streamInfo;
  }
}
