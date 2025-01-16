import { Player } from '../Player';
import { SearchResult } from '../fabric/SearchResult';
import { Track } from '../fabric/Track';
import { User } from 'discord.js';
import { SearchQueryType } from './QueryResolver';

export interface QueryCacheOptions {
  checkInterval?: number;
}

// 5h
const DEFAULT_EXPIRY_TIMEOUT = 18_000_000;

export interface QueryCacheProvider<T> {
  getData(): Promise<DiscordPlayerQueryResultCache<T>[]>;
  addData(data: SearchResult): Promise<void>;
  resolve(context: QueryCacheResolverContext): Promise<SearchResult>;
}

export class QueryCache implements QueryCacheProvider<Track> {
  #defaultCache = new Map<string, DiscordPlayerQueryResultCache<Track>>();
  public timer: NodeJS.Timer;
  public constructor(
    public player: Player,
    public options: QueryCacheOptions = {
      checkInterval: DEFAULT_EXPIRY_TIMEOUT,
    },
  ) {
    this.timer = setInterval(
      this.cleanup.bind(this),
      this.checkInterval,
    ).unref();
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

  public async addData(data: SearchResult) {
    data.tracks.forEach((d) => {
      if (this.#defaultCache.has(d.url)) return;
      this.#defaultCache.set(d.url, new DiscordPlayerQueryResultCache(d));
    });
  }

  public async resolve(context: QueryCacheResolverContext) {
    const result = this.#defaultCache.get(context.query);
    if (!result)
      return new SearchResult(this.player, {
        query: context.query,
        requestedBy: context.requestedBy,
        queryType: context.queryType,
      });

    return new SearchResult(this.player, {
      query: context.query,
      tracks: [result.data],
      playlist: null,
      queryType: context.queryType,
      requestedBy: context.requestedBy,
    });
  }
}

export class DiscordPlayerQueryResultCache<T = unknown> {
  public expireAfter = DEFAULT_EXPIRY_TIMEOUT;
  public constructor(
    public data: T,
    expireAfter: number = DEFAULT_EXPIRY_TIMEOUT,
  ) {
    if (typeof expireAfter === 'number') {
      this.expireAfter = Date.now() + expireAfter;
    }
  }

  public hasExpired() {
    if (
      typeof this.expireAfter !== 'number' ||
      isNaN(this.expireAfter) ||
      this.expireAfter < 1
    )
      return false;
    return Date.now() <= this.expireAfter;
  }
}

export interface QueryCacheResolverContext {
  query: string;
  requestedBy?: User;
  queryType?: SearchQueryType | `ext:${string}`;
}
