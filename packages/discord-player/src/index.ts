import { version as djsVersion } from 'discord.js';

export * from './utils/PlayerEventsEmitter';
export * from './utils/AudioFilters';
export * from './extractors/BaseExtractor';
export * from './extractors/ExtractorExecutionContext';
export * from './fabric';
export * from './manager';
export * from './VoiceInterface/VoiceUtils';
export * from './VoiceInterface/StreamDispatcher';
export * from './utils/Util';
export * from './utils/TypeUtil';
export * from './utils/AsyncQueue';
export * from './types/types';
export * from './utils/FFmpegStream';
export * from './utils/QueryCache';
export * from './utils/QueryResolver';
export * from '@discord-player/ffmpeg';
export * from './Player';
export * from './hooks';
export * from './utils/IPRotator';
export * from './utils/serde';
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
    FiltersChain
} from '@discord-player/equalizer';
export { createAudioPlayer, AudioPlayer, type CreateAudioPlayerOptions } from 'discord-voip';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';

if (!djsVersion.startsWith('14')) {
    process.emitWarning(`Discord.js v${djsVersion} is incompatible with Discord Player v${version}! Please use >=v14.x of Discord.js`);
}
