import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type {
  AudioStreamInfo,
  DiscordConnectOptions,
  DiscordGatewaySend,
  DiscordSession,
  DiscordSessionOptions,
  PlayOptions,
  StageNextOptions,
  StageSnapshot,
  VoiceConnectionState,
} from '@remedia/client';
import type {
  PlaybackBackend,
  PlaybackBackendCapabilities,
  PlaybackBackendContext,
  PlaybackBackendEvents,
  PlaybackSession,
} from '../../src/index.js';

/** Per-session failure injection for lifecycle tests. */
export interface IndependentSessionConfig {
  /** Throw when this one-based listener registration is attempted. */
  failListenerAt?: number;

  /** Reject disposal, exercising cleanup error aggregation. */
  disposeError?: Error;

  /** Reject the initial voice connection. */
  connectError?: Error;

  /** Keep the configured session identity instead of generating one. */
  sessionId?: string;
}

const streamInfo: AudioStreamInfo = {
  streamIndex: 0,
  codec: 'opus',
  sampleRate: 48_000,
  channels: 2,
  channelLayout: 'stereo',
  durationMs: 30_000,
  bitRate: 128_000,
  metadata: {},
};

/** Standalone session implementing only the public Discord Player contract. */
export class IndependentSession implements PlaybackSession {
  /** Own listener registry; no Remedia or Player event class is reused. */
  private readonly emitter = new EventEmitter();

  /** Stable identity reported in every event. */
  public readonly sessionId: string;

  /** Owning guild. */
  public readonly guildId: string;

  /** Current voice destination. */
  public channelId: string;

  /** Custom backends have no native node concept. */
  public readonly nodeId: string | null = null;

  /** Current transport state. */
  public connectionState: VoiceConnectionState = 'disconnected';

  /** Current playback state. */
  public state: DiscordSession['state'] = 'idle';

  /** Current source and output position. */
  public position = {
    mediaMs: 0 as number | null,
    mediaPositionAccuracy: 'estimated' as const,
    submittedMs: 0,
    playedMs: 0 as number | null,
  };

  /** Source duration. */
  public durationMs: number | null = 30_000;

  /** Linear gain. */
  public volume: number;

  /** Gateway self-deaf flag. */
  public selfDeaf: boolean;

  /** Gateway self-mute flag. */
  public selfMute: boolean;

  /** Raw filter controls, unused by the default capability set. */
  public readonly filters: PlaybackSession['filters'] = {
    graph: null,
    set: async (graph: string) => {
      (this.filters as { graph: string | null }).graph = graph;
    },
    clear: async () => {
      (this.filters as { graph: string | null }).graph = null;
    },
  };

  /** Current generation, incremented by each `play()`. */
  public generation = 0;

  /** Metadata attached to the current generation. */
  public customMetadata: unknown;

  /** Connection options supplied by the framework. */
  public readonly connectCalls: DiscordConnectOptions[] = [];

  /** Destination channels requested through `move()`. */
  public readonly moveCalls: string[] = [];

  /** Number of ownership-releasing disposal calls. */
  public disposeCalls = 0;

  /** Whether disposal already ran. */
  public disposed = false;

  /** Number of raw playback requests. */
  public playCalls = 0;

  /** Number of raw stop requests. */
  public stopCalls = 0;

  /** Number of pause requests. */
  public pauseCalls = 0;

  /** Number of resume requests. */
  public resumeCalls = 0;

  /** Requested media positions. */
  public readonly seekCalls: number[] = [];

  /** Requested linear gain values. */
  public readonly volumeCalls: number[] = [];

  /** Submitted staging requests. */
  public readonly stageOptions: StageNextOptions[] = [];

  /** Current staged source. */
  public staged: StageSnapshot | null = null;

  /** One-based listener registration count. */
  public listenerRegistrations = 0;

  private readonly failListenerAt: number | undefined;

