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

    /**
     * If autoplay is enabled in this queue
     * @type {boolean}
     */
    public autoPlay = false;

    /**
     * Queue constructor
     * @param {Player} player The player that instantiated this Queue
     * @param {DiscordMessage} message The message object
     */
    constructor(player: Player, message: Message) {
        super();

        Object.defineProperty(this, 'player', { value: player, enumerable: false });

        /**
         * ID of the guild assigned to this queue
         * @type {DiscordSnowflake}
         */
        this.guildID = message.guild.id;

        /**
         * The voice connection of this queue
         * @type {DiscordVoiceConnection}
         */
        this.voiceConnection = null;

        /**
         * Tracks of this queue
         * @type {Track[]}
         */
        this.tracks = [];

        /**
         * Previous tracks of this queue
         * @type {Track[]}
         */
        this.previousTracks = [];

        /**
         * If the player of this queue is stopped
         * @type {boolean}
         */
        this.stopped = false;

        /**
         * If last track was skipped
         * @type {boolean}
         */
        this.lastSkipped = false;

        /**
         * Queue volume
         * @type {Number}
         */
        this.volume = 100;

        /**
         * If the player of this queue is paused
         * @type {boolean}
         */
        this.paused = Boolean(this.voiceConnection?.dispatcher?.paused);

        /**
         * If repeat mode is enabled in this queue
         * @type {boolean}
         */
        this.repeatMode = false;

        /**
         * If loop mode is enabled in this queue
         * @type {boolean}
         */
        this.loopMode = false;

        /**
         * The additional calculated stream time
         * @type {Number}
         */
        this.additionalStreamTime = 0;

        /**
         * The initial message object
         * @type {DiscordMessage}
         */
        this.firstMessage = message;

        /**
         * The audio filters in this queue
         * @type {QueueFilters}
         */
        this.filters = {};

        Object.keys(AudioFilters).forEach((fn) => {
            this.filters[fn as keyof QueueFilters] = false;
        });
    }

    /**
     * Currently playing track
     * @type {Track}
     */
    get playing(): Track {
        return this.tracks[0];
    }

    /**
     * Calculated volume of this queue
     * @type {Number}
     */
    get calculatedVolume(): number {
        return this.filters.normalizer ? this.volume + 70 : this.volume;
    }

    /**
     * Total duration
     * @type {Number}
     */
    get totalTime(): number {
        return this.tracks.length > 0 ? this.tracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0;
    }

    /**
     * Current stream time
     * @type {Number}
     */
    get currentStreamTime(): number {
        return this.voiceConnection?.dispatcher?.streamTime + this.additionalStreamTime || 0;
    }

    /**
     * Sets audio filters in this player
     * @param {QueueFilters} filters Audio filters to set
     * @type {Promise<void>}
     */
    setFilters(filters: QueueFilters): Promise<void> {
        return this.player.setFilters(this.firstMessage, filters);
    }

    /**
     * Returns array of all enabled filters
     * @type {String[]}
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
     * @type {String[]}
     */
    getFiltersDisabled(): string[] {
        const enabled = this.getFiltersEnabled();

        return Object.keys(this.filters).filter((f) => !enabled.includes(f));
    }

    /**
     * String representation of this Queue
     * @type {String}
     */
    toString(): string {
        return `<Queue ${this.guildID}>`;
    }
}

export default Queue;
