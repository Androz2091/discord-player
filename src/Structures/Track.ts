import { User, Util, SnowflakeUtil, Snowflake } from "discord.js";
import { Player } from "../Player";
import { RawTrackData, TrackJSON } from "../types/types";
import { Playlist } from "./Playlist";
import { Queue } from "./Queue";

class Track {
    public player!: Player;
    public title!: string;
    public description!: string;
    public author!: string;
    public url!: string;
    public thumbnail!: string;
    public duration!: string;
    public views!: number;
    public requestedBy!: User;
    public playlist?: Playlist;
    public readonly raw: RawTrackData = {} as RawTrackData;
    public readonly id: Snowflake = SnowflakeUtil.generate();

    /**
     * Track constructor
     * @param {Player} player The player that instantiated this Track
     * @param {RawTrackData} data Track data
     */
    constructor(player: Player, data: RawTrackData) {
        /**
         * The player that instantiated this Track
         * @name Track#player
         * @type {Player}
         * @readonly
         */
        Object.defineProperty(this, "player", { value: player, enumerable: false });

        /**
         * Title of this track
         * @name Track#title
         * @type {string}
         */

        /**
         * Description of this track
         * @name Track#description
         * @type {string}
         */

        /**
         * Author of this track
         * @name Track#author
         * @type {string}
         */

        /**
         * URL of this track
         * @name Track#url
         * @type {string}
         */

        /**
         * Thumbnail of this track
         * @name Track#thumbnail
         * @type {string}
         */

        /**
         * Duration of this track
         * @name Track#duration
         * @type {string}
         */

        /**
         * Views count of this track
         * @name Track#views
         * @type {number}
         */

        /**
         * Person who requested this track
         * @name Track#requestedBy
         * @type {User}
         */

        /**
         * If this track belongs to playlist
         * @name Track#fromPlaylist
         * @type {boolean}
         */

        /**
         * Raw track data
         * @name Track#raw
         * @type {RawTrackData}
         */

        /**
         * The track id
         * @name Track#id
         * @type {Snowflake}
         * @readonly
         */

        void this._patch(data);
    }

    private _patch(data: RawTrackData) {
        this.title = Util.escapeMarkdown(data.title ?? "");
        this.author = data.author ?? "";
        this.url = data.url ?? "";
        this.thumbnail = data.thumbnail ?? "";
        this.duration = data.duration ?? "";
        this.views = data.views ?? 0;
        this.requestedBy = data.requestedBy;
        this.playlist = data.playlist;

        // raw
        Object.defineProperty(this, "raw", { value: Object.assign({}, { source: data.raw?.source ?? data.source }, data.raw ?? data), enumerable: false });
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
     * @type {number}
     */
    get durationMS(): number {
        const times = (n: number, t: number) => {
            let tn = 1;
            for (let i = 0; i < t; i++) tn *= n;
            return t <= 0 ? 1000 : tn * 1000;
        };

        return this.duration
            .split(":")
            .reverse()
            .map((m, i) => parseInt(m) * times(60, i))
            .reduce((a, c) => a + c, 0);
    }

    /**
     * Returns source of this track
     * @type {TrackSource}
     */
    get source() {
        return this.raw.source ?? "arbitrary";
    }

    /**
     * String representation of this track
     * @returns {string}
     */
    toString(): string {
        return `${this.title} by ${this.author}`;
    }

    /**
     * Raw JSON representation of this track
     * @returns {TrackJSON}
     */
    toJSON(hidePlaylist?: boolean) {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            author: this.author,
            url: this.url,
            thumbnail: this.thumbnail,
            duration: this.duration,
            durationMS: this.durationMS,
            views: this.views,
            requestedBy: this.requestedBy.id,
            playlist: hidePlaylist ? null : this.playlist?.toJSON() ?? null
        } as TrackJSON;
    }
}

export default Track;

export { Track };