  private readonly disposeError: Error | undefined;

  private readonly crossfade: DiscordSessionOptions['crossfade'];

  private readonly connectError: Error | undefined;

  /** Create a session from framework options without native resource allocation. */
  public constructor(options: DiscordSessionOptions, config: IndependentSessionConfig = {}) {
    this.crossfade = options.crossfade;
    this.sessionId = config.sessionId ?? randomUUID();
    this.guildId = options.guildId;
    this.channelId = options.channelId;
    this.volume = options.volume ?? 1;
    this.selfDeaf = options.selfDeaf ?? true;
    this.selfMute = options.selfMute ?? false;
    this.failListenerAt = config.failListenerAt;
    this.disposeError = config.disposeError;
    this.connectError = config.connectError;
    (this.filters as { graph: string | null }).graph = options.filterGraph ?? null;
  }

  /** Retained transport and playback data used by queue reconciliation. */
  public get snapshot(): Pick<
    DiscordSession['snapshot'],
    'generation' | 'state' | 'source' | 'filterGraph' | 'crossfade' | 'staged'
  > {
    return {
      generation: this.generation,
      state: this.state,
      source: this.state === 'idle' ? null : streamInfo,
      filterGraph: this.filters?.graph ?? null,
      crossfade: this.crossfade
        ? { durationMs: 5000, prepareBeforeMs: 30000, curve: 'equalPower', ...this.crossfade }
        : null,
      staged: this.staged,
    };
  }

  /** Count registrations and optionally fail one to exercise attachment rollback. */
  public readonly on: PlaybackSession['on'] = ((name: string, listener: (...args: unknown[]) => void) => {
    this.listenerRegistrations++;

    if (this.listenerRegistrations === this.failListenerAt) throw new Error('listener registration failed');

    this.emitter.on(name, listener);
  }) as PlaybackSession['on'];

  /** Remove only the supplied listener. */
  public readonly off: PlaybackSession['off'] = ((name: string, listener: (...args: unknown[]) => void) => {
    this.emitter.off(name, listener);
  }) as PlaybackSession['off'];

  /** Current listener count for lifecycle assertions. */
  public listenerCount(name: string): number {
    return this.emitter.listenerCount(name);
  }

  private emit<Name extends keyof PlaybackBackendEvents>(name: Name, ...args: PlaybackBackendEvents[Name]): boolean {
    return this.emitter.emit(name, ...args);
  }

  private identity(): {
    sessionId: string;
    guildId: string;
    nodeId: string | null;
    generation: number;
    customMetadata: unknown;
  } {
    return {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
    };
  }

  /** Mark the logical voice transport connected. */
  public async connect(options: DiscordConnectOptions = {}): Promise<void> {
    this.connectCalls.push(options);
    options.signal?.throwIfAborted();
    if (this.connectError) throw this.connectError;

    const previousState = this.connectionState;
    this.connectionState = 'connected';
    this.emit('voiceStateChanged', {
      ...this.identity(),
      previousState,
      state: 'connected',
    });
  }

  /** Move the logical transport without replacing the session. */
  public async move(channelId: string): Promise<void> {
    this.moveCalls.push(channelId);
    const previousState = this.connectionState;
    this.channelId = channelId;
    this.connectionState = 'connected';
    this.emit('voiceStateChanged', {
      ...this.identity(),
      previousState,
      state: 'connected',
    });
  }

  /** Release the logical session exactly once. */
  public async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.disposeCalls++;
    const previousState = this.connectionState;
    this.connectionState = 'disconnected';

    if (previousState !== 'disconnected') {
      this.emit('voiceStateChanged', {
        ...this.identity(),
        previousState,
        state: 'disconnected',
      });
    }

    this.emit('sessionDisposed', { ...this.identity() });

