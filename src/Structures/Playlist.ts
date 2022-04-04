import { Player } from "../Player";
import { PlaylistInitData, PlaylistJSON, TrackSource } from "../types/types";
import { Track } from "./Track";

export class Playlist {
    /**
     * The player
     * @name Playlist#player
     * @type {Player}
     * @readonly
     */
    public readonly player: Player;
    /**
     * The tracks in this playlist
     * @name Playlist#tracks
     * @type {Track[]}
     */
    public tracks: Track[];
    /**
     * The playlist title
     * @type {string}
     */
    public title: string;
    /**
     * The description
     * @name Playlist#description
     * @type {string}
     */
    public description: string;
    /**
     * The thumbnail of this playlist
     * @name Playlist#thumbnail
     * @type {string}
     */
    public thumbnail: string;
    /**
     * The playlist type:
     * - `album`
     * - `playlist`
     * @name Playlist#type
     * @type {string}
     */
    public type: "album" | "playlist";
    /**
     * The source of this playlist:
     * - `youtube`
     * - `soundcloud`
     * - `spotify`
     * - `arbitrary`
     * @name Playlist#source
     * @type {string}
     */
    public source: TrackSource;
    /**
     * The author of this playlist
     * @name Playlist#author
     * @type {object}
     */
    public author: {
        name: string;
        url: string;
    };
    /**
     * The playlist id
     * @name Playlist#id
     * @type {string}
     */
    public id: string;
    /**
     * The playlist url
     * @name Playlist#url
     * @type {string}
     */
    public url: string;
    /**
     * @name Playlist#rawPlaylist
     * @type {any}
     * @readonly
     */
    public readonly rawPlaylist?: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    /**
     * Playlist constructor
     * @param {Player} player The player
     * @param {PlaylistInitData} data The data
     */
    constructor(player: Player, data: PlaylistInitData) {
        this.player = player;
        this.tracks = data.tracks ?? [];
        this.author = data.author;
        this.description = data.description;
        this.thumbnail = data.thumbnail;
        this.type = data.type;
        this.source = data.source;
        this.id = data.id;
        this.url = data.url;
        this.title = data.title;
    }

    *[Symbol.iterator]() {
        yield* this.tracks;
    }

    /**
     * JSON representation of this playlist
     * @param {boolean} [withTracks=true] If it should build json with tracks
     * @returns {PlaylistJSON}
     */
    toJSON(withTracks = true): PlaylistJSON {
        return {
            id: this.id,
            url: this.url,
            title: this.title,
            description: this.description,
            thumbnail: this.thumbnail,
            type: this.type,
            source: this.source,
            author: this.author,
            tracks: withTracks ? this.tracks.map((m) => m.toJSON(true)) : []
        };
    }
}
