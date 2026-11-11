import { afterEach, expect, it, vi } from 'vitest';
import {
  BaseExtractor,
  DiscordPlayer,
  Track,
  definePlugin,
  deserialize,
  parseLyrics,
  type LyricsResult,
} from '../src/index.js';
import { createSourcePluginHost } from '@discord-player/plugin-host';
import { setup, TestTrack } from './mocks/queue.js';

const players: DiscordPlayer[] = [];
function player() {
  const p = new DiscordPlayer({ nodes: [], send() {} });
  players.push(p);
  return p;
}
afterEach(async () => {
  await Promise.all(players.splice(0).map((p) => p.destroy()));
});
const plain = (text: string): LyricsResult => ({ plain: { available: true, text }, synced: { available: false } });

it('supports optional lyrics-only registrations, string input, deterministic priority and content deduplication', async () => {
  const p = player();
  expect(await p.lyrics.search('query')).toEqual([]);
  for (const [id, priority, text] of [
    ['first', 1, 'one'],
    ['priority', 10, 'two'],
    ['duplicate', 0, 'one'],
  ] as const) {
    await p.plugins.register(
      definePlugin({
        id,
        priority,
        setup(ctx) {
          ctx.on('lyrics.search', ({ input }) => {
            expect(input).toBe('query');
            return [plain(text)];
          });
        },
      })(),
    );
  }
  const results = await p.lyrics.search('query');
  expect(results.map((result) => result.provider?.pluginId)).toEqual(['priority', 'first']);
  expect(results.map((result) => result.plain)).toEqual([
    { available: true, text: 'two' },
    { available: true, text: 'one' },
  ]);
  expect((await p.search('query')).isEmpty()).toBe(true);
});

it('prefers restored lyrics affinity, then source capability, then other providers', async () => {
  const p = player();
  const calls: string[] = [];
  for (const id of ['fallback', 'source', 'associated']) {
    await p.plugins.register(
      definePlugin({
        id,
        setup(ctx) {
          ctx.on('lyrics.search', ({ input }) => {
            expect(input).toBeInstanceOf(Track);
            calls.push(id);
            return [plain(id)];
          });
        },
      })(),
    );
  }
  const original = new Track({
    title: 'title',
    sourceReference: { pluginId: 'source', data: null },
    lyricsReference: { pluginId: 'associated', data: { key: 'public' } },
  });
  const track = deserialize(original.serialize()) as Track;
  expect(track.lyricsReference).toEqual(original.lyricsReference);
  await p.lyrics.search(track);
  expect(calls).toEqual(['associated', 'source', 'fallback']);
});

it('adapts optional legacy lyrics, normalizes synchronized-only output, and propagates execution failures', async () => {
  const p = player();
  class LyricsExtractor extends BaseExtractor {
    static override identifier = 'legacy.lyrics';
    override async resolveLyrics(input: Track | string) {
      expect(input).toBe('query');
      return {
        plain: { available: false as const },
        synced: { available: true as const, lines: parseLyrics('[00:02.50]two\n[00:01.005]one') },
      };
    }
  }
  await p.extractors.register(LyricsExtractor);
  expect(p.plugins.describe().find((provider) => provider.id === LyricsExtractor.identifier)?.operations).toEqual([
    'lyrics.search',
  ]);
  expect((await p.search('query')).isEmpty()).toBe(true);
  expect((await p.lyrics.search('query'))[0]?.synced).toEqual({
    available: true,
    lines: [
      { timestampMs: 1005, line: 'one' },
      { timestampMs: 2500, line: 'two' },
    ],
  });
  await p.plugins.register(
    definePlugin({
      id: 'failing',
      priority: 100,
      setup(ctx) {
        ctx.on('lyrics.search', () => {
          throw new Error('service unavailable');
        });
      },
    })(),
  );
  await expect(p.lyrics.search('query')).rejects.toThrow('service unavailable');
  await expect(p.lyrics.search('query', { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
});

it('uses exact plugin IDs, legacy ext targeting, generic hints and custom protocols through one dispatcher', async () => {
  const p = player();
  const calls: { query: string; hint?: string; protocol?: string }[] = [];
  await p.plugins.register(
    definePlugin({
      id: 'source',
      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 1 }));
        ctx.on(
          'search.query.resolve',
          ({ query, protocol, providerHint }) => {
            calls.push({ query, protocol, hint: providerHint });
            return { tracks: [new Track({ title: query })], playlist: null };
          },
          { protocols: ['custom'] },
        );
      },
    })(),
  );
  await p.search('custom:resource');
  expect(calls.at(-1)).toEqual({ query: 'resource', protocol: 'custom', hint: undefined });
  await p.search('custom:resource', { resolveCustomProtocols: false });
  expect(calls.at(-1)?.query).toBe('custom:resource');
  await p.search('query', { searchEngine: 'generic-provider' });
  expect(calls.at(-1)?.hint).toBe('generic-provider');
  await p.search('query', { searchEngine: 'source' });
  expect(calls.at(-1)?.hint).toBeUndefined();
  for (const query of ['https://example.test/a:b', 'file:/path', 'C:\\path', 'unknown:resource']) {
    await p.search(query);
    expect(calls.at(-1)?.query).toBe(query);
  }
  await expect(p.search('query', { searchEngine: 'ext:missing' })).rejects.toThrow('not registered');
  class Legacy extends BaseExtractor {
    static override identifier = 'legacy';
    override protocols = ['legacy'];
    override async handle(query: string, context: { protocol?: string }) {
      return this.createResponse(null, [new Track({ title: `${context.protocol}:${query}` })]);
    }
  }
  await p.extractors.register(Legacy);
  expect((await p.search('legacy:value')).tracks[0]?.title).toBe('legacy:value');
  expect((await p.search('query', { searchEngine: 'ext:legacy' })).tracks[0]?.title).toBe('undefined:query');
});

