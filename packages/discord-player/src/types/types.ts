import { Snowflake, User, UserResolvable, VoiceState } from 'discord.js';
import { Readable, Duplex } from 'stream';
import { Queue } from '../Structures/Queue';
import { Track } from '../Structures/Track';
import { Playlist } from '../Structures/Playlist';
import { StreamDispatcher } from '../VoiceInterface/StreamDispatcher';
import { downloadOptions } from 'ytdl-core';
import { BiquadFilters, EqualizerBand, PCMFilters } from '@discord-player/equalizer';

export type FiltersName = keyof QueueFilters;

export interface PlayerSearchResult {
    playlist: Playlist | null;
    tracks: Track[];
}

/**
 * @typedef {AudioFilters} QueueFilters
 */
export interface QueueFilters {
    bassboost_low?: boolean;
    bassboost?: boolean;
    bassboost_high?: boolean;
    '8D'?: boolean;
    vaporwave?: boolean;
    nightcore?: boolean;
    phaser?: boolean;
    tremolo?: boolean;
    vibrato?: boolean;
    reverse?: boolean;
    treble?: boolean;
    normalizer?: boolean;
    normalizer2?: boolean;
    surrounding?: boolean;
    pulsator?: boolean;
    subboost?: boolean;
    karaoke?: boolean;
    flanger?: boolean;
    gate?: boolean;
    haas?: boolean;
    mcompand?: boolean;
    mono?: boolean;
    mstlr?: boolean;
    mstrr?: boolean;
    compressor?: boolean;
    expander?: boolean;
    softlimiter?: boolean;
    chorus?: boolean;
    chorus2d?: boolean;
    chorus3d?: boolean;
    fadein?: boolean;
    dim?: boolean;
    earrape?: boolean;
}

/**
 * The track source:
 * - soundcloud
 * - youtube
 * - spotify
 * - apple_music
 * - arbitrary
 * @typedef {string} TrackSource
 */
export type TrackSource = 'soundcloud' | 'youtube' | 'spotify' | 'apple_music' | 'arbitrary';

/**
 * @typedef {object} RawTrackData
 * @property {string} title The title
 * @property {string} description The description
 * @property {string} author The author
 * @property {string} url The url
 * @property {string} thumbnail The thumbnail
 * @property {string} duration The duration
 * @property {number} views The views
 * @property {User} requestedBy The user who requested this track
 * @property {Playlist} [playlist] The playlist
 * @property {TrackSource} [source="arbitrary"] The source
 * @property {any} [engine] The engine
 * @property {boolean} [live] If this track is live
 * @property {any} [raw] The raw data
 */
export interface RawTrackData {
    title: string;
    description: string;
    author: string;
    url: string;
    thumbnail: string;
    duration: string;
    views: number;
    requestedBy?: User | null;
    playlist?: Playlist;
    source?: TrackSource;
    engine?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    live?: boolean;
    raw?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    queryType?: SearchQueryType;
}

/**
 * @typedef {object} TimeData
 * @property {number} days Time in days
 * @property {number} hours Time in hours
 * @property {number} minutes Time in minutes
 * @property {number} seconds Time in seconds
 */
