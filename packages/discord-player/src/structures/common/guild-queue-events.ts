import type { DiscordSessionEvents, RemediaClientEvents } from '@remedia/client';
import type { GuildQueue } from '../guild-queue.js';
import type { PlayerTriggeredReason, TrackSkipReason } from '../guild-queue.js';
import type { Track } from '../track.js';

/** Familiar event names emitted by GuildQueue instances through `player.events`. */
export const GuildQueueEvents = {
  /** Queue observation for willPrepareNextTrack; native context is the final argument. */
  WillPrepareNextTrack: 'willPrepareNextTrack',
  /** Queue observation for stageReady; native context is the final argument. */
  StageReady: 'stageReady',
  /** Queue observation for stageFailed; native context is the final argument. */
  StageFailed: 'stageFailed',
  /** Queue observation for stageInvalidated; native context is the final argument. */
  StageInvalidated: 'stageInvalidated',
  /** Queue observation for transitionCancelled; native context is the final argument. */
  TransitionCancelled: 'transitionCancelled',
  /** Queue observation for sessionDisposed; native context is the final argument. */
  SessionDisposed: 'sessionDisposed',
  /** Queue observation for voiceConnectionStateChange; native context is the final argument. */
  VoiceConnectionStateChange: 'voiceConnectionStateChange',
  /** Queue observation for sessionEvent; native context is the final argument. */
  SessionEvent: 'sessionEvent',
  /** Queue observation for sessionResumed; native context is the final argument. */
  SessionResumed: 'sessionResumed',
  /** Queue observation for sessionLost; native context is the final argument. */
  SessionLost: 'sessionLost',
  /** Queue observation for guildAssigned; native context is the final argument. */
  GuildAssigned: 'guildAssigned',
  /** Queue observation for guildReleased; native context is the final argument. */
  GuildReleased: 'guildReleased',
  /** Queue observation for guildMigrated; native context is the final argument. */
  GuildMigrated: 'guildMigrated',

  /** Emitted when one Track is added to the upcoming queue. */
  AudioTrackAdd: 'audioTrackAdd',
  /** Emitted when multiple Tracks are added to the upcoming queue. */
  AudioTracksAdd: 'audioTracksAdd',
  /** Emitted when one Track is removed from the upcoming queue. */
  AudioTrackRemove: 'audioTrackRemove',
  /** Emitted when multiple Tracks are removed from the upcoming queue. */
  AudioTracksRemove: 'audioTracksRemove',
  /** Emitted after the queue's Remedia session connects. */
  Connection: 'connection',
  /** Emitted after the queue's Remedia session is destroyed. */
  ConnectionDestroyed: 'connectionDestroyed',
  /** Emitted when the queue's voice session disconnects. */
  Disconnect: 'disconnect',
  /** Emitted for queue-scoped diagnostic messages. */
  Debug: 'debug',
  /** Emitted for queue-scoped errors. */
  Error: 'error',
  /** Emitted when the connected voice channel becomes empty. */
  EmptyChannel: 'emptyChannel',
  /** Emitted when no upcoming Track remains after queue progression. */
  EmptyQueue: 'emptyQueue',
  /** Emitted when a managed Track begins playback. */
  PlayerStart: 'playerStart',
  /** Emitted when managed Track playback fails. */
  PlayerError: 'playerError',
  /** Emitted when managed Track playback completes naturally. */
  PlayerFinish: 'playerFinish',
  /** Emitted when the current managed Track is skipped. */
  PlayerSkip: 'playerSkip',
  /** Emitted immediately before a managed Track is selected for playback. */
  PlayerTrigger: 'playerTrigger',
  /** Emitted when the Remedia voice state changes. */
  VoiceStateUpdate: 'voiceStateUpdate',
  /** Emitted after the queue node's percentage volume changes. */
  VolumeChange: 'volumeChange',
  /** Emitted when Remedia pauses playback. */
  PlayerPause: 'playerPause',
  /** Emitted when Remedia resumes playback. */
  PlayerResume: 'playerResume',
  /** Emitted when Remedia seeks playback. */
  PlayerSeek: 'playerSeek',
  /** Emitted when managed playback stops without natural completion. */
  PlayerStop: 'playerStop',
  /** Legacy filter event name retained for compatibility. */
  BiquadFiltersUpdate: 'biquadFiltersUpdate',
  /** Legacy filter event name retained for compatibility. */
  EqualizerUpdate: 'equalizerUpdate',
  /** Legacy filter event name retained for compatibility. */
  DSPUpdate: 'dspUpdate',
  /** Legacy filter event name retained for compatibility. */
  AudioFiltersUpdate: 'audioFiltersUpdate',
  /** Legacy channel population event name retained for compatibility. */
  ChannelPopulate: 'channelPopulate',
  /** Legacy sample-rate event name retained for compatibility. */
  SampleRateUpdate: 'sampleRateUpdate',
  /** Legacy filter sample-rate event name retained for compatibility. */
  SampleRateFilterUpdate: 'sampleRateFilterUpdate',
  /** Legacy reverb event name retained for compatibility. */
  ReverbUpdate: 'reverbUpdate',
  /** Legacy compressor event name retained for compatibility. */
  CompressorUpdate: 'compressorUpdate',
  /** Emitted when a GuildQueue is created. */
  QueueCreate: 'queueCreate',
  /** Emitted when a GuildQueue is destroyed. */
  QueueDelete: 'queueDelete',
  /** Emitted before queue-managed playback starts a selected Track. */
  WillPlayTrack: 'willPlayTrack',
  /** Emitted when AUTOPLAY repeat reaches the source-plugin scheduling boundary. */
  WillAutoPlay: 'willAutoPlay',
} as const;

