import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  DiscordConnectOptions,
  DiscordSession,
  DiscordSessionOptions,
  MediaSource,
  PlayOptions,
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
  public get snapshot() {
    return { filterGraph: this.filters.graph };
  }
  /** Count of raw play calls. */
  public playCalls = 0;
  /** Count of disconnect calls. */
  public disconnectCalls = 0;
  /** Initial and repeated voice connection options passed by Discord Player. */
  public connectOptions: DiscordConnectOptions[] = [];
  /** Current Remedia generation. */
  public generation = 0;
  /** Metadata attached to the current raw generation. */
  public customMetadata: unknown;

  /** Create a deterministic fake session. */
  public constructor(options: DiscordSessionOptions, nodeType: 'embedded' | 'remote') {
    super();
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
  /** Set linear gain. */
  public async setVolume(gain: number): Promise<void> {
    this.volume = gain;
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
  /** Seek raw playback. */
  public async seek(positionMs: number): Promise<void> {
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
