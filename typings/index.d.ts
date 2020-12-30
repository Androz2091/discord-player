declare module 'discord-player' {
    import { EventEmitter } from 'events';
    import { Client, Collection, Message, MessageCollector, Snowflake, User, VoiceChannel, VoiceConnection } from 'discord.js';
    import { Playlist as YTSRPlaylist } from 'youtube-sr';
    import { Stream } from 'stream';

    export const version: string;

    class Util {
        static isVoiceEmpty(channel: VoiceChannel): boolean;
        static isSoundcloudLink(query: string): boolean;
        static isSpotifyLink(query: string): boolean;
        static isYTPlaylistLink(query: string): boolean;
        static isYTVideoLink(query: string): boolean;
    }

    export class Player extends EventEmitter {
        constructor(client: Client, options?: PlayerOptions)

        public client: Client;
        public util: Util;
        public options: PlayerOptions;
        public queues: Collection<Snowflake, Queue>;
        public filters: PlayerFilters;

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
        public remove(message: Message, trackOrPosition: Track|number): Track;
        public createProgressBar(message: Message, progressBarOptions: ProgressBarOptions): string;

        public on<K extends keyof PlayerEvents>(event: K, listener: (...args: PlayerEvents[K]) => void): this;
        public once<K extends keyof PlayerEvents>(event: K, listener: (...args: PlayerEvents[K]) => void): this;
        public emit<K extends keyof PlayerEvents>(event: K, ...args: PlayerEvents[K]): boolean;
    }
    interface PlayerOptions {
        leaveOnEnd: boolean;
        leaveOnEndCooldown?: number;
        leaveOnStop: boolean;
        leaveOnEmpty: boolean;
        leaveOnEmptyCooldown?: number;
        autoSelfDeaf: boolean;
    }
    type Filters = 'bassboost' | '8D' | 'vaporwave' | 'nightcore'| 'phaser' | 'tremolo' | 'vibrato' | 'reverse' | 'treble' | 'normalizer' | 'surrounding' | 'pulsator' | 'subboost' | 'karaoke' | 'flanger' | 'gate' | 'haas' | 'mcompand';
    type FiltersStatuses = {
        [key in Filters]: boolean;
    }
    type PlayerFilters = {
        [key in Filters]: string
    }
    interface ProgressBarOptions {
        timecodes: boolean;
    }
    interface CustomPlaylist {
        tracks: Track[];
        duration: number;
        thumbnail: string;
        requestedBy: User;
    }
    type Playlist = YTSRPlaylist & CustomPlaylist;
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
        error: [string, Message];
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
}
