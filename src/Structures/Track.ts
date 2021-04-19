import { Player } from '../Player';
import { User } from 'discord.js';
import { TrackData } from '../types/types';
import Queue from './Queue';

export class Track {
    /**
     * The player that instantiated this Track
     */
    public player!: Player;

    /**
     * Title of this track
     */
    public title!: string;

    /**
     * Description of this track
     */
    public description!: string;

    /**
     * Author of this track
     */
    public author!: string;

    /**
     * Link of this track
     */
    public url!: string;

    /**
     * Thumbnail of this track
     */
    public thumbnail!: string;

    /**
     * Duration of this track
     */
    public duration!: string;

    /**
     * View count of this track
     */
    public views!: number;

    /**
     * Person who requested this track
     */
    public requestedBy!: User;

    /**
     * If this track belongs to a playlist
     */
    public fromPlaylist!: boolean;

    /**
     * Raw data of this track
     */
    public raw!: TrackData;

    /**
     * Track constructor
     * @param player The player that instantiated this Track
     * @param data Track data
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
     */
    get queue(): Queue {
        return this.player.queues.find((q) => q.tracks.includes(this));
    }

    /**
     * The track duration in millisecond
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
     */
    toString(): string {
        return `${this.title} by ${this.author}`;
    }
}

export default Track;
