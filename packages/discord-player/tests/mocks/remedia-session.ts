import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  DiscordConnectOptions,
  DiscordSession,
  DiscordSessionOptions,
  MediaSource,
  PlayOptions,
  StageNextOptions,
  StageSnapshot,
} from '@remedia/client';

/** Minimal deterministic Remedia session used by lifecycle tests. */
export class FakeSession
  extends EventEmitter
  implements
    Pick<
      DiscordSession,
      | 'connect'
      | 'move'
      | 'disconnect'
      | 'dispose'
      | 'setVolume'
      | 'setSelfDeaf'
      | 'setSelfMute'
      | 'pause'
      | 'resume'
      | 'seek'
      | 'stop'
      | 'play'
    >
{
  /** Stable identity exposed in lifecycle events. */
  public readonly sessionId = randomUUID();

  /** Bot guild identifier. */
  public readonly guildId: string;

  /** Current voice channel identifier. */
  public channelId: string;

  /** Bot user identifier. */
  public readonly userId = 'bot-user';

  /** Selected Remedia node identifier. */
  public readonly nodeId: string;

  /** Embedded or remote node kind. */
  public readonly nodeType: 'embedded' | 'remote';

  /** Current raw playback state. */
  public state: 'idle' | 'playing' | 'paused' | 'stopped' | 'completed' | 'failed' = 'idle';

  /** Current voice connection state. */
  public connectionState: 'connected' | 'disconnected' = 'disconnected';

  /** Current linear gain value. */
  public volume: number;

  /** Current Gateway self-deaf setting. */
  public selfDeaf: boolean;

  /** Current Gateway self-mute setting. */
  public selfMute: boolean;

  /** Current position snapshot. */
  public position = {
    mediaMs: 0 as number | null,
    mediaPositionAccuracy: 'estimated' as const,
    submittedMs: 0,
    playedMs: 0 as number | null,
  };

  /** Output elapsed time reported by Remedia's playback clock; independent of the source position. */
  public elapsedMs = 0;

  /** Current source duration. */
  public durationMs: number | null = 60_000;

  /** Filtergraph controls exposed by Remedia. */
  public filters = {
    graph: null as string | null,

    set: async (graph: string) => {
      this.filters.graph = graph;
    },

    clear: async () => {
      this.filters.graph = null;
    },
  };

  /** Persistent session configuration snapshot. */
  public get snapshot(): Pick<
    DiscordSession['snapshot'],
    'filterGraph' | 'crossfade' | 'generation' | 'source' | 'state' | 'staged'
  > {
    return {
      filterGraph: this.filters.graph,
      crossfade: this.crossfade
        ? { durationMs: 5000, prepareBeforeMs: 30000, curve: 'equalPower', ...this.crossfade }
        : null,
      generation: this.generation,
      source: this.info,
      state: this.state,
      staged: this.stage,
    };
  }

  /** Negotiated native crossfade policy. */
  public crossfade: DiscordSessionOptions['crossfade'];

  /** Current staged source. */
  public stage: StageSnapshot | null = null;

  /** Submitted stage identities and metadata. */
  public stageOptions: StageNextOptions[] = [];

  /** Current decoded source information. */
  public info = {
    streamIndex: 0,
    codec: 'opus',
    sampleRate: 48000,
    channels: 2,
    channelLayout: 'stereo',
    durationMs: 60000,
    bitRate: 128000,
    metadata: {},
  };

  /** Request automatic upcoming source preparation. */
  public requestPreparation(): void {
    this.emit('prepareRequested', {
      sessionId: this.sessionId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      remainingMs: 35000,
      transitionInMs: 30000,
    });
  }

  /** Submit a staged source without starting another play operation. */
  public async stageNext(_source: MediaSource, options: StageNextOptions): Promise<StageSnapshot> {
    this.stageOptions.push(options);

    this.stage = {
      expectedGeneration: options.expectedGeneration!,
      entryId: options.entryId,
      queueRevision: options.queueRevision,
      sourceRevision: options.sourceRevision ?? 0,
      state: 'ready',
      bufferedMs: 2000,
      info: this.info,
      error: null,
    };

    this.emit('stageReady', { ...this.stage, sessionId: this.sessionId, generation: this.generation });

    return this.stage;
  }

  /** Release staged media. */
  public async clearStage(): Promise<void> {
    this.stage = null;
  }

  /** Inspect staged media. */
  public async stagedSource(): Promise<StageSnapshot | null> {
    return this.stage;
  }

  /** Promote the staged source, returning the outgoing completion for delayed delivery. */
  public promote(): () => void {
    const options = this.stageOptions.at(-1)!;
    const outgoing = {
      sessionId: this.sessionId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'completed',
      continuation: { type: 'promoted', generation: this.generation + 1, entryId: options.entryId },
    };

    this.generation++;
    this.elapsedMs = 0;
    this.customMetadata = options.customMetadata;
    this.stage = null;

    this.emit('playbackStarted', {
      sessionId: this.sessionId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'playing',
      info: this.info,
      transition: { type: 'crossfade', outgoingGeneration: outgoing.generation, entryId: options.entryId },
    });

    return () => this.emit('playbackCompleted', outgoing);
  }

  /** Count of raw play calls. */
  public playCalls = 0;

  /** Count of disconnect calls. */
  public disconnectCalls = 0;

  /** Number of ownership-releasing disposal calls. */
  public disposeCalls = 0;

  /** Whether Remedia has unregistered the session. */
  public disposed = false;

  /** Initial and repeated voice connection options passed by Discord Player. */
  public connectOptions: DiscordConnectOptions[] = [];

  /** Current Remedia generation. */
  public generation = 0;

  /** Metadata attached to the current raw generation. */
  public customMetadata: unknown;

  /** Create a deterministic fake session. */
  public constructor(
    options: DiscordSessionOptions,
    nodeType: 'embedded' | 'remote',
    private readonly onDispose?: () => void,
  ) {
    super();
    this.crossfade = options.crossfade;
    this.guildId = options.guildId;
    this.channelId = options.channelId;
    this.nodeId = options.nodeId ?? 'fake-node';
    this.nodeType = nodeType;
    this.volume = options.volume ?? 1;
    this.selfDeaf = options.selfDeaf ?? true;
    this.selfMute = options.selfMute ?? false;
    this.filters.graph = options.filterGraph ?? null;
  }

  /** Mark the fake voice session connected. */
  public async connect(options: DiscordConnectOptions = {}): Promise<void> {
    this.connectOptions.push(options);
    this.connectionState = 'connected';
  }

  /** Move this logical session to another voice channel. */
  public async move(channelId: string): Promise<void> {
    this.channelId = channelId;
    this.connectionState = 'connected';
  }

  /** Stop and disconnect the fake voice session. */
  public async disconnect(): Promise<void> {
    this.disconnectCalls++;
    this.connectionState = 'disconnected';
  }

  /** Disconnect and unregister the fake session exactly once, matching Remedia's dispose contract. */
  public async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.disposeCalls++;

    try {
      await this.disconnect();
    } finally {
      this.onDispose?.();
      this.emit('sessionDisposed', {
        sessionId: this.sessionId,
        guildId: this.guildId,
        nodeId: this.nodeId,
        generation: this.generation,
      });
    }
  }

  /** Set linear gain. */
  public async setVolume(gain: number): Promise<void> {
    const previousVolume = this.volume;

    this.volume = gain;
    this.emit('volumeChanged', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
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

  /** Pause raw playback. */
  public async pause(): Promise<void> {
    this.state = 'paused';
  }

  /** Resume raw playback. */
  public async resume(): Promise<void> {
    this.state = 'playing';
  }

  /** Return output elapsed time from Remedia's playback clock. */
  public getPlaybackTime(): number {
    return this.elapsedMs;
  }

  /** Seek raw playback. */
  public async seek(positionMs: number): Promise<void> {
    this.elapsedMs = positionMs;
    this.position = { ...this.position, mediaMs: positionMs, playedMs: positionMs };
  }

  /** Start one raw Remedia generation and emit its start lifecycle event. */
  public async play(
    _source: MediaSource,
    options?: PlayOptions<unknown>,
  ): Promise<{
    streamIndex: number;

    codec: string;

    sampleRate: number;

    channels: number;

    channelLayout: string;

    durationMs: number | null;

    bitRate: number;

    metadata: Record<string, string>;
  }> {
    this.playCalls++;
    this.generation++;
    this.elapsedMs = 0;
    this.state = 'playing';
    this.customMetadata = options?.customMetadata;

    const event = {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'playing' as const,
      info: {
        streamIndex: 0,
        codec: 'opus',
        sampleRate: 48_000,
        channels: 2,
        channelLayout: 'stereo',
        durationMs: this.durationMs,
        bitRate: 128_000,
        metadata: {},
      },
    };

    this.emit('playbackStarted', event);

    return event.info;
  }

  /** Emit natural completion for the current generation. */
  public complete(reconstructed = false): void {
    this.state = 'completed';

    this.emit('playbackCompleted', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      reconstructed,
      state: 'completed',
      position: this.position,
    });
  }

  /** Emit a stop event for the current generation. */
  public async stop(): Promise<void> {
    this.state = 'stopped';

    this.emit('playbackStopped', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'stopped',
      reason: 'test-stop',
    });
  }

  /** Emit a failed event for the current generation. */
  public fail(error = new Error('decode failed')): void {
    this.state = 'failed';

    this.emit('playbackFailed', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'failed',
      error,
    });
  }
}
