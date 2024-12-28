export { createErisCompat, isErisProxy } from './compat/createErisCompat';
export * from './utils/PlayerEventsEmitter';
export * from './utils/AudioFilters';
export * from './extractors/BaseExtractor';
export * from './extractors/ExtractorExecutionContext';
export * from './fabric';
export * from './queue';
export * from './lrclib/LrcLib';
export * from './utils/SequentialBucket';
export * from './VoiceInterface/VoiceUtils';
export * from './VoiceInterface/StreamDispatcher';
export * from './utils/Util';
export * from './utils/TypeUtil';
export * from './utils/AsyncQueue';
export * from './utils/FFmpegStream';
export * from './utils/QueryCache';
export * from './utils/QueryResolver';
export * from '@discord-player/ffmpeg';
export * from './Player';
export * from './hooks';
export * from './utils/serde';
export * from './utils/DependencyReportGenerator';
export {
  AudioFilters as PCMAudioFilters,
  type BiquadFilters,
  FilterType as BiquadFilterType,
  type PCMFilters,
  Q_BUTTERWORTH,
  VolumeTransformer,
  BASS_EQ_BANDS,
  AF_NIGHTCORE_RATE,
  AF_VAPORWAVE_RATE,
  FiltersChain,
} from '@discord-player/equalizer';
export {
  createAudioPlayer,
  AudioPlayer,
  getVoiceConnection,
  getVoiceConnections,
  joinVoiceChannel,
  type JoinConfig,
  type JoinVoiceChannelOptions,
  type CreateAudioPlayerOptions,
} from 'discord-voip';

export { version } from './version';
