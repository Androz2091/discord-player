import type { DiscordPlayer } from '../player.js';
import { GuildQueueEvents } from './common/guild-queue-events.js';
import type { GuildQueue } from './guild-queue.js';
import type { AudioStreamInfo, DiscordSession, DiscordSessionOptions, MediaSource, PlayOptions } from '@remedia/client';
import type { Track } from './track.js';

export interface GuildQueuePlayerNodeSessionCreateOptions extends Omit<DiscordSessionOptions, 'guildId' | 'userId'> {}

export interface PlayRawResult<M = unknown> {
  /** The audio stream information returned by the session after playing the resource. */
  audioStream: AudioStreamInfo;
  /** The DiscordSession instance used to play the resource. */
  session: DiscordSession<M>;
}

export interface GuildQueuePlayerNodePlayResult<M = unknown> extends PlayRawResult<M> {
  /** The track that was played. */
  track: Track;
}

export class GuildQueuePlayerNode<Metadata = any> {
  /**
   * The DiscordSession associated with this guild queue node, or null if no session is currently active.
   */
  public session: DiscordSession | null = null;
  /**
   * The DiscordPlayer instance associated with this guild queue node, which is derived from the guild queue's manager.
   */
  public readonly player: DiscordPlayer;

  /**
   * Creates a new instance of the GuildQueuePlayerNode class, which represents a node associated with a specific guild queue.
   * @param queue The GuildQueue instance that this node is associated with.
   */
  public constructor(public readonly queue: GuildQueue<Metadata>) {
    this.player = queue.manager.player;
  }

  /**
   * Retrieves the current DiscordSession associated with this guild queue node, throwing an error if it is not initialized.
   */
  public getSession<M = unknown>(): DiscordSession<M>;
  public getSession<M = unknown>(throwOnMissingSession: false): DiscordSession<M> | null;
  public getSession<M = unknown>(throwOnMissingSession: boolean = true): DiscordSession<M> | null {
    if (!this.session && throwOnMissingSession) {
      throw new Error('DiscordSession is not initialized. Please call <GuildQueuePlayerNode>.createSession() first.');
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
  public async createSession(options: GuildQueuePlayerNodeSessionCreateOptions): Promise<DiscordSession> {
    using _lock = await this.queue.tasks.acquire('queue.node.create-session');
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
    using _lock = await this.queue.tasks.acquire('queue.node.destroy-session');
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
    using _lock = await this.queue.tasks.acquire('queue.node.set-volume');
    await this.getSession().setVolume(volumePercentage / 100);
    return this.volume;
  }

  /**
   * Seeks to a specific position in the currently playing track of this guild queue node.
   * @param positionMs The position in milliseconds to seek to within the track.
   */
  public async seek(positionMs: number): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.seek');
    await this.getSession().seek(positionMs);
  }

  /**
   * Pauses playback of the current track in this guild queue node.
   */
  public async pause(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.pause');
    await this.getSession().pause();
  }

  /**
   * Resumes playback of the current track in this guild queue node.
   */
  public async resume(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.resume');
    await this.getSession().resume();
  }

  public async skip(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.skip');
    await this.getSession().stop();
  }

  /**
   * The current volume of this guild queue node, represented as a percentage.
   */
  public get volume(): number {
    return this.getSession().volume * 100;
  }

  /**
   * Whether this guild queue node is currently playing a track (i.e. player is actively dispatching audio).
   * Returns `true` if playing, `false` if paused or in other non-playing states.
   */
  public isPlaying() {
    const session = this.getSession(false);
    if (!session) return false;
    return session.state === 'playing';
  }

  /**
   * Plays the given raw remedia resource in this node's session.
   */
  public async playRaw<M = unknown>(resource: MediaSource, options?: PlayOptions<M>): Promise<PlayRawResult<M>> {
    using _lock = await this.queue.tasks.acquire('queue.node.play-raw');
    const session = this.getSession<M>();
    if (('stream' in resource || 'buffer' in resource) && this.getSession().nodeType !== 'embedded') {
      const maybeEmbeddedNode = this.player.getRemedia().nodes.find((node) => node.type === 'embedded');

      if (!maybeEmbeddedNode) {
        throw new Error('Playing raw Stream or Buffer is only supported on embedded nodes.');
      }

      const newSession = await this.createSession({
        nodeId: maybeEmbeddedNode.id,
        channelId: session.channelId,
      });

      await newSession.connect();
    }

    const streamInfo = await session.play(resource, options);

    return {
      audioStream: streamInfo,
      session,
    };
  }

  /**
   * Plays the given Discord Player track in this node's session.
   */
  public async play<M = unknown>(
    track: Track | null | undefined,
    options?: PlayOptions<M>,
  ): Promise<GuildQueuePlayerNodePlayResult<M> | null> {
    using _lock = await this.queue.tasks.acquire('queue.node.play');
    track ||= this.queue.tracks.dequeue();

    if (!track) {
      const error = new Error(
        '<GuildQueuePlayerNode>.play() was called but track was not provided and the GuildQueue has no tracks to dispatch.',
      );
      const success = this.queue.emit(GuildQueueEvents.Error, error);
      if (!success) {
        // No handlers exist for `player.events.on(GuildQueueEvents.Error)`
        throw error;
      }

      return null;
    }

    const resource = await track.getStreamableSource();

    if (!resource) {
      throw new Error(
        'Track.getStreamableSource() returned null or undefined. This indicates that the track could not be converted into a playable media source.',
      );
    }

    const result = await this.playRaw(resource, options);

    return {
      track,
      audioStream: result.audioStream,
      session: result.session,
    };
  }
}
