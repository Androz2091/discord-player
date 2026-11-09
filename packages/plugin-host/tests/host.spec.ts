import { Readable } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import {
  createSourcePluginHost,
  SOURCE_PLUGIN_ID,
  Track,
  definePlugin,
  SourcePluginRuntime,
} from '@discord-player/plugin-host';
import { LegacyFixture } from './fixtures/legacy.js';
const hosts: ReturnType<typeof createSourcePluginHost>[] = [];
function host(options = {}) {
  const h = createSourcePluginHost({ name: 'Test', publicUrl: 'http://localhost:3000', ...options });
  hosts.push(h);
  return h;
}
afterEach(async () => {
  await Promise.all(hosts.splice(0).map((h) => h.close()));
});
const request = (operation: string, input: unknown) => ({ pluginId: SOURCE_PLUGIN_ID, operation, input });
async function http(h: ReturnType<typeof host>, operation: string, input: unknown) {
  const response = await h.fetch(
    new Request('http://localhost:3000/remedia/v1/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request(operation, input)),
    }),
  );
  expect(response.status).toBe(200);
  return response.json();
}
it('runs legacy constructors, context and direct streams without a public URL or playback services', async () => {
  const h = host({ publicUrl: undefined });
  const debug = vi.fn();
  h.runtime.on('debug', debug);
  const extractor = await h.extractors.register(LegacyFixture);
  expect(extractor.context.player).toBe(h.runtime);
  expect(h.runtime).toBeInstanceOf(SourcePluginRuntime);
  const result = await h.handle(request('source.search', { query: 'fixture' }));
  expect(result.handled).toBe(true);
  if (!result.handled) throw new Error('Unhandled');
  const search = result.result as { tracks: Track[] };
  expect(search.tracks[0]).toBeInstanceOf(Track);
  expect(debug).toHaveBeenCalledWith('Resolving source');
  const stream = await h.handle(request('source.stream', { track: search.tracks[0] }));
  if (!stream.handled) throw new Error('Unhandled');
  expect((stream.result as { stream: Readable }).stream).toBeInstanceOf(Readable);
  for await (const chunk of (stream.result as { stream: Readable }).stream)
    expect(chunk.toString()).toBe('encoded fixture');
});
it('serializes metadata, restores private engine state, and transports encoded Readables with Remedia', async () => {
  const h = host();
  await h.extractors.register(LegacyFixture);
  const search = await http(h, 'source.search', { query: 'fixture' });
  expect(JSON.stringify(search)).not.toContain('never serialize');
  expect(search.result.tracks[0].version).toBe(1);
  const media = await http(h, 'source.stream', { track: search.result.tracks[0] });
  const response = await h.fetch(new Request(media.result.url));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('encoded fixture');
});
it('reconstructs expired and restart state using the owning provider URL', async () => {
  const a = host({ maxTrackStates: 1 });
  await a.extractors.register(LegacyFixture);
  const search = await http(a, 'source.search', { query: 'fixture' });
  await http(a, 'source.search', { query: 'evict' });
  const b = host();
  await b.extractors.register(LegacyFixture);
  for (const h of [a, b]) {
    const media = await http(h, 'source.stream', { track: search.result.tracks[0] });
    expect(await (await h.fetch(new Request(media.result.url))).text()).toBe('encoded fixture');
  }
});
it('shares modern and legacy registrations, priorities and cross-provider search', async () => {
  const h = host();
  await h.extractors.register(LegacyFixture);
  await h.plugins.register(
    definePlugin({
      id: 'fixture.modern',
      kind: 'source',
      setup(ctx) {
        ctx.on('search.query.match', () => ({ score: 0 }), { priority: 10 });
        ctx.on('search.query.resolve', () => ({
          tracks: [new Track({ title: 'modern', url: 'https://fixture.test/modern' })],
          playlist: null,
        }));
      },
    })(),
  );
  expect((await h.runtime.search('test')).tracks[0]?.title).toBe('modern');
  expect((await h.runtime.search('delegate', { pluginId: LegacyFixture.identifier })).tracks[0]?.title).toBe('modern');
  await h.plugins.unregister('fixture.modern');
  expect((await h.runtime.search('test')).tracks[0]?.title).toBe('test');
});
it('cancels calls and drains handlers before cleanup', async () => {
  const h = host();
  const cleanup = vi.fn();
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  await h.plugins.register(
    definePlugin({
      id: 'cancel',
      kind: 'source',
      setup(ctx) {
        ctx.onCleanup(cleanup);
        ctx.on('search.query.match', async (_, { signal }) => {
          entered();
          await new Promise<void>((r) => signal.addEventListener('abort', () => r(), { once: true }));
          return null;
        });
      },
    })(),
  );
  const controller = new AbortController();
  const pending = h.handle({ ...request('source.search', { query: 'test' }), signal: controller.signal });
  await started;
  controller.abort();
  await expect(pending).rejects.toBeDefined();
  await h.close();
  expect(cleanup).toHaveBeenCalledOnce();
});
it('serves local files, buffers, and transformations without buffering media in the adapter', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'dp-host-'));
  const file = join(dir, 'audio');
  await writeFile(file, 'file bytes');
  try {
    for (const media of [{ file }, { buffer: Buffer.from('buffer bytes') }]) {
      const h = host();
      await h.plugins.register(
        definePlugin({
          id: 'bytes',
          kind: 'source',
          setup(ctx) {
            ctx.on('search.query.match', () => ({ score: 1 }));
            ctx.on('search.query.resolve', () => ({
              tracks: [new Track({ url: 'https://fixture.test/bytes' })],
              playlist: null,
            }));
            ctx.on('track.stream', () => media);
            ctx.on('stream.transform', ({ track, stream }) => ({
              track,
              stream: Readable.from(
                (async function* () {
                  for await (const chunk of stream) yield Buffer.from(chunk.toString().toUpperCase());
                })(),
              ),
            }));
          },
        })(),
      );
      const search = await http(h, 'source.search', { query: 'bytes' });
      const result = await http(h, 'source.stream', { track: search.result.tracks[0] });
      expect(await (await h.fetch(new Request(result.result.url))).text()).toBe(
        'file' in media ? 'FILE BYTES' : 'BUFFER BYTES',
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it('destroys streaming media on HTTP cancellation and cleans up multiple legacy providers', async () => {
  const h = host();
  const deactivate = vi.fn();
  class Second extends LegacyFixture {
    static override identifier = 'fixture.second';
    override async deactivate() {
      deactivate();
    }
  }
  await h.extractors.loadMulti([LegacyFixture, Second]);
  expect(h.extractors.size).toBe(2);
  const stream = new Readable({
    read() {
      this.push(Buffer.alloc(1024));
    },
  });
  await h.plugins.register(
    definePlugin({
      id: 'endless',
      kind: 'source',
      setup(ctx) {
        ctx.on('search.query.resolve', () => ({
          tracks: [new Track({ url: 'https://fixture.test/endless' })],
          playlist: null,
        }));
        ctx.on('track.stream', () => stream);
      },
    })(),
  );
  const search = await http(h, 'source.resolve', { query: 'bytes', pluginId: 'endless' });
  const result = await http(h, 'source.stream', { track: search.result.tracks[0] });
  const response = await h.fetch(new Request(result.result.url));
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  expect(stream.destroyed).toBe(true);
  await h.close();
  expect(deactivate).toHaveBeenCalledOnce();
  expect(h.extractors.size).toBe(0);
});
it('does not provide queue or audio infrastructure', () => {
  const h = host();
  expect(h.runtime.getRemedia(false)).toBeNull();
  expect(() => h.runtime.getRemedia()).toThrow('does not initialize');
  expect(() => h.runtime.queues).toThrow('does not provide queues');
  expect(() => h.runtime.nodes).toThrow('voice nodes');
  expect(() => h.runtime.play()).toThrow('cannot play');
});
it('uses bridge fallback and related operations through the aggregate HTTP registration', async () => {
  const h = host();
  await h.plugins.register(
    definePlugin({
      id: 'metadata',
      kind: 'source',
      setup(ctx) {
        ctx.on('search.query.resolve', () => ({
          tracks: [new Track({ url: 'https://fixture.test/bridge' })],
          playlist: null,
        }));
        ctx.on('track.related', () => ({
          tracks: [new Track({ title: 'related', url: 'https://fixture.test/related' })],
          playlist: null,
        }));
      },
    })(),
  );
  await h.plugins.register(
    definePlugin({
      id: 'bridge',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.bridge', () => Readable.from([Buffer.from('bridged bytes')]));
      },
    })(),
  );
  const search = await http(h, 'source.resolve', { query: 'bridge', pluginId: 'metadata' });
  const related = await http(h, 'source.related', { track: search.result.tracks[0] });
  expect(related.result.tracks[0].data.title).toBe('related');
  const result = await http(h, 'source.stream', { track: search.result.tracks[0] });
  expect(await (await h.fetch(new Request(result.result.url))).text()).toBe('bridged bytes');
});
it('opens direct HTTP media lazily using the redemption lifetime', async () => {
  const h = host();
  const upstream = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('upstream bytes'));
  try {
    await h.plugins.register(
      definePlugin({
        id: 'url',
        kind: 'source',
        setup(ctx) {
          ctx.on('search.query.resolve', () => ({
            tracks: [new Track({ url: 'https://fixture.test/url' })],
            playlist: null,
          }));
          ctx.on('track.stream', () => 'https://fixture.test/encoded');
        },
      })(),
    );
    const search = await http(h, 'source.resolve', { query: 'url', pluginId: 'url' });
    const result = await http(h, 'source.stream', { track: search.result.tracks[0] });
    expect(upstream).not.toHaveBeenCalled();
    expect(await (await h.fetch(new Request(result.result.url))).text()).toBe('upstream bytes');
    expect(upstream).toHaveBeenCalledOnce();
  } finally {
    upstream.mockRestore();
  }
});
it('rejects lost legacy state when its provider cannot reconstruct the URL', async () => {
  const report = vi.fn();
  const h = host({ maxTrackStates: 1, onError: report });
  class Ephemeral extends LegacyFixture {
    static override identifier = 'ephemeral';
    override async handle(query: string) {
      return query.startsWith('https:') ? this.createResponse() : super.handle(query);
    }
  }
  await h.extractors.register(Ephemeral);
  const search = await http(h, 'source.search', { query: 'first' });
  await http(h, 'source.search', { query: 'evict' });
  const result = await http(h, 'source.stream', { track: search.result.tracks[0] });
  expect((await h.fetch(new Request(result.result.url))).status).toBe(502);
  expect(report.mock.calls[0]?.[0].message).toContain('could not reconstruct expired Track state');
});
it('imports and constructs a standalone host with native binding loading disabled', async () => {
  const { execFileSync } = await import('node:child_process');
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    process.dlopen = () => { throw new Error('Unexpected native binding initialization'); };
    const { createSourcePluginHost } = await import('@discord-player/plugin-host');
    const host = createSourcePluginHost({ name: 'Isolated host' });
    if (host.runtime.getRemedia(false) !== null) throw new Error('Unexpected audio client');
    await host.close();
    process.stdout.write('ok');
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(output).toBe('ok');
});
