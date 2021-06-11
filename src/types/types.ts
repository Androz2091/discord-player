import { User } from "discord.js";
import { downloadOptions } from "ytdl-core";
import { Readable, Duplex } from "stream";

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
