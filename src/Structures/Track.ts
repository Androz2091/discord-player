import { User, Util } from "discord.js";
import { Player } from "../Player";
import { RawTrackData } from "../types/types";
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
    public fromPlaylist!: boolean;
    public readonly raw!: RawTrackData;

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
         * @type {String}
         */

        /**
         * Description of this track
         * @name Track#description
         * @type {String}
         */

        /**
         * Author of this track
         * @name Track#author
         * @type {String}
         */

        /**
         * URL of this track
         * @name Track#url
         * @type {String}
         */

        /**
         * Thumbnail of this track
         * @name Track#thumbnail
         * @type {String}
         */

        /**
         * Duration of this track
         * @name Track#duration
         * @type {String}
         */

        /**
         * Views count of this track
         * @name Track#views
         * @type {Number}
         */

        /**
         * Person who requested this track
         * @name Track#requestedBy
         * @type {DiscordUser}
         */

        /**
         * If this track belongs to playlist
         * @name Track#fromPlaylist
         * @type {Boolean}
         */

        /**
         * Raw track data
         * @name Track#raw
         * @type {RawTrackData}
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
        this.fromPlaylist = Boolean(data.fromPlaylist);

        // raw
        Object.defineProperty(this, "raw", { get: () => data.raw ?? data, enumerable: false });
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
     * @returns {String}
     */
    toString(): string {
        return `${this.title} by ${this.author}`;
    }

    /**
     * Raw JSON representation of this track
     * @returns {Object}
     */
    toJSON() {
        return {
            title: this.title,
            description: this.description,
            author: this.author,
            url: this.url,
            thumbnail: this.thumbnail,
            duration: this.duration,
            durationMS: this.durationMS,
            views: this.views,
            requested: this.requestedBy.id,
            fromPlaylist: this.fromPlaylist
        };
    }
}

export default Track;

export { Track };
