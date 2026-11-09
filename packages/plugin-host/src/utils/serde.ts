import { parseEntity } from './parse-serialized-entity.js';
import { SerializationError } from '../errors.js';
import { Playlist, type SerializedPlaylist } from '../structures/playlist.js';
import { Track, type SerializedTrack } from '../structures/track.js';
import {
  cloneJSONValue,
  SERIALIZATION_SCHEMA_VERSION,
  type JSONValue,
  type Serializable,
  type SerializedEntity,
} from './serialization.js';

export { SERIALIZATION_SCHEMA_VERSION };

export type { JSONPrimitive, JSONValue, Serializable, SerializedEntity } from './serialization.js';

/** Entity discriminator values used in versioned persistence payloads. */
export const SerializedType = {
  /** Track entity discriminator. */
  Track: 'track',
  /** Playlist entity discriminator. */
  Playlist: 'playlist',
} as const;

/** Versioned persistence entities supported by Discord Player. */
export type SerializedEntityUnion = SerializedTrack | SerializedPlaylist;

/** Compatibility alias for the supported serialized entity union. */
export type Encodable = SerializedEntityUnion;

/**
 * Serialize any model that follows the structural `Serializable` contract.
 * The returned value is checked at runtime so custom implementations cannot emit non-JSON data.
 * @param value Model implementing the versioned serialization contract.
 * @returns Its JSON-safe persistence payload.
 */
export function serialize<T extends SerializedEntity<string, JSONValue>>(value: Serializable<T>): T {
  try {
    const result = value.serialize();

    cloneJSONValue(result, '$');

    return result;
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error;
    }

    throw new SerializationError('Could not serialize the provided model.', { cause: error });
  }
}

/**
 * Reconstruct a Track from a versioned Track payload.
 * @param value Versioned Track payload or supported v7 Track data.
 * @returns A Track instance with no source-plugin playback state.
 */
export function deserialize(value: SerializedTrack): Track;

/**
 * Reconstruct a Playlist from a versioned Playlist payload.
 * @param value Versioned Playlist payload or supported v7 Playlist data.
 * @returns A Playlist instance containing reconstructed Track instances.
 */
export function deserialize(value: SerializedPlaylist): Playlist;

/**
 * Validate and reconstruct an untrusted versioned or supported legacy payload.
 * @param value Serialized data to validate and reconstruct.
 * @returns A Track or Playlist instance.
 */
export function deserialize(value: unknown): Track | Playlist;

export function deserialize(value: unknown): Track | Playlist {
  try {
    const entity = parseEntity(value);

    if (entity.type === SerializedType.Track) {
      return Track.fromSerialized(entity);
    }

    return Playlist.fromSerialized(entity);
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error;
    }

    throw new SerializationError('Serialized entity could not be validated or reconstructed.', { cause: error });
  }
}

/**
 * Encode a versioned serialized entity as Base64 JSON.
 * @param value Versioned Track or Playlist payload.
 * @returns UTF-8 JSON encoded as Base64.
 */
export function encode(value: SerializedEntityUnion): string {
  try {
    const safeValue = cloneJSONValue(value, '$');
    const json = JSON.stringify(safeValue);

    if (json === undefined) {
      throw new SerializationError('Serialized entity did not produce JSON text.');
    }

    return Buffer.from(json, 'utf8').toString('base64');
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error;
    }

    throw new SerializationError('Could not encode the serialized entity as Base64 JSON.', { cause: error });
  }
}

/**
 * Decode Base64 JSON without validating its entity shape.
 * Decoded values must still pass through `deserialize()` before reconstruction.
 * @param value Base64 JSON string.
 * @returns Parsed but untrusted data.
 */
export function decode(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as unknown;
  } catch (error) {
    throw new SerializationError('Could not decode Base64 JSON.', { cause: error });
  }
}
