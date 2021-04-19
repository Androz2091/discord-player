import { Message, Snowflake, VoiceConnection } from 'discord.js';
import AudioFilters from '../utils/AudioFilters';
import { Player } from '../Player';
import { EventEmitter } from 'events';
import { Track } from './Track';
import { QueueFilters } from '../types/types';

export class Queue extends EventEmitter {
    /**
     * The player that instantiated this Queue
     */
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

    /**
     * Queue constructor
     * @param player The player that instantiated this Queue
     * @param message The message object
     */
    constructor(player: Player, message: Message) {
        super();

        Object.defineProperty(this, 'player', { value: player, enumerable: false });

        /**
         * ID of the guild assigned to this queue
         */
        this.guildID = message.guild.id;

        /**
         * The voice connection of this queue
         */
        this.voiceConnection = null;

        /**
         * Tracks of this queue
         */
        this.tracks = [];

        /**
         * Previous tracks of this queue
         */
        this.previousTracks = [];

        /**
         * If the player of this queue is stopped
         */
        this.stopped = false;

        /**
         * If last track was skipped
         */
        this.lastSkipped = false;

        /**
         * Queue volume
         */
        this.volume = 100;

        /**
         * If the player of this queue is paused
         */
        this.paused = Boolean(this.voiceConnection?.dispatcher?.paused);

        /**
         * If repeat mode is enabled in this queue
         */
        this.repeatMode = false;

        /**
         * If loop mode is enabled in this queue
         */
        this.loopMode = false;

        /**
         * The additional calculated stream time
         */
        this.additionalStreamTime = 0;

        /**
         * The initial message object
         */
        this.firstMessage = message;

        /**
         * The audio filters in this queue
         */
        this.filters = {};

        Object.keys(AudioFilters).forEach((fn) => {
            this.filters[fn as keyof QueueFilters] = false;
        });
    }

    /**
     * Currently playing track
     */
    get playing(): Track {
        return this.tracks[0];
    }

    /**
     * Calculated volume of this queue
     */
    get calculatedVolume(): number {
        return this.filters.normalizer ? this.volume + 70 : this.volume;
    }

    /**
     * Total duration
     */
    get totalTime(): number {
        return this.tracks.length > 0 ? this.tracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0;
    }

    /**
     * Current stream time
     */
    get currentStreamTime(): number {
        return this.voiceConnection?.dispatcher?.streamTime + this.additionalStreamTime || 0;
    }

    /**
     * Sets audio filters in this player
     * @param filters Audio filters to set
     */
    setFilters(filters: QueueFilters): Promise<void> {
        return this.player.setFilters(this.firstMessage, filters);
    }

    /**
     * Returns array of all enabled filters
     */
    getFiltersEnabled(): string[] {
        const filters: string[] = [];

        for (const filter in this.filters) {
            if (this.filters[filter as keyof QueueFilters] !== false) filters.push(filter);
        }

        return filters;
    }

    /**
     * Returns all disabled filters
     */
    getFiltersDisabled(): string[] {
        const enabled = this.getFiltersEnabled();

        return Object.keys(this.filters).filter((f) => !enabled.includes(f));
    }

    /**
     * String representation of this Queue
     */
    toString(): string {
        return `<Queue ${this.guildID}>`;
    }
}

export default Queue;
