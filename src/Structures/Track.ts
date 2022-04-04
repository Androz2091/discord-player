import { Snowflake, SnowflakeUtil, User, Util } from "discord.js";
import { Player } from "../Player";
import { RawTrackData, TrackJSON, TrackSource } from "../types/types";
import { Playlist } from "./Playlist";
import { Queue } from "./Queue";

class Track {
    /**
     * The player that instantiated this Track
     * @name Track#player
     * @type {Player}
     * @readonly
     */
    public player: Player;
    /**
     * Title of this track
     * @name Track#title
     * @type {string}
     */
    public title: string;
    /**
     * Description of this track
     * @name Track#description
     * @type {string}
     */
    public description: string;
    /**
     * Author of this track
     * @name Track#author
     * @type {string}
     */
    public author: string;
    /**
     * URL of this track
     * @name Track#url
     * @type {string}
     */
    public url: string;
    /**
     * Thumbnail of this track
     * @name Track#thumbnail
     * @type {string}
     */
    public thumbnail: string;
    /**
     * Duration of this track
     * @name Track#duration
     * @type {string}
     */
    public duration: string;
    /**
     * Views count of this track
     * @name Track#views
     * @type {number}
     */
    public views: number;
    /**
     * Person who requested this track
     * @name Track#requestedBy
     * @type {User}
     */
    public requestedBy: User;
    /**
     * The playlist which track belongs
     * @name Track#playlist
     * @type {Playlist}
     */
    public playlist?: Playlist;
    /**
     * Raw track data
     * @name Track#raw
     * @type {RawTrackData}
     */
    public readonly raw: RawTrackData;
    /**
     * The track id
     * @name Track#id
     * @type {Snowflake}
     * @readonly
     */
    public readonly id: Snowflake = SnowflakeUtil.generate();

    /**
     * Track constructor
     * @param {Player} player The player that instantiated this Track
     * @param {RawTrackData} data Track data
     */
    constructor(player: Player, data: RawTrackData) {
        this.player = player;
        this.title = Util.escapeMarkdown(data.title);
        this.description = data.description;
        this.author = data.author;
        this.url = data.url;
        this.thumbnail = data.thumbnail;
        this.duration = data.duration;
        this.views = data.views;
        this.requestedBy = data.requestedBy;
        this.playlist = data.playlist;
        this.raw = Object.assign({}, data.raw ?? data);
    }

    /**
     * The queue in which this track is located
     * @type {(Queue|undefined)}
     */
    get queue(): Queue | undefined {
        return this.player.queues.find((q) => q.tracks.some((ab) => ab.id === this.id));
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
    get source(): TrackSource {
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
    toJSON(hidePlaylist?: boolean): TrackJSON {
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
            requestedBy: this.requestedBy?.id,
            playlist: hidePlaylist ? undefined : this.playlist?.toJSON() ?? undefined
        };
    }
}

export default Track;

export { Track };
