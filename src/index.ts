export { AudioFilters } from "./utils/AudioFilters";
export { ExtractorModel } from "./Structures/ExtractorModel";
export { Playlist } from "./Structures/Playlist";
export { Player } from "./Player";
export { PlayerError, ErrorStatusCode } from "./Structures/PlayerError";
export { QueryResolver } from "./utils/QueryResolver";
export { Queue } from "./Structures/Queue";
export { Track } from "./Structures/Track";
export { VoiceUtils } from "./VoiceInterface/VoiceUtils";
export { VoiceEvents, StreamDispatcher } from "./VoiceInterface/StreamDispatcher";
export { Util } from "./utils/Util";
export * from "./types/types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const version: string = require(`${__dirname}/../package.json`).version;
