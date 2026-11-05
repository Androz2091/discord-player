import { SerializationError } from '../errors.js';
import { Playlist, type SerializedPlaylist } from '../structures/playlist.js';
import { Track, type SerializedTrack } from '../structures/track.js';

/** Serialized model discriminator names. */
export const SerializedType = {
  /** Track discriminator used by v7-compatible serialized data. */
  Track: 'track',
  /** Playlist discriminator used by v7-compatible serialized data. */
  Playlist: 'playlist',
} as const;

/** Serialized data accepted by `deserialize()`. */
export type Encodable = SerializedTrack | SerializedPlaylist;

/**
 * Serialize a Track or Playlist into reconstructable v7-style data.
 * @param value Model to serialize.
 */
export function serialize(
  /** Model to serialize. */
  value: Track | Playlist,
): Encodable {
  if (value instanceof Track || value instanceof Playlist) return value.serialize();
  throw new SerializationError('Expected a Track or Playlist instance.');
}

/**
 * Reconstruct a Track or Playlist from its `$type` discriminator.
 * @param value Serialized model data to validate and reconstruct.
 */
export function deserialize(
  /** Serialized model data. */
  value: unknown,
): Track | Playlist {
  if (typeof value !== 'object' || value === null || !('$type' in value)) {
    throw new SerializationError('Serialized data must be an object with a $type field.');
  }
  try {
    if (value.$type === SerializedType.Track) return Track.fromSerialized(value as SerializedTrack);
    if (value.$type === SerializedType.Playlist) return Playlist.fromSerialized(value as SerializedPlaylist);
  } catch (error) {
    throw new SerializationError('Serialized model data is malformed.', { cause: error });
  }
  throw new SerializationError(`Unknown serialized model type: ${String(value.$type)}.`);
}

/**
 * Encode serialized Track or Playlist data as base64 JSON.
 * @param value Serialized model data.
 */
export function encode(
  /** Serialized model data. */
  value: Encodable,
): string {
  try {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
  } catch (error) {
    throw new SerializationError('Could not encode the serialized model as base64 JSON.', { cause: error });
  }
}

/**
 * Decode base64 JSON into unvalidated serialized data.
 * @param value Base64 JSON string produced by `encode()`.
 */
export function decode(
  /** Base64 JSON string produced by `encode()`. */
  value: string,
): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as unknown;
  } catch (error) {
    throw new SerializationError('Could not decode base64 JSON.', { cause: error });
  }
}