/** Union of familiar guild queue event names. */
export type GuildQueueEvents = (typeof GuildQueueEvents)[keyof typeof GuildQueueEvents];

/** Event parameter tuple with the owning queue prepended. */
export type QueueEventParams<T extends unknown[]> = [queue: GuildQueue, ...args: T];

/** Remedia event variants that can end a raw playback generation. */
export type RawPlaybackTerminalEvent =
  | DiscordSessionEvents['playbackCompleted'][0]
  | DiscordSessionEvents['playbackStopped'][0]
  | DiscordSessionEvents['playbackFailed'][0];

/** Discriminated native session observation, including events rejected by queue correlation. */
export type NativeSessionObservation = {
  [Name in keyof DiscordSessionEvents]: [name: Name, rawEvent: DiscordSessionEvents[Name][0]];
}[keyof DiscordSessionEvents];

/** Queue lifecycle and native observation argument tuples. */
export interface GuildQueueEventsMap {
  /** Native session notification before queue correlation; never changes state itself. */
  sessionEvent: QueueEventParams<NativeSessionObservation>;

  /** Selected upcoming Track, before source preparation; retries may select it again. */
  willPrepareNextTrack: QueueEventParams<[track: Track, rawEvent: DiscordSessionEvents['prepareRequested'][0]]>;

  /** Staged source ready; null Track means its occurrence could not be correlated. */
  stageReady: QueueEventParams<[track: Track | null, rawEvent: DiscordSessionEvents['stageReady'][0]]>;

  /** Staging failure, separate from active playback failure. Local preparation has no native event. */
  stageFailed: QueueEventParams<
    [track: Track | null, error: Error, rawEvent: DiscordSessionEvents['stageFailed'][0] | undefined]
  >;

  /** Native stage invalidation. */
  stageInvalidated: QueueEventParams<[track: Track | null, rawEvent: DiscordSessionEvents['stageInvalidated'][0]]>;

  /** Native transition cancellation. */
  transitionCancelled: QueueEventParams<
    [track: Track | null, rawEvent: DiscordSessionEvents['transitionCancelled'][0]]
  >;

  /** Session released its native resources. */
  sessionDisposed: QueueEventParams<[rawEvent: DiscordSessionEvents['sessionDisposed'][0]]>;

