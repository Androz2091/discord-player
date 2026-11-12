import type { TrackData, TrackJSON, TrackRequester, TrackSource, SerializedTrack } from './track-types.js';
import type { LegacyPlayerContext } from '../legacy-player.js';
import type { BaseExtractor, SearchQueryType } from '../compat/extractors.js';
import type { ProviderReference } from '../plugins/types.js';
import { randomUUID } from 'node:crypto';
import { SerializationError } from '../errors.js';
import { cloneJSONValue, SERIALIZATION_SCHEMA_VERSION, type Serializable } from '../utils/serialization.js';
import { Playlist } from './playlist.js';

export type * from './track-types.js';

function parseDuration(value: string): number {
  if (!value || value === 'LIVE') {
    return 0;
  }

  const parts = value.split(':').map(Number);

  if (parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

function formatDuration(durationMS: number, live: boolean): string {
  if (live) {
    return 'LIVE';
  }

  if (durationMS === 0) {
    return '';
  }

  const seconds = Math.floor(Math.max(0, durationMS) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function requesterIdentity(requester: TrackRequester | null): string | null {
  if (requester === null) {
    return null;
  }

  if (typeof requester === 'string') {
    return requester;
  }

  if (typeof requester === 'object' && requester !== null && typeof requester.id === 'string') {
    return requester.id;
  }

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

  /** Provider-defined source name or identifier. */
  public source: TrackSource;

  /** Whether this is a live stream without a fixed duration. */
  public live: boolean;

  /** Playlist containing this track, when present. */
  public playlist: Playlist | null;

  /** Portable source identity used by the plugin host. */
  public sourceReference?: ProviderReference;

  /** Optional portable lyrics provider affinity. */
  public lyricsReference?: ProviderReference;

  /** Opaque, expiring host state hint. Excluded from toJSON() and serialize(); retain only in memory. */
  public sourceState?: string;

  /** Process-local v7 raw payload. Never serialized. */
  public readonly raw: Record<string, any>;

  /** Legacy query hint. */
  public queryType?: SearchQueryType;

  /** Legacy display title. */
  public cleanTitle: string;

  /** Legacy owning Player, absent for modern data-only tracks. */
  public readonly player?: LegacyPlayerContext;

  /** Process-local v7 bridge provider; never used by core queue playback. */
  public bridgedExtractor: BaseExtractor<any> | null = null;

  /** Process-local v7 bridge metadata; never persisted. */
  public bridgedTrack: Track | null = null;

  private legacyExtractor: BaseExtractor<any> | null = null;

  private metadataProvider?: () => Promise<Metadata | null>;

  /** Compatibility extractor reference. Assigning it stamps a portable provider identity. */
  public get extractor(): BaseExtractor<any> | null {
    return this.legacyExtractor;
  }

  /** Associate a legacy extractor.
   * @param value Legacy owner, or null to clear the process-local reference.
   */
  public set extractor(value: BaseExtractor<any> | null) {
    this.legacyExtractor = value;

    if (value) {
      this.sourceReference = { pluginId: value.identifier, data: { url: this.url, queryType: this.queryType ?? null } };
    }
  }

  /** Request legacy metadata; the callback remains process-local. */
  public async requestMetadata(): Promise<Metadata | null> {
    if (this.metadataProvider) {
      this.trackMetadata = await this.metadataProvider();
    }

    return this.trackMetadata;
  }

  /** Replace legacy metadata.
   * @param value New metadata.
   */
  public setMetadata(value: Metadata | null): void {
    this.trackMetadata = value;
  }

  private trackMetadata: Metadata | null;

  private explicitDurationMs: number | undefined;

  /**
   * Create a Track model without resolving its media source.
   * @param data Track metadata and optional source-plugin payload.
   */
  /** Legacy construction; Player is not needed by modern source plugins.
   * @param player Owning legacy Player.
   * @param data Legacy metadata and local engine payload.
   */
  public constructor(player: LegacyPlayerContext, data: TrackData<Metadata>);

  /** Create a modern data-only track.
   * @param data Track metadata and portable provider identity.
   */
  public constructor(data?: TrackData<Metadata>);

  public constructor(input: TrackData<Metadata> | LegacyPlayerContext = {}, legacyData?: TrackData<Metadata>) {
    const data = legacyData ?? (input as TrackData<Metadata>);

    this.player = legacyData ? (input as LegacyPlayerContext) : undefined;
    this.sourceReference = data.sourceReference;
    this.lyricsReference = data.lyricsReference;
    this.raw = { ...data, ...data.raw };
    this.queryType = data.queryType;
    this.cleanTitle = data.cleanTitle ?? data.title ?? '';
    this.metadataProvider = data.requestMetadata;
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
      metadata: this.player ? null : this.trackMetadata,
      sourceReference: this.sourceReference,
      lyricsReference: this.lyricsReference,
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
        metadata:
          this.player || this.trackMetadata === null ? null : cloneJSONValue(this.trackMetadata, '$.data.metadata'),
        ...(this.lyricsReference
          ? { lyricsReference: { ...this.lyricsReference, data: cloneJSONValue(this.lyricsReference.data) } }
          : {}),
        ...(this.sourceReference
          ? {
              sourceReference: cloneJSONValue(
                this.sourceReference,
                '$.data.sourceReference',
              ) as unknown as ProviderReference,
            }
          : {}),
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
