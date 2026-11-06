import { GuildQueuePlayerAudioFilters } from './guild-queue-player-audio-filters.js';
import type { AudioStreamInfo, DiscordSession, DiscordSessionOptions, MediaSource, PlayOptions } from '@remedia/client';
import type { DiscordPlayer } from '../player.js';
import type { GuildQueue } from './guild-queue.js';
import type { Track } from './track.js';

/**
 * Remedia session configuration supplied when a queue node creates or connects its raw session.
 * `volume` is Remedia's linear gain, from 0 through 2; queue APIs accept percentages instead.
 */
export interface GuildQueuePlayerNodeSessionCreateOptions extends Omit<DiscordSessionOptions, 'guildId' | 'userId'> {}

/** Formatting options for a text progress bar. */
export interface PlayerProgressbarOptions {
  /** Whether to include current and total time labels around the bar. */
  timecodes?: boolean;
  /** Number of cells in the bar, excluding the indicator. */
  length?: number;
  /** Character repeated before the indicator. */
  leftChar?: string;
  /** Character repeated after the indicator. */
  rightChar?: string;
  /** Text placed between time labels and the bar. */
  separator?: string;
  /** Marker placed at the current progress position. */
  indicator?: string;
}

/** Current and total playback time with a percentage progress value. */
export interface PlayerTimestamp {
  /** Current playback position and its formatted label. */
  current: { label: string; value: number };
  /** Total duration and its formatted label. */
  total: { label: string; value: number };
  /** Playback progress from zero through one hundred. */
  progress: number;
}

/** Result returned by raw Remedia playback. */
export interface PlayRawResult<Metadata = unknown> {
  /** Audio stream information reported by Remedia. */
  audioStream: AudioStreamInfo;
  /** Remedia session that owns the playback generation. */
  session: DiscordSession<Metadata>;
}

/** Raw playback result with an optional application Track association. */
export type GuildQueuePlayerNodePlayResult<Metadata = unknown> = PlayRawResult<Metadata> & { track?: Track };

