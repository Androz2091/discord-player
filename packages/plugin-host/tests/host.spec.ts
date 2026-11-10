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
  const h = createSourcePluginHost({
    name: 'Test',
    hostId: 'test-host',
    publicUrl: 'http://localhost:3000',
    ...options,
  });

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
      const h = host({ mediaPolicy: { allowedFileRoots: [dir] } });

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

it('retains a state hint on ordinary models, isolates concurrent playback and refuses foreign hosts', async () => {
  const { deserializeSourceResult, serializeSourceTrack, deserialize } = await import('@discord-player/plugin-host');
  const h = host({ hostId: 'a' });
  const other = host({ hostId: 'b' });
  const seen: Track[] = [];

  class Mutable extends LegacyFixture {
    static override identifier = 'mutable';

    override async stream(track: Track) {
      seen.push(track);
      track.raw.engine.count = (track.raw.engine.count ?? 0) + 1;
      await Promise.resolve();

      return Readable.from([String(track.raw.engine.count)]);
    }
  }

  await h.extractors.register(Mutable);
  await other.extractors.register(Mutable);

  const payload = await http(h, 'source.search', { query: 'fixture' });
  const track = deserializeSourceResult(payload.result).tracks[0]!;

  expect(track.sourceState).toBe(payload.result.tracks[0].sourceState);
  expect((deserialize(track.serialize()) as Track).sourceState).toBeUndefined();
  expect(track.serialize().data.sourceReference?.hostId).toBe('a');

  const sources = await Promise.all(
    [track, serializeSourceTrack(track)].map((value) => h.handle(request('source.stream', { track: value }))),
  );

  for (const result of sources) {
    if (!result.handled) throw new Error('Unhandled');

    let text = '';

    for await (const chunk of (result.result as { stream: Readable }).stream) text += chunk;

    expect(text).toBe('1');
  }

  expect(seen[0]).not.toBe(seen[1]);
  expect(seen[0]!.raw.engine).not.toBe(seen[1]!.raw.engine);

  await expect(other.handle(request('source.stream', { track: serializeSourceTrack(track) }))).rejects.toThrow(
    'another source host',
  );

  const embedded = new SourcePluginRuntime();

  await expect(embedded.plugins.resolveStream(track)).rejects.toThrow('unavailable');
  await embedded.destroy();
});

it('reconstructs expired state and isolates direct calls nested in an HTTP operation', async () => {
  const h = host({ trackStateTtlMs: 1 });
  const extractor = await h.extractors.register(LegacyFixture);
  const handle = vi.spyOn(extractor, 'handle');
  const search = await http(h, 'source.search', { query: 'first' });
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 100);

  try {
    const result = await h.handle(request('source.stream', { track: search.result.tracks[0] }));

    expect(handle).toHaveBeenCalledWith('https://fixture.test/audio', expect.anything());

    if (result.handled) (result.result as { stream: Readable }).stream.destroy();
  } finally {
    clock.mockRestore();
  }

  await h.plugins.register(
    definePlugin({
      id: 'nested',
      kind: 'source',

      setup(ctx) {
        ctx.on('search.query.resolve', async () => {
          const result = await h.handle(
            request('source.resolve', { query: 'inner', pluginId: LegacyFixture.identifier }),
          );

          if (!result.handled) throw new Error('Unhandled');

          expect((result.result as { tracks: Track[] }).tracks[0]).toBeInstanceOf(Track);

          return result.result as { tracks: Track[]; playlist: null };
        });
      },
    })(),
  );

  await Promise.all([
    http(h, 'source.resolve', { query: 'outer', pluginId: 'nested' }),
    h.handle(request('source.search', { query: 'direct' })).then((result) => {
      if (result.handled) expect((result.result as { tracks: Track[] }).tracks[0]).toBeInstanceOf(Track);
    }),
  ]);
});

it('drains an active legacy stream before reconfiguration and disposes its cancelled output', async () => {
  const h = host();
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stream = new Readable({ read() {} });
  const deactivated = vi.fn();

  class Slow extends LegacyFixture {
    static override identifier = 'slow-reconfigure';

    override async stream() {
      enter();
      await gate;

      return stream;
    }

    override async deactivate() {
      deactivated();
    }
  }

  const original = await h.extractors.register(Slow);
  const track = (await h.runtime.search('test', { pluginId: Slow.identifier })).tracks[0]!;
  const pending = h.handle(request('source.stream', { track }));
  const rejected = expect(pending).rejects.toBeDefined();

  await entered;

  const replacing = h.extractors.reconfigure(Slow.identifier, {});

  expect(deactivated).not.toHaveBeenCalled();

  release();
  await replacing;
  await rejected;

  expect(stream.destroyed).toBe(true);
  expect(deactivated).toHaveBeenCalledOnce();
  expect(h.extractors.get(Slow.identifier)).not.toBe(original);
});

it('applies provider blocking and preserves HTTP error redaction without changing direct errors', async () => {
  const h = host({ blockExtractors: [LegacyFixture.identifier] });

  await h.extractors.register(LegacyFixture);

  expect((await h.runtime.search('blocked', { pluginId: LegacyFixture.identifier })).tracks).toEqual([]);
  expect(
    (await http(h, 'source.resolve', { query: 'blocked', pluginId: LegacyFixture.identifier })).result.tracks,
  ).toEqual([]);

  const report = vi.fn();
  const errors = host({ onError: report });

  await errors.plugins.register(
    definePlugin({
      id: 'error',
      kind: 'source',

      setup(ctx) {
        ctx.on('search.query.resolve', () => {
          throw new Error('private-provider-secret');
        });
      },
    })(),
  );

  await expect(errors.handle(request('source.resolve', { query: 'test', pluginId: 'error' }))).rejects.toThrow(
    'private-provider-secret',
  );

  const response = await errors.fetch(
    new Request('https://host.test/remedia/v1/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request('source.resolve', { query: 'test', pluginId: 'error' })),
    }),
  );

  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('private-provider-secret');
  expect(report).toHaveBeenCalledOnce();
});
