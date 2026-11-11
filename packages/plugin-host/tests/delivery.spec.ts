import { createServer } from 'node:http';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import {
  createSourcePluginHost,
  definePlugin,
  SOURCE_PLUGIN_ID,
  Track,
  type SourcePluginHostOptions,
  type PluginContext,
  type SourceStream,
  type SourceStreamTransform,
} from '../src/index.js';

const hosts: ReturnType<typeof createSourcePluginHost>[] = [];

function host(options: Partial<SourcePluginHostOptions> = {}) {
  const h = createSourcePluginHost({
    name: 'Delivery',
    hostId: 'delivery',
    publicUrl: 'https://host.test',
    mediaDelivery: 'direct-url',
    ...options,
  });

  hosts.push(h);

  return h;
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(hosts.splice(0).map((h) => h.close()));
});

async function call(h: ReturnType<typeof host>, operation: string, input: unknown) {
  return h.fetch(
    new Request('https://host.test/remedia/v1/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginId: SOURCE_PLUGIN_ID, operation, input }),
    }),
  );
}

async function result(h: ReturnType<typeof host>, operation: string, input: unknown) {
  const response = await call(h, operation, input);

  expect(response.status).toBe(200);

  return (await response.json()).result;
}

async function provider(
  h: ReturnType<typeof host>,
  stream: () => SourceStream | Promise<SourceStream>,
  setup?: (ctx: PluginContext<Record<string, never>>) => void,
) {
  const open = vi.fn(stream);

  await h.plugins.register(
    definePlugin({
      id: 'source',

      setup(ctx) {
        ctx.on('search.query.resolve', () => ({
          tracks: [new Track({ url: 'https://example.com/audio' })],
          playlist: null,
        }));

        ctx.on('track.stream', open);
        setup?.(ctx);
      },
    })(),
  );

  const search = await result(h, 'metadata.execute', {
    providerId: 'source',
    operation: 'search.query.resolve',
    input: { query: 'audio' },
  });

  return { open, track: search.tracks[0] };
}

