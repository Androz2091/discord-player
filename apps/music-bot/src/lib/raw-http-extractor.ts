import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Track, definePlugin } from 'discord-player';
import { resolveMusicFile, searchMusicFiles } from './music-files.ts';

function parseHTTPURL(query: string): URL | null {
  try {
    const url = new URL(query.trim());

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
        return {
          playlist: null,
          tracks: [
            new Track({
              title: url.pathname.split('/').filter(Boolean).at(-1) || url.hostname,
              author: url.hostname,
              url: url.href,
              requestedBy: options?.requestedBy,
              source: 'arbitrary',
            }),
          ],
        };
      }

      if (hasProtocol(query)) {
        return { playlist: null, tracks: [] };
      }

      const files = await searchMusicFiles(query, signal);
      signal.throwIfAborted();

      return {
        playlist: null,
        tracks: files.map(
          (file) =>
            new Track({
              title: basename(file.path),
              author: 'Local library',
              url: pathToFileURL(file.path).href,
              requestedBy: options?.requestedBy,
              source: 'arbitrary',
              sourceReference: { pluginId: 'org.example.raw-http', data: { file: file.relativePath } },
            }),
        ),
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
