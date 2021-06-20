import { Snowflake, User, UserResolvable } from "discord.js";
import { Readable, Duplex } from "stream";
import { Queue } from "../Structures/Queue";
import Track from "../Structures/Track";
import { Playlist } from "../Structures/Playlist";
import { StreamDispatcher } from "../VoiceInterface/BasicStreamDispatcher";
import { downloadOptions } from "ytdl-core";

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
    playlist?: Playlist;
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
    leaveOnStop?: boolean;
    leaveOnEmpty?: boolean;
    leaveOnEmptyCooldown?: number;
    autoSelfDeaf?: boolean;
    enableLive?: boolean;
    ytdlOptions?: downloadOptions;
    useSafeSearch?: boolean;
    disableAutoRegister?: boolean;
    fetchBeforeQueued?: boolean;
    initialVolume?: number;
}

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
        rawPlaylist?: any;
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
        important?: boolean;
        source?: TrackSource;
    }[];
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
    /**
     * Emitted when bot gets disconnected from a voice channel
     */
    botDisconnect: (queue: Queue) => any;
    /**
     * Emitted when the voice channel is empty
     */
    channelEmpty: (queue: Queue) => any;
    /**
     * Emitted when bot connects to a voice channel
     */
    connectionCreate: (queue: Queue, connection: StreamDispatcher) => any;
    /**
     * Debug information
     */
    debug: (queue: Queue, message: string) => any;
    /**
     * Emitted on error
     */
    error: (queue: Queue, error: Error) => any;
    /**
     * Emitted when queue ends
     */
    queueEnd: (queue: Queue) => any;
    /**
     * Emitted when a single track is added
     */
    trackAdd: (queue: Queue, track: Track) => any;
    /**
     * Emitted when multiple tracks are added
     */
    tracksAdd: (queue: Queue, track: Track[]) => any;
    /**
     * Emitted when a track starts playing
     */
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
    requestedBy: UserResolvable;
    searchEngine?: QueryType;
}

export enum QueueRepeatMode {
    OFF = 0,
    TRACK = 1,
    QUEUE = 2
}

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
    rawPlaylist?: any;
}

export interface TrackJSON {
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

export interface DiscordPlayerInitOptions {
    autoRegisterExtractor?: boolean;
    ytdlOptions?: downloadOptions;
}
