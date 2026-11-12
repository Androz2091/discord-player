import { definePlugin, Track } from 'discord-player';

/**
 * Checks that `query` is an http(s) link to one of the allowed hosts.
 *
 * @param {string} query Text entered by the user.
 * @param {readonly string[]} allowedHosts Lowercase hostnames that are allowed.
 * @returns {{ url: URL } | { error: string }} The parsed URL, or the reason it was rejected.
 */
export function checkMediaUrl(query, allowedHosts) {
  let url;

  try {
    url = new URL(query.trim());
  } catch {
    return { error: 'Provide a direct http(s) link to an audio file.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Only http(s) links are supported.' };
  }

  if (url.username || url.password) {
    return { error: 'Links that contain credentials are not supported.' };
  }

  if (!allowedHosts.includes(url.hostname)) {
    return { error: `"${url.hostname}" is not in ALLOWED_MEDIA_HOSTS.` };
  }

  return { url };
}

/**
 * Plays direct links to audio files hosted on an allowed host.
 *
 * The host list is the only protection against unwanted requests. Remedia follows redirects, so only list hosts you
 * trust not to redirect elsewhere.
 *
 * Options: `{ allowedHosts: string[] }`, the hostnames that audio may be loaded from.
 */
export const mediaSource = definePlugin({
  id: 'music-bot.media-source',

  setup(ctx) {
    const { allowedHosts } = ctx.options;

    // Claim only links that pass the host check.
    ctx.on('search.query.match', ({ query }) => ('url' in checkMediaUrl(query, allowedHosts) ? { score: 100 } : null));

    // Read the file's tags so the queue shows a real title and duration. Unreadable media rejects the search.
    ctx.on('search.query.resolve', async ({ query, options }, { signal }) => {
      const checked = checkMediaUrl(query, allowedHosts);

      if ('error' in checked) throw new Error(checked.error);

      const info = await ctx.player.getRemedia().probe({ url: checked.url.href }, { signal });

      return {
        playlist: null,
        tracks: [
          new Track({
            title: info.metadata.title || checked.url.pathname.split('/').pop() || checked.url.hostname,
            author: info.metadata.artist || checked.url.hostname,
            url: checked.url.href,
            durationMS: info.durationMs ?? undefined,
            requestedBy: options?.requestedBy,
          }),
        ],
      };
    });

    // Check the host again: a stored track must not be able to point the engine at a host that is no longer allowed.
    ctx.on('track.stream', ({ track }, { signal }) => {
      signal.throwIfAborted();

      const checked = checkMediaUrl(track.url, allowedHosts);

      if ('error' in checked) throw new Error(checked.error);

      return { url: checked.url.href };
    });
  },
});