    if (this.disposeError) throw this.disposeError;
  }

  /** Start a monotonic generation. */
  public async play(_source: unknown, options?: PlayOptions<unknown>): Promise<AudioStreamInfo> {
    options?.signal?.throwIfAborted();
    this.playCalls++;
    this.generation++;
    this.state = 'playing';
    this.customMetadata = options?.customMetadata;
    this.position = { ...this.position, mediaMs: 0, playedMs: 0 };
    this.emit('playbackStarted', {
      ...this.identity(),
      state: 'playing',
      info: streamInfo,
    });
    return streamInfo;
  }

  /** Emit one explicit stop for the current generation. */
  public async stop(): Promise<void> {
    this.stopCalls++;
    this.state = 'stopped';
    this.emit('playbackStopped', {
      ...this.identity(),
      state: 'stopped',
      reason: 'independent-stop',
    });
  }

  /** Pause the current generation. */
  public async pause(): Promise<void> {
    this.pauseCalls++;
    const previousState = this.state;
    this.state = 'paused';
    this.emit('playbackPaused', {
      ...this.identity(),
      previousState,
      state: 'paused',
    });
  }

  /** Resume the current generation. */
  public async resume(): Promise<void> {
    this.resumeCalls++;
    const previousState = this.state;
    this.state = 'playing';
    this.emit('playbackResumed', {
      ...this.identity(),
      previousState,
      state: 'playing',
    });
  }

  /** Seek on the media timeline. */
  public async seek(positionMs: number): Promise<void> {
    const previousPositionMs = this.position.mediaMs;
    this.seekCalls.push(positionMs);
    this.position = { ...this.position, mediaMs: positionMs, playedMs: positionMs };
    this.emit('playbackSeeked', {
      ...this.identity(),
      positionMs,
      previousPositionMs,
    });
  }

  /** Change linear gain. */
  public async setVolume(gain: number): Promise<void> {
    const previousVolume = this.volume;
    this.volumeCalls.push(gain);
    this.volume = gain;
    this.emit('volumeChanged', {
      ...this.identity(),
      previousVolume,
      volume: gain,
    });
  }

  /** Set the Gateway self-deaf flag. */
  public async setSelfDeaf(enabled: boolean): Promise<void> {
    this.selfDeaf = enabled;
  }

  /** Set the Gateway self-mute flag. */
  public async setSelfMute(enabled: boolean): Promise<void> {
    this.selfMute = enabled;
  }

  /** Read output elapsed time from the logical playback clock. */
  public getPlaybackTime(): number {
    return this.position.mediaMs ?? 0;
  }

  /** Accept staging only when a test asks for it. */
  public async stageNext(_source: unknown, options: StageNextOptions): Promise<StageSnapshot> {
    this.stageOptions.push(options);
    this.staged = {
      expectedGeneration: options.expectedGeneration ?? this.generation,
      entryId: options.entryId,
      queueRevision: options.queueRevision,
      sourceRevision: options.sourceRevision ?? 0,
      state: 'ready',
      bufferedMs: 0,
      info: streamInfo,
      error: null,
    };
    this.emit('stageReady', { ...this.identity(), ...this.staged });
    return this.staged;
  }

  /** Release staged media. */
  public async clearStage(): Promise<void> {
    this.staged = null;
  }

  /** Inspect staged media. */
  public async stagedSource(): Promise<StageSnapshot | null> {
    return this.staged;
  }

  /** Request the real framework staging path for the current generation. */
  public requestPreparation(): void {
    this.emit('prepareRequested', { ...this.identity(), remainingMs: 35000, transitionInMs: 30000 });
  }

  /** Promote a staged occurrence, optionally leaving start delivery to snapshot recovery. */
  public promote(notify = true): () => void {
    const options = this.stageOptions.at(-1);
    if (!options || !this.staged) throw new Error('No independent stage is available');
    const outgoing = {
      ...this.identity(),
      state: 'completed' as const,
      position: this.position,
      continuation: { type: 'promoted' as const, generation: this.generation + 1, entryId: options.entryId },
    };
    this.generation++;
    this.customMetadata = options.customMetadata;
    this.staged = null;
    this.state = 'playing';
    if (notify)
      this.emit('playbackStarted', {
        ...this.identity(),
        state: 'playing',
        info: streamInfo,
        transition: { type: 'crossfade', outgoingGeneration: outgoing.generation, entryId: options.entryId },
      });
    return () => {
      this.emit('playbackCompleted', outgoing);
    };
  }

  /** Emit natural completion without native end-of-stream detection. */
  public complete(reconstructed = false): void {
    this.state = 'completed';
    this.emit('playbackCompleted', {
      ...this.identity(),
      reconstructed,
      state: 'completed',
      position: this.position,
    });
  }

  /** Emit a real failure for the current generation. */
  public fail(error = new Error('independent failure')): void {
    this.state = 'failed';
    this.emit('playbackFailed', {
      ...this.identity(),
      state: 'failed',
      error,
    });
  }
}

