import { parseLyrics, type LyricsLine, type LyricsResult } from '@discord-player/plugin-host';
import type { GuildQueue } from './guild-queue.js';
import type { Track } from './track.js';

/** Active lyric with its source timestamp, compatible with v7 lookup results. */
export interface LyricsAt {
  /** Timestamp in milliseconds. */
  timestamp: number;
  /** Active text. */
  line: string;
}

/** Lyric notification callback.
 * @param line Active text.
 * @param timestampMs Source timestamp in milliseconds.
 */
export type LyricsCallback = (line: string, timestampMs: number) => void;

/** Read-only timestamp/text view, compatible with v7 lyric-map inspection. */
export type LyricsData = ReadonlyMap<number, string>;

/** Sorted, demand-driven synchronized lyrics using Remedia's media timeline. */
export class SyncedLyricsProvider {
  private lines: LyricsAt[] = [];
  private cursor = -1;
  private lastPosition = -1;
  private lastIndex = -1;
  private track: Track | null = null;
  private expectedTrackId: string | undefined;
  private listeners = new Set<LyricsCallback>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private paused = false;
  private legacyCallback: LyricsCallback | undefined;
  private legacyUnsubscribe: (() => void) | undefined;
  private unsubscribeCallback: (() => void) | undefined;
  private awaitingStart = false;

  /** Bind lifecycle listeners to the queue lifetime.
   * @param queue Timeline and Track owner.
   */
  constructor(public readonly queue: GuildQueue) {
    queue.signal.addEventListener(
      'abort',
      () => {
        this.clear();
        this.unsubscribe();
        this.legacyCallback = undefined;
      },
      { once: true },
    );
  }

  /** Consume queue lifecycle without adding Player-wide listeners per queue.
   * @internal
   * @param event Queue event name.
   * @param track Canonical event Track when available.
   */
  handleEvent(event: string, track: Track | null): void {
    if (event === 'playerStart') {
      if (
        !this.awaitingStart ||
        (this.track && this.track !== track) ||
        (this.expectedTrackId && this.expectedTrackId !== track?.id)
      )
        this.clear();
      this.track = track;
      this.awaitingStart = false;
      this.update();
    } else if (event === 'playerFinish' || event === 'playerStop' || event === 'playerSkip') {
      if (track === this.track) this.clear();
    } else if (event === 'playerSeek') {
      this.cursor = -1;
      this.lastPosition = -1;
      this.update();
    } else if (['playerPause', 'playerResume', 'playerSeek', 'audioFiltersUpdate'].includes(event)) this.update();
  }

  /** Load lyrics once, without requesting a remote service.
   * @param lyrics LRC, normalized synchronized lines, or a plugin result.
   */
  load(lyrics: string | readonly LyricsLine[] | LyricsResult): void {
    this.queue.signal.throwIfAborted();
    if (
      typeof lyrics !== 'string' &&
      'synced' in lyrics &&
      lyrics.trackId &&
      this.queue.currentTrack &&
      lyrics.trackId !== this.queue.currentTrack.id
    )
      throw new Error('Lyrics belong to a different Track than the queue is playing.');
    const input =
      typeof lyrics === 'string'
        ? parseLyrics(lyrics)
        : 'synced' in lyrics
          ? lyrics.synced.available
            ? lyrics.synced.lines
            : []
          : lyrics;
    const normalized = new Map<number, string>();
    for (const line of input) {
      if (!Number.isFinite(line.timestampMs) || line.timestampMs < 0)
        throw new RangeError('Lyric timestamps must be finite non-negative milliseconds.');
      normalized.set(line.timestampMs, line.line);
    }
    this.clear();
    this.lines = [...normalized].sort(([a], [b]) => a - b).map(([timestamp, line]) => ({ timestamp, line }));
    this.track = this.queue.currentTrack;
    this.expectedTrackId = typeof lyrics !== 'string' && 'synced' in lyrics ? lyrics.trackId : undefined;
    this.awaitingStart = !this.queue.node.isPlaying() && !this.queue.node.isPaused();
    this.update();
  }

  /** Detached timestamp/text snapshot; mutations cannot corrupt timeline indexing. */
  public get lyrics(): LyricsData {
    return new Map(this.lines.map((line) => [line.timestamp, line.line]));
  }

  /** Find the active line by binary search; before the first timestamp returns null.
   * Unlike v7's closest-line heuristic, a line remains active until the next line.
   * @param positionMs Source timeline position in milliseconds.
   * @returns Active line and timestamp, or null.
   */
  at(positionMs: number): LyricsAt | null {
    if (!Number.isFinite(positionMs)) return null;
    const index = this.index(positionMs);
    const line = this.lines[index];
    return line ? { ...line } : null;
  }

