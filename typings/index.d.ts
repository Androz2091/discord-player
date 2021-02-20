declare module 'discord-player' {
    import { EventEmitter } from 'events';
    import { Client, Collection, Message, MessageCollector, Snowflake, User, VoiceChannel, VoiceConnection } from 'discord.js';
    import { Playlist as YTSRPlaylist } from 'youtube-sr';
    import { Stream, Readable } from 'stream';

    export const version: string;

    class Util {
        static isVoiceEmpty(channel: VoiceChannel): boolean;
        static isSoundcloudLink(query: string): boolean;
        static isSpotifyLink(query: string): boolean;
        static isYTPlaylistLink(query: string): boolean;
        static isYTVideoLink(query: string): boolean;
        static isSoundcloudPlaylist(query: string): boolean;
        static isVimeoLink(query: string): boolean;
        static getVimeoID(query: string): string;
        static isFacebookLink(query: string): boolean;
        static buildTimecode(data: any): string;
    }

    export class Player extends EventEmitter {
        constructor(client: Client, options?: PlayerOptions)

        public client: Client;
        public util: Util;
        public options: PlayerOptions;
        public queues: Collection<Snowflake, Queue>;
        public filters: PlayerFilters;

        public static get AudioFilters(): PlayerFilters;
        public isPlaying(message: Message): boolean;
        public setFilters(message: Message, newFilters: Partial<Filters>): Promise<void>;
        public play(message: Message, query: string | Track, firstResult?: boolean): Promise<void>;
        public pause(message: Message): void;
        public resume(message: Message): void;
        public stop(message: Message): void;
        public setVolume(message: Message, percent: number): void;
        public getQueue(message: Message): Queue;
        public clearQueue(message: Message): void;
        public skip(message: Message): void;
        public back(message: Message): void;
        public nowPlaying(message: Message): Track;
        public setRepeatMode(message: Message, enabled: boolean): boolean;
        public setLoopMode(message: Message, enabled: boolean): boolean
        public shuffle(message: Message): Queue;
        public remove(message: Message, trackOrPosition: Track | number): Track;
        public createProgressBar(message: Message, progressBarOptions: ProgressBarOptions): string;
        public seek(message: Message, time: number): Promise<void>;
        public moveTo(message: Message, channel: VoiceChannel): void;

        public on<K extends keyof PlayerEvents>(event: K, listener: (...args: PlayerEvents[K]) => void): this;
        public once<K extends keyof PlayerEvents>(event: K, listener: (...args: PlayerEvents[K]) => void): this;
        public emit<K extends keyof PlayerEvents>(event: K, ...args: PlayerEvents[K]): boolean;
    }
    type MusicQuality = 'high' | 'low';
    interface PlayerOptions {
        leaveOnEnd?: boolean;
        leaveOnEndCooldown?: number;
        leaveOnStop?: boolean;
        leaveOnEmpty?: boolean;
        leaveOnEmptyCooldown?: number;
        autoSelfDeaf?: boolean;
        quality?: MusicQuality;
        enableLive?: boolean;
        ytdlRequestOptions?: any;
    }
    type Filters =
        | 'bassboost'
        | '8D'
        | 'vaporwave'
        | 'nightcore'
        | 'phaser'
        | 'tremolo'
        | 'vibrato'
        | 'reverse'
        | 'treble'
        | 'normalizer'
        | 'surrounding'
        | 'pulsator'
        | 'subboost'
        | 'karaoke'
        | 'flanger'
        | 'gate'
        | 'haas'
        | 'mcompand'
        | 'mono'
        | 'mstlr'
        | 'mstrr'
        | 'compressor'
        | 'expander'
        | 'softlimiter'
        | 'chorus'
        | 'chorus2d'
        | 'chorus3d'
        | 'fadein';

    type FiltersStatuses = {
        [key in Filters]: boolean;
    }
    type PlayerFilters = {
        [key in Filters]: string
    }
    interface ProgressBarOptions {
        timecodes: boolean;
        queue: boolean;
    }
    interface CustomPlaylist {
        tracks: Track[];
        duration: number;
        thumbnail: string;
        requestedBy: User;
    }
    type Playlist = YTSRPlaylist & CustomPlaylist;
    type PlayerError = 'NotConnected' | 'UnableToJoin' | 'NotPlaying' | 'LiveVideo' | 'ParseError' | 'VideoUnavailable';
    interface PlayerEvents {
        searchResults: [Message, string, Track[]];
        searchInvalidResponse: [Message, string, Track[], string, MessageCollector];
        searchCancel: [Message, string, Track[]];
        noResults: [Message, string];
        playlistAdd: [Message, Queue, Playlist];
        trackAdd: [Message, Queue, Track];
        trackStart: [Message, Track];
        botDisconnect: [Message];
        channelEmpty: [Message, Queue];
        musicStop: [];
        queueCreate: [Message, Queue];
        queueEnd: [Message, Queue];
        error: [PlayerError, Message];
        playlistParseStart: [any, Message];
        playlistParseEnd: [any, Message];
    }
    class Queue {
        constructor(guildID: string, message: Message, filters: PlayerFilters);

        public guildID: string;
        public voiceConnection?: VoiceConnection;
        public stream: Stream;
        public tracks: Track[];
        public previousTracks: Track[];
        public stopped: boolean;
        public lastSkipped: boolean;
        public volume: number;
        public paused: boolean;
        public repeatMode: boolean;
        public loopMode: boolean;
        public filters: FiltersStatuses;
        public firstMessage: Message;
        private additionalStreamTime: number;

        // these are getters
        public playing: Track;
        public calculatedVolume: number;
        public currentStreamTime: number;
    }
    class Track {
        constructor(videoData: object, user: User, player: Player);

        public player: Player;
        public title: string;
        public description: string;
        public author: string;
        public url: string;
        public thumbnail: string;
        public duration: string;
        public views: number;
        public requestedBy: User;
        public fromPlaylist: boolean;

        // these are getters
        public durationMS: number;
        public queue: Queue;
    }

    export interface RawExtractedData {
        title: string;
        format: string;
        size: number;
        sizeFormat: "MB";
        stream: Readable;
    }

    export interface VimeoExtractedData {
        id: number;
        duration: number;
        title: string;
        url: string;
        thumbnail: string;
        width: number;
        height: number;
        stream: {
            cdn: string;
            fps: number;
            width: number;
            height: number;
            id: string;
            mime: string;
            origin: string;
            profile: number;
            quality: string;
            url: string;
        };
        author: {
            accountType: string;
            id: number;
            name: string;
            url: string;
            avatar: string;
        }
    }

    interface FacebookExtractedData {
        name: string;
        title: string;
        description: string;
        rawVideo: string;
        thumbnail: string;
        uploadedAt: Date;
        duration: string;
        interactionCount: number;
        streamURL: string;
        publishedAt: Date;
        width: number;
        height: number;
        nsfw: boolean;
        genre: string;
        keywords: string[];
        comments: number;
        size: string;
        quality: string;
        author: {
            type: string;
            name: string;
            url: string;
        };
        publisher: {
            type: string;
            name: string;
            url: string;
            avatar: string;
        };
        url: string;
        shares: string;
        views: string;
    }

    class Discord {
        static getInfo(url: string): Promise<RawExtractedData>;
        static download(url: string): Promise<Readable>;
    }

    class Facebook {
        static validateURL(url: string): boolean;
        static download(url: string): Promise<Readable>;
        static getInfo(url: string): Promise<FacebookExtractedData>;
    }

    class Vimeo {
        static getInfo(id: number): Promise<VimeoExtractedData>;
        static download(id: number): Promise<Readable>;
    }

    interface Extractors {
        DiscordExtractor: Discord;
        FacebookExtractor: Facebook;
        VimeoExtractor: Vimeo;
    }

    export const Extractors: Extractors;
}