/** Backend fixture that owns no native runtime and no Remedia session code. */
export class IndependentBackend implements PlaybackBackend {
  /** Stable diagnostic identity. */
  public readonly id = 'independent';

  /** Capabilities are replaced by tests that need staging or processing. */
  public readonly capabilities: PlaybackBackendCapabilities;

  /** Gateway dispatches delivered after initialization. */
  public readonly received: Record<string, unknown>[] = [];

  /** Sessions created through the public contract. */
  public readonly sessions: IndependentSession[] = [];

  /** Gateway payloads emitted through the configured send callback. */
  public readonly sent: Array<{ guildId: string; payload: unknown }> = [];

  /** Configuration consumed by the next session creation. */
  public readonly sessionConfigs: IndependentSessionConfig[] = [];

  /** Initialization context supplied by the Player. */
  public context: PlaybackBackendContext | null = null;

  /** Number of initialization attempts. */
  public initializeCalls = 0;

  /** Number of teardown attempts. */
  public destroyCalls = 0;

  /** Optional initialization hook for races and failures. */
  public initializeHook: ((context: PlaybackBackendContext) => Promise<void>) | null = null;

  /** Optional teardown hook for cleanup failures. */
  public destroyHook: (() => Promise<void>) | null = null;

  /** Optional session creation hook for delayed creation. */
  public createSessionHook:
    | ((options: DiscordSessionOptions, signal: AbortSignal) => PlaybackSession | Promise<PlaybackSession>)
    | null = null;

  /** Gateway sender exposed to the backend context. */
  public readonly send: DiscordGatewaySend = (guildId, payload) => {
    this.sent.push({ guildId, payload });
  };

  /** Create a backend with explicit feature declarations. */
  public constructor(
    capabilities: PlaybackBackendCapabilities = {
      sources: ['url', 'file', 'buffer', 'stream', 'operation'],
      crossfade: false,
      filters: false,
    },
  ) {
    this.capabilities = capabilities;
  }

  /** Initialize without allocating native resources. */
  public async initialize(context: PlaybackBackendContext): Promise<void> {
    this.initializeCalls++;
    this.context = context;
    await this.initializeHook?.(context);
  }

  /** Record the complete Gateway dispatch stream. */
  public receive(packet: Record<string, unknown>): void {
    this.received.push(packet);
  }

  /** Create a standalone session or delegate to a test hook. */
  public async createSession(options: DiscordSessionOptions, signal: AbortSignal): Promise<PlaybackSession> {
    if (this.createSessionHook) return this.createSessionHook(options, signal);

    signal.throwIfAborted();
    const config = this.sessionConfigs.shift() ?? {};
    const session = new IndependentSession(options, config);
    this.sessions.push(session);

    return session;
  }

  /** Release the backend without a native runtime. */
  public async destroy(): Promise<void> {
    this.destroyCalls++;
    await this.destroyHook?.();
  }
}
