import { Player } from '../Player';
import { User } from 'discord.js';
import { TrackData } from '../types/types';
import Queue from './Queue';

export class Track {
    /**
     * The player that instantiated this Track
     * @type {Player}
     */
    public player!: Player;

    /**
     * Title of this track
     * @type {String}
     */
    public title!: string;

    /**
     * Description of this track
     * @type {String}
     */
    public description!: string;

    /**
     * Author of this track
     * @type {String}
     */
    public author!: string;

    /**
     * Link of this track
     * @type {String}
     */
    public url!: string;

    /**
     * Thumbnail of this track
     * @type {String}
     */
    public thumbnail!: string;

    /**
     * Duration of this track
     * @type {String}
     */
    public duration!: string;

    /**
     * View count of this track
     * @type {Number}
     */
    public views!: number;

    /**
     * Person who requested this track
     * @type {Discord.User}
     */
    public requestedBy!: User;

    /**
     * If this track belongs to a playlist
     * @type {Boolean}
     */
    public fromPlaylist!: boolean;

    /**
     * Raw data of this track
     * @type {TrackData}
     */
    public raw!: TrackData;

    /**
     * Track constructor
     * @param {Player} player The player that instantiated this Track
     * @param {TrackData} data Track data
     */
    constructor(player: Player, data: TrackData) {
        Object.defineProperty(this, 'player', { value: player, enumerable: false });

        void this._patch(data);
    }

    private _patch(data: TrackData) {
        this.title = data.title ?? '';
        this.description = data.description ?? '';
        this.author = data.author ?? '';
        this.url = data.url ?? '';
        this.thumbnail = data.thumbnail ?? '';
        this.duration = data.duration ?? '';
        this.views = data.views ?? 0;
        this.requestedBy = data.requestedBy;
        this.fromPlaylist = Boolean(data.fromPlaylist);

        // raw
        Object.defineProperty(this, 'raw', { get: () => data, enumerable: false });
    }

    /**
     * The queue in which this track is located
     * @type {Queue}
     */
    get queue(): Queue {
        return this.player.queues.find((q) => q.tracks.includes(this));
    }

    /**
     * The track duration in millisecond
     * @type {Number}
     */
    get durationMS(): number {
        const times = (n: number, t: number) => {
            let tn = 1;
            for (let i = 0; i < t; i++) tn *= n;
            return t <= 0 ? 1000 : tn * 1000;
        };

        return this.duration
            .split(':')
            .reverse()
            .map((m, i) => parseInt(m) * times(60, i))
            .reduce((a, c) => a + c, 0);
    }

    /**
     * String representation of this track
     * @type {String}
     */
    toString(): string {
        return `${this.title} by ${this.author}`;
    }
}

export default Track;
