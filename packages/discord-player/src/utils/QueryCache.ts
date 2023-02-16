import Fuse from 'fuse.js';
import { Player } from '../Player';
import { SearchResult } from '../Structures/SearchResult';

export interface QueryCacheOptions {
    checkInterval?: number;
}

// 5h
const DEFAULT_EXPIRY_TIMEOUT = 18_000_000;

export class QueryCache {
    #defaultCache = new Map<string, DiscordPlayerQueryResultCache>();
    public timer: NodeJS.Timer;
    public fuse = new Fuse([] as DiscordPlayerQueryResultCache[], {
        keys: ['track.title', 'track.url', 'track.author', 'playlist.tracks.title', 'playlist.tracks.url', 'playlist.tracks.author']
    });
    public constructor(
        public player: Player,
        public options: QueryCacheOptions = {
            checkInterval: DEFAULT_EXPIRY_TIMEOUT
        }
    ) {
        this.timer = setInterval(this.cleanup.bind(this), this.checkInterval).unref();
    }

    public get checkInterval() {
        return this.options.checkInterval ?? DEFAULT_EXPIRY_TIMEOUT;
    }

    public async cleanup() {
        for (const [id, value] of this.#defaultCache) {
            if (value.hasExpired()) {
                this.#defaultCache.delete(id);
            }
        }
    }

    public async clear() {
        this.#defaultCache.clear();
    }

    public async getData() {
        return [...this.#defaultCache.values()];
    }

    public async addData(data: DiscordPlayerQueryResultCache | DiscordPlayerQueryResultCache[]) {
        if (!Array.isArray(data)) {
            this.#defaultCache.set(data.data.query, data);
        } else {
            data.forEach((d) => this.#defaultCache.set(d.data.query, d));
        }
    }

    public async resolve(query: string) {
        const result = this.fuse.search(query);

        if (!result.length)
            return new SearchResult(this.player, {
                query
            });

        const data = result[0].item.data;

        if (data.hasPlaylist()) {
            return new SearchResult(this.player, {
                query: data.query,
                queryType: data.queryType,
                extractor: data.extractor,
                playlist: null,
                requestedBy: data.requestedBy,
                tracks: data.tracks
            });
        }

        return data;
    }
}

export class DiscordPlayerQueryResultCache {
    public expireAfter = DEFAULT_EXPIRY_TIMEOUT;
    public constructor(public data: SearchResult, expireAfter: number = DEFAULT_EXPIRY_TIMEOUT) {
        if (typeof expireAfter === 'number') {
            this.expireAfter = Date.now() + expireAfter;
        }
    }

    public hasExpired() {
        if (typeof this.expireAfter !== 'number' || isNaN(this.expireAfter) || this.expireAfter < 1) return false;
        return Date.now() <= this.expireAfter;
    }
}