function timecode(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Raw Remedia player controls for one guild queue. It never schedules queue tracks. */
export class GuildQueuePlayerNode<Metadata = unknown> {
  /** Current Remedia session, or `null` before connecting. */
  public session: DiscordSession | null = null;
  /** Parent Player that owns Remedia and gateway orchestration. */
  public readonly player: DiscordPlayer;
  /** Queue-owned named presets and raw filtergraph controls, available before connection. */
  public readonly filters: GuildQueuePlayerAudioFilters<Metadata>;
  #volume = 100;

  /**
   * Create raw playback controls for a guild queue.
   * @param queue Guild queue that owns this node.
   */
  public constructor(
    /** Guild queue that owns this raw playback node. */
    public readonly queue: GuildQueue<Metadata>,
  ) {
    this.player = queue.manager.player;
    this.#volume = queue.options.volume ?? 100;
    this.filters = new GuildQueuePlayerAudioFilters(this);
  }

  /** Get the connected session, throwing when one does not exist. */
  public getSession<M = unknown>(): DiscordSession<M>;
  /**
   * Optionally return `null` when no session exists.
   * @param throwOnMissingSession Pass `false` to return `null` instead of throwing.
   */
  public getSession<M = unknown>(throwOnMissingSession: false): DiscordSession<M> | null;
  public getSession<M = unknown>(throwOnMissingSession = true): DiscordSession<M> | null {
    if (!this.session && throwOnMissingSession) {
      throw new Error('DiscordSession is not initialized. Call queue.connect() first.');
    }
    return this.session as DiscordSession<M> | null;
  }

  /**
   * Replace the current session with a newly created, not-yet-connected session.
   * @param options Remedia channel, node, voice, gain, and filtergraph settings.
   * @returns The created Remedia session.
   */
  public async createSession<M = unknown>(
    options: GuildQueuePlayerNodeSessionCreateOptions,
  ): Promise<DiscordSession<M>> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    this.assertQueueAlive();
    await this.destroySessionUnlocked();
    const session = this.player.getRemedia().createDiscordSession({
      ...options,
      guildId: this.queue.guildId,
      userId: this.player.getClientId(),
    });
    this.session = session;
    this.rememberSessionConfiguration(session);
    this.attachSessionListeners(session);
    return session as DiscordSession<M>;
  }

  /**
   * Connect the current session or create and connect one for the requested channel.
   * Moving a connected session uses Remedia's `move()` method and retains this session identity.
   * @param options Remedia channel, node, voice, gain, and filtergraph settings.
   * @returns The connected Remedia session.
   * @throws Error When an existing session is assigned to a different node than requested.
   */
  public async connect<M = unknown>(options: GuildQueuePlayerNodeSessionCreateOptions): Promise<DiscordSession<M>> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    this.assertQueueAlive();
    const existing = this.session;
    if (existing) {
      if (options.nodeId && options.nodeId !== existing.nodeId) {
        throw new Error('Changing a Remedia node while preserving this session is not supported.');
      }

      if (options.selfDeaf !== undefined && options.selfDeaf !== existing.selfDeaf)
        await existing.setSelfDeaf(options.selfDeaf);
      if (options.selfMute !== undefined && options.selfMute !== existing.selfMute)
        await existing.setSelfMute(options.selfMute);
      const previousVolume = existing.volume;
      if (options.volume !== undefined && options.volume !== previousVolume) await existing.setVolume(options.volume);
      if (options.filterGraph !== undefined && options.filterGraph !== existing.filters.graph) {
        if (options.filterGraph === null) await existing.filters.clear();
        else await existing.filters.set(options.filterGraph);
      }

      if (options.channelId !== existing.channelId) await existing.move(options.channelId);
      if (existing.connectionState !== 'connected') await existing.connect();
      this.rememberSessionConfiguration(existing);
      if (existing.volume !== previousVolume)
        this.queue.emit('volumeChange', previousVolume * 100, existing.volume * 100);
      return existing as DiscordSession<M>;
    }

    const session = this.player.getRemedia().createDiscordSession({
      ...options,
      guildId: this.queue.guildId,
      userId: this.player.getClientId(),
    });
    this.session = session;
    this.attachSessionListeners(session);
    try {
      await session.connect();
      this.rememberSessionConfiguration(session);
    } catch (error) {
      await this.destroySessionUnlocked();
      throw error;
    }
    return session as DiscordSession<M>;
  }

  /** Disconnect and clear the current Remedia session. */
  public async destroySession(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    await this.destroySessionUnlocked();
  }

  private async destroySessionUnlocked(): Promise<void> {
    const session = this.session;
    if (!session) return;
    this.rememberSessionConfiguration(session);
    this.session = null;
    session.removeAllListeners();
    await session.disconnect();
    this.queue.emit('connectionDestroyed');
  }

  private attachSessionListeners(session: DiscordSession): void {
    session.on('playbackStarted', (event) => this.queue.handlePlaybackStarted(session, event));
    session.on('playbackCompleted', (event) => this.queue.handlePlaybackTerminal(session, 'natural', event));
    session.on('playbackStopped', (event) => this.queue.handlePlaybackTerminal(session, 'stopped', event));
    session.on('playbackFailed', (event) => this.queue.handlePlaybackTerminal(session, 'failed', event));
    session.on('playbackPaused', (event) => this.queue.emit('playerPause', event));
    session.on('playbackResumed', (event) => this.queue.emit('playerResume', event));
    session.on('playbackSeeked', (event) => this.queue.emit('playerSeek', event));
    session.on('voiceStateChanged', (event) => this.queue.emit('voiceStateUpdate', event));
    session.on('voiceFailed', (event) => this.queue.emit('error', event.error));
  }

  private assertQueueAlive(): void {
    if (this.queue.destroyed) throw new Error('Cannot use a player node after its guild queue has been destroyed.');
  }

  private rememberSessionConfiguration(session: DiscordSession): void {
    this.#volume = session.volume * 100;
    this.queue.options.volume = this.#volume;
    this.queue.options.selfDeaf = session.selfDeaf;
    this.queue.options.selfMute = session.selfMute;
    this.queue.options.filterGraph = session.snapshot.filterGraph;
  }

  /**
   * Play a resolved Remedia source. This method has no queue or history side effects and never advances the queue.
   * @param source Resolved Remedia media source.
   * @param options Remedia playback options and custom metadata.
   * @returns Remedia stream information and the owning session.
   */
  public async play<M = unknown>(source: MediaSource, options?: PlayOptions<M>): Promise<PlayRawResult<M>> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    this.assertQueueAlive();
    const session = this.getSession<M>();
    const audioStream = await session.play(source, options);
    return { audioStream, session };
  }

  /**
   * Compatibility spelling for the raw play method.
   * @param source Resolved Remedia media source.
   * @param options Remedia playback options and custom metadata.
   */
  public playRaw<M = unknown>(source: MediaSource, options?: PlayOptions<M>): Promise<PlayRawResult<M>> {
    return this.play(source, options);
  }

  /**
   * Set player volume using Discord Player's 0–100 percentage convention.
   * @param volumePercentage Volume percentage; Remedia receives a linear gain from zero through one.
   * @returns The applied percentage volume.
   */
  public async setVolume(volumePercentage: number): Promise<number> {
    if (!Number.isFinite(volumePercentage) || volumePercentage < 0 || volumePercentage > 100) {
      throw new RangeError('Volume must be a finite percentage between 0 and 100.');
    }
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    this.assertQueueAlive();
    const previous = this.volume;
    const session = this.getSession(false);
    if (session) await session.setVolume(volumePercentage / 100);
    this.#volume = volumePercentage;
    this.queue.options.volume = volumePercentage;
    if (previous !== volumePercentage) this.queue.emit('volumeChange', previous, volumePercentage);
    return this.#volume;
  }

  /**
   * Seek raw playback to a media position.
   * @param positionMs Requested position in milliseconds; negative values are clamped to zero.
   */
  public async seek(positionMs: number): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    await this.getSession().seek(Math.max(0, positionMs));
  }

  /** Pause raw playback in the current Remedia session. */
  public async pause(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    await this.getSession().pause();
  }

  /** Resume raw playback in the current Remedia session. */
  public async resume(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    await this.getSession().resume();
  }

  /**
   * Set or clear the paused state.
   * @param paused Whether playback should be paused.
   */
  public async setPaused(paused: boolean): Promise<void> {
    if (paused) return this.pause();
    return this.resume();
  }

  /** Skip the queue's current managed Track. */
  public skip(): Promise<Track | null> {
    return this.queue.skip();
  }
  /**
   * Skip to an upcoming Track.
   * @param track Track reference or upcoming queue index.
   */
  public skipTo(track: Track | number): Promise<Track | null> {
    return this.queue.skipTo(track);
  }
  /**
   * Alias for `skipTo()`.
   * @param track Track reference or upcoming queue index.
   */
  public jump(track: Track | number): Promise<Track | null> {
    return this.queue.jump(track);
  }
  /** Stop queue-managed playback while retaining upcoming tracks. */
  public stop(): Promise<void> {
    return this.queue.stop();
  }

  /**
   * Stop the current Remedia generation without queue scheduling.
   * @remarks Intended for queue lifecycle transitions; use `stop()` for queue-managed playback.
   */
  public async stopSession(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    const session = this.getSession(false);
    if (session) await session.stop();
  }

  /** Current volume in Discord Player's 0–100 percentage convention. */
  public get volume(): number {
    return this.session ? this.session.volume * 100 : this.#volume;
  }
  /** Current media position in milliseconds, or zero when Remedia has no position. */
  public get playbackTime(): number {
    const position = this.session?.position;
    return position?.mediaMs ?? position?.playedMs ?? 0;
  }
  /** Total session duration in milliseconds, falling back to the current Track's duration. */
  public get totalDuration(): number {
    return this.session?.durationMs ?? this.queue.currentTrack?.durationMS ?? 0;
  }
  /** Compatibility alias for {@link GuildQueuePlayerNode.playbackTime}. */
  public get streamTime(): number {
    return this.playbackTime;
  }
  /** Whether the raw session is absent or in a terminal/idle state. */
  public isIdle(): boolean {
    return !this.session || ['idle', 'stopped', 'completed', 'failed'].includes(this.session.state);
  }
  /** Whether the raw session is starting, playing, or resuming. */
  public isPlaying(): boolean {
    return !!this.session && ['starting', 'playing', 'resuming'].includes(this.session.state);
  }
  /** Whether the raw session is paused or pausing. */
  public isPaused(): boolean {
    return !!this.session && ['paused', 'pausing'].includes(this.session.state);
  }

  /** Return the formatted timeline for the current queue Track, or `null` when no Track is selected. */
  public getTimestamp(): PlayerTimestamp | null {
    if (!this.queue.currentTrack) return null;
    const current = this.playbackTime;
    const total = this.totalDuration;
    return {
      current: { label: timecode(current), value: current },
      total: { label: timecode(total), value: total },
      progress: total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0,
    };
  }

  /**
   * Create a text progress bar from Remedia's current media position and duration.
   * @param options Bar length, characters, separator, and timecode options.
   * @returns Formatted progress bar, or `null` when the queue has no current Track.
   */
  public createProgressBar(options: PlayerProgressbarOptions = {}): string | null {
    const timestamp = this.getTimestamp();
    if (!timestamp) return null;
    const length = options.length ?? 15;
    if (!Number.isInteger(length) || length < 0)
      throw new RangeError('Progress bar length must be a non-negative integer.');
    const left = options.leftChar ?? '▬';
    const right = options.rightChar ?? '▬';
    const indicator = options.indicator ?? '🔘';
    const separator = options.separator ?? '┃';
    const index = timestamp.total.value > 0 ? Math.min(length, Math.floor((timestamp.progress * length) / 100)) : 0;
    const bar = `${left.repeat(index)}${indicator}${right.repeat(Math.max(0, length - index - 1))}`;
    return options.timecodes === false
      ? bar
      : `${timestamp.current.label} ${separator} ${bar} ${separator} ${timestamp.total.label}`;
  }
}
