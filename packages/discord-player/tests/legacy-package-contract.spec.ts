import { afterEach, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import type * as PlayerAPI from '../src/index.js';
import type * as HostAPI from '@discord-player/plugin-host';
import type { ExtractorSearchContext, ExtractorStreamable } from '../src/index.js';

const require = createRequire(import.meta.url);

// Exercise Node's built-package loading path without mixing transformed source models.
const { BaseExtractor, Track, Playlist } = require('../dist/index.js') as typeof PlayerAPI;
const { createSourcePluginHost, SOURCE_PLUGIN_ID, deserializeSourceResult, serializeSourceTrack } =
  require('../../plugin-host/dist/index.js') as typeof HostAPI;
const hosts: ReturnType<typeof createSourcePluginHost>[] = [];

class MockExtractor extends BaseExtractor<{ createStream?: () => Promise<ExtractorStreamable> }> {
  static override identifier = 'org.example.mock';

  lookup = vi.fn(async (query: string) => ({ title: 'fixture', url: query }));

  override async validate(_query: string, type?: string | null) {
    return type === 'fixtureTrack';
  }

  override async handle(query: string, context: ExtractorSearchContext) {
    const info = await this.lookup(query);
    const track = new Track(this.context.player, {
      ...info,
      queryType: context.type ?? undefined,
      engine: { privateFixture: true },
    });

    track.extractor = this;

    return this.createResponse(null, [track]);
  }

  override async getRelatedTracks(track: InstanceType<typeof Track>) {
    return this.handle(track.url, { type: track.queryType });
  }

  override async stream(): Promise<ExtractorStreamable | undefined> {
    return this.options.createStream?.();
  }
}

class MockBridgeExtractor extends BaseExtractor {
  static override identifier = 'org.example.mock.bridge';

  override async bridge() {
    return 'https://cdn.example.test/bridge.mp3';
  }
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((h) => h.close()));
});

function host() {
  const h = createSourcePluginHost({ name: 'Fixture', hostId: 'fixture', publicUrl: 'https://host.test' });

  hosts.push(h);

  return h;
}

async function remote(h: ReturnType<typeof host>, operation: string, input: unknown) {
  const response = await h.fetch(
    new Request('https://host.test/remedia/v1/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation, input }),
    }),
  );

  expect(response.status).toBe(200);

  return (await response.json()).result;
}

it('uses canonical models for host search, related metadata, URL streaming and restart reconstruction', async () => {
  expect(MockExtractor.prototype).toBeInstanceOf(BaseExtractor);

  const h = host();
  const extractor = await h.extractors.register(MockExtractor, {
    createStream: async () => 'https://cdn.example.test/song.mp3',
  });
  const url = 'https://provider.example.test/song';

  expect(await extractor.validate(url, 'fixtureTrack')).toBe(true);
  expect(await extractor.validate(url, 'otherTrack')).toBe(false);

  const result = await remote(h, 'metadata.execute', {
    providerId: extractor.identifier,
    operation: 'search.query.resolve',
    input: { query: url, providerHint: 'fixtureTrack' },
  });
  const track = deserializeSourceResult(result).tracks[0]!;

  expect(track).toBeInstanceOf(Track);
  expect(track.sourceReference?.data).toMatchObject({ queryType: 'fixtureTrack' });
  expect(track.sourceState).toBeDefined();
  expect(track.serialize()).not.toHaveProperty('sourceState');

  const local = await h.runtime.search(url, { searchEngine: 'fixtureTrack' });

  expect(await h.plugins.resolveStream(local.tracks[0]!)).toEqual({ url: 'https://cdn.example.test/song.mp3' });

  const related = await remote(h, 'source.related', { track: serializeSourceTrack(track) });

  expect(related.tracks).toHaveLength(1);

  const restarted = host();
  const next = await restarted.extractors.register(MockExtractor);
  const handle = vi.spyOn(next, 'handle');

  expect((await remote(restarted, 'source.related', { track: track.serialize() })).tracks).toHaveLength(1);
  expect(next.lookup).toHaveBeenCalledWith(url);
  expect(handle).toHaveBeenCalledWith(url, expect.objectContaining({ type: 'fixtureTrack' }));
});

it('adapts bridging, encoded Readables, playlists and extractor reconfiguration', async () => {
  const h = host();
  const extractor = await h.extractors.register(MockExtractor);
  const bridge = await h.extractors.register(MockBridgeExtractor);
  const bridgeSpy = vi.spyOn(bridge, 'bridge');
  const { tracks } = await h.runtime.search('fixture', { searchEngine: 'fixtureTrack' });

  expect(tracks[0]).toBeInstanceOf(Track);
  expect(await h.plugins.resolveStream(tracks[0]!)).toEqual({ url: 'https://cdn.example.test/bridge.mp3' });
  expect(bridgeSpy).toHaveBeenCalledWith(tracks[0], extractor);
  expect(new Playlist(h.runtime, { tracks }).tracks[0]).toBe(tracks[0]);

  await extractor.reconfigure({ createStream: async () => Readable.from([Buffer.from('encoded')]) });

  const replacement = h.extractors.get(extractor.identifier);

  expect(replacement).not.toBe(extractor);

  const result = await h.runtime.search('fixture', { searchEngine: 'fixtureTrack' });
  const source = await h.plugins.resolveStream(result.tracks[0]!);

  if (!('stream' in source)) throw new Error('Expected encoded fixture stream');

  const chunks: Buffer[] = [];

  for await (const chunk of source.stream) chunks.push(Buffer.from(chunk));

  expect(Buffer.concat(chunks).toString()).toBe('encoded');

  await replacement!.reconfigure({ createStream: async () => 'https://cdn.example.test/reconfigured.mp3' });

  const reconfigured = await h.runtime.search('fixture', { searchEngine: 'fixtureTrack' });

  expect(await h.plugins.resolveStream(reconfigured.tracks[0]!)).toEqual({
    url: 'https://cdn.example.test/reconfigured.mp3',
  });
});
