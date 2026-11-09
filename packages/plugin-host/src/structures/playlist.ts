import type { LegacyPlayerContext } from '../legacy-player.js';
import { Track, type SerializedTrack, type TrackData, type TrackSource } from './track.js';
import {
  cloneJSONValue,
  SERIALIZATION_SCHEMA_VERSION,
  type Serializable,
  type SerializedEntity,
} from '../utils/serialization.js';

/** Metadata used to construct a Playlist. */
export interface PlaylistData {
  /** Stable source playlist identifier. */
  id?: string;

  /** Source page URL. */
  url?: string;

  /** Display title. */
  title?: string;

  /** Playlist description. */
  description?: string;

  /** Thumbnail URL. */
  thumbnail?: string;

  /** Album or playlist classification. */
  type?: 'album' | 'playlist';

  /** Source name. */
  source?: TrackSource;

  /** Playlist author name and source URL. */
  author?: { name: string; url: string };

  /** Playlist entries. */
  tracks?: Array<Track | TrackData>;
}

/** JSON-compatible Playlist representation. */
export interface PlaylistJSON {
  /** Stable source playlist identifier. */
  id: string;

  /** Source page URL. */
  url: string;

  /** Display title. */
  title: string;

  /** Playlist description. */
  description: string;

  /** Thumbnail URL. */
  thumbnail: string;

  /** Album or playlist classification. */
  type: 'album' | 'playlist';

  /** Source name. */
  source: TrackSource;

  /** Playlist author name and source URL. */
  author: { name: string; url: string };

  /** JSON-compatible playlist entries. */
  tracks: ReturnType<Track['toJSON']>[];
}

/** Public Playlist fields stored by the versioned persistence format. */
export type SerializedPlaylistData = {
  /** Stable source playlist identifier. */
  id: string;

  /** Source page URL. */
  url: string;

  /** Display title. */
  title: string;

  /** Playlist description. */
  description: string;

  /** Thumbnail URL. */
  thumbnail: string;

  /** Album or playlist classification. */
  type: 'album' | 'playlist';

  /** Source name. */
  source: TrackSource;

  /** Playlist author name and source URL. */
  author: { name: string; url: string };

  /** Serialized Tracks in playlist order, without parent references. */
  tracks: SerializedTrack[];
};

/** Version 1 persistence representation of a Playlist. */
export type SerializedPlaylist = SerializedEntity<
  'playlist',
  SerializedPlaylistData,
  typeof SERIALIZATION_SCHEMA_VERSION
>;

/** A playlist and its tracks, independent of any Discord client library. */
export class Playlist implements Iterable<Track>, Serializable<SerializedPlaylist> {
  /** Stable source playlist identifier. */
  public readonly id: string;

  /** Source page URL. */
  public url: string;

  /** Display title. */
  public title: string;

  /** Playlist description. */
  public description: string;

  /** Thumbnail URL. */
  public thumbnail: string;

  /** Album or playlist classification. */
  public type: 'album' | 'playlist';

  /** Source name. */
  public source: TrackSource;

  /** Playlist author name and source URL. */
  public author: { name: string; url: string };

  /** Tracks in this playlist, in source order. */
  public tracks: Track[];

  /**
   * Create a playlist from public metadata and Track entries.
   * @param data Playlist metadata and entries in source order.
   */
  public constructor(data?: PlaylistData);

  /** Legacy playlist construction.
   * @param player Legacy Player; retained only for call compatibility.
   * @param data Playlist metadata.
   */
  public constructor(player: LegacyPlayerContext, data: PlaylistData);

  public constructor(input: PlaylistData | LegacyPlayerContext = {}, legacyData?: PlaylistData) {
    const data = legacyData ?? (input as PlaylistData);

    this.id = data.id ?? '';
    this.url = data.url ?? '';
    this.title = data.title ?? '';
    this.description = data.description ?? '';
    this.thumbnail = data.thumbnail ?? '';
    this.type = data.type ?? 'playlist';
    this.source = data.source ?? 'arbitrary';
    this.author = data.author ?? { name: '', url: '' };
    this.tracks = (data.tracks ?? []).map((track) => (track instanceof Track ? track : Track.deserialize(track)));
  }

  /** Sum of known Track durations in milliseconds. */
  public get estimatedDuration(): number {
    return this.tracks.reduce((total, track) => total + track.durationMS, 0);
  }

  /** Human-readable sum of known Track durations. */
  public get durationFormatted(): string {
    const seconds = Math.floor(this.estimatedDuration / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;

    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  /**
   * Return a JSON-compatible playlist representation.
   * @param withTracks Whether to include Track data in the result.
   */
  public toJSON(withTracks = true): PlaylistJSON {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      description: this.description,
      thumbnail: this.thumbnail,
      type: this.type,
      source: this.source,
      author: this.author,
      tracks: withTracks ? this.tracks.map((track) => track.toJSON(true)) : [],
    };
  }

  /**
   * Serialize public Playlist metadata and ordered Tracks using schema version 1.
   * Track serialization omits each Track's parent Playlist reference to prevent recursive payloads.
   * @returns A versioned Playlist persistence payload.
   */
  public serialize(): SerializedPlaylist {
    const serialized: SerializedPlaylist = {
      type: 'playlist',
      version: SERIALIZATION_SCHEMA_VERSION,
      data: {
        id: this.id,
        url: this.url,
        title: this.title,
        description: this.description,
        thumbnail: this.thumbnail,
        type: this.type,
        source: this.source,
        author: { name: this.author.name, url: this.author.url },
        tracks: this.tracks.map((track) => track.serialize()),
      },
    };

    cloneJSONValue(serialized, '$');

    return serialized;
  }

  /**
   * Reconstruct a Playlist from public data and link its Tracks to the restored Playlist.
   * @param data Playlist fields and optional Track entries.
   */
  public static deserialize(data: PlaylistData): Playlist {
    const playlist = new Playlist(data);

    for (const track of playlist.tracks) {
      track.playlist = playlist;
    }

    return playlist;
  }

  /**
   * Reconstruct a Playlist from a validated versioned persistence payload.
   * @param serialized Versioned Playlist payload containing ordered Track entities.
   * @returns A Playlist with Track instances linked to their parent Playlist.
   */
  public static fromSerialized(serialized: SerializedPlaylist): Playlist {
    return Playlist.deserialize({
      ...serialized.data,
      tracks: serialized.data.tracks.map((track) => Track.fromSerialized(track)),
    });
  }

  /** Iterate over Tracks in source order. */
  public [Symbol.iterator](): Iterator<Track> {
    return this.tracks[Symbol.iterator]();
  }
}
