import type { PlaybackBackend, PlaybackSession, PlaybackSessionOptions } from '../playback-backend.js';
import { intercept } from '../plugins/capabilities.js';
import { GuildQueuePlayerAudioFilters } from './guild-queue-player-audio-filters.js';
import type {
  AudioStreamInfo,
  DiscordSessionEvents,
  DiscordSessionOptions,
  MediaSource,
  PlayOptions,
} from '@remedia/client';
import type { DiscordPlayer } from '../player.js';
import type { TrackResolvable, GuildQueue, GuildQueuePlayOptions, GuildQueuePlayResult } from './guild-queue.js';
import { Track } from './track.js';
import type { NativeSessionObservation } from './common/guild-queue-events.js';

/**
 * Playback session configuration supplied when a queue node creates or connects its raw session.
 * `volume` uses linear gain, from 0 through 2; queue APIs accept percentages instead.
 */
export interface GuildQueuePlayerNodeSessionCreateOptions extends Omit<DiscordSessionOptions, 'guildId' | 'userId'> {
  /** Deadline for the initial Discord voice join, in milliseconds; defaults to the backend timeout. */
  connectTimeoutMs?: number;
}

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

/** Result returned by raw playback. */
export interface PlayRawResult<Metadata = unknown> {
  /** Audio stream information reported by the active backend. */
  audioStream: AudioStreamInfo;

  /** Playback session that owns the playback generation. */
  session: PlaybackSession<Metadata>;
}

const PLAYBACK_STATES = [
  'idle',
  'starting',
  'playing',
  'pausing',
  'resuming',
  'paused',
  'stopping',
  'stopped',
  'completed',
  'failed',
] as const;

const CONNECTION_STATES = [
  'connecting',
  'negotiating_dave',
  'connected',
  'reconnecting',
  'disconnecting',
  'disconnected',
  'failed',
] as const;

interface SessionConfiguration {
  volume: number;

  selfDeaf: boolean;

  selfMute: boolean;

  filterGraph: string | null;
}