  /** Register a v7-style callback for subscribe() without arguments.
   * @param callback Text and source-timestamp callback.
   */
  onChange(callback: LyricsCallback): void {
    this.legacyCallback = callback;
  }

  /** Register notification when unsubscribe() releases all subscriptions.
   * @param callback Cleanup notification.
   */
  onUnsubscribe(callback: () => void): void {
    this.unsubscribeCallback = callback;
  }

  /** Subscribe to changes; each returned removal function owns only its subscription.
   * @param callback Optional callback; omitted uses onChange().
   * @returns Idempotent unsubscribe function.
   */
  subscribe(callback?: LyricsCallback): () => void {
    this.queue.signal.throwIfAborted();
    const listener = callback ?? this.legacyCallback;
    if (!listener) return () => {};
    const owned: LyricsCallback = (line, timestamp) => (callback ?? this.legacyCallback)?.(line, timestamp);
    this.listeners.add(owned);
    let removed = false;
    const unsubscribe = () => {
      if (removed) return;
      removed = true;
      this.listeners.delete(owned);
      if (!this.listeners.size) {
        this.cancelTimer();
        const onUnsubscribe = this.unsubscribeCallback;
        this.unsubscribeCallback = undefined;
        onUnsubscribe?.();
      }
    };
    if (!callback) {
      this.legacyUnsubscribe?.();
      this.legacyUnsubscribe = unsubscribe;
    }
    const current = this.at(this.queue.node.session?.position.mediaMs ?? -1);
    const previousIndex = this.lastIndex;
    this.update();
    if (current && previousIndex === this.lastIndex) owned(current.line, current.timestamp);
    return unsubscribe;
  }

  /** Whether at least one subscriber is registered. */
  isSubscribed(): boolean {
    return this.listeners.size > 0;
  }

  /** Remove all subscribers and cancel scheduled work. */
  unsubscribe(): void {
    this.cancelTimer();
    this.listeners.clear();
    this.legacyUnsubscribe = undefined;
    const callback = this.unsubscribeCallback;
    this.unsubscribeCallback = undefined;
    callback?.();
  }

  /** Suspend scheduled notifications without losing subscribers. */
  pause(): boolean {
    const changed = !this.paused;
    this.paused = true;
    this.cancelTimer();
    return changed;
  }

  /** Resume demand-driven timeline scheduling. */
  resume(): boolean {
    const changed = this.paused;
    this.paused = false;
    this.update();
    return changed;
  }

  private index(position: number): number {
    let low = 0;
    let high = this.lines.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.lines[middle]!.timestamp <= position) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  }

  private clear(): void {
    this.cancelTimer();
    this.lines = [];
    this.cursor = -1;
    this.lastIndex = -1;
    this.lastPosition = -1;
    this.track = null;
    this.expectedTrackId = undefined;
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private update(): void {
    this.cancelTimer();
    const session = this.queue.node.session;
    if (this.queue.signal.aborted || this.paused || !this.listeners.size || !session || !this.lines.length) return;
    if (this.track && this.queue.currentTrack !== this.track) {
      this.clear();
      return;
    }
    const position = session.position.mediaMs;
    if (position === null || !Number.isFinite(position)) {
      if (session.state === 'playing') {
        this.timer = setTimeout(() => this.update(), 1000);
        this.timer.unref();
      }
      return;
    }
    if (position < this.lastPosition || this.cursor < 0) this.cursor = this.index(position);
    else if (this.lines[this.cursor + 2] && this.lines[this.cursor + 2]!.timestamp <= position)
      this.cursor = this.index(position);
    else if (this.lines[this.cursor + 1] && this.lines[this.cursor + 1]!.timestamp <= position) this.cursor++;
    this.lastPosition = position;
    const line = this.lines[this.cursor];
    if (!line) this.lastIndex = -1;
    if (line && this.cursor !== this.lastIndex) {
      this.lastIndex = this.cursor;
      for (const listener of this.listeners) {
        try {
          listener(line.line, line.timestamp);
        } catch (error) {
          this.queue.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
    if (session.state !== 'playing' || !this.listeners.size || this.queue.signal.aborted || this.paused) return;
    const next = this.lines[this.cursor + 1];
    if (!next) return;
    // Native snapshots have no progress notification. Recheck the native clock at the
    // next transition, bounded to one second (250ms with an opaque filtergraph).
    let rate = 1;
    const graph = session.filters.graph ?? '';
    for (const match of graph.matchAll(/atempo=(\d+(?:\.\d+)?)/g)) rate *= Number(match[1]);
    for (const match of graph.matchAll(/asetrate=\d+\*(\d+(?:\.\d+)?)/g)) rate *= Number(match[1]);
    this.timer = setTimeout(
      () => this.update(),
      Math.max(1, Math.min(graph ? 250 : 1000, (next.timestamp - position) / rate)),
    );
    this.timer.unref();
  }
}
