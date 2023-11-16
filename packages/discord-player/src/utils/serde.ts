/* eslint-disable @typescript-eslint/no-explicit-any */

import { Exceptions } from '../errors';
import { Playlist, type SerializedTrack, Track, SerializedPlaylist } from '../fabric';
import { TypeUtil } from './TypeUtil';
import { Buffer } from 'buffer';
import { Player } from '../Player';

export enum SerializedType {
    Track = 'track',
    Playlist = 'playlist'
}

export type SerializedMetadata = SerializedTrack | SerializedPlaylist;
export type Serializable = {
    serialize(): any;
};

export type SerializedResult<T> = T extends Track ? SerializedTrack : T extends Playlist ? SerializedPlaylist : any;

export const isSerializedTrack = (data: any): data is SerializedTrack => data.$type === SerializedType.Track;
export const isSerializedPlaylist = (data: any): data is SerializedPlaylist => data.$type === SerializedType.Playlist;
export const isSerializedTrackOrPlaylist = (data: any): data is SerializedMetadata => isSerializedTrack(data) || isSerializedPlaylist(data);

export function serialize<T extends Serializable>(data: T): SerializedResult<T> {
    if (data instanceof Track) return data.serialize() as SerializedResult<T>;
    if (data instanceof Playlist) return data.serialize() as SerializedResult<T>;

    try {
        return (data as any).serialize();
    } catch {
        throw Exceptions.ERR_SERIALIZATION_FAILED();
    }
}

export function deserialize(player: Player, data: SerializedMetadata) {
    if (isSerializedTrack(data)) return Track.fromSerialized(player, data);
    if (isSerializedPlaylist(data)) return Playlist.fromSerialized(player, data);

    throw Exceptions.ERR_DESERIALIZATION_FAILED();
}

export function encode(data: SerializedMetadata) {
    const str = JSON.stringify(data);

    return Buffer.from(str).toString('base64');
}

export function decode(data: string) {
    const str = Buffer.from(data, 'base64').toString();

    return JSON.parse(str);
}

export function tryIntoThumbnailString(data: any) {
    if (!data) return null;
    try {
        if (TypeUtil.isString(data)) return data;
        return data?.url ?? data?.thumbnail?.url ?? null;
    } catch {
        return null;
    }
}
