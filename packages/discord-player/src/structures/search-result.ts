import type { Playlist } from './playlist.js';
import type { Track } from './track.js';

/** Resolved Tracks and optional source playlist metadata returned by search. */
export interface SearchResultData {
  /** Search result Tracks in source relevance order. */
  tracks: Track[];
  /** Playlist associated with the result, or null when the result is not a playlist. */
  playlist: Playlist | null;
}

/** Familiar search result wrapper used by Player-level playback. */
export class SearchResult {
  /** Tracks returned by the search operation. */
  public readonly tracks: Track[];
  /** Playlist metadata returned with the tracks, when available. */
  public readonly playlist: Playlist | null;

  /**
   * Create a result from resolved tracks and optional playlist metadata.
   * @param data Search result payload.
   */
  public constructor(private readonly data: SearchResultData) {
    this.tracks = data.tracks;
    this.playlist = data.playlist;
  }

  /** Create an empty result when no source integration can resolve a query. */
  public static empty() {
    return new SearchResult({
      tracks: [],
      playlist: null,
    });
  }

  /** Whether this result contains no Tracks. */
  public isEmpty() {
    return this.tracks.length === 0;
  }
}
