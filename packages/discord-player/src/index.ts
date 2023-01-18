// try applying smooth volume patch on load
import './smoothVolume';
import { version as djsVersion } from 'discord.js';

export { AudioFilters } from './utils/AudioFilters';
export * from './extractors/BaseExtractor';
export * from './extractors/ExtractorExecutionContext';
export { Playlist } from './Structures/Playlist';
export { Player } from './Player';
export { PlayerError, ErrorStatusCode } from './Structures/PlayerError';
export { QueryResolver } from './utils/QueryResolver';
export { Queue } from './Structures/Queue';
export { Track } from './Structures/Track';
export { VoiceUtils } from './VoiceInterface/VoiceUtils';
export { VoiceEvents, StreamDispatcher } from './VoiceInterface/StreamDispatcher';
export * from './VoiceInterface/VolumeTransformer';
export { Util } from './utils/Util';
export * from './types/types';
export * from './utils/FFmpegStream';
export * from './Structures/GuildQueue';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';

if (!djsVersion.startsWith('14')) {
    process.emitWarning(`Discord.js v${djsVersion} is incompatible with Discord Player v${version}! Please use >=v14.x of Discord.js`);
}
