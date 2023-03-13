import { Snowflake, User, UserResolvable, VoiceState } from 'discord.js';
import { GuildQueue } from '../Structures';
import { Track } from '../Structures/Track';
import { Playlist } from '../Structures/Playlist';
import { downloadOptions } from 'ytdl-core';
import { QueryCache } from '../utils/QueryCache';

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
    lofi?: boolean;
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
 * - APPLE_MUSIC_SEARCH
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
    SPOTIFY_SEARCH: 'spotifySearch',
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
    APPLE_MUSIC_SEARCH: 'appleMusicSearch',
    FILE: 'file'
} as const;

export type SearchQueryType = keyof typeof QueryType | (typeof QueryType)[keyof typeof QueryType];

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PlayerEvents {
    debug: (message: string) => any;
    error: (error: Error) => any;
    voiceStateUpdate: (queue: GuildQueue, oldState: VoiceState, newState: VoiceState) => any;
}

export enum PlayerEvent {
    debug = 'debug',
    error = 'error',
    voiceStateUpdate = 'voiceStateUpdate'
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
 * @property {string[]} [blockExtractors[]] List of the extractors to block
 * @property {boolean} [ignoreCache] If it should ignore query cache lookup
 */
export interface SearchOptions {
    requestedBy?: UserResolvable;
    searchEngine?: SearchQueryType | QueryExtractorSearch;
    blockExtractors?: string[];
    ignoreCache?: boolean;
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
 * @property {string[]} [blockExtractors] List of extractors to disable querying metadata from
 * @property {string[]} [blockStreamFrom] List of extractors to disable streaming from
 * @property {QueryCache | null} [queryCache] Query cache provider
 * @property {boolean} [ignoreInstance] Ignore player instance
 */
export interface PlayerInitOptions {
    autoRegisterExtractor?: boolean;
    ytdlOptions?: downloadOptions;
    connectionTimeout?: number;
    smoothVolume?: boolean;
    lagMonitor?: number;
    lockVoiceStateHandler?: boolean;
    blockExtractors?: string[];
    blockStreamFrom?: string[];
    queryCache?: QueryCache | null;
    ignoreInstance?: boolean;
}
