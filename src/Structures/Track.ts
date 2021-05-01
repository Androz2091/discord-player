// @ts-nocheck

import { Player } from '../Player';
import { User } from 'discord.js';
import { TrackData } from '../types/types';
import Queue from './Queue';

export class Track {
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

    get queue(): Queue {
        return this.player.queues.find((q) => q.tracks.includes(this));
    }

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

    toString(): string {
        return `${this.title} by ${this.author}`;
    }
}

export default Track;