it('proxies applicable URL transformations once in both delivery modes and preserves direct URLs for unrelated transforms', async () => {
  const upstream = createServer((_req, res) => res.end('encoded'));

  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');

  const url = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;

  try {
    for (const mediaDelivery of ['proxy', 'direct-url'] as const) {
      const h = host({ mediaDelivery, directUrlProviders: ['source'], mediaPolicy: { allowPrivateNetworks: true } });
      const transform = vi.fn(({ track, stream }: SourceStreamTransform) => ({
        track,
        stream: Readable.from(
          (async function* () {
            for await (const chunk of stream) yield Buffer.from(chunk.toString().toUpperCase());
          })(),
        ),
      }));
      const resolved = vi.fn();
      const { track, open } = await provider(
        h,
        () => ({ url }),
        (ctx) => {
          ctx.on('stream.transform', transform);
          ctx.on('track.stream.resolved', resolved);
        },
      );
      const grant = await result(h, 'source.stream', { track });

      expect(open).not.toHaveBeenCalled();
      expect(transform).not.toHaveBeenCalled();
      expect(await (await h.fetch(new Request(grant.url))).text()).toBe('ENCODED');
      expect(open).toHaveBeenCalledOnce();
      expect(transform).toHaveBeenCalledOnce();
      expect(resolved).toHaveBeenCalledOnce();
    }

    const h = host({ directUrlProviders: ['source'], mediaPolicy: { allowPrivateNetworks: true } });
    const unrelated = vi.fn();

    await h.plugins.register(
      definePlugin({
        id: 'other',

        setup(ctx) {
          ctx.on('stream.transform', unrelated);
        },
      })(),
    );

    const { track, open } = await provider(h, () => ({ url }));

    expect(await result(h, 'source.stream', { track })).toEqual({ url });
    expect(open).toHaveBeenCalledOnce();
    expect(unrelated).not.toHaveBeenCalled();
  } finally {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});

it.each(['stream', 'buffer', 'file'] as const)(
  'defers %s resolution until redemption and never opens it twice',
  async (kind) => {
    const dir = await mkdtemp(join(tmpdir(), 'lazy-source-'));
    const path = join(dir, 'audio');

    await writeFile(path, 'encoded');

    const h = host({ mediaPolicy: { allowedFileRoots: [dir] } });
    let readable: Readable | undefined;

    try {
      const { track, open } = await provider(h, () => {
        if (kind === 'file') return { file: path };

        if (kind === 'buffer') return { buffer: Buffer.from('encoded') };

        readable = Readable.from(['encoded']);

        return readable;
      });
      const grant = await result(h, 'source.stream', { track });

      expect(open).not.toHaveBeenCalled();
      expect(readable).toBeUndefined();
      expect(await (await h.fetch(new Request(grant.url))).text()).toBe('encoded');
      expect(open).toHaveBeenCalledOnce();
      expect((await h.fetch(new Request(grant.url))).status).toBe(404);
      expect(open).toHaveBeenCalledOnce();

      if (readable) expect(readable.destroyed).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

it('never opens abandoned, expired, cancelled-before-open or shutdown grants', async () => {
  vi.useFakeTimers();

  const h = host({ mediaTtlMs: 10 });
  const { track, open } = await provider(h, () => Readable.from(['encoded']));
  const expired = await result(h, 'source.stream', { track });

  await vi.advanceTimersByTimeAsync(11);

  expect((await h.fetch(new Request(expired.url))).status).toBe(404);

  const cancelled = await result(h, 'source.stream', { track });
  const response = await h.fetch(new Request(cancelled.url, { signal: AbortSignal.abort() }));

  expect(response.ok).toBe(false);

  await result(h, 'source.stream', { track });
  await h.close();

  expect(open).not.toHaveBeenCalled();
});

it('cancels an active redemption and destroys a late provider stream exactly once', async () => {
  const h = host();
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const destroy = vi.fn((error: Error | null, done: (error?: Error | null) => void) => done(error));
  const readable = new Readable({ read() {}, destroy });
  const { track, open } = await provider(h, async () => {
    entered();
    await gate;

    return readable;
  });
  const grant = await result(h, 'source.stream', { track });
  const controller = new AbortController();
  const pending = h.fetch(new Request(grant.url, { signal: controller.signal }));

  await started;
  controller.abort();
  release();

  const response = await pending;

  await response.body?.cancel();

  expect(readable.destroyed).toBe(true);
  expect(destroy).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledOnce();
});

it('does not revive unredeemed grants after provider removal and replacement', async () => {
  const report = vi.fn();
  const h = host({ onError: report });
  const { track, open } = await provider(h, () => Readable.from(['old']));
  const grant = await result(h, 'source.stream', { track });

  await h.plugins.unregister('source');

  const next = await provider(h, () => Readable.from(['new']));
  const response = await h.fetch(new Request(grant.url));

  expect(response.ok).toBe(false);
  expect(open).not.toHaveBeenCalled();
  expect(next.open).not.toHaveBeenCalled();
});

it('fails and disposes a non-URL result from a falsely declared URL-only provider without retrying', async () => {
  const h = host({ directUrlProviders: ['source'], onError() {} });
  const readable = new Readable({ read() {} });
  const { track, open } = await provider(h, () => readable);

  expect((await call(h, 'source.stream', { track })).status).toBe(502);
  expect(readable.destroyed).toBe(true);
  expect(open).toHaveBeenCalledOnce();
});

it('requires stable HTTP identities while keeping generated local handle identities and model ownership', async () => {
  expect(() => host({ hostId: undefined })).toThrow('explicit hostId');

  const a = host({ publicUrl: undefined, hostId: undefined });
  const b = host({ publicUrl: undefined, hostId: undefined });

  expect(a.hostId).not.toBe(b.hostId);

  await expect(a.fetch(new Request('https://host.test/.well-known/remedia'))).rejects.toThrow('explicit hostId');

  const track = new Track({ title: 'local' });

  await a.plugins.register(
    definePlugin({
      id: 'local',

      setup(ctx) {
        ctx.on('search.query.resolve', () => ({ tracks: [track], playlist: null }));

        ctx.on('track.stream', ({ track: input }) => {
          expect(input).toBe(track);

          return { buffer: Buffer.from('local') };
        });
      },
    })(),
  );

  const search = await a.handle({
    pluginId: SOURCE_PLUGIN_ID,
    operation: 'metadata.execute',
    input: { providerId: 'local', operation: 'search.query.resolve', input: { query: 'local' } },
  });

  expect(search.handled && (search.result as { tracks: Track[] }).tracks[0]).toBe(track);
  expect(await a.handle({ pluginId: SOURCE_PLUGIN_ID, operation: 'source.stream', input: { track } })).toEqual({
    handled: true,
    result: { buffer: Buffer.from('local') },
  });

  const first = host({ hostId: 'stable' });
  const restarted = host({ hostId: 'stable' });

  expect(first.hostId).toBe(restarted.hostId);
  expect((await restarted.fetch(new Request('https://host.test/.well-known/remedia'))).status).toBe(200);
});

it.each(['cancel', 'remove', 'shutdown'] as const)('releases active fallback streams on %s', async (action) => {
  const h = host();
  let readable: Readable | undefined;
  const { track, open } = await provider(h, () => {
    readable = new Readable({
      read() {
        this.push(Buffer.alloc(1024));
      },
    });

    return readable;
  });
  const grant = await result(h, 'source.stream', { track });

  expect(readable).toBeUndefined();

  const response = await h.fetch(new Request(grant.url));
  const reader = response.body!.getReader();

  await reader.read();

  if (action === 'remove') await h.plugins.unregister('source');
  else if (action === 'shutdown') await h.close();
  else await reader.cancel();

  expect(readable?.destroyed).toBe(true);
  expect(open).toHaveBeenCalledOnce();

  await reader.cancel().catch(() => {});
});

it('defers URL-only providers which decline to a bridge and applies the bridge owner transform once', async () => {
  const h = host({ directUrlProviders: ['source'] });
  let opened = 0;
  const transformed = vi.fn(({ track, stream }: SourceStreamTransform) => ({ track, stream }));

  await h.plugins.register(
    definePlugin({
      id: 'source',

      setup(ctx) {
        ctx.on('search.query.resolve', () => ({
          tracks: [new Track({ url: 'https://example.com/audio' })],
          playlist: null,
        }));

        ctx.on('track.stream', () => undefined);
      },
    })(),
  );

  await h.plugins.register(
    definePlugin({
      id: 'bridge',

      setup(ctx) {
        ctx.on('track.bridge', () => {
          opened++;

          return Readable.from([Buffer.from('bridged')]);
        });

        ctx.on('stream.transform', transformed);
      },
    })(),
  );

  const search = await result(h, 'metadata.execute', {
    providerId: 'source',
    operation: 'search.query.resolve',
    input: { query: 'bridge' },
  });
  const grant = await result(h, 'source.stream', { track: search.tracks[0] });

  expect(opened).toBe(0);
  expect(transformed).not.toHaveBeenCalled();
  expect(await (await h.fetch(new Request(grant.url))).text()).toBe('bridged');
  expect(opened).toBe(1);
  expect(transformed).toHaveBeenCalledOnce();
});

it('rechecks transforms registered while an eager URL is resolving and defers their execution', async () => {
  const upstream = createServer((_req, res) => res.end('bytes'));

  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');

  const url = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;
  const h = host({ directUrlProviders: ['source'], mediaPolicy: { allowPrivateNetworks: true } });
  const transform = vi.fn(({ track, stream }: SourceStreamTransform) => ({ track, stream }));
  let registered = false;

  try {
    await h.plugins.register(
      definePlugin({
        id: 'source',

        setup(ctx) {
          ctx.on('search.query.resolve', () => ({
            tracks: [new Track({ url: 'https://example.com/audio' })],
            playlist: null,
          }));

          ctx.on('track.stream', () => {
            if (!registered) {
              registered = true;
              ctx.on('stream.transform', transform);
            }

            return { url };
          });
        },
      })(),
    );

    const search = await result(h, 'metadata.execute', {
      providerId: 'source',
      operation: 'search.query.resolve',
      input: { query: 'url' },
    });
    const grant = await result(h, 'source.stream', { track: search.tracks[0] });

    expect(transform).not.toHaveBeenCalled();
    expect(await (await h.fetch(new Request(grant.url))).text()).toBe('bytes');
    expect(transform).toHaveBeenCalledOnce();
  } finally {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
