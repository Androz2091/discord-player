import { randomInt, randomUUID } from 'node:crypto';
import type { DiscordSession, DiscordSessionEvents, NodeSelection, PlayOptions } from '@remedia/client';
import { AsyncQueue } from '../utils/async-queue.js';
import type { GuildQueueManager } from '../managers/guild-queue.manager.js';
import { GuildQueueHistoryManager } from '../managers/guild-queue-history.manager.js';
import { Queue } from './common/queue.js';
import { QueueCapacityError } from '../errors.js';
import { GuildQueueEvents, type GuildQueueEventsMap } from './common/guild-queue-events.js';
import type { GuildQueuePlayerNodeSessionCreateOptions, PlayRawResult } from './guild-queue-player-node.js';
import { GuildQueuePlayerNode } from './guild-queue-player-node.js';
import { Playlist } from './playlist.js';
import { SearchResult } from './search-result.js';
import { Track } from './track.js';

/** Repeat policy applied after a managed playback generation reaches a terminal event. */
export const QueueRepeatMode = {
  /** Stop when the upcoming queue is empty. */
  OFF: 0,
  /** Replay the current track until it is skipped or stopped. */
  TRACK: 1,
  /** Append completed tracks to the end of the upcoming queue. */
  QUEUE: 2,
  /** Emit the autoplay boundary event when the queue becomes empty. */
  AUTOPLAY: 3,
} as const;

/** A supported queue repeat mode. */
export type QueueRepeatMode = (typeof QueueRepeatMode)[keyof typeof QueueRepeatMode];

/** A track identifier accepted by queue navigation and mutation methods. */
export type TrackResolvable = Track | string | number;

/** Reason supplied with the v7-compatible `playerSkip` queue event. */
export enum TrackSkipReason {
  /** Track source could not be resolved. */
  NoStream = 'ERR_NO_STREAM',
  /** User explicitly skipped the current Track. */
  Manual = 'MANUAL',
  /** Seek request exceeded the current Track duration. */
  SEEK_OVER_THRESHOLD = 'SEEK_OVER_THRESHOLD',
  /** Playback jumped to another upcoming Track. */
  Jump = 'JUMPED_TO_ANOTHER_TRACK',
  /** Playback skipped directly to another Track. */
  SkipTo = 'SKIP_TO_ANOTHER_TRACK',
  /** History navigation advanced to the next Track. */
  HistoryNext = 'HISTORY_NEXT_TRACK',
}

/** Reason attached to the familiar `playerTrigger` event. */
export type PlayerTriggeredReason = 'filters' | 'normal';

/** Automatic PCM crossfading policy. Changes apply to newly created sessions only. */
export type CrossfadeOptions =
  | false
  | {
      /** Explicitly opt in to native crossfading. */
      enabled: true;
      /** Overlap duration in milliseconds; defaults to 5000. */
      durationMs?: number;
      /** Preparation lead before the fade begins; defaults to 30000 milliseconds. */
      prepareBeforeMs?: number;
      /** Native mixing curve; only equal power is supported. */
      curve?: 'equalPower';
    };

/** Initialization defaults and policies for one guild queue. */
export interface GuildQueueOptions<Metadata = unknown> {
  /** Automatic crossfading for this queue; overrides the Player default at session creation. */
  crossfade?: CrossfadeOptions;
  /** Arbitrary application metadata stored on the queue. */
  metadata?: Metadata;
  /** Optional Remedia node selection policy for this guild. */
  selectNode?: NodeSelection;
  /** Maximum number of upcoming tracks accepted by public insertion methods; non-positive values mean unlimited. */
  maxSize?: number;
  /** Maximum number of previous tracks retained; non-positive values mean unlimited. */
  maxHistorySize?: number;
  /** Disable collecting previous tracks while keeping manual history navigation available. */
  disableHistory?: boolean;
  /** Repeat policy used after natural playback completion. */
  repeatMode?: QueueRepeatMode;
  /** Initial volume percentage, from 0 to 100. */
  volume?: number;
  /** Raw Remedia filtergraph applied to new sessions; null clears filtering. */
  filterGraph?: string | null;
  /** Desired self-deaf setting; Remedia defaults this to true when omitted. */
  selfDeaf?: boolean;
  /** Desired self-mute setting; Remedia defaults this to false when omitted. */
  selfMute?: boolean;
}

/** Options accepted by a queue connection, using Discord Player's familiar percentage volume. */
export interface GuildQueueConnectOptions extends Omit<
  GuildQueuePlayerNodeSessionCreateOptions,
  'selfDeaf' | 'selfMute' | 'volume' | 'filterGraph'
> {
  /** Voice channel to connect to or move the existing session into. */
  channelId: string;
  /** Percentage volume to initialize or apply, from zero through one hundred. */
  volume?: number;
  /** Raw Remedia filtergraph to initialize or apply; null clears filtering. */
  filterGraph?: string | null;
  /** Discord self-deaf state to initialize or apply. */
  selfDeaf?: boolean;
  /** Discord self-mute state to initialize or apply. */
  selfMute?: boolean;
}

/** Queue-level playback options; queue playback still resolves the Track source before calling the raw node. */
export interface GuildQueuePlayOptions<Metadata = unknown> extends PlayOptions<Metadata> {
  /** Connect or move the queue to this voice channel before starting playback. */
  channelId?: string;
  /** Pin a new Remedia session to this node. */
  nodeId?: string;
  /** Optional Discord self-deaf state to initialize or apply. */
  selfDeaf?: boolean;
  /** Optional Discord self-mute state to initialize or apply. */
  selfMute?: boolean;
  /** Volume percentage, from zero through one hundred. */
  volume?: number;
  /** Raw Remedia filtergraph to apply before playback; null clears filtering. */
  filterGraph?: string | null;
  /** Initial voice join timeout in milliseconds; defaults to Remedia's 100 seconds. */
  connectTimeoutMs?: number;
}

/** Result of a queue-managed playback request. */
export interface GuildQueuePlayResult<Metadata = unknown> {
  /** The track selected for this request, or null for an empty search result. */
  track: Track | null;
  /** The immediate Remedia play result when this request started a track. */
  playerResult: PlayRawResult<GuildQueuePlaybackMetadata<Metadata>> | null;
}

type PlaybackTerminalKind = 'natural' | 'stopped' | 'failed';
type PlaybackRequestReason = 'skip' | 'stop' | 'history';

/** Custom metadata stored on a Remedia generation created by queue-managed playback. */
export interface GuildQueuePlaybackMetadata<UserMetadata = unknown> {
  /** Internal identity used to associate remote lifecycle events with this queue operation. */
  __discordPlayer: { queueToken: string; operationId: string };
  /** Application custom metadata passed to `GuildQueue.play()`. */
  userMetadata?: UserMetadata;
}

