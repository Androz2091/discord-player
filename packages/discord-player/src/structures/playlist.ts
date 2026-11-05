import { Track, type SerializedTrack, type TrackData, type TrackSource } from './track.js';

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
  tracks?: Array<Track | (TrackData & { requested_by?: TrackData['requestedBy'] })>;
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

/** Reconstructable Playlist serialization with the v7 discriminator fields. */
export interface SerializedPlaylist extends Omit<PlaylistJSON, 'tracks'> {
  /** Serialized Tracks that belong to the playlist. */
  tracks: SerializedTrack[];
  /** Serialization type discriminator. */
  $type: 'playlist';
  /** Encoder version string. */
  $encoder_version: string;
}

/** A playlist and its tracks, independent of any Discord client library. */
export class Playlist implements Iterable<Track> {
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
   * Create a playlist and reconstruct any serialized Track entries.
   * @param data Playlist metadata and entries in source order.
   */
  public constructor(data: PlaylistData = {}) {
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

  /** Serialize this Playlist and each Track using v7-compatible discriminators. */
  public serialize(): SerializedPlaylist {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      description: this.description,
      thumbnail: this.thumbnail,
      type: this.type,
      source: this.source,
      author: this.author,
      tracks: this.tracks.map((track) => track.serialize()),
      $type: 'playlist',
      $encoder_version: '8.0.0-dev.0',
    };
  }

  /**
   * Reconstruct a Playlist from regular or legacy playlist data.
   * @param data Playlist fields and optional Track entries.
   */
  public static deserialize(data: PlaylistData): Playlist {
    return new Playlist(data);
  }

  /**
   * Deserialize a v7-style object after validating its type discriminator.
   * @param data Serialized Playlist carrying the `$type: "playlist"` discriminator.
   */
  public static fromSerialized(data: SerializedPlaylist): Playlist {
    if (data.$type !== 'playlist') throw new TypeError('Expected serialized Playlist data with $type "playlist".');
    return new Playlist({ ...data, tracks: data.tracks.map((track) => Track.fromSerialized(track)) });
  }

  /** Iterate over Tracks in source order. */
  public [Symbol.iterator](): Iterator<Track> {
    return this.tracks[Symbol.iterator]();
  }
}
