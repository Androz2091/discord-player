import { Track, definePlugin } from 'discord-player';

/** Source plugin for direct HTTP media URLs opened by Remedia. */
export const rawHTTPSource = definePlugin({
  id: 'org.example.raw-http',
  kind: 'source',
  setup(ctx) {
    ctx.on('search.query.match', ({ query }) => (/^https?:\/\//i.test(query) ? { score: 100 } : null));
    ctx.on('search.query.resolve', ({ query }) => ({ playlist: null, tracks: [new UrlTrack(query)] }));

    ctx.on('track.stream', ({ track }, { signal }) => {
      signal.throwIfAborted();

      return { url: track.url };
    });
  },
});

/** Data-only example Track for direct HTTP media URLs. */
export class UrlTrack extends Track {
  /**
   * Wrap a direct media URL in the public Track model.
   * @param input HTTP or HTTPS URL that Remedia can open.
   * @param requesterId Discord user who requested the Track.
   */
  public constructor(input: string, requesterId?: string) {
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
      sourceReference: { pluginId: 'org.example.raw-http', data: { url: url.href } },
    });
  }
}