interface ManagedOperation {
  /** Unique application operation identity, distinct from Remedia generation. */
  id: string;
  /** Track owned by this managed playback operation. */
  track: Track;
  /** Exact session to which this operation was submitted. */
  session: DiscordSession;
  /** Remedia's generation when it becomes known from a lifecycle event. */
  generation: number | null;
  /** Source preparation and play cancellation signal. */
  controller: AbortController;
  /** Current queue-managed phase. */
  phase: 'preparing' | 'starting' | 'playing';
  /** Whether a terminal transition has already been consumed. */
  terminal: boolean;
  /** Optional application request that caused a stop. */
  requestedReason?: PlaybackRequestReason;
  /** First terminal event captured synchronously, before transition serialization. */
  pendingTerminal?: { kind: PlaybackTerminalKind; event: TerminalEvent };
  /** Prevent duplicate start events from reconstructed/replayed lifecycle messages. */
  startEmitted: boolean;
}

interface Reservation {
  operation: ManagedOperation;
  outgoing: ManagedOperation;
  entryId: string;
  queueRevision: number;
  sourceRevision: number;
  repeat: boolean;
}

type StartedEvent = DiscordSessionEvents['playbackStarted'][0];
type TerminalEvent =
  | DiscordSessionEvents['playbackCompleted'][0]
  | DiscordSessionEvents['playbackStopped'][0]
  | DiscordSessionEvents['playbackFailed'][0];