function timecode(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Raw playback controls for one guild queue. It never schedules queue tracks. */
export class GuildQueuePlayerNode<Metadata = unknown> {
  /** Current playback session, or `null` before connecting. */
  #currentSession: PlaybackSession | null = null;

  /** Framework-owned current session; use createSession() to replace it safely. */
  public get session(): PlaybackSession | null {
    return this.#currentSession;
  }

  /** Parent Player that owns the playback backend and gateway orchestration. */
  public readonly player: DiscordPlayer;

  /** Queue-owned named presets and raw filtergraph controls, available before connection. */
  public readonly filters: GuildQueuePlayerAudioFilters<Metadata>;

  #volume = 100;

  private detachSessionListeners: (() => void) | null = null;

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
  public getSession<M = unknown>(): PlaybackSession<M>;

  /**
   * Optionally return `null` when no session exists.
   * @param throwOnMissingSession Pass `false` to return `null` instead of throwing.
   */
  public getSession<M = unknown>(throwOnMissingSession: false): PlaybackSession<M> | null;

  public getSession<M = unknown>(throwOnMissingSession = true): PlaybackSession<M> | null {
    if (!this.session && throwOnMissingSession) {
      throw new Error('PlaybackSession is not initialized. Call queue.connect() first.');
    }

    return this.session as PlaybackSession<M> | null;
  }

  /**
   * Replace the current session with a newly created, not-yet-connected session.
   * @param options Channel, node, voice, gain, and filtergraph settings.
   * @returns The created playback session.
   */
  public async createSession<M = unknown>(
    options: GuildQueuePlayerNodeSessionCreateOptions,
  ): Promise<PlaybackSession<M>> {
    const request = intercept(this.player.plugins, 'voice.beforeSession', {
      guildId: this.queue.guildId,
      channelId: options.channelId,
    });
    if (typeof request.channelId !== 'string' || !request.channelId)
      throw new TypeError('Voice channel ID must be nonempty.');
    options = { ...options, channelId: request.channelId };
    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    this.assertQueueAlive();
    await this.destroySessionUnlocked();

    const { connectTimeoutMs: _connectTimeoutMs, ...sessionOptions } = options;
    const negotiated = await this.sessionPolicy(sessionOptions);
    const session = await this.createBackendSession({
      ...negotiated,
      guildId: this.queue.guildId,
      userId: this.player.getClientId(),
    });

    await this.adoptSession(session);

    return session as PlaybackSession<M>;
  }

  /**
   * Connect the current session or create and connect one for the requested channel.
   * Moving a connected session uses the backend's `move()` method and retains this session identity.
   * @param options Channel, node, voice, gain, and filtergraph settings.
   * @returns The connected playback session.
   * @throws Error When an existing session is assigned to a different node than requested.
   */
  public async connect<M = unknown>(options: GuildQueuePlayerNodeSessionCreateOptions): Promise<PlaybackSession<M>> {
    const request = intercept(this.player.plugins, 'voice.beforeSession', {
      guildId: this.queue.guildId,
      channelId: options.channelId,
    });
    if (typeof request.channelId !== 'string' || !request.channelId)
      throw new TypeError('Voice channel ID must be nonempty.');
    options = { ...options, channelId: request.channelId };
    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    this.assertQueueAlive();

    const existing = this.session;
    if (
      this.player.playbackBackend &&
      options.filterGraph !== undefined &&
      !this.player.playbackBackend.capabilities.filters
    )
      throw new Error('Playback backend does not support audio filters.');

    if (existing) {
      this.assertHosts(existing.nodeId, options.pluginHosts ?? []);

      if (options.nodeId && options.nodeId !== existing.nodeId) {
        throw new Error('Changing a Remedia node while preserving this session is not supported.');
      }

      if (options.selfDeaf !== undefined && options.selfDeaf !== existing.selfDeaf)
        await existing.setSelfDeaf(options.selfDeaf);

      if (options.selfMute !== undefined && options.selfMute !== existing.selfMute)
        await existing.setSelfMute(options.selfMute);

      const previousVolume = existing.volume;

      if (options.volume !== undefined && options.volume !== previousVolume) await existing.setVolume(options.volume);

      if (options.filterGraph !== undefined && options.filterGraph !== existing.filters?.graph) {
        if (options.filterGraph === null) await this.requireFilters(existing).clear();
        else await this.requireFilters(existing).set(options.filterGraph);
      }

      if (options.channelId !== existing.channelId) await existing.move(options.channelId);

      if (existing.connectionState !== 'connected') {
        await existing.connect({
          ...(options.connectTimeoutMs === undefined ? {} : { timeoutMs: options.connectTimeoutMs }),
          ...(this.player.playbackBackend
            ? { signal: AbortSignal.any([this.queue.signal, this.player.playbackSignal]) }
            : {}),
        });
      }

      this.rememberSessionConfiguration(existing);
      this.queue.voice.connected(existing);

      return existing as PlaybackSession<M>;
    }

    const { connectTimeoutMs, ...sessionOptions } = options;
    const negotiated = await this.sessionPolicy(sessionOptions);
    const session = await this.createBackendSession({
      ...negotiated,
      guildId: this.queue.guildId,
      userId: this.player.getClientId(),
    });

    try {
      await this.adoptSession(session);
      await session.connect({
        ...(connectTimeoutMs === undefined ? {} : { timeoutMs: connectTimeoutMs }),
        ...(this.player.playbackBackend
          ? { signal: AbortSignal.any([this.queue.signal, this.player.playbackSignal]) }
          : {}),
      });
      this.rememberSessionConfiguration(session);
      this.queue.voice.connected(session);
    } catch (error) {
      if (this.session === session) {
        try {
          await this.destroySessionUnlocked();
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], 'Playback session connection failed', { cause: error });
        }
      }

      throw error;
    }

    return session as PlaybackSession<M>;
  }

  /** Disconnect and clear the current playback session. */
  public async destroySession(): Promise<void> {
    this.player.plugins.assertNotDispatching();
    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    await this.destroySessionUnlocked();
  }

  private async destroySessionUnlocked(): Promise<void> {
    const session = this.session;

    if (!session) return;

    this.queue.invalidateSession(session);
    this.rememberSessionConfiguration(session);
    this.#currentSession = null;
    this.queue.voice.connected(null);
    await this.queue.cancelPreparation();
    // Keep native diagnostics attached through disposal, then release only our listeners.
    try {
      await session.dispose();
    } finally {
      this.detachSessionListeners?.();
      this.detachSessionListeners = null;
    }
    this.queue.emit('connectionDestroyed');
  }

  private requireFilters(session: PlaybackSession) {
    if (!session.filters || (this.player.playbackBackend && !this.player.playbackBackend.capabilities.filters))
      throw new Error('Playback backend does not support audio filters.');
    return session.filters;
  }

  private async createBackendSession(options: PlaybackSessionOptions): Promise<PlaybackSession> {
    const backend = this.player.playbackBackend;
    if (!backend) return this.player.getRemedia().createDiscordSession(options);
    this.player.getBackend();
    const signal = AbortSignal.any([this.queue.signal, this.player.playbackSignal]);
    signal.throwIfAborted();
    const session = await backend.createSession(options, signal);
    try {
      this.queue.signal.throwIfAborted();
      this.player.playbackSignal.throwIfAborted();
      if (this.player.playbackBackend !== backend)
        throw new Error('Playback provider was removed during session creation.');
      this.assertBackendSession(session, backend);
      return session;
    } catch (error) {
      if (session && typeof session.dispose === 'function') {
        try {
          await session.dispose();
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], 'Invalid playback session cleanup failed', { cause: cleanup });
        }
      }
      throw error;
    }
  }

  private assertBackendSession(session: PlaybackSession, backend: PlaybackBackend): void {
    if (!session || typeof session !== 'object')
      throw new TypeError('Playback backend returned an invalid session implementation.');

    if (
      ![
        'connect',
        'move',
        'dispose',
        'play',
        'stop',
        'pause',
        'resume',
        'seek',
        'setVolume',
        'setSelfDeaf',
        'setSelfMute',
        'getPlaybackTime',
        'on',
        'off',
      ].every((name) => typeof Reflect.get(session, name) === 'function')
    )
      throw new TypeError('Playback backend returned an invalid session implementation.');

    if (!session.snapshot || !Number.isSafeInteger(session.snapshot.generation))
      throw new TypeError('Playback backend returned an invalid session snapshot.');

    if (typeof session.sessionId !== 'string' || !session.sessionId)
      throw new TypeError('Playback backend returned an invalid session identity.');

    if (session.guildId !== this.queue.guildId)
      throw new Error('Playback backend returned an invalid session identity.');

    if (typeof session.channelId !== 'string' || !session.channelId)
      throw new TypeError('Playback backend returned an invalid session channel.');

    if (session.nodeId !== null && typeof session.nodeId !== 'string')
      throw new TypeError('Playback backend returned an invalid session node.');

    if (!CONNECTION_STATES.includes(session.connectionState))
      throw new TypeError('Playback backend returned an invalid connection state.');

    if (!PLAYBACK_STATES.includes(session.state) || !PLAYBACK_STATES.includes(session.snapshot.state))
      throw new TypeError('Playback backend returned an invalid playback state.');

    if (
      !session.position ||
      typeof session.position !== 'object' ||
      !('mediaMs' in session.position) ||
      !(session.position.mediaMs === null || Number.isFinite(session.position.mediaMs))
    )
      throw new TypeError('Playback backend returned an invalid playback position.');

    if (session.durationMs !== null && (!Number.isFinite(session.durationMs) || session.durationMs < 0))
      throw new TypeError('Playback backend returned an invalid source duration.');

    if (!Number.isFinite(session.volume) || session.volume < 0 || session.volume > 2)
      throw new TypeError('Playback backend returned an invalid volume.');

    if (typeof session.selfDeaf !== 'boolean' || typeof session.selfMute !== 'boolean')
      throw new TypeError('Playback backend returned invalid voice flags.');

    if (session.snapshot.filterGraph !== null && typeof session.snapshot.filterGraph !== 'string')
      throw new TypeError('Playback backend returned an invalid filter graph.');

    const crossfade = session.snapshot.crossfade;

    if (
      crossfade !== null &&
      crossfade !== undefined &&
      (crossfade.enabled !== true ||
        !Number.isFinite(crossfade.durationMs) ||
        crossfade.durationMs <= 0 ||
        !Number.isFinite(crossfade.prepareBeforeMs) ||
        crossfade.prepareBeforeMs < 0 ||
        crossfade.curve !== 'equalPower')
    )
      throw new TypeError('Playback backend returned an invalid crossfade snapshot.');

    if (session.filters) {
      if (
        (session.filters.graph !== null && typeof session.filters.graph !== 'string') ||
        typeof session.filters.set !== 'function' ||
        typeof session.filters.clear !== 'function'
      )
        throw new TypeError('Playback backend returned invalid filter controls.');
    }

    for (const name of ['stageNext', 'clearStage', 'stagedSource'] as const) {
      const value = session[name];

      if (value !== undefined && typeof value !== 'function')
        throw new TypeError('Playback backend returned invalid staging controls.');
    }

    if (!backend.capabilities.crossfade && crossfade?.enabled)
      throw new Error('Playback backend enabled undeclared crossfade.');

    if (!backend.capabilities.filters && session.snapshot.filterGraph)
      throw new Error('Playback backend enabled undeclared audio filters.');

    if (backend.capabilities.filters && !session.filters)
      throw new Error('Playback backend declared filters without session controls.');

    if (
      backend.capabilities.crossfade &&
      (typeof session.stageNext !== 'function' ||
        typeof session.clearStage !== 'function' ||
        typeof session.stagedSource !== 'function')
    )
      throw new Error('Playback backend declared crossfade without session staging controls.');
  }

  private async adoptSession(session: PlaybackSession): Promise<void> {
    const previousDetach = this.detachSessionListeners;
    let detach: (() => void) | null = null;
    let configuration: SessionConfiguration;

    try {
      configuration = this.readSessionConfiguration(session);
      previousDetach?.();
      detach = this.attachSessionListeners(session);
    } catch (error) {
      detach?.();
      this.detachSessionListeners = null;
      const errors: unknown[] = [error];

      try {
        await session.dispose();
      } catch (cleanup) {
        errors.push(cleanup);
      }

      if (errors.length > 1) throw new AggregateError(errors, 'Playback session attachment failed', { cause: error });

      throw error;
    }

    this.#currentSession = session;
    this.detachSessionListeners = detach;
    this.applySessionConfiguration(configuration);
  }

  private async sessionPolicy(
    options: GuildQueuePlayerNodeSessionCreateOptions,
  ): Promise<GuildQueuePlayerNodeSessionCreateOptions> {
    const backend = this.player.playbackBackend;
    if (backend) {
      if (options.nodeId || this.queue.options.selectNode)
        throw new Error('Custom playback providers do not support Remedia node selection.');
      this.assertHosts(null, options.pluginHosts ?? []);
      if (options.filterGraph !== undefined && !backend.capabilities.filters)
        throw new Error('Playback backend does not support audio filters.');
      const requested = this.queue.options.crossfade ?? this.player.options.crossfade ?? options.crossfade;
      if (requested && !backend.capabilities.crossfade) throw new Error('Playback backend does not support crossfade.');
      return {
        ...options,
        crossfade: requested ? { durationMs: 5000, prepareBeforeMs: 30000, curve: 'equalPower', ...requested } : false,
      };
    }
    const client = this.player.getRemedia();
    const hosts = options.pluginHosts ?? [];
    const requested = this.queue.options.crossfade ?? this.player.options.crossfade;
    const selector = this.queue.options.selectNode;
    let nodeId = options.nodeId ?? client.getAssignment(this.queue.guildId)?.nodeId;

    // Without a queue selector, Remedia performs its own capacity-aware placement.
    if (!nodeId && selector) {
      const candidates = this.eligibleNodes(hosts);

      // An empty pool is reported by Remedia's own placement error.
      if (candidates.length) nodeId = await selector(candidates, { guildId: this.queue.guildId });
    }

    if (nodeId) this.assertHosts(nodeId, hosts);

    const selected = nodeId && nodeId !== options.nodeId ? { ...options, nodeId } : options;

    if (!requested) return selected;

    // Remedia rejects crossfade on nodes without support. Request it only when every node
    // that can host this session supports it, otherwise play without crossfade.
    const hostable = nodeId ? client.nodes.filter((node) => node.id === nodeId) : this.eligibleNodes(hosts);
    const available =
      hostable.length > 0 &&
      hostable.every((node) => node.type === 'embedded' || node.capabilities?.crossfade.available === true);

    if (!available)
      this.player.emit(
        'debug',
        nodeId
          ? `Queue ${this.queue.guildId}: crossfade unavailable on node ${nodeId}; using ordinary playback.`
          : `Queue ${this.queue.guildId}: automatic placement may choose a node without crossfade support; using ordinary playback. Pin a node or provide selectNode to use crossfade.`,
      );

    return {
      ...selected,
      crossfade: available ? { durationMs: 5000, prepareBeforeMs: 30000, curve: 'equalPower', ...requested } : false,
    };
  }

  /** Nodes Remedia would consider for a new assignment: healthy, with capacity, and hosting every required plugin host. */
  private eligibleNodes(hosts: readonly string[]) {
    return this.player
      .getRemedia()
      .nodes.filter(
        (node) =>
          node.status === 'healthy' &&
          (!hosts.length ||
            (node.type === 'remote' &&
              node.capabilities?.pluginOperations?.available &&
              hosts.every((host) => node.capabilities?.pluginOperations?.hosts.includes(host)))) &&
          node.capacity > 0 &&
          Math.max(node.statistics?.playersActive ?? 0, node.assignedGuilds.length) < node.capacity &&
          node.statistics?.transportHealth !== 'degraded' &&
          node.statistics?.processingHealth !== 'degraded',
      );
  }

  private assertHosts(nodeId: string | null, hosts: readonly string[]): void {
    if (!hosts.length) return;

    const backend = this.player.playbackBackend;
    if (backend) {
      if (
        !backend.capabilities.sources.includes('operation') ||
        !hosts.every((host) => backend.capabilities.pluginHosts?.includes(host))
      )
        throw new Error('Playback backend cannot access required source hosts.');
      return;
    }
    const node = this.player.getRemedia().nodes.find((item) => item.id === nodeId);

    if (
      node?.type !== 'remote' ||
      !node.capabilities?.pluginOperations?.available ||
      !hosts.every((host) => node.capabilities?.pluginOperations?.hosts.includes(host))
    )
      throw new Error(`Remedia node ${nodeId} cannot access required source hosts (${hosts.join(', ')})`);
  }

  private attachSessionListeners(session: PlaybackSession): () => void {
    const cleanups: (() => void)[] = [];
    type SessionListener = <Name extends keyof DiscordSessionEvents>(
      name: Name,
      handler: (...args: DiscordSessionEvents[Name]) => void,
    ) => void;

    // Narrow Node's open EventEmitter overloads to Remedia's closed public event contract.
    const subscribe = session.on.bind(session) as SessionListener;
    const unsubscribe = session.off.bind(session) as SessionListener;
    const on: SessionListener = (name, handler) => {
      subscribe(name, handler);
      cleanups.push(() => unsubscribe(name, handler));
    };

    try {
      // Native observation remains available even when generation correlation rejects an event.
      const observe = <Name extends keyof DiscordSessionEvents>(name: Name) => {
        on(name, (...args) => {
          // A mapped tuple keeps event names correlated with their exported native payloads.
          this.queue.emit('sessionEvent', ...([name, args[0]] as NativeSessionObservation));
        });
      };

      for (const name of [
        'playbackStarted',
        'playbackCompleted',
        'playbackStopped',
        'playbackFailed',
        'playbackPaused',
        'playbackResumed',
        'playbackSeeked',
        'prepareRequested',
        'stageReady',
        'stageFailed',
        'stageInvalidated',
        'transitionCancelled',
        'filterChanged',
        'volumeChanged',
        'voiceStateChanged',
        'voiceFailed',
        'sessionDisposed',
      ] as const)
        observe(name);

      const active = () => session === this.session && !this.queue.destroyed;

      on('prepareRequested', (event) => this.queue.handlePrepareRequested(session, event));

      for (const name of ['stageReady', 'stageFailed', 'stageInvalidated', 'transitionCancelled'] as const) {
        on(name, (event) => this.queue.handleStageEvent(session, name, event));
      }

      on('playbackStarted', (event) => this.queue.handlePlaybackStarted(session, event));
      on('playbackCompleted', (event) => this.queue.handlePlaybackTerminal(session, 'natural', event));
      on('playbackStopped', (event) => this.queue.handlePlaybackTerminal(session, 'stopped', event));
      on('playbackFailed', (event) => this.queue.handlePlaybackTerminal(session, 'failed', event));
      on('playbackPaused', (event) => {
        if (active() && event.generation === session.snapshot.generation) this.queue.emit('playerPause', event);
      });
      on('playbackResumed', (event) => {
        if (active() && event.generation === session.snapshot.generation) this.queue.emit('playerResume', event);
      });
      on('playbackSeeked', (event) => {
        if (active() && event.generation === session.snapshot.generation) this.queue.emit('playerSeek', event);
      });
      on('volumeChanged', (event) => {
        if (!active()) return;

        this.#volume = event.volume * 100;
        this.queue.options.volume = this.#volume;
        this.queue.emit('volumeChange', event.previousVolume * 100, this.#volume, event);
      });
      on('filterChanged', (event) => {
        if (!active()) return;

        this.queue.options.filterGraph = event.graph;
        this.queue.emit('audioFiltersUpdate', event.previousGraph, event.graph, event);
      });
      on('voiceStateChanged', (event) => {
        if (!active()) return;

        this.queue.emit('voiceConnectionStateChange', event.previousState, event.state, event);

        if (event.state === 'connected') this.queue.voice.connected(session);

        if (event.state === 'connected')
          void this.queue.reconcileCrossfade(session).catch((error) => this.player.emit('debug', String(error)));
      });
      on('voiceFailed', (event) => {
        if (active()) this.queue.emit('error', event.error, event);
      });
      on('sessionDisposed', (event) => this.queue.emit('sessionDisposed', event));
    } catch (error) {
      const errors: unknown[] = [error];

      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (cleanupError) {
          errors.push(cleanupError);
        }
      }

      if (errors.length > 1)
        throw new AggregateError(errors, 'Playback session listener attachment failed', { cause: error });

      throw error;
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }

  private assertQueueAlive(): void {
    this.player.plugins.assertNotDispatching();
    if (this.player.playbackBackend) this.player.getBackend();
    if (this.queue.destroyed) throw new Error('Cannot use a player node after its guild queue has been destroyed.');
  }

  private rememberSessionConfiguration(session: PlaybackSession): void {
    this.applySessionConfiguration(this.readSessionConfiguration(session));
  }

  private readSessionConfiguration(session: PlaybackSession): SessionConfiguration {
    return {
      volume: session.volume * 100,
      selfDeaf: session.selfDeaf,
      selfMute: session.selfMute,
      filterGraph: session.snapshot.filterGraph,
    };
  }

  private applySessionConfiguration(configuration: SessionConfiguration): void {
    this.#volume = configuration.volume;
    this.queue.options.volume = configuration.volume;
    this.queue.options.selfDeaf = configuration.selfDeaf;
    this.queue.options.selfMute = configuration.selfMute;
    this.queue.options.filterGraph = configuration.filterGraph;
  }

  /** Play a Track through the managed queue, preserving v7 scheduling.
   * @param track Canonical Track to enqueue or start.
   * @param options Managed playback and connection options.
   * @returns Managed queue result.
   */
  public play<M = unknown>(track: Track, options?: GuildQueuePlayOptions<M>): Promise<GuildQueuePlayResult<M>>;

  /** Start the next queued Track when idle.
   * @param track Omit or pass null to select the next occurrence.
   * @returns Selected Track, or null.
   */
  public play(track?: null): Promise<Track | null>;

  /** Play a native descriptor without scheduling managed Tracks.
   * @param source Resolved native media source.
   * @param options Native playback options.
   * @returns Native stream information and owning session.
   */
  public play<M = unknown>(source: MediaSource, options?: PlayOptions<M>): Promise<PlayRawResult<M>>;

  public async play<M = unknown>(
    source?: MediaSource | Track | null,
    options?: GuildQueuePlayOptions<M>,
  ): Promise<PlayRawResult<M> | GuildQueuePlayResult<M> | Track | null> {
    if (source == null) return this.queue.playNext();
    if (source instanceof Track) return this.queue.play(source, options);

    this.assertQueueAlive();
    const session = this.getSession<M>();
    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    this.assertQueueAlive();

    if (session !== this.session) throw new Error('Queue session changed before playback; retry on the current queue.');
    options?.signal?.throwIfAborted();
    const backend = this.player.playbackBackend;
    if (backend) {
      const kind =
        'url' in source
          ? 'url'
          : 'file' in source
            ? 'file'
            : 'buffer' in source
              ? 'buffer'
              : 'stream' in source
                ? 'stream'
                : 'operation';
      if (!backend.capabilities.sources.includes(kind))
        throw new Error(`Playback backend does not support ${kind} sources.`);
    }
    const audioStream = await session.play(source, options);

    return { audioStream, session };
  }

  /**
   * Set player volume using Discord Player's 0–200 percentage convention.
   * @param volumePercentage Volume percentage; the backend receives a linear gain from zero through two.
   * @returns The applied percentage volume.
   */
  public async setVolume(volumePercentage: number): Promise<number> {
    volumePercentage = intercept(this.player.plugins, 'audio.beforeVolume', {
      guildId: this.queue.guildId,
      volume: volumePercentage,
    }).volume;
    if (!Number.isFinite(volumePercentage) || volumePercentage < 0 || volumePercentage > 200) {
      throw new RangeError('Volume must be a finite percentage between 0 and 200.');
    }

    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    this.assertQueueAlive();

    const previous = this.volume;
    const session = this.getSession(false);

    if (session) await session.setVolume(volumePercentage / 100);

    this.#volume = volumePercentage;
    this.queue.options.volume = volumePercentage;

    if (!session && previous !== volumePercentage) this.queue.emit('volumeChange', previous, volumePercentage);

    return this.#volume;
  }

  /** Locate an upcoming Track using the queue's reference resolution.
   * @param track Track, ID, title, URL or upcoming index.
   * @returns Index, or -1 when absent.
   */
  public getTrackPosition(track: TrackResolvable): number {
    return this.queue.getTrackPosition(track);
  }

  /** Whether native source preparation is in progress. */
  public isBuffering(): boolean {
    return this.queue.isBuffering() || this.session?.state === 'starting';
  }

  /** Remove an upcoming Track through the queue's canonical mutation path.
   * @param track Track reference or upcoming index.
   * @param emitEvent Whether to emit the queue removal event.
   */
  public remove(track: TrackResolvable, emitEvent = true): Track | undefined {
    return this.queue.removeTrack(track, emitEvent);
  }

  /** Insert an upcoming Track.
   * @param track Track to insert.
   * @param index Upcoming position, default zero.
   */
  public insert(track: Track, index = 0): void {
    this.queue.insertTrack(track, index);
  }

  /** Move an upcoming Track.
   * @param track Track reference or upcoming index.
   * @param index Destination position.
   */
  public move(track: TrackResolvable, index = 0): void {
    this.queue.moveTrack(track, index);
  }

  /** Copy an upcoming occurrence.
   * @param track Track reference or upcoming index.
   * @param index Destination position.
   */
  public copy(track: TrackResolvable, index = 0): void {
    this.queue.copyTrack(track, index);
  }

  /** Swap upcoming occurrences.
   * @param first First Track reference or index.
   * @param second Second Track reference or index.
   */
  public swap(first: TrackResolvable, second: TrackResolvable): void {
    this.queue.swapTracks(first, second);
  }

  /**
   * Seek raw playback to a media position.
   * @param positionMs Requested position in milliseconds; negative values are clamped to zero.
   */
  public async seek(positionMs: number): Promise<void> {
    positionMs = intercept(this.player.plugins, 'playback.beforeSeek', {
      guildId: this.queue.guildId,
      positionMs,
    }).positionMs;
    if (!Number.isFinite(positionMs)) throw new RangeError('Seek position must be finite.');
    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    await this.queue.cancelPreparation();
    await this.getSession().seek(Math.max(0, positionMs));
  }

  /** Pause raw playback in the current playback session. */
  public async pause(): Promise<void> {
    intercept(this.player.plugins, 'playback.beforePause', { guildId: this.queue.guildId });
    this.queue.voice.manualPause();
    using _lock = await this.queue.tasks.acquire('queue.node.operation');

    await this.getSession().pause();
  }

  /** Resume raw playback in the current playback session. */
  public async resume(): Promise<void> {
    intercept(this.player.plugins, 'playback.beforeResume', { guildId: this.queue.guildId });
    this.queue.voice.manualPause();
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

  /** Stop queue-managed playback while retaining upcoming tracks.
   * @param force Destroy the queue immediately instead of applying stop policy.
   */
  public stop(force = false): Promise<void> {
    return force ? this.queue.destroy() : this.queue.stop();
  }

  /**
   * Stop the current playback generation without queue scheduling.
   * @remarks Intended for queue lifecycle transitions; use `stop()` for queue-managed playback.
   */
  public async stopSession(): Promise<void> {
    using _lock = await this.queue.tasks.acquire('queue.node.operation');
    const session = this.getSession(false);

    if (session) await session.stop();

    this.queue.handleSessionStopped();
  }

  /** Current volume in Discord Player's 0–200 percentage convention. */
  public get volume(): number {
    return this.session ? this.session.volume * 100 : this.#volume;
  }

  /**
   * Output elapsed time in milliseconds, read on demand from the backend playback clock.
   * @remarks This is time spent producing output for the current generation, not the source-media position.
   * It starts at the seek target after `seek()` and can differ from the source position (and exceed
   * {@link GuildQueuePlayerNode.totalDuration}) when a filter changes tempo. Returns zero when no session exists.
   */
  public get playbackTime(): number {
    return this.session?.getPlaybackTime() ?? 0;
  }

  /** Total session duration in milliseconds, falling back to the current Track's duration. */
  public get totalDuration(): number {
    return this.session?.durationMs ?? this.queue.currentTrack?.durationMS ?? 0;
  }

  /** Compatibility alias for {@link GuildQueuePlayerNode.playbackTime}; also output elapsed time. */
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

  /**
   * Return the formatted timeline for the current queue Track, or `null` when no Track is selected.
   * @remarks `current` is output elapsed time and `total` is the source duration, so `progress` is clamped to 100
   * and is approximate while a tempo-changing filter is active.
   */
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
   * Create a text progress bar from output elapsed time and the source duration.
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
