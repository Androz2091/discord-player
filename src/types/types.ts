import { Snowflake, User, UserResolvable } from "discord.js";
import { Readable, Duplex } from "stream";
import { Queue } from "../Structures/Queue";
import Track from "../Structures/Track";
import { Playlist } from "../Structures/Playlist";
import { StreamDispatcher } from "../VoiceInterface/StreamDispatcher";
import { downloadOptions } from "ytdl-core";

export type FiltersName = keyof QueueFilters;

/**
 * @typedef {AudioFilters} QueueFilters
 */
export interface QueueFilters {
    bassboost_low?: boolean;
    bassboost?: boolean;
    bassboost_high?: boolean;
    "8D"?: boolean;
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
 * - arbitrary
 * @typedef {string} TrackSource
 */
export type TrackSource = "soundcloud" | "youtube" | "spotify" | "arbitrary";

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
    requestedBy: User;
    playlist?: Playlist;
    source?: TrackSource;
    engine?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    live?: boolean;
    raw?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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
}

/**
 * @typedef {object} PlayerOptions
 * @property {boolean} [leaveOnEnd=true] If it should leave on end
 * @property {boolean} [leaveOnStop=true] If it should leave on stop
 * @property {boolean} [leaveOnEmpty=true] If it should leave on empty
 * @property {number} [leaveOnEmptyCooldown=1000] The cooldown in ms
 * @property {boolean} [autoSelfDeaf=true] If it should set the bot in deaf mode
 * @property {YTDLDownloadOptions} [ytdlOptions={}] The youtube download options
 * @property {number} [initialVolume=100] The initial player volume
 * @property {number} [bufferingTimeout=3000] Buffering timeout for the stream
 */
export interface PlayerOptions {
    leaveOnEnd?: boolean;
    leaveOnStop?: boolean;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    autoSelfDeaf?: boolean;
    ytdlOptions?: downloadOptions;
    initialVolume?: number;
    bufferingTimeout?: number;
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
        type: "album" | "playlist";
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
 * @typedef {string} QueryType
 */
export enum QueryType {
    AUTO = "auto",
    YOUTUBE = "youtube",
    YOUTUBE_PLAYLIST = "youtube_playlist",
    SOUNDCLOUD_TRACK = "soundcloud_track",
    SOUNDCLOUD_PLAYLIST = "soundcloud_playlist",
    SOUNDCLOUD = "soundcloud",
    SPOTIFY_SONG = "spotify_song",
    SPOTIFY_ALBUM = "spotify_album",
    SPOTIFY_PLAYLIST = "spotify_playlist",
    FACEBOOK = "facebook",
    VIMEO = "vimeo",
    ARBITRARY = "arbitrary",
    REVERBNATION = "reverbnation",
    YOUTUBE_SEARCH = "youtube_search",
    YOUTUBE_VIDEO = "youtube_video",
    SOUNDCLOUD_SEARCH = "soundcloud_search"
}

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

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PlayerEvents {
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

/**
 * @typedef {object} SearchOptions
 * @property {UserResolvable} requestedBy The user who requested this search
 * @property {QueryType} [searchEngine=QueryType.AUTO] The query search engine
 * @property {boolean} [blockExtractor=false] If it should block custom extractors
 */
export interface SearchOptions {
    requestedBy: UserResolvable;
    searchEngine?: QueryType;
    blockExtractor?: boolean;
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
    type: "album" | "playlist";
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
    type: "album" | "playlist";
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
 * @property {YTDLDownloadOptions} [ytdlOptions={}] The options passed to `ytdl-core`
 * @property {number} [connectionTimeout=20000] The voice connection timeout
 */
export interface PlayerInitOptions {
    autoRegisterExtractor?: boolean;
    ytdlOptions?: downloadOptions;
    connectionTimeout?: number;
}
