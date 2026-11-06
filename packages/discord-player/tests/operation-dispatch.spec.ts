import { Readable } from 'node:stream';
import { it, expect } from 'vitest';
import { DiscordPlayer, Track, definePlugin, PluginRegistry } from '../src/index.js';
import { Legacy } from './mocks/legacy.js';

const player = () => new DiscordPlayer({ nodes: [], send() {} });

declare module '../src/plugins/types.js' {
  interface SourceOperationMap {
    'fixture.null': { input: number; output: null | false; policy: 'first' };
  }
}

it('supports every dispatch policy, stable priority, null/false and scoped removal', async () => {
  const host = new PluginRegistry();

  host.defineOperation('fixture.null', 'first');

  const seen: string[] = [];

  for (const [id, priority] of [
    ['a', 0],
    ['b', 5],
    ['c', 5],
  ] as const) {
    await host.register(
      definePlugin({
        id,
        kind: 'source',
        setup(ctx) {
          ctx.on('fixture.null', () => (id === 'b' ? false : null), { priority });

          ctx.on(
            'track.stream.resolved',
            () => {
              seen.push(id);
            },
            { priority },
          );

          ctx.on('search.query.match', () => ({ score: id === 'a' ? 1000 : 1 }), { priority });
          ctx.on('stream.transform', ({ track }) => ({ track, stream: Readable.from([id]) }), { priority });
        },
      })(),
    );
  }

  expect(await host.execute('fixture.null', 0)).toBe(false);
  expect(await host.execute('fixture.null', 0, { pluginId: 'a' })).toBeNull();

  const matches = await host.execute('search.query.match', { query: 'x' });

  expect(matches.map((match) => match?.pluginId)).toEqual(['b', 'c', 'a']);

  const track = new Track();

  await host.execute('track.stream.resolved', { track });
  expect(seen).toEqual(['b', 'c', 'a']);

  const transformed = await host.execute('stream.transform', { track, stream: Readable.from([]) });
  const chunks = [];

  for await (const chunk of transformed!.stream) {
    chunks.push(chunk);
  }

  expect(chunks).toEqual(['a']);
  await host.unregister('b');
  expect((await host.execute('search.query.match', { query: 'x' })).map((m) => m?.pluginId)).toEqual(['c', 'a']);
});

it('uses match confidence within a priority tier and preserves explicit targeting and protocol routing', async () => {
  const p = player();

  for (const [id, score] of [
    ['low', 1],
    ['high', 100],
  ] as const) {
    await p.plugins.register(
      definePlugin({
        id,
        kind: 'source',
        setup(ctx) {
          ctx.on('search.query.match', () => ({ score }));

          ctx.on('search.query.resolve', ({ query }) => ({
            playlist: null,
            tracks: [new Track({ title: id + ':' + query })],
          }));
        },
      })(),
    );
  }

  expect((await p.search('query')).tracks[0]!.title).toBe('high:query');
  expect((await p.search('query', { pluginId: 'low' })).tracks[0]!.title).toBe('low:query');
  expect((await p.search('unknown:query')).tracks[0]!.title).toBe('high:unknown:query');
  await p.extractors.register(Legacy, { prefix: 'legacy:' });

  class HigherPriority extends Legacy {
    static override identifier = 'org.example.unrelated';

    override priority = 100;

    override protocols = ['other'];
  }

  await p.extractors.register(HigherPriority, { prefix: 'other:' });
  expect((await p.search('raw://query')).tracks[0]!.title).toBe('legacy:query');
  expect((await p.search('query', { searchEngine: 'ext:low' })).tracks[0]!.title).toBe('low:query');
  await p.destroy();
});
