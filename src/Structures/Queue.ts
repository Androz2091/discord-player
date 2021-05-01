// @ts-nocheck

import { Message, Snowflake, VoiceConnection } from 'discord.js';
import AudioFilters from '../utils/AudioFilters';
import { Player } from '../Player';
import { EventEmitter } from 'events';
import { Track } from './Track';
import { QueueFilters } from '../types/types';

export class Queue extends EventEmitter {
    public player!: Player;
    public guildID: Snowflake;
    public voiceConnection?: VoiceConnection;
    public stream?: any;
    public tracks: Track[];
    public previousTracks: Track[];
    public stopped: boolean;
    public lastSkipped: boolean;
    public volume: number;
    public paused: boolean;
    public repeatMode: boolean;
    public loopMode: boolean;
    public filters: QueueFilters;
    public additionalStreamTime: number;
    public firstMessage: Message;

    public autoPlay = false;

    constructor(player: Player, message: Message) {
        super();

        Object.defineProperty(this, 'player', { value: player, enumerable: false });

        this.guildID = message.guild.id;

        this.voiceConnection = null;

        this.tracks = [];

        this.previousTracks = [];

        this.stopped = false;

        this.lastSkipped = false;

        this.volume = 100;

        this.paused = Boolean(this.voiceConnection?.dispatcher?.paused);

        this.repeatMode = false;

        this.loopMode = false;

        this.additionalStreamTime = 0;

        this.firstMessage = message;

        this.filters = {};

        Object.keys(AudioFilters).forEach((fn) => {
            this.filters[fn as keyof QueueFilters] = false;
        });
    }


    get playing(): Track {
        return this.tracks[0];
    }


    get calculatedVolume(): number {
        return this.filters.normalizer ? this.volume + 70 : this.volume;
    }

    get totalTime(): number {
        return this.tracks.length > 0 ? this.tracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0;
    }

    get currentStreamTime(): number {
        return this.voiceConnection?.dispatcher?.streamTime + this.additionalStreamTime || 0;
    }

    setFilters(filters: QueueFilters): Promise<void> {
        return this.player.setFilters(this.firstMessage, filters);
    }

    getFiltersEnabled(): string[] {
        const filters: string[] = [];

        for (const filter in this.filters) {
            if (this.filters[filter as keyof QueueFilters] !== false) filters.push(filter);
        }

        return filters;
    }

    getFiltersDisabled(): string[] {
        const enabled = this.getFiltersEnabled();

        return Object.keys(this.filters).filter((f) => !enabled.includes(f));
    }

    toString(): string {
        return `<Queue ${this.guildID}>`;
    }
}

export default Queue;
