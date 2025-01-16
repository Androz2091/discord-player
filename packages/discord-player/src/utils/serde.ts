/* eslint-disable @typescript-eslint/no-explicit-any */

import { DeserializationError, SerializationError } from '../errors';
import {
  Playlist,
  type SerializedTrack,
  Track,
  SerializedPlaylist,
} from '../fabric';
import { TypeUtil } from './TypeUtil';
import { Buffer } from 'buffer';
import { Player } from '../Player';

export enum SerializedType {
  Track = 'track',
  Playlist = 'playlist',
}

export type Encodable = SerializedTrack | SerializedPlaylist;

const isTrack = (data: any): data is SerializedTrack =>
  data.$type === SerializedType.Track;
const isPlaylist = (data: any): data is SerializedPlaylist =>
  data.$type === SerializedType.Playlist;

export function serialize(data: Track | Playlist | any) {
  if (data instanceof Track) return data.serialize();
  if (data instanceof Playlist) return data.serialize();

  try {
    return data.toJSON();
  } catch {
    throw new SerializationError();
  }
}

export function deserialize(player: Player, data: Encodable) {
  if (isTrack(data)) return Track.fromSerialized(player, data);
  if (isPlaylist(data)) return Playlist.fromSerialized(player, data);

  throw new DeserializationError();
}

export function encode(data: Encodable) {
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
