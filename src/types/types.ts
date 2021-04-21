import { downloadOptions } from 'ytdl-core';
import { User } from 'discord.js';
import { Readable, Duplex } from 'stream';

/**
 * @typedef {object} PlayerOptions
 * @property {boolean} [leaveOnEnd=false] If it should leave on queue end
 * @property {number} [leaveOnEndCooldown=0] Time in ms to wait before executing `leaveOnEnd`
 * @property {boolean} [leaveOnStop=false] If it should leave on stop command
 * @property {boolean} [leaveOnEmpty=false] If it should leave on empty voice channel
 * @property {number} [leaveOnEmptyCooldown=0] Time in ms to wait before executing `leaveOnEmpty`
 * @property {boolean} [autoSelfDeaf=false] If it should set the client to `self deaf` mode on joining
 * @property {boolean} [enableLive=false] If it should enable live videos support
 * @property {YTDLDownloadOptions} [ytdlDownloadOptions={}] The download options passed to `ytdl-core`
 * @property {boolean} [useSafeSearch=false] If it should use `safe search` method for youtube searches
 */
export interface PlayerOptions {
    leaveOnEnd?: boolean;
    leaveOnEndCooldown?: number;
    leaveOnStop?: boolean;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    autoSelfDeaf?: boolean;
    enableLive?: boolean;
    ytdlDownloadOptions?: downloadOptions;
    useSafeSearch?: boolean;
}

export type FiltersName = keyof QueueFilters;

/**
 * @typedef {'soundcloud'|'youtube'|'arbitrary'} TrackSource
 */
export type TrackSource = 'soundcloud'|'youtube'|'arbitrary';

/**
 * @typedef {object} TrackData
 * @property {string} title The title
 * @property {string} description The description
 * @property {string} author The author
 * @property {string} url The url
 * @property {string} duration The duration
 * @property {number} views The view count
 * @property {Discord.User} requestedBy The user who requested this track
 * @property {boolean} fromPlaylist If this track came from a playlist
 * @property {TrackSource} [source] The track source
 * @property {string|Readable} [engine] The stream engine
 * @property {boolean} [live=false] If this track is livestream instance
 */
export interface TrackData {
    title: string;
    description: string;
    author: string;
    url: string;
    thumbnail: string;
    duration: string;
    views: number;
    requestedBy: User;
    fromPlaylist: boolean;
    source?: TrackSource;
    engine?: any;
    live?: boolean;
}

/**
 * @typedef {object} QueueFilters
 * The FFmpeg Filters
 */
export type QueueFilters = {
    bassboost?: boolean;
    '8D'?: boolean;
    vaporwave?: boolean;
    nightcore?: boolean;
    phaser?: boolean;
    tremolo?: boolean;
    vibrato?: boolean;
    reverse?: boolean;
    treble?: boolean;
    normalizer?: boolean;
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
};

/**
 * @typedef {'soundcloud_track'|'soundcloud_playlist'|'spotify_song'|'spotify_album'|'spotify_playlist'|'youtube_video'|'youtube_playlist'|'vimeo'|'facebook'|'reverbnation'|'attachment'|'youtube_search'} QueryType The query type
 */
export type QueryType =
    | 'soundcloud_track'
    | 'soundcloud_playlist'
    | 'spotify_song'
    | 'spotify_album'
    | 'spotify_playlist'
    | 'youtube_video'
    | 'youtube_playlist'
    | 'vimeo'
    | 'facebook'
    | 'reverbnation'
    | 'attachment'
    | 'youtube_search';

/**
 * @typedef {object} ExtractorModelData
 * @property {string} title The title
 * @property {number} duration The duration in ms
 * @property {string} thumbnail The thumbnail url
 * @property {string|Readable} engine The audio engine
 * @property {number} views The views count of this stream
 * @property {string} author The author
 * @property {string} description The description
 * @property {string} url The url
 * @property {string} [version='0.0.0'] The extractor version
 * @property {boolean} [important=false] Mark as important
 */
export interface ExtractorModelData {
    title: string;
    duration: number;
    thumbnail: string;
    engine: string | Readable | Duplex;
    views: number;
    author: string;
    description: string;
    url: string;
    version?: string;
    important?: boolean;
}

/**
 * @typedef {object} PlayerProgressbarOptions
 * @property {boolean} [timecodes] If it should return progres bar with time codes
 * @property {boolean} [queue] if it should return the progress bar of the whole queue
 * @property {number} [length] The length of progress bar to build
 */
export interface PlayerProgressbarOptions {
    timecodes?: boolean;
    queue?: boolean;
    length?: number;
}

/**
 * @typedef {object} LyricsData
 * @property {string} title The title of the lyrics
 * @property {number} id The song id
 * @property {string} thumbnail The thumbnail
 * @property {string} image The image
 * @property {string} url The url
 * @property {object} artist The artust info
 * @property {string} [artist.name] The name of the artist
 * @property {number} [artist.id] The ID of the artist
 * @property {string} [artist.url] The profile link of the artist
 * @property {string} [artist.image] The artist image url
 * @property {string?} lyrics The lyrics
 */
export interface LyricsData {
    title: string;
    id: number;
    thumbnail: string;
    image: string;
    url: string;
    artist: {
        name: string;
        id: number;
        url: string;
        image: string;
    };
    lyrics?: string;
}

/**
 * @typedef {object} PlayerStats
 * @property {number} uptime The uptime in ms
 * @property {number} connections The number of connections
 * @property {number} users The number of users
 * @property {number} queues The number of queues
 * @property {number} extractors The number of custom extractors registered
 * @property {object} versions The versions metadata
 * @property {string} [versions.ffmpeg] The ffmpeg version
 * @property {string} [versions.node] The node version
 * @property {string} [versions.v8] The v8 JavaScript engine version
 * @property {object} system The system data
 * @property {string} [system.arch] The system arch
 * @property {'aix'|'android'|'darwin'|'freebsd'|'linux'|'openbsd'|'sunos'|'win32'|'cygwin'|'netbsd'} [system.platform] The system platform
 * @property {number} [system.cpu] The cpu count
 * @property {object} [system.memory] The memory info
 * @property {string} [system.memory.total] The total memory
 * @property {string} [system.memory.usage] The memory usage
 * @property {string} [system.memory.rss] The memory usage in RSS
 * @property {string} [system.memory.arrayBuffers] The memory usage in ArrayBuffers
 * @property {number} [system.uptime] The system uptime
 */
export interface PlayerStats {
    uptime: number;
    connections: number;
    users: number;
    queues: number;
    extractors: number;
    versions: {
        ffmpeg: string;
        node: string;
        v8: string;
    };
    system: {
        arch: string;
        platform:
            | 'aix'
            | 'android'
            | 'darwin'
            | 'freebsd'
            | 'linux'
            | 'openbsd'
            | 'sunos'
            | 'win32'
            | 'cygwin'
            | 'netbsd';
        cpu: number;
        memory: {
            total: string;
            usage: string;
            rss: string;
            arrayBuffers: string;
        };
        uptime: number;
    };
}

/**
 * @typedef {object} TimeData
 * @property {number} days The time in days
 * @property {number} hours The time in hours
 * @property {number} minutes The time in minutes
 * @property {number} seconds The time in seconds
 */
export interface TimeData {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}
