import { downloadOptions } from 'ytdl-core';
import { User } from 'discord.js';
import { Readable, Duplex } from 'stream';

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

export type TrackSource = 'soundcloud' | 'youtube' | 'arbitrary';

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
}

export interface PlayerProgressbarOptions {
    timecodes?: boolean;
    queue?: boolean;
    length?: number;
}

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

export interface TimeData {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}
