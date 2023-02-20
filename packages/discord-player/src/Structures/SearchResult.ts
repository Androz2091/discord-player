import { User } from 'discord.js';
import { BaseExtractor } from '../extractors/BaseExtractor';
import { Player } from '../Player';
import { QueryExtractorSearch, QueryType, SearchQueryType } from '../types/types';
import { Playlist } from './Playlist';
import { Track } from './Track';

export interface SearchResultData {
    query: string;
    queryType?: SearchQueryType | QueryExtractorSearch | null;
    extractor?: BaseExtractor | null;
    playlist?: Playlist | null;
    tracks?: Track[];
    requestedBy?: User | null;
}

export class SearchResult {
    public constructor(public player: Player, private _data: SearchResultData) {
        this._data.tracks?.forEach((track) => {
            track.extractor = this._data.extractor || null;
        });
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
            requestedBy: this.requestedBy!
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
            requestedBy: this.requestedBy?.toJSON() || null
        };
    }
}
