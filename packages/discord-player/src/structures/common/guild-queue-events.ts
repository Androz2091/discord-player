import type { GuildQueue } from '../guild-queue.js';
import type { DiscordSessionEvents } from '@remedia/client';

export const GuildQueueEvents = {
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
  /**
   * Emitted when the player is stopped
   */
  PlayerStop: 'playerStop',
} as const;

export type GuildQueueEvents = (typeof GuildQueueEvents)[keyof typeof GuildQueueEvents];

export type QueueEventParams<T extends unknown[]> = [queue: GuildQueue, ...args: T];

export interface GuildQueueEventsMap {
  [GuildQueueEvents.PlayerSeek]: QueueEventParams<[event: DiscordSessionEvents['playbackSeeked'][0]]>;
  [GuildQueueEvents.PlayerPause]: QueueEventParams<[event: DiscordSessionEvents['playbackPaused'][0]]>;
  [GuildQueueEvents.PlayerStart]: QueueEventParams<[event: DiscordSessionEvents['playbackStarted'][0]]>;
  [GuildQueueEvents.PlayerFinish]: QueueEventParams<[event: DiscordSessionEvents['playbackCompleted'][0]]>;
  [GuildQueueEvents.PlayerError]: QueueEventParams<[event: DiscordSessionEvents['playbackFailed'][0]]>;
  [GuildQueueEvents.PlayerStop]: QueueEventParams<[event: DiscordSessionEvents['playbackStopped'][0]]>;
}
