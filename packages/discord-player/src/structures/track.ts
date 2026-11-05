import { randomUUID } from 'node:crypto';
import type { MediaSource } from '@remedia/client';
import { SerializationError, SourceUnavailableError } from '../errors.js';
import {
  cloneJSONValue,
  SERIALIZATION_SCHEMA_VERSION,
  type JSONValue,
  type Serializable,
  type SerializedEntity,
} from '../utils/serialization.js';
import { Playlist, type PlaylistData, type PlaylistJSON } from './playlist.js';

/** Name or identifier for a Track's source integration. */
export type TrackSource = 'soundcloud' | 'youtube' | 'spotify' | 'apple_music' | 'arbitrary' | string;
/** Requester identifier or a structural requester object. */
export type TrackRequester = string | { id?: string; username?: string; [key: string]: unknown };

export interface TrackData<Metadata = unknown> {
  /** Stable track identifier. */
  id?: string;
  /** Display title. */
  title?: string;
  /** Track author or artist. */
  author?: string;
  /** Track description. */
  description?: string;
  /** Source page URL. */
  url?: string;
  /** Thumbnail URL. */
  thumbnail?: string;
  /** Human-readable duration. */
  duration?: string;
  /** Duration in milliseconds when known. */
  durationMS?: number;
  /** View or play count when available. */
  views?: number;
  /** User or application identity that requested this track. */
  requestedBy?: TrackRequester | null;
  /** Alias for `requestedBy`. */
  requester?: TrackRequester | null;
  /** Source name, such as YouTube, Spotify, or arbitrary. */
  source?: TrackSource;
  /** Whether this is a live stream without a fixed duration. */
  live?: boolean;
  /** Arbitrary source-plugin metadata. */
  metadata?: Metadata | null;
  /** Playlist containing this track, when present. */
  playlist?: Playlist | PlaylistData | null;
}

/** JSON-compatible representation of a Track. */
export interface TrackJSON<Metadata = unknown> extends TrackData<Metadata> {
  /** Stable track identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** Track author or artist. */
  author: string;
  /** Track description. */
  description: string;
  /** Source page URL. */
  url: string;
  /** Thumbnail URL. */
  thumbnail: string;
  /** Human-readable duration. */
  duration: string;
  /** Duration in milliseconds. */
  durationMS: number;
  /** View or play count. */
  views: number;
  /** Serialized requester identity, or null when no requester is known. */
  requestedBy: string | null;
  /** Serialized playlist metadata, or null when omitted. */
  playlist: PlaylistJSON | null;
}

/** Public Track fields stored by the versioned persistence format. */
export type SerializedTrackData = {
  /** Stable Track identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** Track author or artist. */
  author: string;
  /** Track description. */
  description: string;
  /** Source page URL. */
  url: string;
  /** Thumbnail URL. */
  thumbnail: string;
  /** Duration in milliseconds. */
  durationMS: number;
  /** View or play count when available. */
  views: number;
  /** Portable requester identity, or null when unknown. */
  requestedBy: string | null;
  /** Source identifier such as `youtube` or `arbitrary`. */
  source: string;
  /** Whether the Track is a live stream. */
  live: boolean;
  /** JSON-safe application metadata, or null when absent. */
  metadata: JSONValue | null;
};

/** Version 1 persistence representation of a Track. */
export type SerializedTrack = SerializedEntity<'track', SerializedTrackData, typeof SERIALIZATION_SCHEMA_VERSION>;

