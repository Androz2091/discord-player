import { InvalidArgTypeError } from '../errors';
import type { Player } from '../Player';
import { Util } from '../utils/Util';
import { SequentialBucket } from '../utils/SequentialBucket';

export interface LrcSearchParams {
  /**
   * The query to search for. Either this or trackName is required.
   */
  q?: string;
  /**
   * The track name to search for. Either this or query is required.
   */
  trackName?: string;
  /**
   * The artist name
   */
  artistName?: string;
  /**
   * The album name
   */
  albumName?: string;
}

export interface LrcGetParams extends Required<Omit<LrcSearchParams, 'query'>> {
  /**
   * The duration of the track
   */
  duration: number;
}

const toSnakeCase = (obj: Record<string, string>): Record<string, string> => {
  const snakeObj: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    const newKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`,
    );
    snakeObj[newKey] = value;
  }

  return snakeObj;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createQuery = (params: any) =>
  new URLSearchParams(toSnakeCase(params)).toString();

export interface LrcSearchResult {
  /**
   * The track id
   */
  id: number;
  /**
   * The track name
   */
  name: string;
  /**
   * The artist name
   */
  trackName: string;
  /**
   * The album name
   */
  artistName: string;
  /**
   * The album name
   */
  albumName: string;
  /**
   * The duration of the track
   */
  duration: number;
  /**
   * The release date of the track
   */
  instrumental: boolean;
  /**
   * The release date of the track
   */
  plainLyrics: string;
  /**
   * The release date of the track
   */
  syncedLyrics?: string;
}

export type LrcGetResult = Omit<LrcSearchResult, 'name'>;

export class LrcLib {
  /**
   * The API URL
   */
  public api = 'https://lrclib.net/api';
  /**
   * The request timeout. Default is 15 seconds.
   */
  public timeout = 15_000;
  /**
   * The request bucket
   */
  public bucket = new SequentialBucket();

  /**
   * Creates a new LrcLib instance
   * @param {Player} player The player instance
   */
  public constructor(public readonly player: Player) {}

  /**
   * Sets the request timeout
   * @param {number} timeout The timeout in milliseconds
   */
  public setRequestTimeout(timeout: number) {
    this.timeout = timeout;
  }

  /**
   * Sets the retry limit. Default is 5.
   * @param {number} limit The retry limit
   */
  public setRetryLimit(limit: number) {
    this.bucket.MAX_RETRIES = limit;
  }

  /**
   * Gets lyrics
   * @param params The get params
   */
  public get(params: LrcGetParams) {
    const path = `get?${createQuery(params)}`;

    return this.request<LrcSearchResult>(path);
  }

  /**
   * Gets lyrics by ID
   * @param id The lyrics ID
   */
  public getById(id: `${number}` | number) {
    return this.request<LrcSearchResult>(`get/${id}`);
  }

  /**
   * Gets cached lyrics
   * @param params The get params
   */
  public getCached(params: LrcGetParams) {
    const path = `get-cached?${createQuery(params)}`;

    return this.request<LrcSearchResult>(path);
  }

  /**
   * Searches for lyrics
   * @param params The search params
   */
  public search(params: LrcSearchParams) {
    if (!params.q && !params.trackName) {
      throw new InvalidArgTypeError(
        'one of q or trackName',
        'string',
        [String(params.q), String(params.trackName)].join(', '),
      );
    }

    const path = `search?${createQuery(params)}`;

    return this.request<LrcSearchResult[]>(path);
  }

  /**
   * Requests the API
   * @param path The path
   * @param options The request options
   */
  public async request<T>(path: string, options?: RequestInit): Promise<T> {
    const dispatcher = () => {
      const { name, version } = Util.getRuntime();

      const runtimeVersion =
        name === 'unknown' ? version : `${name}/${version}`;

      const init: RequestInit = {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeout),
        ...options,
        headers: {
          'User-Agent': `Discord-Player/${this.player.version} ${
            runtimeVersion ?? ''
          }`.trimEnd(),
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      };

      this.player.debug(`[LrcLib] Requesting ${path}`);

      return fetch(
        `${this.api}${path.startsWith('/') ? path : '/' + path}`,
        init,
      );
    };

    const res = await this.bucket.enqueue(dispatcher);

    return res.json();
  }
}
