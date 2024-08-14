import { type Snowflake } from 'discord-api-types/globals';
import { Exceptions } from '../errors';
import { Player, PlayerNodeInitializationResult, PlayerNodeInitializerOptions } from '../Player';
import { PlaylistInitData, PlaylistJSON, TrackJSON, TrackSource } from '../types/types';
import { SerializedType, tryIntoThumbnailString } from '../utils/serde';
import { TypeUtil } from '../utils/TypeUtil';
import { Util } from '../utils/Util';
import { Track } from './Track';

export type SerializedPlaylist = ReturnType<Playlist['serialize']>;

export class Playlist {
    public readonly player: Player;
    public tracks: Track[];
    public title: string;
    public description: string;
    public thumbnail: string;
    public type: 'album' | 'playlist';
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
     * Estimated duration of this playlist
     */
    public get estimatedDuration() {
        return this.tracks.reduce((p, c) => p + c.durationMS, 0);
    }

    /**
     * Formatted estimated duration of this playlist
     */
    public get durationFormatted() {
        return Util.buildTimeCode(Util.parseMS(this.estimatedDuration));
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

    /**
     * Serialize this playlist into reconstructable data
     */
    public serialize() {
        return {
            tracks: this.tracks.map((m) => m.serialize()),
            title: this.title,
            description: this.description,
            thumbnail: TypeUtil.isString(this.thumbnail) ? this.thumbnail : tryIntoThumbnailString(this.thumbnail),
            type: this.type,
            source: this.source,
            author: this.author,
            id: this.id,
            url: this.url,
            $type: SerializedType.Playlist,
            $encoder_version: '[VI]{{inject}}[/VI]'
        };
    }

    /**
     * Deserialize this playlist from serialized data
     * @param player Player instance
     * @param data Serialized data
     */
    public static fromSerialized(player: Player, data: SerializedPlaylist) {
        if (data.$type !== SerializedType.Playlist) throw Exceptions.ERR_INVALID_ARG_TYPE('data', 'SerializedPlaylist', 'malformed data');
        return new Playlist(player, {
            ...data,
            tracks: data.tracks.map((m) => Track.fromSerialized(player, m))
        });
    }

    /**
     * Play this playlist to the given voice channel. If queue exists and another track is being played, this playlist will be added to the queue.
     * @param channel Voice channel on which this playlist shall be played
     * @param options Node initialization options
     */
    public async play<T = unknown>(channelId: Snowflake, options?: PlayerNodeInitializerOptions<T>): Promise<PlayerNodeInitializationResult<T>> {
        const fn = this.player.play.bind(this.player);

        return await fn(channelId, this, options);
    }
}