  /** Remedia transport state, distinct from Discord Gateway member state. */
  voiceConnectionStateChange: QueueEventParams<
    [
      previousState: DiscordSessionEvents['voiceStateChanged'][0]['previousState'],
      state: DiscordSessionEvents['voiceStateChanged'][0]['state'],
      rawEvent: DiscordSessionEvents['voiceStateChanged'][0],
    ]
  >;

  /** Native sessionResumed projected only onto an existing owning queue. */
  sessionResumed: QueueEventParams<[rawEvent: RemediaClientEvents['sessionResumed'][0]]>;

  /** Native sessionLost projected only onto an existing owning queue. */
  sessionLost: QueueEventParams<[rawEvent: RemediaClientEvents['sessionLost'][0]]>;

  /** Native guildAssigned projected only onto an existing owning queue. */
  guildAssigned: QueueEventParams<[rawEvent: RemediaClientEvents['guildAssigned'][0]]>;

  /** Native guildReleased projected only onto an existing owning queue. */
  guildReleased: QueueEventParams<[rawEvent: RemediaClientEvents['guildReleased'][0]]>;

  /** Native guildMigrated projected only onto an existing owning queue. */
  guildMigrated: QueueEventParams<[rawEvent: RemediaClientEvents['guildMigrated'][0]]>;

  /** One Track was added; arguments are queue and Track. */
  [GuildQueueEvents.AudioTrackAdd]: QueueEventParams<[track: Track]>;

  /** Multiple Tracks were added; arguments are queue and Track array. */
  [GuildQueueEvents.AudioTracksAdd]: QueueEventParams<[tracks: Track[]]>;

  /** One Track was removed; arguments are queue and Track. */
  [GuildQueueEvents.AudioTrackRemove]: QueueEventParams<[track: Track]>;

  /** Multiple Tracks were removed; arguments are queue and Track array. */
  [GuildQueueEvents.AudioTracksRemove]: QueueEventParams<[tracks: Track[]]>;

  /** A queue session connected. */
  [GuildQueueEvents.Connection]: QueueEventParams<[]>;

  /** A queue session was destroyed. */
  [GuildQueueEvents.ConnectionDestroyed]: QueueEventParams<[]>;

  /** A queue session disconnected. */
  [GuildQueueEvents.Disconnect]: QueueEventParams<[]>;

  /** Queue-scoped debug message. */
  [GuildQueueEvents.Debug]: QueueEventParams<[message: string]>;

  /** Queue-scoped application error. */
  [GuildQueueEvents.Error]: QueueEventParams<[error: Error, rawEvent?: DiscordSessionEvents['voiceFailed'][0]]>;

  /** Connected voice channel became empty. */
  [GuildQueueEvents.EmptyChannel]: QueueEventParams<[]>;

  /** Upcoming queue became empty. */
  [GuildQueueEvents.EmptyQueue]: QueueEventParams<[]>;

  /** Managed Track started; raw Remedia event is appended when present. */
  [GuildQueueEvents.PlayerStart]: QueueEventParams<
    [track: Track, rawEvent: DiscordSessionEvents['playbackStarted'][0] | undefined]
  >;

  /** Managed Track failed; arguments preserve the v7 order and append the Remedia event. */
  [GuildQueueEvents.PlayerError]: QueueEventParams<
    [error: Error, track: Track, rawEvent: DiscordSessionEvents['playbackFailed'][0] | undefined]
  >;

  /** Managed Track completed naturally; the raw Remedia event is appended when present. */
  [GuildQueueEvents.PlayerFinish]: QueueEventParams<
    [track: Track, rawEvent: DiscordSessionEvents['playbackCompleted'][0] | undefined]
  >;

  /** Managed Track was skipped; the raw Remedia stop event is appended when present. */
  [GuildQueueEvents.PlayerSkip]: QueueEventParams<
    [
      track: Track,
      reason: TrackSkipReason,
      description: string,
      rawEvent: DiscordSessionEvents['playbackStopped'][0] | undefined,
    ]
  >;

