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

    constructor(player: Player, message: Message, filters: typeof AudioFilters) {
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

        // @ts-ignore
        this.filters = {};

        Object.keys(AudioFilters).forEach((fn) => {
            // @ts-ignore
            this.filters[fn] = false;
        });
    }

    /**
     * Currently playing track
     */
    get playing() {
        return this.tracks[0];
    }

    /**
     * Calculated volume of this queue
     */
    get calculatedVolume() {
        return this.filters.bassboost ? this.volume + 50 : this.volume;
    }

    /**
     * Total duration
     */
    get totalTime() {
        return this.tracks.length > 0 ? this.tracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0;
    }

    /**
     * Current stream time
     */
    get currentStreamTime() {
        return this.voiceConnection?.dispatcher?.streamTime + this.additionalStreamTime || 0;
    }
}

export default Queue;
