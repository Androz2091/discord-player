import Player from '../Player';
import { User } from 'discord.js';
import { TrackData } from "../types/Track";

export default class Track {
    public player!: Player;
    public title!: string;
    public description!: string;
    public author!: string;
    public url!: string;
    public thumbnail!: string;
    public duration!: string;
    public views!: number;
    public requestedBy!: User;
    public fromPlaylist!: boolean;
    public raw!: TrackData;

    constructor(player: Player, data: TrackData) {
        /**
         * The player that instantiated this Track
         */
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
        Object.defineProperty(this, "raw", { get: () => data, enumerable: false });
    }
}
