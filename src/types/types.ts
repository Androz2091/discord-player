import { User } from "discord.js";
import { downloadOptions } from "ytdl-core";
import { Readable, Duplex } from "stream";
import { Queue } from "../Structures/Queue";
import Track from "../Structures/Track";

export type FiltersName = keyof QueueFilters;

export type QueueFilters = {
    bassboost?: boolean;
    "8D"?: boolean;
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

export type TrackSource = "soundcloud" | "youtube" | "spotify" | "arbitrary";

export interface RawTrackData {
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
    raw?: any;
}

export interface TimeData {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export interface PlayerProgressbarOptions {
    timecodes?: boolean;
    queue?: boolean;
    length?: number;
    line?: string;
    indicator?: string;
}

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
    disableAutoRegister?: boolean;
    fetchBeforeQueued?: boolean;
    initialVolume?: number;
}

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
    source?: TrackSource;
}

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
    SOUNDCLOUD_SEARCH = "soundcloud_search"
}

export interface PlayerEvents {
    botDisconnect: () => any;
    channelEmpty: () => any;
    connectionCreate: () => any;
    debug: (queue: Queue, message: string) => any;
    error: (queue: Queue, error: Error) => any;
    musicStop: () => any;
    noResults: () => any;
    playlistAdd: () => any;
    playlistParseEnd: () => any;
    playlistParseStart: () => any;
    queueCreate: () => any;
    queueEnd: (queue: Queue) => any;
    searchCancel: () => any;
    searchInvalidResponse: () => any;
    searchResults: () => any;
    trackAdd: (queue: Queue, track: Track) => any;
    tracksAdd: (queue: Queue, track: Track[]) => any;
    trackStart: (queue: Queue, track: Track) => any;
}

export interface PlayOptions {
    /** If this play is triggered for filters update */
    filtersUpdate?: boolean;

    /** ffmpeg args passed to encoder */
    encoderArgs?: string[];

    /** Time to seek to before playing */
    seek?: number;

    /** If it should start playing provided track immediately */
    immediate?: boolean;
}

export interface SearchOptions {
    requestedBy: User;
    searchEngine?: QueryType;
}

export enum QueueRepeatMode {
    OFF = 0,
    TRACK = 1,
    QUEUE = 2
}