  /** Track selection trigger with its application-level reason. */
  [GuildQueueEvents.PlayerTrigger]: QueueEventParams<[track: Track, reason: PlayerTriggeredReason]>;

  /** Remedia voice-state update. */
  [GuildQueueEvents.VoiceStateUpdate]: QueueEventParams<[event: DiscordSessionEvents['voiceStateChanged'][0]]>;

  /** Previous and new volume percentages. */
  [GuildQueueEvents.VolumeChange]: QueueEventParams<
    [oldVolume: number, newVolume: number, rawEvent?: DiscordSessionEvents['volumeChanged'][0]]
  >;

  /** Remedia pause lifecycle event. */
  [GuildQueueEvents.PlayerPause]: QueueEventParams<[rawEvent: DiscordSessionEvents['playbackPaused'][0]]>;

  /** Remedia resume lifecycle event. */
  [GuildQueueEvents.PlayerResume]: QueueEventParams<[rawEvent: DiscordSessionEvents['playbackResumed'][0]]>;

  /** Remedia seek lifecycle event. */
  [GuildQueueEvents.PlayerSeek]: QueueEventParams<[rawEvent: DiscordSessionEvents['playbackSeeked'][0]]>;

  /** Managed playback stopped; the raw Remedia stop event is appended when present. */
  [GuildQueueEvents.PlayerStop]: QueueEventParams<
    [track: Track | null, rawEvent: DiscordSessionEvents['playbackStopped'][0] | undefined]
  >;

  /** Legacy filter update event retained for consumer type compatibility. */
  [GuildQueueEvents.BiquadFiltersUpdate]: QueueEventParams<[oldFilters: unknown, newFilters: unknown]>;

  /** Legacy filter update event retained for consumer type compatibility. */
  [GuildQueueEvents.EqualizerUpdate]: QueueEventParams<[oldFilters: unknown, newFilters: unknown]>;

  /** Legacy filter update event retained for consumer type compatibility. */
  [GuildQueueEvents.DSPUpdate]: QueueEventParams<[oldFilters: unknown, newFilters: unknown]>;

  /** Legacy filter update event retained for consumer type compatibility. */
  [GuildQueueEvents.AudioFiltersUpdate]: QueueEventParams<
    [oldFilters: string | null, newFilters: string | null, rawEvent?: DiscordSessionEvents['filterChanged'][0]]
  >;

  /** Legacy channel population event retained for compatibility. */
  [GuildQueueEvents.ChannelPopulate]: QueueEventParams<[]>;

  /** Legacy sample-rate update event retained for compatibility. */
  [GuildQueueEvents.SampleRateUpdate]: QueueEventParams<[oldRate: number | null, newRate: number]>;

  /** Legacy filter sample-rate event retained for compatibility. */
  [GuildQueueEvents.SampleRateFilterUpdate]: QueueEventParams<[oldFilter: unknown, newFilter: unknown]>;

  /** Legacy reverb update event retained for compatibility. */
  [GuildQueueEvents.ReverbUpdate]: QueueEventParams<[oldValue: unknown, newValue: unknown]>;

  /** Legacy compressor update event retained for compatibility. */
  [GuildQueueEvents.CompressorUpdate]: QueueEventParams<[oldValue: unknown, newValue: unknown]>;

  /** Queue was created; no raw Remedia event exists. */
  [GuildQueueEvents.QueueCreate]: QueueEventParams<[]>;

  /** Queue was deleted; no raw Remedia event exists. */
  [GuildQueueEvents.QueueDelete]: QueueEventParams<[]>;

  /** A Track was selected and will be submitted to Remedia. */
  [GuildQueueEvents.WillPlayTrack]: QueueEventParams<[track: Track]>;

  /** AUTOPLAY reached its deferred source-plugin scheduling boundary. */
  [GuildQueueEvents.WillAutoPlay]: QueueEventParams<[track: Track]>;
}
