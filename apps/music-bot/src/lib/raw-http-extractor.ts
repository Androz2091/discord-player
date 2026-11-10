import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Track, definePlugin } from 'discord-player';
import { resolveMusicFile, searchMusicFiles } from './music-files.ts';

function parseHTTPURL(query: string): URL | null {
  try {
    const url = new URL(query.trim());

    if (process.env.DISALLOWED_HOSTNAME && url.hostname.includes(process.env.DISALLOWED_HOSTNAME)) {
      return null;
    }

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function hasProtocol(query: string): boolean {
  return /^[a-z][\w+.-]*:\/\//i.test(query.trim());
}

/** Source extractor for direct HTTP media and files beneath MUSIC_DIRECTORY. */
export const rawHTTPExtractor = definePlugin({
  id: 'org.example.raw-http',
  kind: 'source',

  setup(ctx) {
    ctx.on('search.query.match', ({ query }, { signal }) => {
      signal.throwIfAborted();

      if (parseHTTPURL(query)) {
        return { score: 100 };
      }

      return hasProtocol(query) ? null : { score: 10 };
    });

    ctx.on('search.query.resolve', async ({ query, options }, { signal }) => {
      signal.throwIfAborted();

      const url = parseHTTPURL(query);

      if (url) {
        const metadata = await ctx.player
          .getRemedia(false)
          ?.probe(
            {
              url: url.toString(),
            },
            { signal },
          )
          .catch(() => null);

        return {
          playlist: null,
          tracks: [
            new Track({
              title:
                metadata?.metadata?.title ||
                metadata?.metadata?.album ||
                url.pathname.split('/').filter(Boolean).at(-1) ||
                url.hostname,
              author: metadata?.metadata?.artist || metadata?.metadata?.albumArtist || url.hostname,
              url: url.href,
              durationMS: metadata?.durationMs ?? undefined,
              requestedBy: options?.requestedBy,
              source: 'arbitrary',
              metadata,
            }),
          ],
        };
      }

      if (hasProtocol(query)) {
        return { playlist: null, tracks: [] };
      }

      const files = await searchMusicFiles(query, signal);

      signal.throwIfAborted();

      const tracksWithMetadata = await Promise.all(
        files.map(async (file) => {
          const metadata = await ctx.player
            .getRemedia(false)
            ?.probe(
              {
                file: pathToFileURL(file.path).href,
              },
              { signal },
            )
            .catch(() => null);

          return new Track({
            title: metadata?.metadata?.title || metadata?.metadata?.album || basename(file.path),
            author: metadata?.metadata?.artist || metadata?.metadata?.albumArtist || 'Local library',
            url: pathToFileURL(file.path).href,
            requestedBy: options?.requestedBy,
            source: 'arbitrary',
            sourceReference: {
              pluginId: 'org.example.raw-http',
              data: { file: file.relativePath },
            },
            durationMS: metadata?.durationMs ?? undefined,
            metadata,
          });
        }),
      );

      return {
        playlist: null,
        tracks: tracksWithMetadata,
      };
    });

    ctx.on('track.stream', async ({ track }, { signal }) => {
      signal.throwIfAborted();

      const data = track.sourceReference?.data;

      if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.file === 'string') {
        const file = await resolveMusicFile(data.file, signal);

        signal.throwIfAborted();

        if (!file) {
          throw new Error('The local music file is unavailable in MUSIC_DIRECTORY.');
        }

        return { file };
      }

      const url = parseHTTPURL(track.url);

      return url ? { url: url.href } : undefined;
    });
  },
});
