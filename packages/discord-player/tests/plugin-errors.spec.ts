import { Readable } from 'node:stream';
import { expect, it, vi } from 'vitest';
import { DiscordPlayer, PluginRegistry, Track, definePlugin } from '../src/index.js';
import { deferred } from './mocks/async.js';
import { settle } from './mocks/async.js';
import type { SourceStream } from '../src/index.js';

it('rejects invalid registration shapes, unsupported kinds and duplicate operation definitions', async () => {
  const host = new PluginRegistry();
  for (const descriptor of [null, {}, { definition: { id: 'runtime', kind: 'runtime', setup() {} } }]) {
    await expect(host.register(descriptor as never)).rejects.toThrow('source plugin');
  }
  expect(() => host.defineOperation('track.stream', 'first')).toThrow('already defined');
  await expect(host.execute('unknown' as never, {} as never)).rejects.toThrow('Undefined operation');
  await expect(
    host.register(
      definePlugin({
        id: 'invalid',
        kind: 'source',
        setup(ctx) {
          ctx.on('unknown' as never, () => undefined);
        },
      })(),
    ),
  ).rejects.toThrow('Undefined operation');
  await host.destroy();
  await expect(host.register(definePlugin({ id: 'later', kind: 'source', setup() {} })())).rejects.toThrow('destroyed');
});

it('cleans every resource on failed setup and retains setup, destroy and cleanup failures', async () => {
  const host = new PluginRegistry();
  const cleanup = vi.fn(() => {
    throw new Error('resource failed');
  });
  await expect(
    host.register(
      definePlugin({
        id: 'failure',
        kind: 'source',
        setup(ctx) {
          ctx.onCleanup(cleanup);
          throw new Error('setup failed');
        },
        destroy() {
          throw new Error('destroy failed');
        },
      })(),
    ),
  ).rejects.toBeInstanceOf(AggregateError);
  expect(cleanup).toHaveBeenCalledOnce();
  expect(host.has('failure')).toBe(false);
  const p = new DiscordPlayer({
    nodes: [],
    send() {},
    plugins: [
      definePlugin({
        id: 'good',
        kind: 'source',
        setup() {},
        destroy() {
          throw new Error('cleanup failed');
        },
      })(),
      definePlugin({
        id: 'bad',
        kind: 'source',
        setup() {
          throw new Error('setup failed');
        },
      })(),
    ],
  });
  await expect(p.initialize('bot')).rejects.toBeInstanceOf(AggregateError);
});

it.each(['direct', 'wrapped'] as const)('disposes a late %s stream after operation cancellation', async (kind) => {
  const host = new PluginRegistry();
  const pending = deferred<SourceStream>();
  const stream = Readable.from(['late']);
  const controller = new AbortController();
  await host.register(
    definePlugin({
      id: 'late',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.stream', () => pending.promise);
      },
    })(),
  );
  const call = host.resolveStream(new Track(), { signal: controller.signal });
  const rejected = expect(call).rejects.toBe('cancel');
  await settle();
  controller.abort('cancel');
  pending.resolve(kind === 'direct' ? stream : { stream });
  await rejected;
  expect(stream.destroyed).toBe(true);
  await host.destroy();
});

it('uses explicit bridge fallback only for declined stream operations and attributes genuine failures', async () => {
  const host = new PluginRegistry();
  await host.register(
    definePlugin({
      id: 'source',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.stream', () => undefined);
      },
    })(),
  );
  await host.register(
    definePlugin({
      id: 'bridge',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.bridge', () => ({ url: 'https://example.test/fallback' }));
      },
    })(),
  );
  const track = new Track({ sourceReference: { pluginId: 'source', data: null } });
  expect(await host.resolveStream(track)).toEqual({ url: 'https://example.test/fallback' });
  await host.unregister('bridge');
  await expect(host.resolveStream(track)).rejects.toThrow('No source plugin handled');
  await host.register(
    definePlugin({
      id: 'thrower',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.stream', () => {
          throw 'plain failure';
        });
      },
    })(),
  );
  await expect(
    host.resolveStream(new Track({ sourceReference: { pluginId: 'thrower', data: null } })),
  ).rejects.toMatchObject({
    pluginId: 'thrower',
    operation: 'track.stream',
    message: expect.stringContaining('plain failure'),
  });
  await host.destroy();
});

it('does not execute later snapshot handlers after their registration has been removed', async () => {
  const host = new PluginRegistry();
  const called = vi.fn();
  await host.register(
    definePlugin({
      id: 'first',
      kind: 'source',
      setup(ctx) {
        ctx.on(
          'track.stream.resolved',
          async () => {
            await host.unregister('later');
          },
          { priority: 10 },
        );
      },
    })(),
  );
  await host.register(
    definePlugin({
      id: 'later',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.stream.resolved', called);
      },
    })(),
  );
  await host.execute('track.stream.resolved', { track: new Track() });
  expect(called).not.toHaveBeenCalled();
  await host.destroy();
});

it('cancels callback-style legacy transforms when their registration is removed', async () => {
  const { BaseExtractor } = await import('../src/index.js');
  const p = new DiscordPlayer({ nodes: [], send() {} });
  const stream = Readable.from(['encoded']);
  class Waiting extends BaseExtractor {
    static override identifier = 'org.example.waiting';
    override async stream() {
      return stream;
    }
    override handlePostStream() {
      /* Intentionally waits for registration cancellation. */
    }
  }
  await p.extractors.register(Waiting);
  const resolving = p.plugins.resolveStream(
    new Track({ sourceReference: { pluginId: Waiting.identifier, data: null } }),
  );
  const rejected = expect(resolving).rejects.toMatchObject({ name: 'AbortError' });
  await settle();
  await p.extractors.unregister(Waiting.identifier);
  await rejected;
  expect(stream.destroyed).toBe(true);
  await p.destroy();
});
