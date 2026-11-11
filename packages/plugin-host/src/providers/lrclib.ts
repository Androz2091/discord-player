import { definePlugin } from '../plugins/types.js';
import { parseLyrics } from '../lyrics.js';

/** Search parameters supported by the LRCLIB API. */
export interface LrcSearchParams {
  /** Free-form query. Either `q` or `trackName` is required. */
  q?: string;

  /** Track title. Either `q` or `trackName` is required. */
  trackName?: string;

  /** Artist name filter. */
  artistName?: string;

  /** Album name filter. */
  albumName?: string;
}

/** Parameters accepted by LRCLIB's exact lookup endpoints. */
export interface LrcGetParams extends LrcSearchParams {
  /** Track duration in seconds. */
  duration?: number;
}

/** Lyrics record returned by LRCLIB search. */
export interface LrcSearchResult {
  /** LRCLIB record ID. */
  id: number;

  /** Display name supplied by LRCLIB. */
  name: string;

  /** Track title. */
  trackName: string;

  /** Artist name. */
  artistName: string;

  /** Album name. */
  albumName: string;

  /** Track duration in seconds. */
  duration: number;

  /** Whether the recording is instrumental. */
  instrumental: boolean;

  /** Plain lyric text, when available. */
  plainLyrics: string;

  /** Synchronized LRC text, when supplied by the service. */
  syncedLyrics?: string;
}

/** Lyrics record returned by exact LRCLIB lookups. */
/** Lyrics record returned by the LRCLIB exact lookup endpoints. */
export type LrcGetResult = Omit<LrcSearchResult, 'name'>;

function toSnakeCase(params: LrcGetParams): URLSearchParams {
  const result = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;

    const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

    result.set(snake, String(value));
  }

  return result;
}

function delayWait(ms: number, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted();

  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** LRCLIB API client with serialized requests and bounded retries. */
export class LrcLib {
  /** Base API URL. */
  public api = 'https://lrclib.net/api';

  /** Request timeout in milliseconds. */
  public timeout = 15_000;

  /** Maximum retry count for rate limits and server errors. */
  public retryLimit = 5;

  #tail: Promise<void> = Promise.resolve();

  /**
   * Create an LRCLIB client owned by one Player.
   * @param player Player used to identify requests and publish debug messages.
   */
  public constructor(
    /** Player used to identify requests and publish debug messages. */
    public readonly player: { version: string; debug(message: string): void },
  ) {}

  /**
   * Set the request timeout.
   * @param timeout Positive request timeout in milliseconds.
   */
  public setRequestTimeout(
    /** Timeout in milliseconds. */
    timeout: number,
  ): void {
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new RangeError('Request timeout must be a positive finite number.');

    this.timeout = timeout;
  }

  /**
   * Set the maximum retry count.
   * @param limit Non-negative retry count for rate limits and server errors.
   */
  public setRetryLimit(
    /** Non-negative retry count. */
    limit: number,
  ): void {
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Retry limit must be a non-negative integer.');

    this.retryLimit = limit;
  }

  /**
   * Get lyrics by exact track metadata.
   * @param params Track title, artist, album, and optional duration.
   */
  public get(
    /** Exact lookup metadata. */
    params: LrcGetParams,
  ): Promise<LrcGetResult> {
    return this.request(`get?${toSnakeCase(params)}`);
  }

  /**
   * Get lyrics by LRCLIB record ID.
   * @param id Numeric LRCLIB record ID.
   */
  public getById(
    /** Numeric LRCLIB record ID. */
    id: `${number}` | number,
  ): Promise<LrcGetResult> {
    return this.request(`get/${id}`);
  }

  /**
   * Get cached lyrics by exact track metadata.
   * @param params Track title, artist, album, and optional duration.
   */
  public getCached(
    /** Exact lookup metadata. */
    params: LrcGetParams,
  ): Promise<LrcGetResult> {
    return this.request(`get-cached?${toSnakeCase(params)}`);
  }

  /**
   * Search LRCLIB for matching lyric records.
   * @param params Free-form query or track and artist metadata.
   */
  public search(
    /** Search query or track and artist metadata. */
    params: LrcSearchParams,
  ): Promise<LrcSearchResult[]> {
    if (!params.q && !params.trackName) throw new TypeError('Provide either q or trackName when searching lyrics.');

    return this.request(`search?${toSnakeCase(params)}`);
  }

  /**
   * Send one serialized request to LRCLIB.
   * @param path API path, with or without a leading slash.
   * @param options Additional fetch options merged with the default GET request.
   * @returns Parsed JSON response.
   */
  public async request<Result>(
    /** API path, with or without a leading slash. */
    path: string,
    /** Additional fetch options merged with the default GET request. */
    options: RequestInit = {},
  ): Promise<Result> {
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.#tail;

    this.#tail = previous.then(() => turn);
    await previous;

    try {
      const url = `${this.api}${path.startsWith('/') ? path : `/${path}`}`;

      this.player.debug(`[LrcLib] Requesting ${path}`);

      for (let attempt = 0; ; attempt++) {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          ...options,
          signal: options.signal ?? AbortSignal.timeout(this.timeout),
          headers: {
            'User-Agent': `Discord-Player/${this.player.version}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (response.ok) return (await response.json()) as Result;

        if ((response.status === 429 || response.status >= 500) && attempt < this.retryLimit) {
          const retryAfter = Number(response.headers.get('retry-after'));
          const delay =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(250 * 2 ** attempt, 4000);

          await delayWait(delay, options.signal);
          continue;
        }

        throw new Error(`LRCLIB request failed with HTTP ${response.status} ${response.statusText}.`);
      }
    } finally {
      release();
    }
  }
}

/** Optional LRCLIB provider. No provider is installed by constructing a Player. */
export const lrclibPlugin = definePlugin({
  id: 'org.lrclib',
  setup(ctx) {
    const client = new LrcLib({ version: 'plugin-host', debug: (message) => ctx.player.debug(message) });

    ctx.on('lyrics.search', async ({ input }, { signal }) => {
      const params = typeof input === 'string' ? { q: input } : { trackName: input.title, artistName: input.author };
      const records = await client.request<LrcSearchResult[]>(`search?${toSnakeCase(params)}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(client.timeout)]),
      });

      return records.map((record) => ({
        plain: record.plainLyrics
          ? { available: true as const, text: record.plainLyrics }
          : { available: false as const },
        synced: record.syncedLyrics
          ? { available: true as const, lines: parseLyrics(record.syncedLyrics) }
          : { available: false as const },
        metadata: {
          id: record.id,
          trackName: record.trackName,
          artistName: record.artistName,
          albumName: record.albumName,
          instrumental: record.instrumental,
        },
      }));
    });
  },
});
