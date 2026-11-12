import type {
  AudioStreamInfo,
  DiscordConnectOptions,
  DiscordSession,
  DiscordSessionEvents,
  DiscordSessionOptions,
  MediaSource,
  PlayOptions,
  RemediaClientOptions,
  StageNextOptions,
  StageSnapshot,
} from '@remedia/client';

/** Shared session event schemas. Backends emit their real events with original generation metadata. */
export type PlaybackBackendEvents<Metadata = unknown> = DiscordSessionEvents<Metadata>;

/** Encoded media descriptor accepted by the framework source pipeline. */
export type PlaybackSource = MediaSource;

/** Session creation settings; node placement is specific to the default Remedia backend. */
export type PlaybackSessionOptions = DiscordSessionOptions;

/** Explicit capabilities of a custom playback provider. */
export interface PlaybackBackendCapabilities {
  /** Encoded descriptor variants the backend can actually consume. */
  readonly sources: readonly ('url' | 'file' | 'buffer' | 'stream' | 'operation')[];

  /** Whether generation-aware staging, promotion and reconciliation are implemented. */
  readonly crossfade: boolean;

  /** Whether raw filtergraphs and the built-in named presets are supported. */
  readonly filters: boolean;

  /** Accessible standalone source deployments; required for operation descriptors. */
  readonly pluginHosts?: readonly string[];
}

/** Initialization services supplied before the provider creates playback resources. */
export interface PlaybackBackendContext {
  /** Discord bot user identity. */
  readonly clientId: string;

  /** Combined Player and provider lifetime; abort pending work immediately when it ends. */
  readonly signal: AbortSignal;

  /** Configured shard-aware Gateway sender. */
  readonly send: RemediaClientOptions['send'];
}

type EventSubscription<Metadata> = {
  [K in keyof PlaybackBackendEvents<Metadata>]: (
    name: K,
    listener: (...args: PlaybackBackendEvents<Metadata>[K]) => void,
  ) => void;
}[keyof PlaybackBackendEvents<Metadata>];

// Closed overloads preserve event tuple inference without depending on a concrete emitter class.
type Overloads<T> = (T extends T ? (overload: T) => void : never) extends (overload: infer I) => void ? I : never;

/** Minimal structural session consumed by queue orchestration, independent of concrete native classes. */
export interface PlaybackSession<Metadata = unknown> {
  /** Stable, unique session identity, never reused after disposal. */
  readonly sessionId: string;

  /** Owning guild. */
  readonly guildId: string;

  /** Current voice destination. */
  readonly channelId: string;

  /** Backend node identity, or null when there is no node concept. */
  readonly nodeId: string | null;

  /** Current transport state, separate from playback state. */
  readonly connectionState: DiscordSession['connectionState'];

  /** Playback state for the current generation. */
  readonly state: DiscordSession['state'];

  /** Current position measurements; unavailable media positions are null. */
  readonly position: DiscordSession['position'];

  /** Source duration, or null when unknown. */
  readonly durationMs: number | null;

  /** Linear gain from zero through two. */
  readonly volume: number;

  /** Gateway self-deaf flag. */
  readonly selfDeaf: boolean;

  /** Gateway self-mute flag. */
  readonly selfMute: boolean;

  /** Retained generation, state and source data used for lifecycle reconciliation. */
  readonly snapshot: Pick<
    DiscordSession['snapshot'],
    'generation' | 'state' | 'source' | 'filterGraph' | 'crossfade' | 'staged'
  >;

  /** Optional advanced processing controls, required only when filters are declared. */
  readonly filters?: {
    /** Current raw graph, or null. */
    readonly graph: string | null;
    /**
     * Set a supported graph.
     * @param graph Validated raw graph.
     */
    set(graph: string): Promise<void>;
    /** Disable processing. */
    clear(): Promise<void>;
  };

  /** Subscribe to real typed lifecycle notifications.
   * @param name Event name.
   * @param listener Typed event callback.
   */
  readonly on: Overloads<EventSubscription<Metadata>>;

  /** Release an owned listener, leaving application listeners intact.
   * @param name Event name.
   * @param listener Original callback.
   */
  readonly off: Overloads<EventSubscription<Metadata>>;

  /** Join voice, honoring cancellation.
   * @param options Deadline and cancellation.
   */
  connect(options?: DiscordConnectOptions): Promise<void>;

  /** Move the same logical session.
   * @param channelId New voice destination.
   */
  move(channelId: string): Promise<void>;

  /** Dispose idempotently, cancelling pending connection/play and releasing inputs. */
  dispose(): Promise<void>;

  /** Start a new monotonic generation; preserve customMetadata in all its events.
   * @param source Encoded media.
   * @param options Metadata and cancellation.
   */
  play(source: PlaybackSource, options?: PlayOptions<Metadata>): Promise<AudioStreamInfo>;

  /** Stop the current generation and emit playbackStopped once. */
  stop(): Promise<void>;

  /** Pause the current generation. */
  pause(): Promise<void>;

  /** Resume the same generation. */
  resume(): Promise<void>;

  /** Seek on the media timeline. Reject unsupported sources.
   * @param positionMs Finite nonnegative position.
   */
  seek(positionMs: number): Promise<void>;

  /** Change linear gain.
   * @param gain Value from zero through two.
   */
  setVolume(gain: number): Promise<void>;

  /** Set the voice self-deaf flag.
   * @param enabled Requested flag.
   */
  setSelfDeaf(enabled: boolean): Promise<void>;

  /** Set the voice self-mute flag.
   * @param enabled Requested flag.
   */
  setSelfMute(enabled: boolean): Promise<void>;

  /** Read output elapsed milliseconds without scheduling asynchronous work. */
  getPlaybackTime(): number;

  /** Optional staging.
   * @param source Next encoded media.
   * @param options Occurrence and generation fences.
   */
  stageNext?(source: PlaybackSource, options: StageNextOptions<Metadata>): Promise<StageSnapshot>;

  /** Optional idempotent stage cancellation. */
  clearStage?(): Promise<void>;

  /** Optional stage reconciliation. */
  stagedSource?(): Promise<StageSnapshot | null>;
}

/** Advanced local provider. The framework retains ownership of queues and session references. */
export interface PlaybackBackend {
  /** Stable diagnostic identity. */
  readonly id: string;

  /** Explicit feature declarations; unsupported operations must reject. */
  readonly capabilities: PlaybackBackendCapabilities;

  /** Initialize without creating a Remedia runtime.
   * @param context Gateway services and lifetime.
   */
  initialize(context: PlaybackBackendContext): Promise<void>;

  /** Consume the complete Gateway dispatch stream.
   * @param packet Original dispatch packet.
   */
  receive(packet: Record<string, unknown>): void;

  /** Create a new session; the framework owns connection and listener attachment.
   * @param options Session identity and settings.
   * @param signal Queue lifetime.
   */
  createSession(options: PlaybackSessionOptions, signal: AbortSignal): PlaybackSession | Promise<PlaybackSession>;

  /** Release all remaining provider resources, including partially initialized resources. Must be idempotent. */
  destroy(): Promise<void>;
}

declare module '@discord-player/plugin-host' {
  interface ProviderMap {
    /** Player-local playback implementation, selected before native resource initialization. */
    'playback.backend': PlaybackBackend;
  }
}
