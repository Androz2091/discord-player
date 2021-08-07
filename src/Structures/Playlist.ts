import { Player } from "../Player";
import { Track } from "./Track";
import { PlaylistInitData, PlaylistJSON, TrackJSON, TrackSource } from "../types/types";

class Playlist {
    public readonly player: Player;
    public tracks: Track[];
    public title: string;
    public description: string;
    public thumbnail: string;
    public type: "album" | "playlist";
    public source: TrackSource;
    public author: {
        name: string;
        url: string;
    };
    public id: string;
    public url: string;
    public readonly rawPlaylist?: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    /**
     * Playlist constructor
     * @param {Player} player The player
     * @param {PlaylistInitData} data The data
     */
    constructor(player: Player, data: PlaylistInitData) {
        /**
         * The player
         * @name Playlist#player
         * @type {Player}
         * @readonly
         */
        this.player = player;

        /**
         * The tracks in this playlist
         * @name Playlist#tracks
         * @type {Track[]}
         */
        this.tracks = data.tracks ?? [];

        /**
         * The author of this playlist
         * @name Playlist#author
         * @type {object}
         */
        this.author = data.author;

        /**
         * The description
         * @name Playlist#description
         * @type {string}
         */
        this.description = data.description;

        /**
         * The thumbnail of this playlist
         * @name Playlist#thumbnail
         * @type {string}
         */
        this.thumbnail = data.thumbnail;

        /**
         * The playlist type:
         * - `album`
         * - `playlist`
         * @name Playlist#type
         * @type {string}
         */
        this.type = data.type;

        /**
         * The source of this playlist:
         * - `youtube`
         * - `soundcloud`
         * - `spotify`
         * - `arbitrary`
         * @name Playlist#source
         * @type {string}
         */
        this.source = data.source;

        /**
         * The playlist id
         * @name Playlist#id
         * @type {string}
         */
        this.id = data.id;

        /**
         * The playlist url
         * @name Playlist#url
         * @type {string}
         */
        this.url = data.url;

        /**
         * The playlist title
         * @type {string}
         */
        this.title = data.title;

        /**
         * @name Playlist#rawPlaylist
         * @type {any}
         * @readonly
         */
    }

    *[Symbol.iterator]() {
        yield* this.tracks;
    }

    /**
     * JSON representation of this playlist
     * @param {boolean} [withTracks=true] If it should build json with tracks
     * @returns {PlaylistJSON}
     */
    toJSON(withTracks = true) {
        const payload = {
            id: this.id,
            url: this.url,
            title: this.title,
            description: this.description,
            thumbnail: this.thumbnail,
            type: this.type,
            source: this.source,
            author: this.author,
            tracks: [] as TrackJSON[]
        };

        if (withTracks) payload.tracks = this.tracks.map((m) => m.toJSON(true));

        return payload as PlaylistJSON;
    }
}

export { Playlist };