it('honors explicit targets over a competing protocol and applies search options directly to play', async () => {
  const { player: p, queue } = await setup();
  players.push(p);
  const resolve = vi.fn(({ query }: { query: string }) => ({ tracks: [new TestTrack(query)], playlist: null }));
  await p.plugins.register(
    definePlugin({
      id: 'target',
      setup(ctx) {
        ctx.on('search.query.resolve', resolve);
      },
    })(),
  );
  await p.plugins.register(
    definePlugin({
      id: 'protocol',
      priority: 100,
      setup(ctx) {
        ctx.on(
          'search.query.resolve',
          () => {
            throw new Error('wrong provider');
          },
          { protocols: ['owned'] },
        );
      },
    })(),
  );
  const result = await p.play({ guildId: queue.id, channelId: 'voice-one' }, 'owned:value', {
    searchEngine: 'target',
    resolveCustomProtocols: true,
  });
  expect(resolve.mock.lastCall?.[0].query).toBe('owned:value');
  expect(result.track?.title).toBe('owned:value');
});

it('registers metadata-only remote plugins, validates capabilities, and preserves search/lyrics host affinity', async () => {
  const host = createSourcePluginHost({ name: 'fixture', hostId: 'deployment', publicUrl: 'http://source.test' });
  await host.plugins.register(
    definePlugin({
      id: 'remote',
      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 1 }));
        ctx.on(
          'search.query.resolve',
          ({ query, protocol }) => ({
            tracks: [
              new Track({
                title: `${protocol}:${query}`,
                lyricsReference: { pluginId: 'remote', hostId: 'deployment', data: null },
              }),
            ],
            playlist: null,
          }),
          { protocols: ['custom'] },
        );
        ctx.on('lyrics.search', () => [plain('remote text')]);
      },
    })(),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((input, init) => host.fetch(new Request(String(input), init))),
  );
  const p = player();
  try {
    await p.plugins.register(
      definePlugin({ id: 'remote', remoteHost: { hostId: 'deployment', url: 'http://source.test' } })(),
    );
    const track = (await p.search('custom:resource')).tracks[0]!;
    expect(track.title).toBe('custom:resource');
    expect(track.sourceReference).toMatchObject({ pluginId: 'remote', hostId: 'deployment' });
    const lyrics = await p.lyrics.search(deserialize(track.serialize()) as Track);
    expect(lyrics[0]?.provider).toMatchObject({ pluginId: 'remote', hostId: 'deployment' });
    await expect(
      p.plugins.register(
        definePlugin({ id: 'absent', remoteHost: { hostId: 'deployment', url: 'http://source.test' } })(),
      ),
    ).rejects.toThrow('not advertised');
    const response = await host.fetch(new Request('http://source.test/.well-known/remedia'));
    const manifest = await response.json();
    expect(manifest.providers[0].operations).toContain('lyrics.search');
    expect(manifest.plugins[0].operations).not.toContain('source.stream');
  } finally {
    await host.close();
  }
});

it('bulk-registers a lyrics-only host and sends foreign Track metadata without leaking runtime source state', async () => {
  const host = createSourcePluginHost({
    name: 'lyrics fixture',
    hostId: 'lyrics-deployment',
    publicUrl: 'http://lyrics.test',
  });
  const received: (Track | string)[] = [];
  await host.plugins.register(
    definePlugin({
      id: 'remote.lyrics',
      setup(ctx) {
        ctx.on('lyrics.search', ({ input }) => {
          received.push(input);
          return [plain('text')];
        });
      },
    })(),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((input, init) => host.fetch(new Request(String(input), init))),
  );
  const p = player();
  try {
    await p.plugins.registerHost({ hostId: 'lyrics-deployment', url: 'http://lyrics.test' });
    const track = new Track({
      title: 'foreign',
      sourceReference: { pluginId: 'source', hostId: 'source-deployment', data: null },
      lyricsReference: { pluginId: 'remote.lyrics', hostId: 'lyrics-deployment', data: null },
    });
    track.sourceState = 'private-runtime-state';
    expect((await p.lyrics.search(track))[0]?.plain).toEqual({ available: true, text: 'text' });
    expect(received[0]).toBeInstanceOf(Track);
    expect((received[0] as Track).sourceState).toBeUndefined();
    expect((received[0] as Track).title).toBe('foreign');
    const manifest = await (await host.fetch(new Request('http://lyrics.test/.well-known/remedia'))).json();
    expect(manifest.plugins[0].operations).toEqual(['metadata.execute']);
    await p.plugins.unregister('remote.lyrics', 'lyrics-deployment');
    expect(await p.lyrics.search(track)).toEqual([]);
  } finally {
    await host.close();
  }
});
