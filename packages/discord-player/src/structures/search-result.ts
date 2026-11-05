import type { Playlist } from './playlist.js';
import type { Track } from './track.js';

export interface SearchResultData {
  tracks: Track[];
  playlist: Playlist | null;
}

export class SearchResult {
  public readonly tracks: Track[];
  public readonly playlist: Playlist | null;

  public constructor(private readonly data: SearchResultData) {
    this.tracks = data.tracks;
    this.playlist = data.playlist;
  }

  public static empty() {
    return new SearchResult({
      tracks: [],
      playlist: null,
    });
  }

  public isEmpty() {
    return this.tracks.length === 0;
  }
}
