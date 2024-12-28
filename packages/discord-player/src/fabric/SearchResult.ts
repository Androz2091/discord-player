import { User, UserResolvable } from 'discord.js';
import { BaseExtractor } from '../extractors/BaseExtractor';
import { Player } from '../Player';
import { Playlist } from './Playlist';
import { Track } from './Track';
import { QueryType, SearchQueryType } from '../utils/QueryResolver';

export interface SearchResultData {
  query: string;
  queryType?: SearchQueryType | QueryExtractorSearch | null;
  extractor?: BaseExtractor | null;
  playlist?: Playlist | null;
  tracks?: Track[];
  requestedBy?: User | null;
}

export interface PlayOptions {
  /**
   * If this play was triggered for filters update
   */
  filtersUpdate?: boolean;
  /**
   * FFmpeg args passed to encoder
   */
  encoderArgs?: string[];
  /**
   * Time to seek to before playing
   */
  seek?: number;
  /**
   * If it should start playing the provided track immediately
   */
  immediate?: boolean;
}

export type QueryExtractorSearch = `ext:${string}`;

export interface SearchOptions {
  /**
   * The user who requested this search
   */
  requestedBy?: UserResolvable;
  /**
   * The query search engine, can be extractor name to target specific one (custom)
   */
  searchEngine?: SearchQueryType | QueryExtractorSearch;
  /**
   * List of the extractors to block
   */
  blockExtractors?: string[];
  /**
   * If it should ignore query cache lookup
   */
  ignoreCache?: boolean;
  /**
   * Fallback search engine to use
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestOptions?: any;
  /**
   * Fallback search engine to use
   */
  fallbackSearchEngine?: (typeof QueryType)[keyof typeof QueryType];
}

export interface PlayerSearchResult {
  playlist: Playlist | null;
  tracks: Track[];
}

export class SearchResult {
  public constructor(public player: Player, private _data: SearchResultData) {
    this._data.tracks?.forEach((track) => {
      track.extractor ??= this._data.extractor || null;
      track.requestedBy ??= _data.requestedBy || null;
    });
  }

  public setQueryType(type: SearchQueryType | QueryExtractorSearch) {
    this._data.queryType = type;
    return this;
  }

  public setRequestedBy(user: User) {
    this._data.requestedBy = user;
    this._data.tracks?.forEach((track) => {
      track.requestedBy = user;
    });
    return this;
  }

  public setExtractor(extractor: BaseExtractor) {
    this._data.extractor = extractor;
    this._data.tracks?.forEach((track) => {
      track.extractor = extractor;
    });
    return this;
  }

  public setTracks(tracks: Track[]) {
    this._data.tracks = tracks;
    return this;
  }

  public setQuery(query: string) {
    this._data.query = query;
    return this;
  }

  public setPlaylist(playlist: Playlist) {
    this._data.playlist = playlist;
    return this;
  }

  /**
   * The search query
   */
  public get query() {
    return this._data.query;
  }

  /**
   * The search query type
   */
  public get queryType() {
    return this._data.queryType || QueryType.AUTO;
  }

  /**
   * The extractor
   */
  public get extractor() {
    return this._data.extractor || null;
  }

  /**
   * Playlist result
   */
  public get playlist() {
    return this._data.playlist;
  }

  /**
   * Tracks result
   */
  public get tracks() {
    return this._data.tracks || [];
  }

  /**
   * Requested by
   */
  public get requestedBy() {
    return this._data.requestedBy || null;
  }

  /**
   * Re-execute this search
   */
  public async execute() {
    return this.player.search(this.query, {
      searchEngine: this.queryType,
      requestedBy: this.requestedBy!,
    });
  }

  /**
   * If this search result is empty
   */
  public isEmpty() {
    return !this.tracks.length;
  }

  /**
   * If this search result has playlist
   */
  public hasPlaylist() {
    return this.playlist != null;
  }

  /**
   * If this search result has tracks
   */
  public hasTracks() {
    return this.tracks.length > 0;
  }

  /**
   * JSON representation of this search
   */
  public toJSON() {
    return {
      query: this.query,
      queryType: this.queryType,
      playlist: this.playlist?.toJSON(false) || null,
      tracks: this.tracks.map((m) => m.toJSON(true)),
      extractor: this.extractor?.identifier || null,
      requestedBy: this.requestedBy?.toJSON() || null,
    };
  }
}
