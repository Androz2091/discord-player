import type { DiscordPlayer } from '../player.js';
import { TrackSkipReason, type GuildQueue } from '../structures/guild-queue.js';
import { Stack } from '../structures/common/stack.js';
import type { Track } from '../structures/track.js';
import { NoResultError } from '../errors.js';

/** Previous-track history and navigation for a GuildQueue. */
export class GuildQueueHistoryManager<Metadata = unknown> {
  /** Player instance that owns this history manager. */
  public readonly player: DiscordPlayer;
  /** Tracks ordered from oldest to newest, with the most recent track at the top. */
  public readonly tracks: Stack<Track>;

  /**
   * Create a history manager for a queue.
   * @param queue Queue whose managed playback history is stored here.
   */
  public constructor(
    /** Queue whose managed playback history is stored here. */
    public readonly queue: GuildQueue<Metadata>,
  ) {
    this.player = queue.manager.player;
    this.tracks = new Stack(queue.maxHistorySize);
  }

  /** Current managed Track, including a paused Track. */
  public get currentTrack(): Track | null {
    return this.queue.currentTrack;
  }
  /** The next upcoming track, if any. */
  public get nextTrack(): Track | null {
    return this.queue.tracks.peek() ?? null;
  }
  /** Most recently completed or skipped track, if history is enabled. */
  public get previousTrack(): Track | null {
    return this.tracks.peek() ?? null;
  }
  /** Whether history collection is disabled for this queue. */
  public get disabled(): boolean {
    return this.queue.options.disableHistory ?? false;
  }
  /** Number of retained previous tracks. */
  public get size(): number {
    return this.tracks.size;
  }

  /**
   * Push one or more completed Tracks into history, respecting the configured retention limit.
   * @param track Completed or skipped Track, or a batch of Tracks in oldest-to-newest order.
   * @returns Whether history collection accepted the Tracks.
   */
  public push(track: Track | Track[]): boolean {
    if (this.disabled) return false;
    this.tracks.add(track);
    this.resize();
    return true;
  }

  /** Clear retained history. */
  public clear(): void {
    this.tracks.clear();
  }
  /** Get the number of retained previous Tracks. */
  public getSize(): number {
    return this.size;
  }
  /** Whether there are no retained previous Tracks. */
  public isEmpty(): boolean {
    return this.tracks.isEmpty();
  }

  /**
   * Play the next upcoming Track, or reject when the queue has no next Track.
   * @returns A promise that resolves after the navigation request starts.
   */
  public async next(): Promise<void> {
    if (!this.nextTrack) throw new NoResultError('No next track in the queue.');
    if (this.queue.isPlaying())
      await this.queue.skip(TrackSkipReason.HistoryNext, 'Skipped by GuildQueueHistory.next().');
    else await this.queue.playNext();
  }

  /**
   * Play the previous Track and optionally put the current Track back at the queue head.
   * @param preserveCurrent Whether to put the current Track at the upcoming queue head.
   * @returns A promise that resolves after the navigation request starts.
   */
  public async previous(preserveCurrent = true): Promise<void> {
    const track = this.tracks.pop();
    if (!track) throw new NoResultError('No previous track in history.');
    try {
      await this.queue.playHistoryTrack(track, preserveCurrent);
    } catch (error) {
      this.tracks.push(track);
      throw error;
    }
  }

  /**
   * Alias for `previous()`.
   * @param preserveCurrent Whether to put the current Track at the upcoming queue head.
   */
  public back(preserveCurrent = true): Promise<void> {
    return this.previous(preserveCurrent);
  }

  /** Trim oldest history entries when the queue's history limit changes. */
  public resize(): void {
    this.tracks.setMaxSize(this.queue.maxHistorySize);
  }
}