export interface TimeData {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

/**
 * @typedef {object} PlayerProgressbarOptions
 * @property {boolean} [timecodes] If it should render time codes
 * @property {boolean} [queue] If it should create progress bar for the whole queue
 * @property {number} [length] The bar length
 * @property {string} [line] The bar track
 * @property {string} [indicator] The indicator
 */
export interface PlayerProgressbarOptions {
    timecodes?: boolean;
    length?: number;
    line?: string;
    indicator?: string;
    queue?: boolean;
}

/**
 * @typedef {object} PlayerOptions
 * @property {boolean} [leaveOnEnd=true] If it should leave on end
 * @property {boolean} [leaveOnStop=true] If it should leave on stop
 * @property {boolean} [leaveOnEmpty=true] If it should leave on empty
 * @property {number} [leaveOnEmptyCooldown=1000] The cooldown in ms
 * @property {number} [leaveOnEndCooldown=1000] The cooldown in ms
 * @property {boolean} [autoSelfDeaf=true] If it should set the bot in deaf mode
 * @property {YTDLDownloadOptions} [ytdlOptions] The youtube download options
 * @property {number} [initialVolume=100] The initial player volume
 * @property {number} [bufferingTimeout=3000] Buffering timeout for the stream
 * @property {boolean} [spotifyBridge=true] If player should bridge spotify source to youtube
 * @property {boolean} [disableVolume=false] If player should disable inline volume
 * @property {boolean} [disableEqualizer=false] If player should disable equalizer
 * @property {boolean} [disableBiquad=false] If player should disable biquad
 * @property {number} [volumeSmoothness=0] The volume transition smoothness between volume changes (lower the value to get better result)
 * Setting this or leaving this empty will disable this effect. Example: `volumeSmoothness: 0.1`
 * @property {EqualizerBand[]} [equalizerBands] The equalizer bands array for 15 band equalizer.
 * @property {BiquadFilters} [biquadFilter] The biquad filter initializer value
 * @property {boolean} [disableFilters] Disable/enable PCM filter
 * @property {PCMFilters[]} [defaultFilters] The PCM filters initializer
 * @property {Function} [onBeforeCreateStream] Runs before creating stream
 */
export interface PlayerOptions {
    leaveOnEnd?: boolean;
    leaveOnEndCooldown?: number;
    leaveOnStop?: boolean;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    autoSelfDeaf?: boolean;
    ytdlOptions?: downloadOptions;
    initialVolume?: number;
    bufferingTimeout?: number;
    spotifyBridge?: boolean;
    disableVolume?: boolean;
    disableEqualizer?: boolean;
    disableBiquad?: boolean;
    volumeSmoothness?: number;
    equalizerBands?: EqualizerBand[];
    biquadFilter?: BiquadFilters;
    disableFilters?: boolean;
    defaultFilters?: PCMFilters[];
    onBeforeCreateStream?: (track: Track, source: SearchQueryType, queue: Queue) => Promise<Readable>;
}

/**
 * @typedef {object} ExtractorModelData
 * @property {object} [playlist] The playlist info (if any)
 * @property {string} [playlist.title] The playlist title
 * @property {string} [playlist.description] The playlist description
 * @property {string} [playlist.thumbnail] The playlist thumbnail
 * @property {album|playlist} [playlist.type] The playlist type: `album` | `playlist`
 * @property {TrackSource} [playlist.source] The playlist source
 * @property {object} [playlist.author] The playlist author
 * @property {string} [playlist.author.name] The author name
 * @property {string} [playlist.author.url] The author url
 * @property {string} [playlist.id] The playlist id
 * @property {string} [playlist.url] The playlist url
 * @property {any} [playlist.rawPlaylist] The raw data
 * @property {ExtractorData[]} data The data
 */

/**
 * @typedef {object} ExtractorData
 * @property {string} title The title
 * @property {number} duration The duration
 * @property {string} thumbnail The thumbnail
 * @property {string|Readable|Duplex} engine The stream engine
 * @property {number} views The views count
 * @property {string} author The author
 * @property {string} description The description
 * @property {string} url The url
 * @property {string} [version] The extractor version
 * @property {TrackSource} [source="arbitrary"] The source
 */
export interface ExtractorModelData {
    playlist?: {
        title: string;
        description: string;
        thumbnail: string;
        type: 'album' | 'playlist';
        source: TrackSource;
        author: {
            name: string;
            url: string;
        };
        id: string;
        url: string;
        rawPlaylist?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    data: {
        title: string;
        duration: number;
        thumbnail: string;
        engine: string | Readable | Duplex;
        views: number;
        author: string;
        description: string;
        url: string;
        version?: string;
        source?: TrackSource;
    }[];
}

/**
 * The search query type
 * This can be one of:
 * - AUTO
 * - YOUTUBE
 * - YOUTUBE_PLAYLIST
 * - SOUNDCLOUD_TRACK
 * - SOUNDCLOUD_PLAYLIST
 * - SOUNDCLOUD
 * - SPOTIFY_SONG
 * - SPOTIFY_ALBUM
 * - SPOTIFY_PLAYLIST
 * - FACEBOOK
 * - VIMEO
 * - ARBITRARY
 * - REVERBNATION
 * - YOUTUBE_SEARCH
 * - YOUTUBE_VIDEO
 * - SOUNDCLOUD_SEARCH
 * - APPLE_MUSIC_SONG
 * - APPLE_MUSIC_ALBUM
 * - APPLE_MUSIC_PLAYLIST
 * - FILE
 * @typedef {number} QueryType
 */
export const QueryType = {
    AUTO: 'auto',
    YOUTUBE: 'youtube',
    YOUTUBE_PLAYLIST: 'youtubePlaylist',
    SOUNDCLOUD_TRACK: 'soundcloudTrack',
    SOUNDCLOUD_PLAYLIST: 'soundcloudPlaylist',
    SOUNDCLOUD: 'soundcloud',
    SPOTIFY_SONG: 'spotifySong',
    SPOTIFY_ALBUM: 'spotifyAlbum',
    SPOTIFY_PLAYLIST: 'spotifyPlaylist',
    FACEBOOK: 'facebook',
    VIMEO: 'vimeo',
    ARBITRARY: 'arbitrary',
    REVERBNATION: 'reverbnation',
    YOUTUBE_SEARCH: 'youtubeSearch',
    YOUTUBE_VIDEO: 'youtubeVideo',
    SOUNDCLOUD_SEARCH: 'soundcloudSearch',
    APPLE_MUSIC_SONG: 'appleMusicSong',
    APPLE_MUSIC_ALBUM: 'appleMusicAlbum',
    APPLE_MUSIC_PLAYLIST: 'appleMusicPlaylist',
    FILE: 'file'
} as const;

export type SearchQueryType = keyof typeof QueryType | (typeof QueryType)[keyof typeof QueryType];

/**
 * Emitted when bot gets disconnected from a voice channel
 * @event Player#botDisconnect
 * @param {Queue} queue The queue
 */

/**
 * Emitted when the voice channel is empty
 * @event Player#channelEmpty
 * @param {Queue} queue The queue
 */

/**
 * Emitted when bot connects to a voice channel
 * @event Player#connectionCreate
 * @param {Queue} queue The queue
 * @param {StreamDispatcher} connection The discord player connection object
 */

/**
 * Debug information
 * @event Player#debug
 * @param {Queue} queue The queue
 * @param {string} message The message
 */

/**
 * Emitted on error
 * <warn>This event should handled properly otherwise it may crash your process!</warn>
 * @event Player#error
 * @param {Queue} queue The queue
 * @param {Error} error The error
 */

/**
 * Emitted on connection error. Sometimes stream errors are emitted here as well.
 * @event Player#connectionError
 * @param {Queue} queue The queue
 * @param {Error} error The error
 */

/**
 * Emitted when queue ends
 * @event Player#queueEnd
 * @param {Queue} queue The queue
 */

/**
 * Emitted when a single track is added
 * @event Player#trackAdd
 * @param {Queue} queue The queue
 * @param {Track} track The track
 */

/**
 * Emitted when multiple tracks are added
 * @event Player#tracksAdd
 * @param {Queue} queue The queue
 * @param {Track[]} tracks The tracks
 */

/**
 * Emitted when a track starts playing
 * @event Player#trackStart
 * @param {Queue} queue The queue
 * @param {Track} track The track
 */

/**
 * Emitted when a track ends
 * @event Player#trackEnd
 * @param {Queue} queue The queue
 * @param {Track} track The track
 */

/**
 * Emitted when voice state updates. Listen to this event to modify internal voice state update handler.
 * @event Player#voiceStateUpdate
 * @param {Queue} queue The queue that this update belongs to
 * @param {VoiceState} oldState The old voice state
 * @param {VoiceState} newState The new voice state
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PlayerEvents {
    //#region legacy
    botDisconnect: (queue: Queue) => any;
    channelEmpty: (queue: Queue) => any;
    connectionCreate: (queue: Queue, connection: StreamDispatcher) => any;
    debug: (queue: Queue, message: string) => any;
    error: (queue: Queue, error: Error) => any;
    connectionError: (queue: Queue, error: Error) => any;
    queueEnd: (queue: Queue) => any;
    trackAdd: (queue: Queue, track: Track) => any;
    tracksAdd: (queue: Queue, track: Track[]) => any;
    trackStart: (queue: Queue, track: Track) => any;
    trackEnd: (queue: Queue, track: Track) => any;
    voiceStateUpdate: (queue: Queue, oldState: VoiceState, newState: VoiceState) => any;
    //#endregion legacy
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * @typedef {object} PlayOptions
 * @property {boolean} [filtersUpdate=false] If this play was triggered for filters update
 * @property {string[]} [encoderArgs=[]] FFmpeg args passed to encoder
 * @property {number} [seek] Time to seek to before playing
 * @property {boolean} [immediate=false] If it should start playing the provided track immediately
 */
export interface PlayOptions {
    filtersUpdate?: boolean;
    encoderArgs?: string[];
    seek?: number;
    immediate?: boolean;
}

export type QueryExtractorSearch = `ext:${string}`;

/**
 * @typedef {object} SearchOptions
 * @property {UserResolvable} requestedBy The user who requested this search
 * @property {typeof QueryType|string} [searchEngine=QueryType.AUTO] The query search engine, can be extractor name to target specific one (custom)
 * @property {boolean} [blockExtractors[]] List of the extractors to block
 */
export interface SearchOptions {
    requestedBy?: UserResolvable;
    searchEngine?: SearchQueryType | QueryExtractorSearch;
    blockExtractors?: string[];
}

/**
 * The queue repeat mode. This can be one of:
 * - OFF
 * - TRACK
 * - QUEUE
 * - AUTOPLAY
 * @typedef {number} QueueRepeatMode
 */
export enum QueueRepeatMode {
    OFF = 0,
    TRACK = 1,
    QUEUE = 2,
    AUTOPLAY = 3
}

/**
 * @typedef {object} PlaylistInitData
 * @property {Track[]} tracks The tracks of this playlist
 * @property {string} title The playlist title
 * @property {string} description The description
 * @property {string} thumbnail The thumbnail
 * @property {album|playlist} type The playlist type: `album` | `playlist`
 * @property {TrackSource} source The playlist source
 * @property {object} author The playlist author
 * @property {string} [author.name] The author name
 * @property {string} [author.url] The author url
 * @property {string} id The playlist id
 * @property {string} url The playlist url
 * @property {any} [rawPlaylist] The raw playlist data
 */
export interface PlaylistInitData {
    tracks: Track[];
    title: string;
    description: string;
    thumbnail: string;
    type: 'album' | 'playlist';
    source: TrackSource;
    author: {
        name: string;
        url: string;
    };
    id: string;
    url: string;
    rawPlaylist?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * @typedef {object} TrackJSON
 * @property {string} title The track title
 * @property {string} description The track description
 * @property {string} author The author
 * @property {string} url The url
 * @property {string} thumbnail The thumbnail
 * @property {string} duration The duration
 * @property {number} durationMS The duration in ms
 * @property {number} views The views count
 * @property {Snowflake} requestedBy The id of the user who requested this track
 * @property {PlaylistJSON} [playlist] The playlist info (if any)
 */
export interface TrackJSON {
    id: Snowflake;
    title: string;
    description: string;
    author: string;
    url: string;
    thumbnail: string;
    duration: string;
    durationMS: number;
    views: number;
    requestedBy: Snowflake;
    playlist?: PlaylistJSON;
}

/**
 * @typedef {object} PlaylistJSON
 * @property {string} id The playlist id
 * @property {string} url The playlist url
 * @property {string} title The playlist title
 * @property {string} description The playlist description
 * @property {string} thumbnail The thumbnail
 * @property {album|playlist} type The playlist type: `album` | `playlist`
 * @property {TrackSource} source The track source
 * @property {object} author The playlist author
 * @property {string} [author.name] The author name
 * @property {string} [author.url] The author url
 * @property {TrackJSON[]} tracks The tracks data (if any)
 */
export interface PlaylistJSON {
    id: string;
    url: string;
    title: string;
    description: string;
    thumbnail: string;
    type: 'album' | 'playlist';
    source: TrackSource;
    author: {
        name: string;
        url: string;
    };
    tracks: TrackJSON[];
}

/**
 * @typedef {object} PlayerInitOptions
 * @property {boolean} [autoRegisterExtractor=true] If it should automatically register `@discord-player/extractor`
 * @property {YTDLDownloadOptions} [ytdlOptions] The options passed to `ytdl-core`
 * @property {number} [connectionTimeout=20000] The voice connection timeout
 * @property {boolean} [smoothVolume=true] Toggle smooth volume transition
 * @property {boolean} [lagMonitor=30000] Time in ms to re-monitor event loop lag
 * @property {boolean} [lockVoiceStateHandler] Prevent voice state handler from being overridden
 * @property {string[]} [blockExtractors] List of extractors to block
 */
export interface PlayerInitOptions {
    autoRegisterExtractor?: boolean;
    ytdlOptions?: downloadOptions;
    connectionTimeout?: number;
    smoothVolume?: boolean;
    lagMonitor?: number;
    lockVoiceStateHandler?: boolean;
    blockExtractors?: string[];
}