function parseDuration(value: string): number {
  if (!value || value === 'LIVE') return 0;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

function formatDuration(durationMS: number, live: boolean): string {
  if (live) return 'LIVE';
  if (durationMS === 0) return '';
  const seconds = Math.floor(Math.max(0, durationMS) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function requesterIdentity(requester: TrackRequester | null): string | null {
  if (requester === null) return null;
  if (typeof requester === 'string') return requester;
  if (typeof requester === 'object' && requester !== null && typeof requester.id === 'string') return requester.id;
  throw new SerializationError('Track requester objects must have a string id to be persisted.');
}

/** A Discord-library-agnostic track model. Source resolution belongs to a source plugin. */
export class Track<Metadata = unknown> implements Serializable<SerializedTrack> {
  /** Stable identifier for this Track instance. */
  public readonly id: string;
  /** Display title. */
  public title: string;
  /** Track author or artist. */
  public author: string;
  /** Track description. */
  public description: string;
  /** Source page URL. */
  public url: string;
  /** Thumbnail URL. */
  public thumbnail: string;
  /** Human-readable duration. */
  public duration: string;
  /** View or play count when available. */
  public views: number;
  /** User or application identity that requested this track. */
  public requestedBy: TrackRequester | null;
  /** Source name, such as YouTube, Spotify, or arbitrary. */
  public source: TrackSource;
  /** Whether this is a live stream without a fixed duration. */
  public live: boolean;
  /** Playlist containing this track, when present. */
  public playlist: Playlist | null;
  private trackMetadata: Metadata | null;
  private explicitDurationMs: number | undefined;

  /**
   * Create a Track model without resolving its media source.
   * @param data Track metadata and optional source-plugin payload.
   */
  public constructor(data: TrackData<Metadata> = {}) {
    this.id = data.id ?? randomUUID();
    this.title = data.title ?? '';
    this.author = data.author ?? '';
    this.description = data.description ?? (this.author ? `${this.title} by ${this.author}` : this.title);
    this.url = data.url ?? '';
    this.thumbnail = data.thumbnail ?? '';
    this.duration = data.duration ?? '';
    this.explicitDurationMs = data.durationMS;
    this.views = data.views ?? 0;
    this.requestedBy = data.requestedBy ?? data.requester ?? null;
    this.source = data.source ?? 'arbitrary';
    this.live = data.live ?? false;
    this.playlist =
      data.playlist instanceof Playlist ? data.playlist : data.playlist ? Playlist.deserialize(data.playlist) : null;
    this.trackMetadata = data.metadata ?? null;
  }

  /** Alias for the v7 `requestedBy` field. */
  public get requester(): TrackRequester | null {
    return this.requestedBy;
  }
  /**
   * Set the requester through the shorter alias.
   * @param value Requesting user or application identity.
   */
  public set requester(value: TrackRequester | null) {
    this.requestedBy = value;
  }
  /** Arbitrary source-plugin metadata. */
  public get metadata(): Metadata | null {
    return this.trackMetadata;
  }
  /**
   * Replace arbitrary source-plugin metadata.
   * @param value Metadata value to attach, or null to clear it.
   */
  public set metadata(value: Metadata | null) {
    this.trackMetadata = value;
  }
  /** Whether source-plugin metadata is present. */
  public get hasMetadata(): boolean {
    return this.trackMetadata !== null;
  }
  /** Track duration in milliseconds, parsed from `duration` when not supplied. */
  public get durationMS(): number {
    return this.explicitDurationMs ?? parseDuration(this.duration);
  }

  /**
   * Cast this Track to a different metadata type without copying it.
   * @returns The same Track reference with a different metadata type.
   */
  public asMetadata<NewMetadata>(): Track<NewMetadata> {
    return this as unknown as Track<NewMetadata>;
  }

  /**
   * Source plugins may override this method to return a Remedia MediaSource.
   * The base implementation rejects with `SourceUnavailableError` while source integrations are deferred.
   * @param options Optional signal for cancelling source preparation.
   * @returns A resolved Remedia media source.
   */
  public async getStreamableSource(
    /** Signal for cancelling asynchronous source preparation. */
    options?: { signal?: AbortSignal },
  ): Promise<MediaSource> {
    void options;
    throw new SourceUnavailableError(this.title || this.id);
  }

  /** Format the Track as `title by author`, omitting the author when empty. */
  public toString(): string {
    return this.author ? `${this.title} by ${this.author}` : this.title;
  }

  /** Format the Track title as a Markdown hyperlink to its source URL. */
  public toHyperlink(): string {
    return `[${this.title}](${this.url})`;
  }

  /**
   * Return a JSON-compatible Track representation.
   * @param hidePlaylist When true, omit playlist metadata to prevent nested playlist serialization.
   */
  public toJSON(hidePlaylist = false): TrackJSON<Metadata> {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      description: this.description,
      url: this.url,
      thumbnail: this.thumbnail,
      duration: this.duration,
      durationMS: this.durationMS,
      views: this.views,
      requestedBy: typeof this.requestedBy === 'string' ? this.requestedBy : (this.requestedBy?.id ?? null),
      source: this.source,
      live: this.live,
      metadata: this.trackMetadata,
      playlist: hidePlaylist ? null : (this.playlist?.toJSON(false) ?? null),
    };
  }

  /**
   * Serialize public Track data using schema version 1.
   * Requesters are reduced to their string identity, Playlist links are omitted, and metadata must be JSON-safe.
   * @returns A versioned Track persistence payload.
   */
  public serialize(): SerializedTrack {
    const live = this.live || this.duration.trim().toUpperCase() === 'LIVE';
    const serialized: SerializedTrack = {
      type: 'track',
      version: SERIALIZATION_SCHEMA_VERSION,
      data: {
        id: this.id,
        title: this.title,
        author: this.author,
        description: this.description,
        url: this.url,
        thumbnail: this.thumbnail,
        durationMS: this.durationMS,
        views: this.views,
        requestedBy: requesterIdentity(this.requestedBy),
        source: this.source,
        live,
        metadata: this.trackMetadata === null ? null : cloneJSONValue(this.trackMetadata, '$.data.metadata'),
      },
    };
    cloneJSONValue(serialized, '$');
    return serialized;
  }

  /**
   * Construct a Track from public model data without resolving its media source.
   * @param data Track fields and optional source-plugin metadata.
   * @returns A Track instance reconstructed from the provided fields.
   */
  public static deserialize<Metadata = unknown>(data: TrackData<Metadata>): Track<Metadata> {
    return new Track(data);
  }

  /**
   * Reconstruct a Track from a validated versioned persistence payload.
   * @param serialized Versioned Track payload.
   * @returns A Track instance with no reconstructed source-plugin playback state.
   */
  public static fromSerialized(serialized: SerializedTrack): Track {
    const data = serialized.data;
    return Track.deserialize({
      ...data,
      duration: formatDuration(data.durationMS, data.live),
      playlist: null,
    });
  }
}
