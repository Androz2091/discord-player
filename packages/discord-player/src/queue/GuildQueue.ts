import { Player, PlayerNodeInitializerOptions, TrackLike } from '../Player';
import {
  ChannelType,
  Guild,
  GuildVoiceChannelResolvable,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';
import { Collection, Queue, QueueStrategy } from '@discord-player/utils';
import {
  BiquadFilters,
  CommonResamplerFilterPreset,
  CompressorParameters,
  EqualizerBand,
  PCMFilters,
  ReverbParameters,
  SeekerParameters,
} from '@discord-player/equalizer';
import { Track, TrackResolvable } from '../fabric/Track';
import { StreamDispatcher } from '../stream/StreamDispatcher';
import {
  type AudioPlayer,
  AudioResource,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from 'discord-voip';
import { Util, VALIDATE_QUEUE_CAP } from '../utils/Util';
import { Playlist } from '../fabric/Playlist';
import { GuildQueueHistory } from './GuildQueueHistory';
import { GuildQueuePlayerNode, StreamConfig } from './GuildQueuePlayerNode';
import { GuildQueueAudioFilters } from './GuildQueueAudioFilters';
import { Readable } from 'stream';
import { setTimeout } from 'timers';
import { GuildQueueStatistics } from './GuildQueueStatistics';
import { TypeUtil } from '../utils/TypeUtil';
import { AsyncQueue } from '../utils/AsyncQueue';
import {
  InvalidArgTypeError,
  NoVoiceChannelError,
  NoVoiceConnectionError,
  OutOfRangeError,
  VoiceConnectionDestroyedError,
} from '../errors';
import { SyncedLyricsProvider } from './SyncedLyricsProvider';
import { LrcGetResult, LrcSearchResult } from '../lrclib/LrcLib';
import { FiltersName } from '../fabric';
import { SearchQueryType } from '../utils/QueryResolver';
import type { ExtractorStreamable } from '../extractors/BaseExtractor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GuildNodeInit<Meta = any> {
  guild: Guild;
  queueStrategy: QueueStrategy;
  equalizer: EqualizerBand[] | boolean;
  volume: number | boolean;
  biquad: BiquadFilters | boolean | undefined;
  resampler: number | boolean;
  filterer: PCMFilters[] | boolean;
  ffmpegFilters: FiltersName[];
  disableHistory: boolean;
  onBeforeCreateStream?: OnBeforeCreateStreamHandler;
  onAfterCreateStream?: OnAfterCreateStreamHandler;
  onStreamExtracted?: OnStreamExtractedHandler;
  repeatMode?: QueueRepeatMode;
  leaveOnEmpty: boolean;
  leaveOnEmptyCooldown: number;
  leaveOnEnd: boolean;
  leaveOnEndCooldown: number;
  leaveOnStop: boolean;
  leaveOnStopCooldown: number;
  connectionTimeout: number;
  selfDeaf?: boolean;
  metadata?: Meta | null;
  bufferingTimeout: number;
  noEmitInsert: boolean;
  maxSize?: number;
  maxHistorySize?: number;
  preferBridgedMetadata: boolean;
  pauseOnEmpty?: boolean;
  disableVolume: boolean;
  disableEqualizer: boolean;
  disableFilterer: boolean;
  disableBiquad: boolean;
  disableResampler: boolean;
  disableCompressor: boolean;
  disableReverb: boolean;
  disableSeeker: boolean;
  disableFallbackStream: boolean;
  enableStreamInterceptor: boolean;
  verifyFallbackStream: boolean;
}

export interface VoiceConnectConfig {
  deaf?: boolean;
  timeout?: number;
  group?: string;
  audioPlayer?: AudioPlayer;
}

export interface PostProcessedResult {
  stream: Readable;
  type: StreamType;
}

export type OnBeforeCreateStreamHandler = (
  track: Track,
  queryType: SearchQueryType,
  queue: GuildQueue,
) => Promise<Readable | null>;

export type OnStreamExtractedHandler = (
  stream: Readable | ExtractorStreamable | string,
  track: Track,
  queue: GuildQueue,
) => Promise<Readable | ExtractorStreamable | string>;

export type OnAfterCreateStreamHandler<T = unknown> = (
  stream: Readable,
  queue: GuildQueue,
  track: Track<T>,
) => Promise<PostProcessedResult | null>;

export type PlayerTriggeredReason = 'filters' | 'normal';

export const GuildQueueEvent = {
  /**
   * Emitted when audio track is added to the queue
   */
  AudioTrackAdd: 'audioTrackAdd',
  /**
   * Emitted when audio tracks were added to the queue
   */
  AudioTracksAdd: 'audioTracksAdd',
  /**
   * Emitted when audio track is removed from the queue
   */
  AudioTrackRemove: 'audioTrackRemove',
  /**
   * Emitted when audio tracks are removed from the queue
   */
  AudioTracksRemove: 'audioTracksRemove',
  /**
   * Emitted when a connection is created
   */
  Connection: 'connection',
  /**
   * Emitted when a voice connection is destroyed
   */
  ConnectionDestroyed: 'connectionDestroyed',
  /**
   * Emitted when the bot is disconnected from the channel
   */
  Disconnect: 'disconnect',
  /**
   * Emitted when the queue sends a debug info
   */
  Debug: 'debug',
  /**
   * Emitted when the queue encounters error
   */
  Error: 'error',
  /**
   * Emitted when the voice channel is empty
   */
  EmptyChannel: 'emptyChannel',
  /**
   * Emitted when the queue is empty
   */
  EmptyQueue: 'emptyQueue',
  /**
   * Emitted when the audio player starts streaming audio track
   */
  PlayerStart: 'playerStart',
  /**
   * Emitted when the audio player errors while streaming audio track
   */
  PlayerError: 'playerError',
  /**
   * Emitted when the audio player finishes streaming audio track
   */
  PlayerFinish: 'playerFinish',
  /**
   * Emitted when the audio player skips current track
   */
  PlayerSkip: 'playerSkip',
  /**
   * Emitted when the audio player is triggered
   */
  PlayerTrigger: 'playerTrigger',
  /**
   * Emitted when the voice state is updated. Consuming this event may disable default voice state update handler if `Player.isVoiceStateHandlerLocked()` returns `false`.
   */
  VoiceStateUpdate: 'voiceStateUpdate',
  /**
   * Emitted when volume is updated
   */
  VolumeChange: 'volumeChange',
  /**
   * Emitted when player is paused
   */
  PlayerPause: 'playerPause',
  /**
   * Emitted when player is resumed
   */
  PlayerResume: 'playerResume',
  /**
   * Biquad Filters Update
   */
  BiquadFiltersUpdate: 'biquadFiltersUpdate',
  /**
   * Equalizer Update
   */
  EqualizerUpdate: 'equalizerUpdate',
  /**
   * DSP update
   */
  DSPUpdate: 'dspUpdate',
  /**
   * Audio Filters Update
   */
  AudioFiltersUpdate: 'audioFiltersUpdate',
  /**
   * Audio player will play next track
   */
  WillPlayTrack: 'willPlayTrack',
  /**
   * Emitted when a voice channel is repopulated
   */
  ChannelPopulate: 'channelPopulate',
  /**
   * Emitted when a queue is successfully created
   */
  QueueCreate: 'queueCreate',
  /**
   * Emitted when a queue is deleted
   */
  QueueDelete: 'queueDelete',
  /**
   * Emitted when a queue is trying to add similar track for autoplay
   */
  WillAutoPlay: 'willAutoPlay',
  /**
   * Emitted when sample rate is updated
   */
  SampleRateUpdate: 'sampleRateUpdate',
  /**
   * Emitted when a named sample rate filter is updated
   */
  SampleRateFilterUpdate: 'sampleRateFilterUpdate',
  /**
   * Emitted when reverb filter is updated
   */
  ReverbUpdate: 'reverbUpdate',
  /**
   * Emitted when compressor filter is updated
   */
  CompressorUpdate: 'compressorUpdate',
  /**
   * Emitted when seek is performed
   */
  PlayerSeek: 'playerSeek',
} as const;

export type GuildQueueEvent =
  (typeof GuildQueueEvent)[keyof typeof GuildQueueEvent];

export enum TrackSkipReason {
  NoStream = 'ERR_NO_STREAM',
  Manual = 'MANUAL',
  SEEK_OVER_THRESHOLD = 'SEEK_OVER_THRESHOLD',
  Jump = 'JUMPED_TO_ANOTHER_TRACK',
  SkipTo = 'SKIP_TO_ANOTHER_TRACK',
  HistoryNext = 'HISTORY_NEXT_TRACK',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GuildQueueEvents<Meta = any> {
  /**
   * Emitted when audio track is added to the queue
   * @param queue The queue where this event occurred
   * @param track The track
   */
  [GuildQueueEvent.AudioTrackAdd]: (
    queue: GuildQueue<Meta>,
    track: Track,
  ) => unknown;
  /**
   * Emitted when audio tracks were added to the queue
   * @param queue The queue where this event occurred
   * @param tracks The tracks array
   */
  [GuildQueueEvent.AudioTracksAdd]: (
    queue: GuildQueue<Meta>,
    track: Track[],
  ) => unknown;
  /**
   * Emitted when audio track is removed from the queue
   * @param queue The queue where this event occurred
   * @param track The track
   */
  [GuildQueueEvent.AudioTrackRemove]: (
    queue: GuildQueue<Meta>,
    track: Track,
  ) => unknown;
  /**
   * Emitted when audio tracks are removed from the queue
   * @param queue The queue where this event occurred
   * @param track The track
   */
  [GuildQueueEvent.AudioTracksRemove]: (
    queue: GuildQueue<Meta>,
    track: Track[],
  ) => unknown;
  /**
   * Emitted when a connection is created
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.Connection]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when a connection is destroyed
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.ConnectionDestroyed]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when the bot is disconnected from the channel
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.Disconnect]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when the queue sends a debug info
   * @param queue The queue where this event occurred
   * @param message The debug message
   */
  [GuildQueueEvent.Debug]: (
    queue: GuildQueue<Meta>,
    message: string,
  ) => unknown;
  /**
   * Emitted when the queue encounters error
   * @param queue The queue where this event occurred
   * @param error The error
   */
  [GuildQueueEvent.Error]: (queue: GuildQueue<Meta>, error: Error) => unknown;
  /**
   * Emitted when the voice channel is empty
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.EmptyChannel]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when the queue is empty
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.EmptyQueue]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when the audio player starts streaming audio track
   * @param queue The queue where this event occurred
   * @param track The track that is being streamed
   */
  [GuildQueueEvent.PlayerStart]: (
    queue: GuildQueue<Meta>,
    track: Track,
  ) => unknown;
  /**
   * Emitted when the audio player errors while streaming audio track
   * @param queue The queue where this event occurred
   * @param error The error
   * @param track The track that is being streamed
   */
  [GuildQueueEvent.PlayerError]: (
    queue: GuildQueue<Meta>,
    error: Error,
    track: Track,
  ) => unknown;
  /**
   * Emitted when the audio player finishes streaming audio track
   * @param queue The queue where this event occurred
   * @param track The track that was being streamed
   */
  [GuildQueueEvent.PlayerFinish]: (
    queue: GuildQueue<Meta>,
    track: Track,
  ) => unknown;
  /**
   * Emitted when the audio player skips current track
   * @param queue The queue where this event occurred
   * @param track The track that was skipped
   * @param reason The reason for skipping
   * @param description The description for skipping
   */
  [GuildQueueEvent.PlayerSkip]: (
    queue: GuildQueue<Meta>,
    track: Track,
    reason: TrackSkipReason,
    description: string,
  ) => unknown;
  /**
   * Emitted when the audio player is triggered
   * @param queue The queue where this event occurred
   * @param track The track which was played in this event
   */
  [GuildQueueEvent.PlayerTrigger]: (
    queue: GuildQueue<Meta>,
    track: Track,
    reason: PlayerTriggeredReason,
  ) => unknown;
  /**
   * Emitted when the voice state is updated. Consuming this event may disable default voice state update handler if `Player.isVoiceStateHandlerLocked()` returns `false`.
   * @param queue The queue where this event occurred
   * @param oldState The old voice state
   * @param newState The new voice state
   */
  [GuildQueueEvent.VoiceStateUpdate]: (
    queue: GuildQueue<Meta>,
    oldState: VoiceState,
    newState: VoiceState,
  ) => unknown;
  /**
   * Emitted when audio player is paused
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.PlayerPause]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when audio player is resumed
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.PlayerResume]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when audio player's volume is changed
   * @param queue The queue where this event occurred
   * @param oldVolume The old volume
   * @param newVolume The updated volume
   */
  [GuildQueueEvent.VolumeChange]: (
    queue: GuildQueue<Meta>,
    oldVolume: number,
    newVolume: number,
  ) => unknown;
  /**
   * Emitted when equalizer config is updated
   * @param queue The queue where this event occurred
   * @param oldFilters Old filters
   * @param newFilters New filters
   */
  [GuildQueueEvent.EqualizerUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilters: EqualizerBand[],
    newFilters: EqualizerBand[],
  ) => unknown;
  /**
   * Emitted when biquad filters is updated
   * @param queue The queue where this event occurred
   * @param oldFilters Old filters
   * @param newFilters New filters
   */
  [GuildQueueEvent.BiquadFiltersUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilters: BiquadFilters | null,
    newFilters: BiquadFilters | null,
  ) => unknown;
  /**
   * Emitted when dsp filters is updated
   * @param queue The queue where this event occurred
   * @param oldFilters Old filters
   * @param newFilters New filters
   */
  [GuildQueueEvent.DSPUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilters: PCMFilters[],
    newFilters: PCMFilters[],
  ) => unknown;
  /**
   * Emitted when ffmpeg audio filters is updated
   * @param queue The queue where this event occurred
   * @param oldFilters Old filters
   * @param newFilters New filters
   */
  [GuildQueueEvent.AudioFiltersUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilters: FiltersName[],
    newFilters: FiltersName[],
  ) => unknown;

  /**
   * Emitted before streaming an audio track. This event can be used to modify stream config before playing a track.
   * Listening to this event will pause the execution of audio player until `done()` is invoked.
   * @param queue The queue where this event occurred
   * @param track The track that will be streamed
   * @param config Configurations for streaming
   * @param done Done callback
   */
  [GuildQueueEvent.WillPlayTrack]: (
    queue: GuildQueue<Meta>,
    track: Track<unknown>,
    config: StreamConfig,
    done: () => void,
  ) => unknown;
  /**
   * Emitted when a voice channel is populated
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.ChannelPopulate]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when a queue is successfully created
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.QueueCreate]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when a queue is successfully deleted
   * @param queue The queue where this event occurred
   */
  [GuildQueueEvent.QueueDelete]: (queue: GuildQueue<Meta>) => unknown;
  /**
   * Emitted when a queue is trying to add similar track for autoplay
   * @param queue The queue where this event occurred
   * @param tracks The similar tracks that were found
   * @param done Done callback
   */
  [GuildQueueEvent.WillAutoPlay]: (
    queue: GuildQueue<Meta>,
    tracks: Track[],
    done: (track: Track | null) => void,
  ) => unknown;
  /**
   * Emitted when sample rate is updated
   * @param queue The queue where this event occurred
   * @param oldRate The old sample rate
   * @param newRate The new sample rate
   */
  [GuildQueueEvent.SampleRateUpdate]: (
    queue: GuildQueue<Meta>,
    oldRate: number,
    newRate: number,
  ) => unknown;
  /**
   * Emitted when a named sample rate filter is updated
   * @param queue The queue where this event occurred
   * @param oldRate The old sample rate filter
   * @param newRate The new sample rate filter
   */
  [GuildQueueEvent.SampleRateFilterUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilter: CommonResamplerFilterPreset | null,
    newFilter: CommonResamplerFilterPreset | null,
  ) => unknown;
  /**
   * Emitted when reverb filter is updated
   * @param queue The queue where this event occurred
   * @param oldFilter The old reverb filter
   * @param newFilter The new reverb filter
   */
  [GuildQueueEvent.ReverbUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilter: ReverbParameters | null,
    newFilter: ReverbParameters | null,
  ) => unknown;
  /**
   * Emitted when compressor filter is updated
   * @param queue The queue where this event occurred
   * @param oldFilter The old compressor filter
   * @param newFilter The new compressor filter
   */
  [GuildQueueEvent.CompressorUpdate]: (
    queue: GuildQueue<Meta>,
    oldFilter: CompressorParameters | null,
    newFilter: CompressorParameters | null,
  ) => unknown;
  /**
   * Emitted when seek is performed
   * @param queue The queue where this event occurred
   * @param position The seek position
   */
  [GuildQueueEvent.PlayerSeek]: (
    queue: GuildQueue<Meta>,
    parameters: SeekerParameters,
  ) => unknown;
}

/**
 * The queue repeat mode. This can be one of:
 * - OFF
 * - TRACK
 * - QUEUE
 * - AUTOPLAY
 */
export const QueueRepeatMode = {
  /**
   * Disable repeat mode.
   */
  OFF: 0,
  /**
   * Repeat the current track.
   */
  TRACK: 1,
  /**
   * Repeat the entire queue.
   */
  QUEUE: 2,
  /**
   * When last track ends, play similar tracks in the future if queue is empty.
   */
  AUTOPLAY: 3,
} as const;

export type QueueRepeatMode =
  (typeof QueueRepeatMode)[keyof typeof QueueRepeatMode];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class GuildQueue<Meta = any> {
  #transitioning = false;
  #deleted = false;
  #shuffle = false;
  private __current: Track | null = null;
  public tracks: Queue<Track>;
  public history = new GuildQueueHistory<Meta>(this);
  public dispatcher: StreamDispatcher | null = null;
  public node = new GuildQueuePlayerNode<Meta>(this);
  public filters = new GuildQueueAudioFilters<Meta>(this);
  public onBeforeCreateStream: OnBeforeCreateStreamHandler = async () => null;
  public onAfterCreateStream: OnAfterCreateStreamHandler = async (stream) => ({
    stream,
    type: StreamType.Raw,
  });
  public onStreamExtracted: OnStreamExtractedHandler = async (stream) => stream;
  public repeatMode: QueueRepeatMode = QueueRepeatMode.OFF;
  public timeouts = new Collection<string, NodeJS.Timeout>();
  public stats = new GuildQueueStatistics<Meta>(this);
  public tasksQueue = new AsyncQueue();
  public syncedLyricsProvider = new SyncedLyricsProvider(this);

  public constructor(
    public player: Player,
    public options: GuildNodeInit<Meta>,
  ) {
    this.tracks = new Queue<Track>(options.queueStrategy);
    if (TypeUtil.isFunction(options.onBeforeCreateStream))
      this.onBeforeCreateStream = options.onBeforeCreateStream;
    if (TypeUtil.isFunction(options.onAfterCreateStream))
      this.onAfterCreateStream = options.onAfterCreateStream;
    if (TypeUtil.isFunction(options.onStreamExtracted))
      this.onStreamExtracted = options.onStreamExtracted;
    if (!TypeUtil.isNullish(options.repeatMode))
      this.repeatMode = options.repeatMode;

    options.selfDeaf ??= true;
    options.maxSize ??= Infinity;
    options.maxHistorySize ??= Infinity;
    options.pauseOnEmpty ??= true;

    if (
      !TypeUtil.isNullish(this.options.biquad) &&
      !TypeUtil.isBoolean(this.options.biquad)
    ) {
      this.filters._lastFiltersCache.biquad = this.options.biquad;
    }

    if (Array.isArray(this.options.equalizer)) {
      this.filters._lastFiltersCache.equalizer = this.options.equalizer;
    }

    if (Array.isArray(this.options.filterer)) {
      this.filters._lastFiltersCache.filters = this.options.filterer;
    }

    if (TypeUtil.isNumber(this.options.resampler)) {
      this.filters._lastFiltersCache.sampleRate = this.options.resampler;
    }

    if (TypeUtil.isArray(this.options.ffmpegFilters)) {
      this.filters.ffmpeg.setDefaults(this.options.ffmpegFilters);
    }

    if (!TypeUtil.isNumber(options.maxSize)) {
      throw new InvalidArgTypeError(
        '[GuildNodeInit.maxSize]',
        'number',
        typeof options.maxSize,
      );
    }

    if (!TypeUtil.isNumber(options.maxHistorySize)) {
      throw new InvalidArgTypeError(
        '[GuildNodeInit.maxHistorySize]',
        'number',
        typeof options.maxHistorySize,
      );
    }

    if (options.maxSize < 1) options.maxSize = Infinity;
    if (options.maxHistorySize < 1) options.maxHistorySize = Infinity;

    if (this.hasDebugger)
      this.debug(
        `GuildQueue initialized for guild ${this.options.guild.name} (ID: ${this.options.guild.id})`,
      );
    this.emit(GuildQueueEvent.QueueCreate, this);
  }

  /**
   * Whether this queue can intercept streams
   */
  public canIntercept() {
    return this.options.enableStreamInterceptor;
  }

  /**
   * Estimated duration of this queue in ms
   */
  public get estimatedDuration() {
    return this.tracks.store.reduce((a, c) => a + c.durationMS, 0);
  }

  /**
   * Formatted duration of this queue
   */
  public get durationFormatted() {
    return Util.buildTimeCode(Util.parseMS(this.estimatedDuration));
  }

  /**
   * The sync lyrics provider for this queue.
   * @example const lyrics = await player.lyrics.search({ q: 'Alan Walker Faded' });
   * const syncedLyrics = queue.syncedLyrics(lyrics[0]);
   * console.log(syncedLyrics.at(10_000));
   * // subscribe to lyrics change
   * const unsubscribe = syncedLyrics.onChange((lyrics, timestamp) => {
   *    console.log(lyrics, timestamp);
   * });
   * // unsubscribe from lyrics change
   * unsubscribe(); // or
   * syncedLyrics.unsubscribe();
   */
  public syncedLyrics(lyrics: LrcGetResult | LrcSearchResult) {
    this.syncedLyricsProvider.load(lyrics?.syncedLyrics ?? '');
    return this.syncedLyricsProvider;
  }

  /**
   * Write a debug message to this queue
   * @param m The message to write
   */
  public debug(m: string) {
    this.emit(GuildQueueEvent.Debug, this, m);
  }

  /**
   * The metadata of this queue
   */
  public get metadata() {
    return this.options.metadata!;
  }

  public set metadata(m: Meta) {
    this.options.metadata = m;
  }

  /**
   * Set metadata for this queue
   * @param m Metadata to set
   */
  public setMetadata(m: Meta) {
    this.options.metadata = m;
  }

  /**
   * Indicates current track of this queue
   */
  public get currentTrack() {
    return this.dispatcher?.audioResource?.metadata || this.__current;
  }

  /**
   * Indicates if this queue was deleted previously
   */
  public get deleted() {
    return this.#deleted;
  }

  /**
   * The voice channel of this queue
   */
  public get channel() {
    return this.dispatcher?.channel || null;
  }

  public set channel(c: VoiceBasedChannel | null) {
    if (this.dispatcher) {
      if (c) {
        this.dispatcher.channel = c;
      } else {
        this.delete();
      }
    }
  }

  /**
   * The voice connection of this queue
   */
  public get connection() {
    return this.dispatcher?.voiceConnection || null;
  }

  /**
   * The guild this queue belongs to
   */
  public get guild() {
    return this.options.guild;
  }

  /**
   * The id of this queue
   */
  public get id() {
    return this.guild.id;
  }

  /**
   * Set transition mode for this queue
   * @param state The state to set
   */
  public setTransitioning(state: boolean) {
    this.#transitioning = state;
  }

  /**
   * if this queue is currently under transition mode
   */
  public isTransitioning() {
    return this.#transitioning;
  }

  /**
   * Set repeat mode for this queue
   * @param mode The repeat mode to apply
   */
  public setRepeatMode(mode: QueueRepeatMode) {
    this.repeatMode = mode;
  }

  /**
   * Max size of this queue
   */
  public get maxSize() {
    return this.options.maxSize ?? Infinity;
  }

  /**
   * Max size of this queue
   */
  public getMaxSize() {
    return this.maxSize;
  }

  /**
   * Gets the size of the queue
   */
  public get size() {
    return this.tracks.size;
  }

  /**
   * The size of this queue
   */
  public getSize() {
    return this.size;
  }

  /**
   * Max history size of this queue
   */
  public get maxHistorySize() {
    return this.options.maxHistorySize ?? Infinity;
  }

  /**
   * Max history size of this queue
   */
  public getMaxHistorySize() {
    return this.maxHistorySize;
  }

  /**
   * Set max history size for this queue
   * @param size The size to set
   */
  public setMaxHistorySize(size: number) {
    if (!TypeUtil.isNumber(size)) {
      throw new InvalidArgTypeError('size', 'number', typeof size);
    }

    if (size < 1) size = Infinity;

    this.options.maxHistorySize = size;
  }

  /**
   * Set max size for this queue
   * @param size The size to set
   */
  public setMaxSize(size: number) {
    if (!TypeUtil.isNumber(size)) {
      throw new InvalidArgTypeError('size', 'number', typeof size);
    }

    if (size < 1) size = Infinity;

    this.options.maxSize = size;
  }

  /**
   * Clear this queue
   */
  public clear() {
    this.tracks.clear();
    this.history.clear();
  }

  /**
   * Check if this queue has no tracks left in it
   */
  public isEmpty() {
    return this.tracks.size < 1;
  }

  /**
   * Check if this queue is full
   */
  public isFull() {
    return this.tracks.size >= this.maxSize;
  }

  /**
   * Get queue capacity
   */
  public getCapacity() {
    if (this.isFull()) return 0;
    const cap = this.maxSize - this.size;
    return cap;
  }

  /**
   * Check if this queue currently holds active audio resource
   */
  public isPlaying() {
    return (
      this.dispatcher?.audioResource != null &&
      !this.dispatcher.audioResource.ended
    );
  }

  /**
   * Add track to the queue. This will emit `audioTracksAdd` when multiple tracks are added, otherwise `audioTrackAdd`.
   * @param track Track or playlist or array of tracks to add
   */
  public addTrack(track: Track | Track[] | Playlist) {
    const toAdd = track instanceof Playlist ? track.tracks : track;
    const isMulti = Array.isArray(toAdd);

    VALIDATE_QUEUE_CAP(this, toAdd);

    this.tracks.add(toAdd);

    if (isMulti) {
      this.emit(GuildQueueEvent.AudioTracksAdd, this, toAdd);
    } else {
      this.emit(GuildQueueEvent.AudioTrackAdd, this, toAdd);
    }
  }

  /**
   * Remove a track from queue
   * @param track The track to remove
   */
  public removeTrack(track: TrackResolvable) {
    return this.node.remove(track);
  }

  /**
   * Prepends a track or track resolvable to the queue
   * @param track The track resolvable to insert
   * @param index The index to insert the track at (defaults to 0). If > 0, the inserted track will be placed before the track at the given index.
   */
  public prepend(track: Track | Queue<Track> | Array<Track>, index = 0): void {
    if (index < 0 || index > this.tracks.size) {
      throw new OutOfRangeError(
        'index',
        `${index}`,
        '0',
        `${this.tracks.size}`,
      );
    }

    const count = Array.isArray(track)
      ? track.length
      : track instanceof Queue
      ? track.size
      : 1;

    VALIDATE_QUEUE_CAP(this, count);

    const insertionIndex = index === 0 ? 0 : index - 1;

    if (track instanceof Track) {
      this.node.insert(track, insertionIndex);
      this.emit(GuildQueueEvent.AudioTrackAdd, this, track);
      return;
    }

    const tracks = track instanceof Queue ? track.store : track;

    this.tracks.store.splice(insertionIndex, 0, ...tracks);

    if (!this.options.noEmitInsert) {
      this.emit(GuildQueueEvent.AudioTracksAdd, this, tracks);
    }
  }

  /**
   * Appends a track or track resolvable to the queue
   * @param track The track resolvable to insert
   * @param index The index to insert the track at (defaults to 0). If > 0, the inserted track will be placed after the track at the given index.
   */
  public append(track: Track | Queue<Track> | Array<Track>, index = 0): void {
    if (index < 0 || index > this.tracks.size) {
      throw new OutOfRangeError(
        'index',
        `${index}`,
        '0',
        `${this.tracks.size}`,
      );
    }

    const count = Array.isArray(track)
      ? track.length
      : track instanceof Queue
      ? track.size
      : 1;

    VALIDATE_QUEUE_CAP(this, count);

    if (track instanceof Track) {
      this.node.insert(track, index);
      this.emit(GuildQueueEvent.AudioTrackAdd, this, track);
      return;
    }

    const tracks = track instanceof Queue ? track.store : track;

    this.tracks.store.splice(index, 0, ...tracks);

    if (!this.options.noEmitInsert) {
      this.emit(GuildQueueEvent.AudioTracksAdd, this, tracks);
    }
  }

  /**
   * Inserts the track to the given index
   * @param track The track to insert
   * @param index The index to insert the track at (defaults to 0)
   */
  public insertTrack(track: Track, index = 0): void {
    return this.node.insert(track, index);
  }

  /**
   * Moves a track in the queue
   * @param from The track to move
   * @param to The position to move to
   */
  public moveTrack(track: TrackResolvable, index = 0): void {
    return this.node.move(track, index);
  }

  /**
   * Copy a track in the queue
   * @param from The track to clone
   * @param to The position to clone at
   */
  public copyTrack(track: TrackResolvable, index = 0): void {
    return this.node.copy(track, index);
  }

  /**
   * Swap two tracks in the queue
   * @param src The first track to swap
   * @param dest The second track to swap
   */
  public swapTracks(src: TrackResolvable, dest: TrackResolvable): void {
    return this.node.swap(src, dest);
  }

  /**
   * Create stream dispatcher from the given connection
   * @param connection The connection to use
   */
  public createDispatcher(
    connection: VoiceConnection,
    options: Pick<VoiceConnectConfig, 'audioPlayer' | 'timeout'> = {},
  ) {
    if (connection.state.status === VoiceConnectionStatus.Destroyed) {
      throw new VoiceConnectionDestroyedError();
    }

    const channel = this.player.client.channels.cache.get(
      connection.joinConfig.channelId!,
    );
    if (!channel) throw new NoVoiceChannelError();
    if (!channel.isVoiceBased())
      throw new InvalidArgTypeError(
        'channel',
        `VoiceBasedChannel (type ${ChannelType.GuildVoice}/${ChannelType.GuildStageVoice})`,
        String(channel?.type),
      );

    if (this.dispatcher) {
      this.#removeListeners(this.dispatcher);
      this.dispatcher.destroy();
      this.dispatcher = null;
    }

    this.dispatcher = new StreamDispatcher(
      connection,
      channel,
      this,
      options.timeout ?? this.options.connectionTimeout,
      options.audioPlayer,
    );
  }

  /**
   * Connect to a voice channel
   * @param channelResolvable The voice channel to connect to
   * @param options Join config
   */
  public async connect(
    channelResolvable: GuildVoiceChannelResolvable,
    options: VoiceConnectConfig = {},
  ) {
    const channel = this.player.client.channels.resolve(channelResolvable);
    if (!channel || !channel.isVoiceBased()) {
      throw new InvalidArgTypeError(
        'channel',
        `VoiceBasedChannel (type ${ChannelType.GuildVoice}/${ChannelType.GuildStageVoice})`,
        String(channel?.type),
      );
    }

    if (this.hasDebugger)
      this.debug(
        `Connecting to ${
          channel.type === ChannelType.GuildStageVoice ? 'stage' : 'voice'
        } channel ${channel.name} (ID: ${channel.id})`,
      );

    if (this.dispatcher && channel.id !== this.dispatcher.channel.id) {
      if (this.hasDebugger) this.debug('Destroying old connection');
      this.#removeListeners(this.dispatcher);
      this.dispatcher.destroy();
      this.dispatcher = null;
    }

    this.dispatcher = await this.player.voiceUtils.connect(channel, {
      deaf: options.deaf ?? this.options.selfDeaf ?? true,
      maxTime: options?.timeout ?? this.options.connectionTimeout ?? 120_000,
      queue: this,
      audioPlayer: options?.audioPlayer,
      group: options.group ?? this.player.client.user?.id,
    });

    this.emit(GuildQueueEvent.Connection, this);

    if (this.channel!.type === ChannelType.GuildStageVoice) {
      await this.channel!.guild.members.me!.voice.setSuppressed(false).catch(
        async () => {
          return await this.channel!.guild.members.me!.voice.setRequestToSpeak(
            true,
          ).catch(Util.noop);
        },
      );
    }

    this.#attachListeners(this.dispatcher);

    return this;
  }

  /**
   * Enable shuffle mode for this queue
   * @param dynamic Whether to shuffle the queue dynamically. Defaults to `true`.
   * Dynamic shuffling will shuffle the queue when the current track ends, without mutating the queue.
   * If set to `false`, the queue will be shuffled immediately in-place, which cannot be undone.
   */
  public enableShuffle(dynamic = true) {
    if (!dynamic) {
      this.tracks.shuffle();
      return true;
    }

    this.#shuffle = true;
    return true;
  }

  /**
   * Disable shuffle mode for this queue.
   */
  public disableShuffle() {
    this.#shuffle = false;
    return true;
  }

  /**
   * Toggle shuffle mode for this queue.
   * @param dynamic Whether to shuffle the queue dynamically. Defaults to `true`.
   * @returns Whether shuffle is enabled or disabled.
   */
  public toggleShuffle(dynamic = true) {
    if (dynamic) {
      this.#shuffle = !this.#shuffle;
      return this.#shuffle;
    } else {
      this.tracks.shuffle();
      return true;
    }
  }

  /**
   * Whether shuffle mode is enabled for this queue.
   */
  public get isShuffling() {
    return this.#shuffle;
  }

  /**
   * The voice connection latency of this queue
   */
  public get ping() {
    return this.connection?.ping.udp ?? -1;
  }

  /**
   * Delete this queue
   */
  public delete() {
    if (this.player.nodes.delete(this.id)) {
      this.#deleted = true;
      this.player.events.emit(GuildQueueEvent.QueueDelete, this);
      this.node.tasksQueue.cancelAll();
      this.tasksQueue.cancelAll();
    }
  }

  /**
   * Revives this queue
   * @returns
   */
  public revive() {
    if (!this.deleted || this.player.nodes.has(this.id)) return;
    this.#deleted = false;
    this.setTransitioning(false);
    this.player.nodes.cache.set(this.id, this);
    this.player.events.emit(GuildQueueEvent.QueueCreate, this);
  }

  /**
   * Set self deaf
   * @param mode On/Off state
   * @param reason Reason
   */
  public setSelfDeaf(mode?: boolean, reason?: string) {
    return this.guild.members.me!.voice.setDeaf(mode, reason);
  }

  /**
   * Set self mute
   * @param mode On/Off state
   * @param reason Reason
   */
  public setSelfMute(mode?: boolean, reason?: string) {
    return this.guild.members.me!.voice.setMute(mode, reason);
  }

  /**
   * Play a track in this queue
   * @param track The track to be played
   * @param options Player node initialization options
   */
  public async play(
    track: TrackLike,
    options?: PlayerNodeInitializerOptions<Meta>,
  ) {
    if (!this.channel) throw new NoVoiceConnectionError();

    return this.player.play(this.channel, track, options);
  }

  /**
   * Emit an event on this queue
   * @param event The event to emit
   * @param args The args for the event
   */
  public emit<K extends keyof GuildQueueEvents<Meta>>(
    event: K,
    ...args: Parameters<GuildQueueEvents<Meta>[K]>
  ): boolean {
    if (this.deleted) return false;
    return this.player.events.emit(event, ...args);
  }

  #attachListeners(dispatcher: StreamDispatcher) {
    dispatcher.on('error', (e) => this.emit(GuildQueueEvent.Error, this, e));
    dispatcher.on(
      'debug',
      (m) => this.hasDebugger && this.emit(GuildQueueEvent.Debug, this, m),
    );
    dispatcher.on('finish', (r) => this.#performFinish(r));
    dispatcher.on('start', (r) => this.#performStart(r));
    dispatcher.on('destroyed', () => {
      this.#removeListeners(dispatcher);
      this.dispatcher = null;
    });
    dispatcher.on('dsp', (f) => {
      if (!Object.is(this.filters._lastFiltersCache.filters, f)) {
        this.emit(
          GuildQueueEvent.DSPUpdate,
          this,
          this.filters._lastFiltersCache.filters,
          f,
        );
      }
      this.filters._lastFiltersCache.filters = f;
    });
    dispatcher.on('biquad', (f) => {
      if (this.filters._lastFiltersCache.biquad !== f) {
        this.emit(
          GuildQueueEvent.BiquadFiltersUpdate,
          this,
          this.filters._lastFiltersCache.biquad,
          f,
        );
      }
      this.filters._lastFiltersCache.biquad = f;
    });
    dispatcher.on('eqBands', (f) => {
      if (!Object.is(f, this.filters._lastFiltersCache.equalizer)) {
        this.emit(
          GuildQueueEvent.EqualizerUpdate,
          this,
          this.filters._lastFiltersCache.equalizer,
          f,
        );
      }
      this.filters._lastFiltersCache.equalizer = f;
    });
    dispatcher.on('volume', (f) => {
      if (this.filters._lastFiltersCache.volume !== f)
        this.emit(
          GuildQueueEvent.VolumeChange,
          this,
          this.filters._lastFiltersCache.volume,
          f,
        );
      this.filters._lastFiltersCache.volume = f;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const areObjectsDifferent = (a: any, b: any) => {
      if (!a && !b) return false;
      if (!a || !b) return true;
      if (Object.keys(a).length !== Object.keys(b).length) return true;
      return Object.keys(a).some((k) => a[k] !== b[k]);
    };

    dispatcher.on('sampleRate', (f) => {
      if (this.filters._lastFiltersCache.sampleRate !== f.sampleRate) {
        this.emit(
          GuildQueueEvent.SampleRateUpdate,
          this,
          this.filters._lastFiltersCache.sampleRate,
          f.sampleRate,
        );

        this.filters._lastFiltersCache.sampleRate = f.sampleRate;

        this.filters.seeker?.setSampleRate(f.sampleRate);
        this.filters.seeker?.setTotalDuration(this.node.estimatedDuration);
      }

      if (f.currentFilter !== this.filters._lastFiltersCache.sampleRateFilter) {
        this.emit(
          GuildQueueEvent.SampleRateFilterUpdate,
          this,
          this.filters._lastFiltersCache.sampleRateFilter ?? null,
          f.currentFilter,
        );
        this.filters._lastFiltersCache.sampleRateFilter = f.currentFilter;
      }
    });
    dispatcher.on('reverb', (f) => {
      if (areObjectsDifferent(f, this.filters._lastFiltersCache.reverb)) {
        this.emit(
          GuildQueueEvent.ReverbUpdate,
          this,
          this.filters._lastFiltersCache.reverb ?? null,
          f,
        );
        this.filters._lastFiltersCache.reverb = f;
      }
    });
    dispatcher.on('seeker', (f) => {
      if (this.hasDebugger) {
        this.debug(
          `Seeker >> Seeked to ${f.seekTarget}ms for Track ${this.currentTrack?.title}`,
        );
      }

      if (f.seekTarget != null) this.node.setProgress(f.seekTarget);

      this.emit(GuildQueueEvent.PlayerSeek, this, f);
    });

    dispatcher.on('compressor', (f) => {
      if (areObjectsDifferent(f, this.filters._lastFiltersCache.compressor)) {
        this.emit(
          GuildQueueEvent.CompressorUpdate,
          this,
          this.filters._lastFiltersCache.compressor ?? null,
          f,
        );
        this.filters._lastFiltersCache.compressor = f;
      }
    });
  }

  public get hasDebugger() {
    return this.player.events.hasDebugger;
  }

  #removeListeners<T extends { removeAllListeners: () => unknown }>(target: T) {
    target.removeAllListeners();
  }

  #performStart(resource?: AudioResource<Track>) {
    const track = resource?.metadata || this.currentTrack;
    const reason = this.isTransitioning() ? 'filters' : 'normal';

    if (this.hasDebugger)
      this.debug(
        `Player triggered for Track ${JSON.stringify({
          title: track?.title,
          reason,
        })}`,
      );

    this.emit(GuildQueueEvent.PlayerTrigger, this, track!, reason);
    if (track && !this.isTransitioning())
      this.emit(GuildQueueEvent.PlayerStart, this, track);
    this.setTransitioning(false);
  }

  #getNextTrack() {
    if (!this.isShuffling) {
      return this.tracks.dispatch();
    }

    const store = this.tracks.store;

    if (!store.length) return;

    const track = Util.randomChoice(store);

    this.tracks.removeOne((t) => {
      return t.id === track.id;
    });

    return track;
  }

  #performFinish(resource?: AudioResource<Track>) {
    const track = resource?.metadata || this.currentTrack;

    if (this.hasDebugger)
      this.debug(
        `Track ${JSON.stringify({
          title: track?.title,
          isTransitionMode: this.isTransitioning(),
        })} was marked as finished`,
      );

    if (!this.isTransitioning()) {
      this.syncedLyricsProvider.unsubscribe();
      this.syncedLyricsProvider.lyrics.clear();
      if (this.hasDebugger)
        this.debug(
          'Adding track to history and emitting finish event since transition mode is disabled...',
        );
      if (track) {
        this.history.push(track);
        this.node.resetProgress();
        this.emit(GuildQueueEvent.PlayerFinish, this, track);
      }
      if (this.#deleted) return this.#emitEnd();
      if (this.tracks.size < 1 && this.repeatMode === QueueRepeatMode.OFF) {
        if (this.hasDebugger)
          this.debug(
            'No more tracks left in the queue to play and repeat mode is off, initiating #emitEnd()',
          );
        this.#emitEnd();
      } else {
        if (this.repeatMode === QueueRepeatMode.TRACK) {
          if (this.hasDebugger)
            this.debug(
              'Repeat mode is set to track, repeating last track from the history...',
            );
          this.__current = this.history.tracks.dispatch() || track;
          return this.node.play(this.__current!, { queue: false });
        }
        if (this.repeatMode === QueueRepeatMode.QUEUE) {
          if (this.hasDebugger)
            this.debug(
              'Repeat mode is set to queue, moving last track from the history to current queue...',
            );
          const next = this.history.tracks.dispatch() || track;
          if (next) this.tracks.add(next);
        }
        if (!this.tracks.size && track) {
          if (this.repeatMode === QueueRepeatMode.AUTOPLAY) {
            if (this.hasDebugger)
              this.debug(
                'Repeat mode is set to autoplay, initiating autoplay handler...',
              );
            this.#handleAutoplay(track);
            return;
          }
        } else {
          if (this.hasDebugger)
            this.debug('Initializing next track of the queue...');
          this.__current = this.#getNextTrack()!;
          this.node.play(this.__current, {
            queue: false,
          });
        }
      }
    }
  }

  #emitEnd() {
    this.__current = null;
    this.emit(GuildQueueEvent.EmptyQueue, this);
    if (this.options.leaveOnEnd) {
      const tm: NodeJS.Timeout = setTimeout(() => {
        if (this.isPlaying()) return clearTimeout(tm);
        this.dispatcher?.disconnect();
      }, this.options.leaveOnEndCooldown).unref();
    }
  }

  async #handleAutoplay(track: Track) {
    try {
      if (this.hasDebugger)
        this.debug(
          `Autoplay >> Finding related tracks for Track ${track.title} (${
            track.url
          }) [ext:${track.extractor?.identifier || 'N/A'}]`,
        );
      const tracks =
        (await track.extractor?.getRelatedTracks(track, this.history))
          ?.tracks ||
        (
          await this.player.extractors.run(async (ext) => {
            if (this.hasDebugger)
              this.debug(`Autoplay >> Querying extractor ${ext.identifier}`);
            const res = await ext.getRelatedTracks(track, this.history);
            if (!res.tracks.length) {
              if (this.hasDebugger)
                this.debug(
                  `Autoplay >> Extractor ${ext.identifier} failed to provide results.`,
                );
              return false;
            }

            if (this.hasDebugger)
              this.debug(
                `Autoplay >> Extractor ${ext.identifier} successfully returned results.`,
              );

            return res.tracks;
          })
        )?.result ||
        [];

      let resolver: (track: Track | null) => void = Util.noop;
      const donePromise = new Promise<Track | null>(
        (resolve) => (resolver = resolve),
      );

      const success = this.emit(
        GuildQueueEvent.WillAutoPlay,
        this,
        tracks,
        resolver!,
      );

      // prevent dangling promise
      if (!success) {
        resolver(
          tracks.length
            ? (() => {
                const unique = tracks.filter(
                  (tr) => !this.history.tracks.find((t) => t.url === tr.url),
                );
                return unique?.[0] ?? Util.randomChoice(tracks.slice(0, 5));
              })()
            : null,
        );
      }

      const nextTrack = await donePromise;

      if (!nextTrack) {
        if (this.hasDebugger)
          this.debug('Autoplay >> No track was found, initiating #emitEnd()');
        throw 'No track was found';
      }

      await this.node.play(nextTrack, {
        queue: false,
        seek: 0,
        transitionMode: false,
      });
    } catch {
      return this.#emitEnd();
    }
  }
}
