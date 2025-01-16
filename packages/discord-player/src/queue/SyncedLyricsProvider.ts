import { NotExistingError } from '../errors';
import { LrcGetResult, LrcSearchResult } from '../lrclib/LrcLib';
import type { GuildQueue } from './GuildQueue';

export type LyricsData = Map<number, string>;
export type Unsubscribe = () => void;
export type LyricsCallback = (lyrics: string, timestamp: number) => unknown;
export type LyricsAt = { timestamp: number; line: string };

const timestampPattern = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

export class SyncedLyricsProvider {
  #loop: NodeJS.Timeout | null = null;
  #callback: LyricsCallback | null = null;
  #onUnsubscribe: Unsubscribe | null = null;

  public interval = 100;
  public readonly lyrics: LyricsData = new Map();

  public constructor(
    public readonly queue: GuildQueue,
    public readonly raw?: LrcGetResult | LrcSearchResult,
  ) {
    if (raw?.syncedLyrics) this.load(raw?.syncedLyrics);
  }

  public isSubscribed() {
    return this.#callback !== null;
  }

  public load(lyrics: string) {
    if (!lyrics) throw new NotExistingError('syncedLyrics');

    this.lyrics.clear();
    this.unsubscribe();

    const lines = lyrics.split('\n');

    for (const line of lines) {
      const match = line.match(timestampPattern);

      if (match) {
        const [, minutes, seconds, milliseconds] = match;
        const timestamp =
          parseInt(minutes) * 60 * 1000 +
          parseInt(seconds) * 1000 +
          parseInt(milliseconds);

        this.lyrics.set(timestamp, line.replace(timestampPattern, '').trim());
      }
    }
  }

  /**
   * Returns the lyrics at a specific time or at the closest time (±2 seconds)
   * @param time The time in milliseconds
   */
  public at(time: number): LyricsAt | null {
    const lowestTime = this.lyrics.keys().next().value;
    if (lowestTime == null || time < lowestTime) return null;
    if (this.lyrics.has(time))
      return { line: this.lyrics.get(time) as string, timestamp: time };

    const keys = Array.from(this.lyrics.keys());

    const closest = keys.reduce((a, b) =>
      Math.abs(b - time) < Math.abs(a - time) ? b : a,
    );

    if (closest > time) return null;

    if (Math.abs(closest - time) > 2000) return null;

    const line = this.lyrics.get(closest);

    if (!line) return null;

    return { timestamp: closest, line };
  }

  /**
   * Callback for the lyrics change.
   * @param callback The callback function
   */
  public onChange(callback: LyricsCallback) {
    this.#callback = callback;
  }

  /**
   * Callback to detect when the provider is unsubscribed.
   * @param callback The callback function
   */
  public onUnsubscribe(callback: Unsubscribe) {
    this.#onUnsubscribe = callback;
  }

  /**
   * Unsubscribes from the queue.
   */
  public unsubscribe() {
    if (this.#loop) clearInterval(this.#loop);
    if (this.#onUnsubscribe) this.#onUnsubscribe();

    this.#callback = null;
    this.#onUnsubscribe = null;
    this.#loop = null;
  }

  /**
   * Subscribes to the queue to monitor the current time.
   * @returns The unsubscribe function
   */
  public subscribe(): Unsubscribe {
    if (this.#loop) return () => this.unsubscribe();

    this.#createLoop();

    return () => this.unsubscribe();
  }

  /**
   * Pauses the lyrics provider.
   */
  public pause() {
    const hasLoop = this.#loop !== null;

    if (hasLoop) {
      clearInterval(this.#loop!);
      this.#loop = null;
    }

    return hasLoop;
  }

  /**
   * Resumes the lyrics provider.
   */
  public resume() {
    const hasLoop = this.#loop !== null;

    if (!hasLoop) this.#createLoop();

    return !hasLoop;
  }

  #createLoop() {
    if (!this.#callback) return;
    if (this.#loop) clearInterval(this.#loop);

    let lastValue: LyricsAt | null = null;

    this.#loop = setInterval(() => {
      if (this.queue.deleted) return this.unsubscribe();

      if (!this.#callback || !this.queue.isPlaying()) return;

      const time = this.queue.node.getTimestamp();
      if (!time) return;

      const lyrics = this.at(time.current.value);

      if (!lyrics) return;

      if (
        lastValue !== null &&
        lyrics.line === lastValue.line &&
        lyrics.timestamp === lastValue.timestamp
      )
        return;

      lastValue = lyrics;

      this.#callback(lyrics.line, lyrics.timestamp);
    }, this.interval).unref();
  }
}
