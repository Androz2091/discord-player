import type { SearchQueryType } from '../compat/query-types.js';
import type { SourceReference } from '../plugins/types.js';
import type { JSONValue, SerializedEntity, SERIALIZATION_SCHEMA_VERSION } from '../utils/serialization.js';
import type { Playlist, PlaylistData, PlaylistJSON } from './playlist.js';

/** Name or identifier for a Track's source integration. */
export type TrackSource = string;

/** Requester identifier or a structural requester object. */
export type TrackRequester = string | { id?: string; username?: string; [key: string]: unknown };

/** Public metadata and optional portable source identity. */
export interface TrackData<Metadata = unknown> {
  /** Portable provider payload; exclude secrets and live resources. */
  sourceReference?: SourceReference;

  /** Process-local legacy data, never persisted. */
  raw?: Record<string, any>;

  /** Legacy source location or engine object, never persisted. */
  engine?: unknown;

  /** Legacy query hint. */
  queryType?: SearchQueryType;

  /** Legacy asynchronous metadata provider, never persisted. */
  requestMetadata?: () => Promise<Metadata | null>;

  /** Legacy display title. */
  cleanTitle?: string;

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

  /** Provider-defined source name or identifier. */
  source?: TrackSource;

  /** Whether this is a live stream without a fixed duration. */
  live?: boolean;

  /** Arbitrary source-plugin metadata. */
  metadata?: Metadata | null;

  /** Playlist containing this track, when present. */
  playlist?: Playlist | PlaylistData | null;
}

/** Legacy raw construction fields; live engines and callbacks remain process-local. */
export type RawTrackData<Metadata = unknown> = TrackData<Metadata>;

/** Legacy metadata refinement for custom extractor helpers. */
export type WithMetadata<T extends object, Metadata> = T & {
  /** Attached metadata. */
  metadata: Metadata;

  /** Resolve process-local extractor metadata. */
  requestMetadata(): Promise<Metadata>;
};

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
  /** Optional provider identity, absent in older version 1 payloads. */
  sourceReference?: SourceReference;

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

  /** Provider-defined source identifier. */
  source: string;

  /** Whether the Track is a live stream. */
  live: boolean;

  /** JSON-safe application metadata, or null when absent. */
  metadata: JSONValue | null;
};

/** Version 1 persistence representation of a Track. */
export type SerializedTrack = SerializedEntity<'track', SerializedTrackData, typeof SERIALIZATION_SCHEMA_VERSION>;
