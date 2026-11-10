import { Readable } from 'node:stream';
import { it, expect, vi } from 'vitest';
import {
  DiscordPlayer,
  Track,
  definePlugin,
  PluginError,
  deserialize,
  type SourceOperationMap as Operations,
} from '../src/index.js';

it('owns independent lifecycle, options, subscriptions and cleanup on each Player', async () => {
  const cleanup = vi.fn();
  const destroy = vi.fn();
  const source = definePlugin<{ prefix: string }>({
    id: 'org.example.source',
    kind: 'source',

    async setup(ctx) {
      let calls = 0;

      ctx.onCleanup(cleanup);
      ctx.on('search.query.match', () => ({ score: 100 }));

      ctx.on('search.query.resolve', ({ query }) => ({
        playlist: null,
        tracks: [new Track({ title: `${ctx.options.prefix}${query}:${++calls}`, url: 'https://example.test/a' })],
      }));

      ctx.on('track.stream', ({ track }) => track.url);
    },

    destroy,
  });
  const a = new DiscordPlayer({ nodes: [], send() {}, plugins: [source({ prefix: 'a' })] });
  const b = new DiscordPlayer({ nodes: [], send() {}, plugins: [source({ prefix: 'b' })] });
  const track = (await a.search('query')).tracks[0]!;

  expect(track.title).toBe('aquery:1');
  expect((await b.search('query')).tracks[0]!.title).toBe('bquery:1');
  expect(await a.plugins.resolveStream(deserialize(track.serialize()) as Track)).toEqual({ url: track.url });

  await a.plugins.unregister('org.example.source');

  expect((await a.search('query')).isEmpty()).toBe(true);

  await Promise.all([a.destroy(), b.destroy()]);

  expect(cleanup).toHaveBeenCalledTimes(2);
  expect(destroy).toHaveBeenCalledTimes(2);
});

it('rejects remote streams and buffers while accepting URLs and server files', async () => {
  const host = new DiscordPlayer({ nodes: [], send() {} }).plugins;
  let source: Operations['track.stream']['output'] = Readable.from(['encoded']);

  await host.register(
    definePlugin({
      id: 'raw',
      kind: 'source',

      setup(ctx) {
        ctx.on('track.stream', () => source);
      },
    })(),
  );

  await expect(host.resolveStream(new Track(), { remote: true })).rejects.toBeInstanceOf(PluginError);
  source = { buffer: Buffer.from('audio') };
  await expect(host.resolveStream(new Track(), { remote: true })).rejects.toThrow('server-accessible');
  source = '/server/audio.mp3';

  expect(await host.resolveStream(new Track(), { remote: true })).toEqual({ file: source });

  source = Readable.from(['encoded']);

  expect(await host.resolveStream(new Track())).toEqual({ stream: source });
});