function normalizeLimit(value: number | undefined, fallback: number): number {
  const limit = value ?? fallback;
  if (!Number.isFinite(limit) || limit <= 0) return Infinity;
  return Math.floor(limit);
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** OOP manager for upcoming tracks, playback policy, history, and queue lifecycle. */
export class GuildQueue<Metadata = unknown> {
  /** Upcoming managed tracks, ordered from next to last. */
  public readonly tracks: Queue<Track>;
  /** Raw Remedia session and controls for this queue. */
  public readonly node: GuildQueuePlayerNode<Metadata>;
  /** Previous-track history and navigation manager. */
  public readonly history: GuildQueueHistoryManager<Metadata>;
  /** Keyed async locks used to serialize conflicting queue operations. */
  public readonly tasks: AsyncQueue;
  /** Statistics for queue-managed playback. */
  public readonly stats = {
    tracksAdded: 0,
    tracksStarted: 0,
    tracksFinished: 0,
    tracksFailed: 0,
  };
  #currentTrack: Track | null = null;
  #operation: ManagedOperation | null = null;
  #outgoing = new Map<number, ManagedOperation>();
  #failedIncoming: ManagedOperation | null = null;
  #reservation: Reservation | null = null;
  #prepareRequest: { session: DiscordSession; event: DiscordSessionEvents['prepareRequested'][0] } | null = null;
  #decisionRevision = 0;
  #sourceRevision = 0;
  #committing = false;
  #destroyed = false;
  #queueToken = randomUUID();
  #maxSize: number;
  #maxHistorySize: number;
  #repeatMode: QueueRepeatMode;
  #shuffle = false;
  #lastCustomMetadata: unknown;
  #terminalKeys = new Set<string>();

  /**
   * Create a queue for one guild ID.
   * @param manager Manager that owns and caches this queue.
   * @param guildId Discord guild snowflake or another stable application guild identifier.
   * @param options Queue configuration and application metadata.
   */
  public constructor(
    /** The manager that owns and caches this queue. */
    public readonly manager: GuildQueueManager,
    /** Discord guild snowflake or another stable application guild identifier. */
    public readonly guildId: string,
    /** Queue configuration. */
    public readonly options: GuildQueueOptions<Metadata> = {},
  ) {
    if (
      options.volume !== undefined &&
      (!Number.isFinite(options.volume) || options.volume < 0 || options.volume > 100)
    ) {
      throw new RangeError('Queue volume must be a finite percentage between 0 and 100.');
    }
    this.#maxSize = normalizeLimit(options.maxSize, Infinity);
    this.#maxHistorySize = normalizeLimit(options.maxHistorySize, Infinity);
    this.#repeatMode = options.repeatMode ?? QueueRepeatMode.OFF;
    this.tracks = new Queue<Track>();
    this.tasks = new AsyncQueue();
    this.tracks.onMutation = () => this.queueChanged();
    this.node = new GuildQueuePlayerNode(this);
    this.history = new GuildQueueHistoryManager(this);
    this.emit(GuildQueueEvents.QueueCreate);
  }

  /**
   * Emit a typed guild queue event through this Player's queue event emitter.
   * @param event Public queue event name.
   * @param args Event arguments after the queue instance, in v7-compatible order.
   * @returns Whether any registered listener handled the event.
   */
  public emit<Event extends keyof GuildQueueEventsMap>(
    event: Event,
    ...args: GuildQueueEventsMap[Event] extends [unknown, ...infer Rest] ? Rest : never
  ): boolean {
    if (this.#destroyed && event !== GuildQueueEvents.QueueDelete) return false;
    const emitter = this.manager.player.events as unknown as {
      emit(event: string | symbol, ...args: unknown[]): boolean;
    };
    return emitter.emit(event as string, this, ...args);
  }

  /** Convenient alias for `guildId`. */
  public get id(): string {
    return this.guildId;
  }
  /** Arbitrary application metadata stored on this queue. */
  public get metadata(): Metadata {
    return this.options.metadata as Metadata;
  }
  /**
   * Replace the arbitrary queue metadata.
   * @param value New application metadata.
   */
  public set metadata(value: Metadata) {
    this.options.metadata = value;
  }
  /** Whether this queue has been destroyed and removed from its manager. */
  public get destroyed(): boolean {
    return this.#destroyed;
  }
  /** The current managed track, including a paused track. */
  public get currentTrack(): Track | null {
    return this.#currentTrack;
  }
  /** Number of upcoming tracks, excluding the current track. */
  public get size(): number {
    return this.tracks.size;
  }
  /** Maximum number of upcoming tracks accepted by public insertions. */
  public get maxSize(): number {
    return this.#maxSize;
  }
  /** Maximum number of previous tracks retained. */
  public get maxHistorySize(): number {
    return this.#maxHistorySize;
  }
  /** Current repeat policy. */
  public get repeatMode(): QueueRepeatMode {
    return this.#repeatMode;
  }
  /**
   * Set the repeat policy.
   * @param mode Repeat behavior to apply after natural playback completion.
   */
  public set repeatMode(mode: QueueRepeatMode) {
    this.setRepeatMode(mode);
  }
  /** Sum of upcoming track durations in milliseconds. */
  public get estimatedDuration(): number {
    return this.tracks.toArray().reduce((sum, track) => sum + track.durationMS, 0);
  }
  /** Human-readable sum of upcoming track durations. */
  public get durationFormatted(): string {
    const seconds = Math.floor(this.estimatedDuration / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${minutes}:${String(remainder).padStart(2, '0')}`;
  }
  /** Whether dynamic shuffle is enabled. */
  public get isShuffling(): boolean {
    return this.#shuffle;
  }

  /**
   * Add one Track, an array of Tracks, or a Playlist to the upcoming queue.
   * @param track Track, batch, or playlist to append.
   * @throws QueueCapacityError When the insertion would exceed `maxSize`.
   */
  public addTrack(track: Track | Track[] | Playlist): void {
    this.assertAlive();
    const incoming = track instanceof Playlist ? track.tracks : Array.isArray(track) ? track : [track];
    this.assertCapacity(incoming.length);
    this.tracks.merge(incoming);
    this.stats.tracksAdded += incoming.length;
    if (incoming.length === 1) this.emit(GuildQueueEvents.AudioTrackAdd, incoming[0]!);
    else this.emit(GuildQueueEvents.AudioTracksAdd, incoming);
  }

  /**
   * Add multiple Tracks to the upcoming queue.
   * @param tracks Tracks to append in their existing order.
   */
  public addTracks(tracks: Track[]): void {
    this.addTrack(tracks);
  }

  /**
   * Remove the first matching Track, ID, title, URL, or numeric queue index.
   * @param track Track reference, identifier, title, URL, or zero-based upcoming index.
   * @returns The removed Track, or `undefined` when no match exists.
   */
  public removeTrack(track: TrackResolvable): Track | undefined {
    this.assertAlive();
    const items = this.tracks.toArray();
    const index =
      typeof track === 'number'
        ? track
        : items.findIndex((item) => item === track || item.id === track || item.title === track || item.url === track);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return undefined;
    const removed = this.tracks.removeAt(index);
    if (removed) this.emit(GuildQueueEvents.AudioTrackRemove, removed);
    return removed;
  }

  /**
   * Insert one or more Tracks before `index`; defaults to the queue head.
   * @param track Track, batch, or Queue to insert.
   * @param index Zero-based insertion index.
   * @throws QueueCapacityError When the insertion would exceed `maxSize`.
   */
  public prepend(track: Track | Track[] | Queue<Track>, index = 0): void {
    this.insertTracks(this.toTracks(track), index);
  }

  /**
   * Append one or more Tracks; with an explicit index they are inserted after that index.
   * @param track Track, batch, or Queue to insert.
   * @param index Optional existing queue index after which to insert.
   * @throws QueueCapacityError When the insertion would exceed `maxSize`.
   */
  public append(track: Track | Track[] | Queue<Track>, index?: number): void {
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index > this.size)) {
      throw new RangeError(`Queue index must be an integer between 0 and ${this.size}.`);
    }
    const insertionIndex = index === undefined || index === this.size ? this.size : index + 1;
    this.insertTracks(this.toTracks(track), insertionIndex);
  }

  /**
   * Insert a Track at an upcoming queue index.
   * @param track Track to insert.
   * @param index Zero-based insertion index.
   */
  public insertTrack(track: Track, index = 0): void {
    this.insertTracks([track], index);
  }

  /**
   * Move an upcoming Track to a new queue index.
   * @param track Track reference, identifier, title, URL, or current index.
   * @param index Destination index after removal.
   */
  public moveTrack(track: TrackResolvable, index = 0): void {
    this.assertAlive();
    const items = this.tracks.toArray();
    const source = this.resolveTrackIndex(items, track);
    if (source < 0) return;
    this.assertIndex(index, items.length);
    this.tracks.move(source, Math.min(index, items.length - 1));
  }

  /**
   * Copy an upcoming Track reference to a new queue index.
   * @param track Track reference, identifier, title, URL, or current index.
   * @param index Destination insertion index.
   */
  public copyTrack(track: TrackResolvable, index = 0): void {
    this.assertAlive();
    const items = this.tracks.toArray();
    const source = this.resolveTrackIndex(items, track);
    if (source < 0) return;
    this.insertTracks([items[source]!], index);
  }

  /**
   * Swap two upcoming Tracks by reference, ID, title, URL, or queue index.
   * @param source First Track reference, identifier, title, URL, or index.
   * @param destination Second Track reference, identifier, title, URL, or index.
   */
  public swapTracks(source: TrackResolvable, destination: TrackResolvable): void {
    this.assertAlive();
    const items = this.tracks.toArray();
    const left = this.resolveTrackIndex(items, source);
    const right = this.resolveTrackIndex(items, destination);
    if (left < 0 || right < 0) return;
    this.tracks.swap(left, right);
  }

  /** Clear upcoming Tracks and previous-track history; the current playback continues. */
  public clear(): void {
    this.tracks.clear();
    this.history.clear();
  }

  /** Get the current upcoming queue size. */
  public getSize(): number {
    return this.size;
  }
  /** Get the configured maximum upcoming queue size. */
  public getMaxSize(): number {
    return this.maxSize;
  }
  /** Get the configured history limit. */
  public getMaxHistorySize(): number {
    return this.maxHistorySize;
  }
  /** Whether there are no upcoming Tracks. */
  public isEmpty(): boolean {
    return this.tracks.isEmpty();
  }
  /** Whether public insertions have reached the configured queue limit. */
  public isFull(): boolean {
    return Number.isFinite(this.maxSize) && this.size >= this.maxSize;
  }
  /** Remaining public insertion capacity, or Infinity for an unbounded queue. */
  public getCapacity(): number {
    return Number.isFinite(this.maxSize) ? Math.max(0, this.maxSize - this.size) : Infinity;
  }

  /**
   * Change the maximum upcoming queue size; values below one mean unlimited.
   * @param size New capacity; `Infinity` or a non-positive finite value means unlimited.
   */
  public setMaxSize(size: number): void {
    if (!Number.isFinite(size) && size !== Infinity)
      throw new TypeError('maxSize must be a finite number or Infinity.');
    this.#maxSize = normalizeLimit(size, Infinity);
  }

  /**
   * Change the maximum retained history size; values below one mean unlimited.
   * @param size New history limit; `Infinity` or a non-positive finite value means unlimited.
   */
  public setMaxHistorySize(size: number): void {
    if (!Number.isFinite(size) && size !== Infinity)
      throw new TypeError('maxHistorySize must be a finite number or Infinity.');
    this.#maxHistorySize = normalizeLimit(size, Infinity);
    this.history.tracks.setMaxSize(this.#maxHistorySize);
  }

  /**
   * Set repeat policy for natural completion.
   * @param mode Repeat behavior to apply after natural playback completion.
   */
  public setRepeatMode(mode: QueueRepeatMode): void {
    if (!Object.values(QueueRepeatMode).includes(mode)) throw new RangeError(`Unknown repeat mode: ${mode}`);
    this.#repeatMode = mode;
    this.policyChanged();
  }

  /**
   * Enable dynamic random selection, or shuffle the upcoming queue in place.
   * @param dynamic When true, choose tracks dynamically; when false, immediately shuffle the current order.
   * @returns `true` after enabling or applying a shuffle.
   */
  public enableShuffle(dynamic = true): boolean {
    this.policyChanged();
    if (dynamic) this.#shuffle = true;
    else this.tracks.shuffle();
    return true;
  }

  /** Disable dynamic random selection. An earlier in-place shuffle is not reversible. */
  public disableShuffle(): boolean {
    this.policyChanged();
    this.#shuffle = false;
    return true;
  }

  /**
   * Toggle dynamic shuffle, or immediately shuffle the upcoming queue in place.
   * @param dynamic When false, shuffle the current order without changing the dynamic setting.
   * @returns New dynamic shuffle state, or `true` after an immediate shuffle.
   */
  public toggleShuffle(dynamic = true): boolean {
    if (!dynamic) {
      this.tracks.shuffle();
      return true;
    }
    this.policyChanged();
    this.#shuffle = !this.#shuffle;
    return this.#shuffle;
  }

  /** Whether a queue-managed playback generation is active, including paused playback. */
  public isPlaying(): boolean {
    return !!this.#operation && !this.#operation.terminal;
  }

  /**
   * Connect to or move the queue's logical Remedia session.
   * @param options Channel, node, and voice policy settings for the session.
   * @returns The queue's connected Remedia session.
   */
  public async connect(options: GuildQueueConnectOptions): Promise<DiscordSession> {
    using _lock = await this.tasks.acquire('queue.playback-transition');
    this.assertAlive();
    return this.connectLocked(options);
  }

  /**
   * Queue-aware playback entry point. Adds tracks and starts one when no managed generation is active.
   * @param resource Track, batch, playlist, or search result to queue.
   * @param options Queue connection settings and Remedia playback options.
   * @returns The selected Track and its immediate raw play result, if playback started.
   */
  public async play<PlaybackMetadata = unknown>(
    resource: Track | Track[] | Playlist | SearchResult,
    options: GuildQueuePlayOptions<PlaybackMetadata> = {},
  ): Promise<GuildQueuePlayResult<PlaybackMetadata>> {
    let selected: Track | null = null;
    let work: Promise<PlayRawResult<GuildQueuePlaybackMetadata<PlaybackMetadata>> | null> | null = null;
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      this.assertAlive();
      const incoming =
        resource instanceof Track
          ? [resource]
          : resource instanceof Playlist
            ? resource.tracks
            : resource instanceof SearchResult
              ? resource.first(1)
              : resource;
      if (!incoming?.length) return { track: null, playerResult: null };
      if (options.channelId) {
        await this.connectLocked({ ...options, channelId: options.channelId });
      } else if (!this.node.getSession(false)) {
        throw new Error('This queue has no voice session. Pass channelId or call queue.connect() first.');
      } else if (
        options.nodeId !== undefined ||
        options.selfDeaf !== undefined ||
        options.selfMute !== undefined ||
        options.volume !== undefined ||
        options.filterGraph !== undefined
      ) {
        await this.connectLocked({
          ...options,
          channelId: this.node.getSession().channelId,
        });
      }
      this.addTrack(incoming);
      selected = incoming[0] ?? null;
      if (!this.#operation) {
        selected = this.takeNextTrack() ?? null;
        if (selected) {
          this.#lastCustomMetadata = options.customMetadata;
          work = this.beginTrackLocked(selected, options);
        }
      }
    }
    const playerResult = work ? await work : null;
    return { track: selected, playerResult };
  }

  /**
   * Skip the current managed Track and start the next upcoming Track.
   * @param reason v7-compatible skip reason to include in `playerSkip`.
   * @param description Human-readable reason for the skip.
   * @returns The Track selected next, or `null` when no Track is available.
   */
  public async skip(
    reason: TrackSkipReason = TrackSkipReason.Manual,
    description = 'Skipped by user',
  ): Promise<Track | null> {
    return this.terminateCurrent('skip', reason, description);
  }

  /**
   * Skip the current Track and play an upcoming Track selected by reference, identifier, title, URL, or index.
   * @param target Track reference, identifier, title, URL, or upcoming index.
   * @returns The selected Track, or `null` when no match exists.
   */
  public async skipTo(target: TrackResolvable): Promise<Track | null> {
    let targetTrack: Track | null = null;
    let work: Promise<PlayRawResult | null> | null = null;
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      this.assertAlive();
      const items = this.tracks.toArray();
      const index = this.resolveTrackIndex(items, target);
      if (index < 0) return null;
      if (!this.node.getSession(false)) {
        throw new Error('Cannot start a managed Track without a connected Remedia session.');
      }

      await this.cancelPreparation();
      targetTrack = items.splice(index, 1)[0] ?? null;
      this.replaceTracks(items);
      const operation = this.#operation;
      if (operation) {
        operation.requestedReason = 'skip';
        if (operation.phase === 'preparing') operation.controller.abort(new Error('Playback skipped.'));
        else await this.node.stopSession();
        const pending = operation.pendingTerminal;
        work = this.finalizeLocked(
          operation,
          pending?.kind === 'natural' ? 'natural' : 'stopped',
          pending?.event,
          targetTrack ?? undefined,
          TrackSkipReason.SkipTo,
          'Skipped to another track',
        );
      } else if (targetTrack) {
        work = this.beginTrackLocked(targetTrack, {});
      }
    }
    if (work) await work.catch(() => undefined);
    return targetTrack;
  }

  /** Start the next upcoming Track when no managed generation is active. */
  public async playNext(): Promise<Track | null> {
    let selected: Track | null = null;
    let work: Promise<PlayRawResult | null> | null = null;
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      this.assertAlive();
      if (this.#operation) return this.#currentTrack;
      if (this.size && !this.node.getSession(false)) {
        throw new Error('Cannot start a managed Track without a connected Remedia session.');
      }

      selected = this.takeNextTrack() ?? null;
      if (selected)
        work = this.beginTrackLocked(selected, {
          customMetadata: this.#lastCustomMetadata,
        });
    }
    if (work) await work;
    return selected;
  }

  /**
   * Alias for `skipTo()`.
   * @param target Track reference, identifier, title, URL, or upcoming index.
   */
  public jump(target: TrackResolvable): Promise<Track | null> {
    return this.skipTo(target);
  }

  /** Stop managed playback while retaining upcoming tracks. */
  public async stop(): Promise<void> {
    using _lock = await this.tasks.acquire('queue.playback-transition');
    if (this.#destroyed) return;
    const operation = this.#operation;
    if (!operation) return;
    await this.cancelPreparation();
    operation.requestedReason = 'stop';
    if (operation.phase === 'preparing') operation.controller.abort(new Error('Playback stopped.'));
    else await this.node.stopSession();
    const pending = operation.pendingTerminal;
    this.finalizeLocked(operation, pending?.kind === 'natural' ? 'natural' : 'stopped', pending?.event);
  }

  /** Destroy the queue, abort source preparation, close the session, clear state, and remove it from the manager. */
  public async destroy(): Promise<void> {
    if (this.#destroyed) return;
    this.#destroyed = true;
    void this.cancelPreparation();
    for (const operation of this.#outgoing.values()) operation.controller.abort();
    this.#outgoing.clear();
    this.#operation?.controller.abort(new Error('Guild queue destroyed.'));
    using _lock = await this.tasks.acquire('queue.playback-transition');
    this.#operation = null;
    this.#currentTrack = null;
    this.tracks.clear();
    this.history.clear();
    await this.node.destroySession();
    this.manager.cache.delete(this.guildId);
    this.emit(GuildQueueEvents.QueueDelete);
  }

  /** Alias for `destroy()`. */
  public delete(): Promise<void> {
    return this.destroy();
  }

  /**
   * Set and persist the bot's self-deaf state through Remedia.
   * @param enabled Whether the bot should be self-deafened.
   */
  public async setSelfDeaf(enabled = true): Promise<void> {
    await this.setVoicePolicy('setSelfDeaf', enabled);
  }
  /**
   * Set and persist the bot's self-mute state through Remedia.
   * @param enabled Whether the bot should be self-muted.
   */
  public async setSelfMute(enabled = true): Promise<void> {
    await this.setVoicePolicy('setSelfMute', enabled);
  }

  /**
   * Navigate backward through previous tracks, optionally putting the current Track back at the queue head.
   * @param track Historical Track to start.
   * @param preserveCurrent Whether to put the current Track at the upcoming queue head.
   */
  public async playHistoryTrack(track: Track, preserveCurrent = true): Promise<void> {
    let work: Promise<PlayRawResult | null> | null = null;
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      this.assertAlive();
      const operation = this.#operation;
      await this.cancelPreparation();
      const current = this.#currentTrack;
      if (current && preserveCurrent && current !== track) this.tracks.insert(current, 0);
      if (operation) {
        operation.requestedReason = 'history';
        if (operation.phase === 'preparing')
          operation.controller.abort(new Error('History navigation replaced the current track.'));
        else await this.node.stopSession();
        operation.terminal = true;
        this.#operation = null;
        this.#currentTrack = null;
      }
      work = this.beginTrackLocked(track, {});
    }
    await work;
  }

  /**
   * Apply a lifecycle event from the exact current Remedia session. Raw playback has no managed token and is ignored.
   * @param session Exact session that emitted the lifecycle event.
   * @param event Generation-aware Remedia playback-start event.
   */
  public handlePlaybackStarted(session: DiscordSession, event: StartedEvent): void {
    if (event.transition) this.promote(session, event);
    else if (session === this.node.session && !this.matchOperation(session, event)) {
      this.#prepareRequest = null;
      void this.cancelPreparation();
    }
    const operation = this.matchOperation(session, event);
    if (this.#destroyed || !operation || operation.terminal || operation.pendingTerminal || operation.startEmitted)
      return;
    if (operation.generation !== null && operation.generation !== event.generation) return;
    operation.generation = event.generation;
    operation.phase = 'playing';
    operation.startEmitted = true;
    this.stats.tracksStarted++;
    this.emit(GuildQueueEvents.PlayerTrigger, operation.track, 'normal');
    this.emit(GuildQueueEvents.PlayerStart, operation.track, event);
  }

  /**
   * Consume a generation-aware Remedia terminal event once.
   * @param session Exact session that emitted the lifecycle event.
   * @param kind Application-level terminal classification.
   * @param event Generation-aware Remedia completion, stop, or failure event.
   */
  public handlePlaybackTerminal(session: DiscordSession, kind: PlaybackTerminalKind, event: TerminalEvent): void {
    if (this.#destroyed) return;
    if ('continuation' in event && event.continuation && this.#reservation) {
      const reservation = this.#reservation;
      const info = session.snapshot.source;
      if (info && event.continuation.entryId === reservation.entryId)
        this.handlePlaybackStarted(session, {
          sessionId: session.sessionId,
          nodeId: session.nodeId,
          guildId: this.guildId,
          generation: event.continuation.generation,
          state: 'playing',
          info,
          customMetadata: { __discordPlayer: { queueToken: this.#queueToken, operationId: reservation.operation.id } },
          transition: { type: 'crossfade', outgoingGeneration: event.generation, entryId: reservation.entryId },
        });
    }
    const operation = this.matchOperation(session, event);
    if (!operation || operation.terminal) return;
    if (operation.generation !== null && operation.generation !== event.generation) return;
    operation.generation = event.generation;
    const terminalKey = `${event.sessionId}:${event.generation}:${operation.id}`;
    if (this.#terminalKeys.has(terminalKey)) return;
    this.#terminalKeys.add(terminalKey);
    if (this.#terminalKeys.size > 512) this.#terminalKeys.delete(this.#terminalKeys.values().next().value as string);
    operation.pendingTerminal ??= { kind, event };
    void this.processTerminal(operation, kind, event).catch((error) =>
      this.emit(GuildQueueEvents.Error, asError(error)),
    );
  }

  /**
   * Cancel an upcoming reservation without removing its queue occurrence.
   * @returns Resolves after native staged media is released.
   */
  public async cancelPreparation(): Promise<void> {
    const reservation = this.#reservation;
    if (!reservation) return;
    this.#reservation = null;
    if (reservation.operation.phase === 'preparing')
      reservation.operation.controller.abort(new Error('Crossfade reservation invalidated.'));
    using _lock = await this.tasks.acquire('queue.crossfade-stage');
    await reservation.operation.session
      .clearStage()
      .catch((error) => this.debugCrossfade(`clear failed: ${String(error)}`));
    reservation.operation.controller.abort();
  }

  private debugCrossfade(message: string): void {
    this.manager.player.emit('debug', `Queue ${this.guildId}: crossfade ${message}`);
  }

  private policyChanged(): void {
    this.#decisionRevision++;
    this.reprepareAfterMutation();
  }

  private queueChanged(): void {
    this.#decisionRevision++;
    if (!this.#committing && this.#prepareRequest && (!this.#reservation || !this.reservationValid(this.#reservation)))
      this.reprepareAfterMutation();
  }

  private reprepareAfterMutation(): void {
    const request = this.#prepareRequest;
    void this.cancelPreparation().then(() => {
      if (request && request === this.#prepareRequest) this.handlePrepareRequested(request.session, request.event);
    });
  }

  private reservationValid(reservation: Reservation): boolean {
    if (
      this.#destroyed ||
      this.node.session !== reservation.operation.session ||
      this.#operation !== reservation.outgoing ||
      reservation.outgoing.terminal
    )
      return false;
    if (reservation.repeat)
      return (
        this.#repeatMode === QueueRepeatMode.TRACK || (this.#repeatMode === QueueRepeatMode.QUEUE && this.size === 0)
      );
    const index = this.tracks
      .toArray()
      .findIndex((_, occurrenceIndex) => this.tracks.entryId(occurrenceIndex) === reservation.entryId);
    return (
      index >= 0 &&
      this.tracks.at(index) === reservation.operation.track &&
      (this.#shuffle || index === 0) &&
      this.#repeatMode !== QueueRepeatMode.TRACK
    );
  }

  /**
   * Resolve one upcoming occurrence only when Remedia requests preparation.
   * @param session Exact session requesting preparation.
   * @param event Generation and session identity supplied by Remedia.
   */
  public handlePrepareRequested(session: DiscordSession, event: DiscordSessionEvents['prepareRequested'][0]): void {
    const outgoing = this.matchOperation(session, event);
    if (
      !outgoing ||
      outgoing !== this.#operation ||
      outgoing.terminal ||
      outgoing.generation !== event.generation ||
      !session.snapshot.crossfade?.enabled
    )
      return;
    this.#prepareRequest = { session, event };
    if (this.#reservation) return;
    const repeat =
      this.#repeatMode === QueueRepeatMode.TRACK || (this.#repeatMode === QueueRepeatMode.QUEUE && !this.size);
    const index = this.#shuffle && this.size ? randomInt(this.size) : 0;
    const track = repeat ? outgoing.track : this.tracks.at(index);
    if (!track) return;
    const operation: ManagedOperation = {
      id: randomUUID(),
      track,
      session,
      generation: null,
      controller: new AbortController(),
      phase: 'preparing',
      terminal: false,
      startEmitted: false,
    };
    const reservation: Reservation = {
      operation,
      outgoing,
      repeat,
      entryId: repeat ? randomUUID() : this.tracks.entryId(index)!,
      queueRevision: ++this.#decisionRevision,
      sourceRevision: ++this.#sourceRevision,
    };
    this.#reservation = reservation;
    this.debugCrossfade(`preparation requested for ${reservation.entryId}`);
    void this.prepareStage(reservation).catch((error) => {
      if (this.#reservation === reservation) {
        void this.cancelPreparation();
        this.emit(GuildQueueEvents.PlayerError, asError(error), track, undefined);
      }
    });
  }

  private async prepareStage(reservation: Reservation): Promise<void> {
    const { operation } = reservation;
    const source = await this.manager.player.plugins.resolveStream(operation.track, {
      signal: operation.controller.signal,
      remote:
        this.manager.player.getRemedia().nodes.find((node) => node.id === operation.session.nodeId)?.type === 'remote',
      blocked: this.manager.player.options.blockExtractors,
    });
    using _lock = await this.tasks.acquire('queue.crossfade-stage');
    if (this.#reservation !== reservation || !this.reservationValid(reservation) || operation.controller.signal.aborted)
      return;
    operation.phase = 'starting';
    await operation.session.stageNext(source, {
      expectedGeneration: reservation.outgoing.generation!,
      entryId: reservation.entryId,
      queueRevision: reservation.queueRevision,
      sourceRevision: reservation.sourceRevision,
      ...('expiresAtMs' in source && typeof source.expiresAtMs === 'number' && Number.isFinite(source.expiresAtMs)
        ? { expiresAtMs: source.expiresAtMs }
        : {}),
      customMetadata: {
        __discordPlayer: { queueToken: this.#queueToken, operationId: operation.id },
        userMetadata: this.#lastCustomMetadata,
      },
    });
  }

  private promote(session: DiscordSession, event: StartedEvent): void {
    const reservation = this.#reservation;
    if (
      event.sessionId !== session.sessionId ||
      !reservation ||
      event.generation <= (reservation.outgoing.generation ?? Infinity) ||
      event.transition?.entryId !== reservation.entryId ||
      event.transition.outgoingGeneration !== reservation.outgoing.generation ||
      session !== reservation.operation.session
    )
      return;
    if (!this.reservationValid(reservation)) {
      void this.cancelPreparation();
      return;
    }
    const { operation, outgoing } = reservation;
    this.#reservation = null;
    this.#committing = true;
    try {
      if (!reservation.repeat) {
        const index = this.tracks
          .toArray()
          .findIndex((_, occurrenceIndex) => this.tracks.entryId(occurrenceIndex) === reservation.entryId);
        this.tracks.removeAt(index);
      }
    } finally {
      this.#committing = false;
    }
    this.#prepareRequest = null;
    this.#outgoing.set(outgoing.generation!, outgoing);
    this.#operation = operation;
    this.#currentTrack = operation.track;
    operation.generation = event.generation;
    operation.phase = 'playing';
    this.debugCrossfade(`promoted ${reservation.entryId} as generation ${event.generation}`);
  }

  /**
   * Reconcile native stage readiness, invalidation, failures, and cancelled transitions.
   * @param session Exact session emitting the event.
   * @param name Native lifecycle event name.
   * @param event Generation-aware stage or cancellation identity.
   */
  public handleStageEvent(
    session: DiscordSession,
    name: 'stageReady' | 'stageFailed' | 'stageInvalidated' | 'transitionCancelled',
    event: DiscordSessionEvents['stageReady'][0] | DiscordSessionEvents['transitionCancelled'][0],
  ): void {
    if (session !== this.node.session || event.sessionId !== session.sessionId) return;
    this.debugCrossfade(`${name} for ${event.entryId}`);
    if (
      name === 'stageFailed' &&
      this.#reservation?.entryId === event.entryId &&
      'sourceRevision' in event &&
      event.sourceRevision === this.#reservation.sourceRevision
    ) {
      this.emit(
        GuildQueueEvents.PlayerError,
        new Error('reason' in event ? String(event.reason) : 'Crossfade staging failed.'),
        this.#reservation.operation.track,
        undefined,
      );
    }
    if (name === 'transitionCancelled' && 'failedGeneration' in event) {
      const outgoing = this.#outgoing.get(event.generation);
      const incoming = this.#operation ?? this.#failedIncoming;
      if (outgoing && !outgoing.pendingTerminal && incoming?.generation === event.failedGeneration) {
        this.#outgoing.delete(event.generation);
        const alreadyFailed = incoming.terminal;
        incoming.terminal = true;
        incoming.controller.abort();
        this.#operation = outgoing;
        this.#currentTrack = outgoing.track;
        if (!alreadyFailed) this.tracks.insert(incoming.track, 0);
        if (!alreadyFailed) this.stats.tracksFailed++;
        this.#failedIncoming = null;
        this.emit(
          GuildQueueEvents.PlayerError,
          new Error('Crossfade transition cancelled; outgoing source retained.'),
          incoming.track,
          undefined,
        );
      }
    }
    const reservation = this.#reservation;
    if (
      reservation?.entryId === event.entryId &&
      name !== 'stageReady' &&
      (!('sourceRevision' in event) || event.sourceRevision === reservation.sourceRevision)
    )
      void this.cancelPreparation();
  }

  /**
   * Recover a promotion missed during transport recovery from the native playback snapshot.
   * @param session Reconnected session whose native state should be inspected.
   */
  public async reconcileCrossfade(session: DiscordSession): Promise<void> {
    const reservation = this.#reservation;
    if (!reservation || session !== this.node.session) return;
    const stage = await session.stagedSource();
    if (this.#reservation !== reservation) return;
    const snapshot = session.snapshot;
    if (
      !stage &&
      ['playing', 'paused'].includes(snapshot.state) &&
      snapshot.generation > (reservation.outgoing.generation ?? Infinity) &&
      snapshot.source
    ) {
      this.handlePlaybackStarted(session, {
        sessionId: session.sessionId,
        guildId: this.guildId,
        nodeId: session.nodeId,
        generation: snapshot.generation,
        state: 'playing',
        info: snapshot.source,
        customMetadata: { __discordPlayer: { queueToken: this.#queueToken, operationId: reservation.operation.id } },
        transition: {
          type: 'crossfade',
          outgoingGeneration: reservation.outgoing.generation!,
          entryId: reservation.entryId,
        },
      });
    } else if (!stage) await this.cancelPreparation();
  }

  /** Reconcile outgoing sources after a session-wide stop has completed. */
  public handleSessionStopped(): void {
    for (const operation of this.#outgoing.values()) {
      const pending = operation.pendingTerminal;
      this.finalizeLocked(operation, pending?.kind ?? 'stopped', pending?.event);
    }
  }

  private async processTerminal(
    operation: ManagedOperation,
    kind: PlaybackTerminalKind,
    event: TerminalEvent,
  ): Promise<void> {
    let nextWork: Promise<PlayRawResult | null> | null = null;
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      if (this.#destroyed || operation.terminal) return;
      nextWork = this.finalizeLocked(operation, kind, event);
    }
    if (nextWork) await nextWork.catch(() => undefined);
  }

  private finalizeLocked(
    operation: ManagedOperation,
    terminal: PlaybackTerminalKind,
    event?: TerminalEvent,
    selectedNext?: Track,
    skipReason: TrackSkipReason = TrackSkipReason.Manual,
    skipDescription = 'Skipped by user',
  ): Promise<PlayRawResult | null> | null {
    if (operation.terminal) return null;
    if (this.#operation !== operation) {
      if (operation.generation === null || this.#outgoing.get(operation.generation) !== operation) return null;
      this.#outgoing.delete(operation.generation);
      operation.terminal = true;
      operation.controller.abort();
      if (terminal === 'natural') {
        this.stats.tracksFinished++;
        if (this.#repeatMode === QueueRepeatMode.OFF || this.#repeatMode === QueueRepeatMode.AUTOPLAY)
          this.history.push(operation.track);
        if (this.#repeatMode === QueueRepeatMode.QUEUE) this.tracks.enqueue(operation.track);
        this.emit(GuildQueueEvents.PlayerFinish, operation.track, event?.state === 'completed' ? event : undefined);
      } else if (terminal === 'stopped') {
        this.emit(GuildQueueEvents.PlayerStop, operation.track, event?.state === 'stopped' ? event : undefined);
      } else if (terminal === 'failed') {
        this.stats.tracksFailed++;
        this.emit(
          GuildQueueEvents.PlayerError,
          event?.state === 'failed' ? event.error : new Error('Outgoing source failed'),
          operation.track,
          undefined,
        );
      }
      return null;
    }
    void this.cancelPreparation();
    operation.terminal = true;
    operation.controller.abort(new Error('Playback generation ended.'));
    const track = operation.track;
    const reason = terminal === 'stopped' && operation.requestedReason === 'skip' ? 'skip' : terminal;
    this.#operation = null;
    this.#currentTrack = track;

    if (reason === 'natural') {
      this.stats.tracksFinished++;
      if (this.#repeatMode === QueueRepeatMode.OFF || this.#repeatMode === QueueRepeatMode.AUTOPLAY)
        this.history.push(track);
      this.emit(GuildQueueEvents.PlayerFinish, track, event?.state === 'completed' ? event : undefined);
    } else if (reason === 'skip') {
      this.history.push(track);
      const stopEvent = event?.state === 'stopped' ? event : undefined;
      this.emit(GuildQueueEvents.PlayerSkip, track, skipReason, skipDescription, stopEvent);
    } else if (reason === 'failed') {
      if (this.#outgoing.size) this.#failedIncoming = operation;
      this.stats.tracksFailed++;
      const failure = event?.state === 'failed' ? event.error : new Error('Managed playback stopped unexpectedly.');
      this.emit(GuildQueueEvents.PlayerError, failure, track, event?.state === 'failed' ? event : undefined);
      this.tracks.insert(track, 0);
      this.#currentTrack = null;
      return null;
    } else {
      const stopEvent = event?.state === 'stopped' ? event : undefined;
      this.emit(GuildQueueEvents.PlayerStop, track, stopEvent);
      this.#currentTrack = null;
      return null;
    }

    this.#currentTrack = null;
    if (this.#destroyed) return null;

    let next: Track | undefined;
    if (selectedNext) {
      next = selectedNext;
    } else if (reason === 'natural' && this.#repeatMode === QueueRepeatMode.TRACK) {
      next = track;
    } else {
      if (reason === 'natural' && this.#repeatMode === QueueRepeatMode.QUEUE)
        this.tracks.insert(track, this.tracks.size);
      next = this.takeNextTrack();
    }

    if (!next && reason === 'natural' && this.#repeatMode === QueueRepeatMode.AUTOPLAY) {
      this.emit(GuildQueueEvents.WillAutoPlay, track);
      this.emit(GuildQueueEvents.EmptyQueue);
      return null;
    }
    if (!next) {
      this.emit(GuildQueueEvents.EmptyQueue);
      return null;
    }
    return this.beginTrackLocked(next, {
      customMetadata: this.#lastCustomMetadata,
    });
  }

  private async terminateCurrent(
    kind: 'skip' | 'stop',
    reason: TrackSkipReason,
    description: string,
  ): Promise<Track | null> {
    let nextWork: Promise<PlayRawResult | null> | null = null;
    const requestedOperation = this.#operation;
    if (!requestedOperation || this.#destroyed) return null;
    await this.cancelPreparation();
    requestedOperation.requestedReason = kind;
    if (requestedOperation.phase === 'preparing') {
      requestedOperation.controller.abort(new Error(kind === 'skip' ? 'Playback skipped.' : 'Playback stopped.'));
    }
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      if (this.#destroyed) return null;
      const operation = this.#operation;
      if (!operation || operation !== requestedOperation) return requestedOperation.track;
      if (operation.phase === 'preparing')
        operation.controller.abort(new Error(kind === 'skip' ? 'Playback skipped.' : 'Playback stopped.'));
      else await this.node.stopSession();
      const pending = operation.pendingTerminal;
      const terminalKind = pending?.kind === 'natural' ? 'natural' : pending?.kind === 'failed' ? 'failed' : 'stopped';
      nextWork = this.finalizeLocked(operation, terminalKind, pending?.event, undefined, reason, description);
    }
    if (nextWork) await nextWork.catch(() => undefined);
    return requestedOperation.track;
  }

  private beginTrackLocked<PlaybackMetadata = unknown>(
    track: Track,
    options: GuildQueuePlayOptions<PlaybackMetadata>,
  ): Promise<PlayRawResult<GuildQueuePlaybackMetadata<PlaybackMetadata>> | null> {
    const session = this.node.getSession(false);
    if (!session) throw new Error('Cannot start a managed Track without a connected Remedia session.');
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    const operation: ManagedOperation = {
      id: randomUUID(),
      track,
      session,
      generation: null,
      controller,
      phase: 'preparing',
      terminal: false,
      startEmitted: false,
    };
    this.#prepareRequest = null;
    this.#failedIncoming = null;
    this.#operation = operation;
    this.#currentTrack = track;
    return this.prepareAndPlay(operation, options, signal);
  }

  private async prepareAndPlay<PlaybackMetadata = unknown>(
    operation: ManagedOperation,
    options: GuildQueuePlayOptions<PlaybackMetadata>,
    signal: AbortSignal,
  ): Promise<PlayRawResult<GuildQueuePlaybackMetadata<PlaybackMetadata>> | null> {
    try {
      const source = await this.manager.player.plugins.resolveStream(operation.track, {
        signal,
        remote:
          this.manager.player.getRemedia().nodes.find((node) => node.id === operation.session.nodeId)?.type ===
          'remote',
        blocked: this.manager.player.options.blockExtractors,
      });
      using _lock = await this.tasks.acquire('queue.playback-transition', {
        signal: this.#destroyed ? AbortSignal.abort() : undefined,
      });
      if (this.#destroyed || this.#operation !== operation || operation.terminal || signal.aborted) return null;
      operation.phase = 'starting';
      const customMetadata: GuildQueuePlaybackMetadata<PlaybackMetadata> = {
        __discordPlayer: {
          queueToken: this.#queueToken,
          operationId: operation.id,
        },
        userMetadata: options.customMetadata,
      };
      const result = await this.node.play<GuildQueuePlaybackMetadata<PlaybackMetadata>>(source, {
        customMetadata,
        signal,
      });
      if (this.#operation === operation && !operation.terminal && operation.phase === 'starting')
        operation.phase = 'playing';
      return result;
    } catch (error) {
      if (this.#destroyed || operation.controller.signal.aborted || options.signal?.aborted) {
        await this.restoreCancelledPreparation(operation);
        return null;
      }
      await this.restoreFailedPreparation(operation, asError(error));
      throw error;
    }
  }

  private async restoreFailedPreparation(operation: ManagedOperation, error: Error): Promise<void> {
    using _lock = await this.tasks.acquire('queue.playback-transition');
    if (this.#destroyed || this.#operation !== operation || operation.terminal) return;
    operation.terminal = true;
    operation.controller.abort(new Error('Playback preparation failed.'));
    this.#operation = null;
    this.#currentTrack = null;
    this.tracks.insert(operation.track, 0);
    this.stats.tracksFailed++;
    const event = operation.pendingTerminal?.event;
    this.emit(GuildQueueEvents.PlayerError, error, operation.track, event?.state === 'failed' ? event : undefined);
  }

  private async restoreCancelledPreparation(operation: ManagedOperation): Promise<void> {
    let nextWork: Promise<PlayRawResult | null> | null = null;
    {
      using _lock = await this.tasks.acquire('queue.playback-transition');
      if (this.#operation !== operation || operation.terminal) return;
      if (!this.#destroyed && (operation.requestedReason === 'skip' || operation.requestedReason === 'stop')) {
        const pending = operation.pendingTerminal;
        const terminal = pending?.kind === 'natural' ? 'natural' : pending?.kind === 'failed' ? 'failed' : 'stopped';
        nextWork = this.finalizeLocked(operation, terminal, pending?.event);
      } else {
        operation.terminal = true;
        this.#operation = null;
        this.#currentTrack = null;
        if (!this.#destroyed && operation.requestedReason !== 'history') this.tracks.insert(operation.track, 0);
      }
    }
    if (nextWork) await nextWork.catch(() => undefined);
  }

  private matchOperation(
    session: DiscordSession,
    event: Pick<StartedEvent, 'sessionId' | 'customMetadata'>,
  ): ManagedOperation | null {
    const markerId = (event.customMetadata as Partial<GuildQueuePlaybackMetadata> | undefined)?.__discordPlayer
      ?.operationId;
    const operation = [this.#operation, ...this.#outgoing.values()].find((item) => item?.id === markerId);
    if (!operation || operation.session !== session || operation.session.sessionId !== event.sessionId) return null;
    const metadata = event.customMetadata as Partial<GuildQueuePlaybackMetadata> | undefined;
    const marker = metadata?.__discordPlayer;
    if (!marker || marker.queueToken !== this.#queueToken || marker.operationId !== operation.id) return null;
    return operation;
  }

  private async connectLocked(options: GuildQueueConnectOptions): Promise<DiscordSession> {
    if (
      options.volume !== undefined &&
      (!Number.isFinite(options.volume) || options.volume < 0 || options.volume > 100)
    ) {
      throw new RangeError('Queue volume must be a finite percentage between 0 and 100.');
    }
    const existing = this.node.getSession(false);
    const volume = options.volume ?? (existing ? undefined : (this.options.volume ?? this.node.volume));
    const selfDeaf = options.selfDeaf ?? (existing ? undefined : this.options.selfDeaf);
    const selfMute = options.selfMute ?? (existing ? undefined : this.options.selfMute);
    const filterGraph =
      options.filterGraph !== undefined ? options.filterGraph : existing ? undefined : this.options.filterGraph;

    if (options.volume !== undefined) this.options.volume = options.volume;
    if (options.selfDeaf !== undefined) this.options.selfDeaf = options.selfDeaf;
    if (options.selfMute !== undefined) this.options.selfMute = options.selfMute;
    if (options.filterGraph !== undefined) this.options.filterGraph = options.filterGraph;

    const session = await this.node.connect({
      channelId: options.channelId,
      ...(options.nodeId ? { nodeId: options.nodeId } : {}),
      ...(options.connectTimeoutMs === undefined ? {} : { connectTimeoutMs: options.connectTimeoutMs }),
      ...(selfDeaf !== undefined ? { selfDeaf } : {}),
      ...(selfMute !== undefined ? { selfMute } : {}),
      ...(volume !== undefined ? { volume: volume / 100 } : {}),
      ...(filterGraph !== undefined ? { filterGraph } : {}),
    });
    this.emit(GuildQueueEvents.Connection);
    return session;
  }

  private async setVoicePolicy(methodName: 'setSelfDeaf' | 'setSelfMute', enabled: boolean): Promise<void> {
    using _lock = await this.tasks.acquire('queue.node.operation');
    const session = this.node.getSession();
    if (methodName === 'setSelfDeaf') {
      await session.setSelfDeaf(enabled);
      this.options.selfDeaf = enabled;
    } else {
      await session.setSelfMute(enabled);
      this.options.selfMute = enabled;
    }
  }

  private takeNextTrack(): Track | undefined {
    if (!this.#shuffle) return this.tracks.dequeue();
    if (!this.tracks.size) return undefined;
    return this.tracks.removeAt(randomInt(this.tracks.size));
  }

  private insertTracks(incoming: Track[], index: number): void {
    this.assertAlive();
    this.assertIndex(index, this.size);
    this.assertCapacity(incoming.length);
    this.tracks.insert(incoming, index);
    this.stats.tracksAdded += incoming.length;
    if (incoming.length === 1) this.emit(GuildQueueEvents.AudioTrackAdd, incoming[0]!);
    else if (incoming.length > 1) this.emit(GuildQueueEvents.AudioTracksAdd, incoming);
  }

  private toTracks(value: Track | Track[] | Queue<Track>): Track[] {
    return value instanceof Queue ? value.toArray() : Array.isArray(value) ? value : [value];
  }

  private replaceTracks(tracks: Track[]): void {
    this.tracks.clear();
    this.tracks.merge(tracks);
  }

  private resolveTrackIndex(items: Track[], value: TrackResolvable): number {
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value < items.length ? value : -1;
    return items.findIndex(
      (track) => track === value || track.id === value || track.title === value || track.url === value,
    );
  }

  private assertIndex(index: number, size: number): void {
    if (!Number.isInteger(index) || index < 0 || index > size)
      throw new RangeError(`Queue index must be an integer between 0 and ${size}.`);
  }

  private assertCapacity(count: number): void {
    if (count > this.getCapacity()) throw new QueueCapacityError(count, this.getCapacity());
  }

  private assertAlive(): void {
    if (this.#destroyed) throw new Error(`Guild queue ${this.guildId} has been destroyed.`);
  }
}
