import { searchLyrics, type LyricsResult, type Track } from '@discord-player/plugin-host';
import type { DiscordPlayer } from './player.js';

export type { LyricsLine, LyricsResult, LyricsRequest } from '@discord-player/plugin-host';
export { parseLyrics } from '@discord-player/plugin-host';

/** Optional lyrics facade over the Player's shared capability registry. */
export class Lyrics {
  /** Create lyrics lookup for a Player.
   * @param player Registry and lifetime owner.
   */
  constructor(private readonly player: DiscordPlayer) {}

  /** Look up lyrics through registered providers; no handlers or matches returns an empty array.
   * @param input Canonical Track or free-form query.
   * @param options Optional caller cancellation combined with the Player lifetime.
   * @returns Normalized records; operational errors propagate.
   */
  async search(input: Track | string, options: { signal?: AbortSignal } = {}): Promise<LyricsResult[]> {
    await this.player.ready();
    return searchLyrics(
      this.player.plugins,
      input,
      options.signal ? AbortSignal.any([this.player.signal, options.signal]) : this.player.signal,
    );
  }
}
