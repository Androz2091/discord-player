import { Readable } from 'node:stream';
import { it, expect } from 'vitest';
import { BaseExtractor, DiscordPlayer, Track, definePlugin, type NextFunction } from '../src/index.js';
import { Legacy } from './mocks/legacy.js';

const player = () => new DiscordPlayer({ nodes: [], send() {} });

it('adapts legacy lifecycle, raw data, protocols, priority, blocking and reconfiguration', async () => {
  const p = player();

  await p.plugins.register(
    definePlugin({
      id: 'modern',
      kind: 'source',

      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 100 }));
        ctx.on('search.query.resolve', () => ({ tracks: [new Track({ title: 'modern' })], playlist: null }));
      },
    })(),
  );

  const legacy = await p.extractors.register(Legacy, { prefix: 'old:' });
  const track = (await p.search('raw:query')).tracks[0]!;

  expect(track.title).toBe('old:query');
  expect(track.extractor).toBe(legacy);
  expect(await track.requestMetadata()).toEqual({ value: 2 });
  expect(track.serialize().data.metadata).toBeNull();
  expect(await p.plugins.resolveStream(track)).toEqual({ url: track.url });
  expect((await p.search('query', { blockExtractors: [Legacy.identifier] })).tracks[0]!.title).toBe('modern');

  await legacy.reconfigure({ prefix: 'new:' });

  expect(legacy.deactivated).toBe(1);
  expect((await p.search('query')).tracks[0]!.title).toBe('new:query');
  expect(await p.plugins.execute('search.query.match', { query: 'x' })).toHaveLength(2);

  await p.extractors.unregister(Legacy.identifier);

  expect(p.plugins.has(Legacy.identifier)).toBe(false);
  expect(p.extractors.size).toBe(0);

  await p.destroy();
});

it('rejects instances and modern definitions at the legacy registration boundary', async () => {
  const p = player();

  await expect(
    Reflect.apply(p.extractors.register, p.extractors, [new Legacy(p.extractors, { prefix: '' })]),
  ).rejects.toThrow('constructor');

  await expect(
    Reflect.apply(p.extractors.register, p.extractors, [definePlugin({ id: 'modern', kind: 'source', setup() {} })()]),
  ).rejects.toThrow('constructor');
});

it('routes legacy bridging, related tracks and post-stream processing through the same registry', async () => {
  const p = player();
  let transformed = 0;
  const input = Readable.from(['encoded']);

  class MetadataOnly extends Legacy {
    static override identifier = 'org.example.metadata';

    override async stream(track: Track) {
      return (await this.context.requestBridge(track, this)).result;
    }
  }

  class Bridge extends BaseExtractor {
    static override identifier = 'org.example.bridge';

    override async bridge(track: Track) {
      track.bridgedTrack = new Track({ title: 'bridge metadata' });

      return input;
    }

    override handlePostStream(stream: Readable, next: NextFunction) {
      transformed++;
      next(null, stream);
    }

    override async getRelatedTracks() {
      return this.createResponse(null, [new Track({ title: 'related', url: 'https://example.test/related' })]);
    }
  }

  await p.extractors.register(MetadataOnly, { prefix: '' });
  await p.extractors.register(Bridge);

  const track = (await p.search('query')).tracks[0]!;

  expect(await p.plugins.resolveStream(track)).toEqual({ stream: input });
  expect(transformed).toBe(1);
  expect(track.bridgedExtractor).toBe(p.extractors.get(Bridge.identifier));

  const related = await p.plugins.execute('track.related', { track }, { pluginId: Bridge.identifier });

  expect(related!.tracks[0]!.sourceReference?.pluginId).toBe(Bridge.identifier);

  await p.extractors.unregister(Bridge.identifier);

  expect(input.destroyed).toBe(true);

  await p.destroy();
});
