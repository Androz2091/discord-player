import { randomUUID } from 'node:crypto';
import { SerializationError } from '../errors.js';
import { Playlist, type SerializedPlaylist, type SerializedPlaylistData } from '../structures/playlist.js';
import { Track, type SerializedTrack, type SerializedTrackData } from '../structures/track.js';
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

type UnknownRecord = Record<string, unknown>;

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
    if (error instanceof SerializationError) throw error;
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
    if (entity.type === SerializedType.Track) return Track.fromSerialized(entity);
    return Playlist.fromSerialized(entity);
  } catch (error) {
    if (error instanceof SerializationError) throw error;
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
    if (json === undefined) throw new SerializationError('Serialized entity did not produce JSON text.');
    return Buffer.from(json, 'utf8').toString('base64');
  } catch (error) {
    if (error instanceof SerializationError) throw error;
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

function parseEntity(value: unknown): SerializedEntityUnion {
  const record = asRecord(value, '$');
  if (Object.hasOwn(record, 'version') || Object.hasOwn(record, 'data')) {
    return parseVersionedEntity(record, '$');
  }
  if (Object.hasOwn(record, '$type')) return normalizeLegacyEntity(record);
  if (Object.hasOwn(record, 'type')) return parseVersionedEntity(record, '$');
  throw new SerializationError('Serialized data must have a type discriminator.');
}

function parseVersionedEntity(record: UnknownRecord, path: string): SerializedEntityUnion {
  const type = requiredString(record, 'type', path);
  if (type !== SerializedType.Track && type !== SerializedType.Playlist) {
    throw new SerializationError(`Unknown serialized entity type: ${type}.`);
  }

  const version = requiredNumber(record, 'version', path);
  if (!Number.isInteger(version) || version !== SERIALIZATION_SCHEMA_VERSION) {
    throw new SerializationError(
      `Unsupported ${type} serialization schema version ${String(version)}; supported version is ${SERIALIZATION_SCHEMA_VERSION}.`,
    );
  }

  assertOnlyKeys(record, ['type', 'version', 'data'], path);
  const data = asRecord(requiredField(record, 'data', path), `${path}.data`);
  return type === SerializedType.Track
    ? parseTrackEntity(data, `${path}.data`)
    : parsePlaylistEntity(data, `${path}.data`);
}

function parseTrackEntity(data: UnknownRecord, path: string): SerializedTrack {
  assertOnlyKeys(
    data,
    [
      'id',
      'title',
      'author',
      'description',
      'url',
      'thumbnail',
      'durationMS',
      'views',
      'requestedBy',
      'source',
      'live',
      'metadata',
    ],
    path,
  );

  const metadataValue = requiredField(data, 'metadata', path);
  const metadata = metadataValue === null ? null : cloneJSONValue(metadataValue, `${path}.metadata`);
  const normalized: SerializedTrackData = {
    id: requiredString(data, 'id', path),
    title: requiredString(data, 'title', path),
    author: requiredString(data, 'author', path),
    description: requiredString(data, 'description', path),
    url: requiredString(data, 'url', path),
    thumbnail: requiredString(data, 'thumbnail', path),
    durationMS: nonNegativeNumber(data, 'durationMS', path),
    views: nonNegativeNumber(data, 'views', path),
    requestedBy: nullableString(data, 'requestedBy', path),
    source: requiredString(data, 'source', path),
    live: requiredBoolean(data, 'live', path),
    metadata,
  };

  return { type: SerializedType.Track, version: SERIALIZATION_SCHEMA_VERSION, data: normalized };
}

function parsePlaylistEntity(data: UnknownRecord, path: string): SerializedPlaylist {
  assertOnlyKeys(data, ['id', 'url', 'title', 'description', 'thumbnail', 'type', 'source', 'author', 'tracks'], path);
  const type = requiredString(data, 'type', path);
  if (type !== 'album' && type !== 'playlist') {
    throw new SerializationError(`${path}.type must be "album" or "playlist".`);
  }

  const author = asRecord(requiredField(data, 'author', path), `${path}.author`);
  assertOnlyKeys(author, ['name', 'url'], `${path}.author`);
  const tracks = requiredArray(data, 'tracks', path).map((track, index) => {
    const entity = parseVersionedEntity(asRecord(track, `${path}.tracks[${index}]`), `${path}.tracks[${index}]`);
    if (entity.type !== SerializedType.Track) {
      throw new SerializationError(`${path}.tracks[${index}] must be a Track entity.`);
    }
    return entity;
  });

  const normalized: SerializedPlaylistData = {
    id: requiredString(data, 'id', path),
    url: requiredString(data, 'url', path),
    title: requiredString(data, 'title', path),
    description: requiredString(data, 'description', path),
    thumbnail: requiredString(data, 'thumbnail', path),
    type,
    source: requiredString(data, 'source', path),
    author: {
      name: requiredString(author, 'name', `${path}.author`),
      url: requiredString(author, 'url', `${path}.author`),
    },
    tracks,
  };
  return { type: SerializedType.Playlist, version: SERIALIZATION_SCHEMA_VERSION, data: normalized };
}

/** Normalize persisted v7 payloads only at the decoder boundary. */
function normalizeLegacyEntity(record: UnknownRecord): SerializedEntityUnion {
  const type = requiredString(record, '$type', '$');
  if (type === SerializedType.Track) return normalizeLegacyTrack(record, '$');
  if (type === SerializedType.Playlist) return normalizeLegacyPlaylist(record, '$');
  throw new SerializationError(`Unknown legacy serialized entity type: ${type}.`);
}

function normalizeLegacyTrack(record: UnknownRecord, path: string): SerializedTrack {
  const duration = optionalString(record, 'duration', path);
  const liveValue = optionalField(record, 'live');
  if (liveValue !== undefined && typeof liveValue !== 'boolean') {
    throw new SerializationError(`${path}.live must be a boolean when provided.`);
  }
  const live = liveValue === true || duration?.toUpperCase() === 'LIVE';
  const durationValue = optionalField(record, 'durationMS');
  if (durationValue === undefined && duration === undefined) {
    throw new SerializationError(`${path}.duration is required when durationMS is absent.`);
  }
  const durationMS =
    durationValue === undefined
      ? parseLegacyDuration(duration ?? '', live, `${path}.duration`)
      : nonNegativeValue(durationValue, `${path}.durationMS`);
  const idValue = optionalField(record, 'id');
  if (idValue !== undefined && typeof idValue !== 'string') {
    throw new SerializationError(`${path}.id must be a string when provided.`);
  }

  const requestedByValue = optionalField(record, 'requested_by') ?? optionalField(record, 'requestedBy') ?? null;
  const metadataValue = optionalField(record, 'metadata');
  const sourceValue = optionalField(record, 'source');
  const extractorValue = optionalField(record, 'extractor');
  const source =
    typeof sourceValue === 'string'
      ? sourceValue
      : typeof extractorValue === 'string'
        ? extractorValue
        : requiredString(record, 'source', path);

  const data: SerializedTrackData = {
    // v7 did not persist Track IDs; a fresh runtime identity is assigned only for that legacy case.
    id: typeof idValue === 'string' ? idValue : randomUUID(),
    title: requiredString(record, 'title', path),
    author: requiredString(record, 'author', path),
    description: requiredString(record, 'description', path),
    url: requiredString(record, 'url', path),
    thumbnail: legacyStringOrEmpty(record, 'thumbnail', path),
    durationMS,
    views: nonNegativeNumber(record, 'views', path),
    requestedBy: legacyRequesterIdentity(requestedByValue, `${path}.requested_by`),
    source,
    live,
    metadata:
      metadataValue === undefined || metadataValue === null ? null : cloneJSONValue(metadataValue, `${path}.metadata`),
  };
  return { type: SerializedType.Track, version: SERIALIZATION_SCHEMA_VERSION, data };
}

function normalizeLegacyPlaylist(record: UnknownRecord, path: string): SerializedPlaylist {
  const playlistType = requiredString(record, 'type', path);
  if (playlistType !== 'album' && playlistType !== 'playlist') {
    throw new SerializationError(`${path}.type must be "album" or "playlist".`);
  }
  const author = asRecord(requiredField(record, 'author', path), `${path}.author`);
  const tracks = requiredArray(record, 'tracks', path).map((track, index) => {
    const trackRecord = asRecord(track, `${path}.tracks[${index}]`);
    if (Object.hasOwn(trackRecord, 'version') || Object.hasOwn(trackRecord, 'data')) {
      const entity = parseVersionedEntity(trackRecord, `${path}.tracks[${index}]`);
      if (entity.type !== SerializedType.Track) {
        throw new SerializationError(`${path}.tracks[${index}] must be a Track entity.`);
      }
      return entity;
    }
    if (trackRecord.$type !== SerializedType.Track) {
      throw new SerializationError(`${path}.tracks[${index}] must be a legacy Track entity.`);
    }
    return normalizeLegacyTrack(trackRecord, `${path}.tracks[${index}]`);
  });

  const data: SerializedPlaylistData = {
    id: requiredString(record, 'id', path),
    url: requiredString(record, 'url', path),
    title: requiredString(record, 'title', path),
    description: requiredString(record, 'description', path),
    thumbnail: legacyStringOrEmpty(record, 'thumbnail', path),
    type: playlistType,
    source: requiredString(record, 'source', path),
    author: {
      name: requiredString(author, 'name', `${path}.author`),
      url: requiredString(author, 'url', `${path}.author`),
    },
    tracks,
  };
  return { type: SerializedType.Playlist, version: SERIALIZATION_SCHEMA_VERSION, data };
}

function legacyRequesterIdentity(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  const requester = asRecord(value, path);
  const id = optionalField(requester, 'id');
  if (typeof id !== 'string') {
    throw new SerializationError(`${path} must be a string or an object with a string id.`);
  }
  return id;
}

function parseLegacyDuration(value: string, live: boolean, path: string): number {
  if (live || value === '') return 0;
  const parts = value.split(':');
  if (parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) {
    throw new SerializationError(`${path} is not a supported legacy duration.`);
  }
  const totalSeconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  const milliseconds = Math.round(totalSeconds * 1000);
  if (!Number.isFinite(milliseconds)) throw new SerializationError(`${path} is not a finite duration.`);
  return milliseconds;
}

function asRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SerializationError(`${path} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SerializationError(`${path} must be a plain object.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new SerializationError(`${path} cannot contain symbol keys.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new SerializationError(`${path}.${key} must be an enumerable data property.`);
    }
  }
  return value as UnknownRecord;
}

function assertOnlyKeys(record: UnknownRecord, allowed: string[], path: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) throw new SerializationError(`${path}.${key} is not supported by this schema version.`);
  }
}

function requiredField(record: UnknownRecord, key: string, path: string): unknown {
  if (!Object.hasOwn(record, key)) throw new SerializationError(`${path}.${key} is required.`);
  return record[key];
}

function optionalField(record: UnknownRecord, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function requiredString(record: UnknownRecord, key: string, path: string): string {
  const value = requiredField(record, key, path);
  if (typeof value !== 'string') throw new SerializationError(`${path}.${key} must be a string.`);
  return value;
}

function optionalString(record: UnknownRecord, key: string, path: string): string | undefined {
  const value = optionalField(record, key);
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new SerializationError(`${path}.${key} must be a string when provided.`);
  return value;
}

function requiredNumber(record: UnknownRecord, key: string, path: string): number {
  const value = requiredField(record, key, path);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SerializationError(`${path}.${key} must be a finite number.`);
  }
  return value;
}

function nonNegativeNumber(record: UnknownRecord, key: string, path: string): number {
  return nonNegativeValue(requiredField(record, key, path), `${path}.${key}`);
}

function nonNegativeValue(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new SerializationError(`${path} must be a finite non-negative number.`);
  }
  return value;
}

function nullableString(record: UnknownRecord, key: string, path: string): string | null {
  const value = requiredField(record, key, path);
  if (value === null || typeof value === 'string') return value;
  throw new SerializationError(`${path}.${key} must be a string or null.`);
}

function requiredBoolean(record: UnknownRecord, key: string, path: string): boolean {
  const value = requiredField(record, key, path);
  if (typeof value !== 'boolean') throw new SerializationError(`${path}.${key} must be a boolean.`);
  return value;
}

function requiredArray(record: UnknownRecord, key: string, path: string): unknown[] {
  const value = requiredField(record, key, path);
  if (!Array.isArray(value)) throw new SerializationError(`${path}.${key} must be an array.`);
  cloneJSONValue(value, `${path}.${key}`);
  return value;
}

function legacyStringOrEmpty(record: UnknownRecord, key: string, path: string): string {
  const value = optionalField(record, key);
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new SerializationError(`${path}.${key} must be a string when provided.`);
  return value;
}
