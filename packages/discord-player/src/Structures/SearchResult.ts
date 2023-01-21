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
    public constructor(public player: Player, private _data: SearchResultData) {}

    public get query() {
        return this._data.query;
    }

    public get queryType() {
        return this._data.queryType || QueryType.AUTO;
    }

    public get extractor() {
        return this._data.extractor || null;
    }

    public get playlist() {
        return this._data.playlist;
    }

    public get tracks() {
        return this._data.tracks || [];
    }

    public get requestedBy() {
        return this._data.requestedBy || null;
    }

    public async execute() {
        return this.player.search(this.query, {
            searchEngine: this.queryType,
            requestedBy: this.requestedBy!
        });
    }

    public isEmpty() {
        return !this.tracks.length;
    }

    public hasPlaylist() {
        return this.playlist != null;
    }

    public hasTracks() {
        return this.tracks.length > 0;
    }

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
