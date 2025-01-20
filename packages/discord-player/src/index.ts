export { createErisCompat } from './compat/createErisCompat';
export { createOceanicCompat } from './compat/createOceanicCompat';
export { isErisProxy, isOceanicProxy } from './compat/common';
export * from './utils/PlayerEventsEmitter';
export * from './utils/AudioFilters';
export * from './extractors/BaseExtractor';
export * from './extractors/ExtractorExecutionContext';
export * from './fabric';
export * from './queue';
export * from './lrclib/LrcLib';
export * from './utils/SequentialBucket';
export * from './stream/VoiceUtils';
export * from './stream/StreamDispatcher';
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
export * from './stream/InterceptedStream';
export * from './PlayerStreamInterceptor';
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
  StreamType,
  createAudioResource,
  type JoinConfig,
  type JoinVoiceChannelOptions,
  type CreateAudioPlayerOptions,
} from 'discord-voip';

export { version } from './version';
