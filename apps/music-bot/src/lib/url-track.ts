import { Track } from 'discord-player';

/** Example source adapter for direct HTTP media URLs while source plugins are deferred. */
export class UrlTrack extends Track {
  /**
   * Wrap a direct media URL in the public Track model.
   * @param input HTTP or HTTPS URL that Remedia can open.
   * @param requesterId Discord user who requested the Track.
   */
  public constructor(input: string, requesterId: string) {
    const url = new URL(input.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new TypeError('Only HTTP and HTTPS media URLs are supported.');
    }
    super({
      title: url.pathname.split('/').filter(Boolean).at(-1) || url.hostname,
      author: url.hostname,
      url: url.href,
      requestedBy: requesterId,
      source: 'arbitrary',
    });
  }

  /**
   * Return the URL as a resolved media source for queue-managed playback.
   * @param options Cancellation signal supplied by the queue.
   * @returns The URL that Remedia should open.
   */
  public override async getStreamableSource(options?: { signal?: AbortSignal }): Promise<{ url: string }> {
    options?.signal?.throwIfAborted();
    return { url: this.url };
  }
}
