import { it, expect, vi } from 'vitest';
import { DiscordPlayer, Track, definePlugin } from '../src/index.js';
import { settle as tick } from './mocks/async.js';

const player = () => new DiscordPlayer({ nodes: [], send() {} });

it('rejects duplicate IDs and attributes setup, handler and teardown failures', async () => {
  const host = player().plugins;
  const cleanup = vi.fn();
  const failed = definePlugin({
    id: 'failed',
    kind: 'source',

    setup(ctx) {
      ctx.onCleanup(cleanup);

      throw new Error('setup failed');
    },
  });

  await expect(host.register(failed())).rejects.toMatchObject({ pluginId: 'failed', operation: 'setup' });

  expect(cleanup).toHaveBeenCalledOnce();
  expect(host.has('failed')).toBe(false);

  const source = definePlugin({
    id: 'source',
    kind: 'source',

    setup(ctx) {
      ctx.on('track.stream', () => {
        throw new Error('stream failed');
      });
    },

    destroy() {
      throw new Error('cleanup failed');
    },
  });

  await host.register(source());
  await expect(host.register(source())).rejects.toThrow('Duplicate');

  await expect(host.execute('track.stream', { track: new Track() })).rejects.toMatchObject({
    pluginId: 'source',
    operation: 'track.stream',
  });

  await expect(host.unregister('source')).rejects.toThrow('cleanup failed');

  expect(host.has('source')).toBe(false);
});

it('aborts and drains in-flight handlers before cleanup and propagates caller cancellation', async () => {
  const host = player().plugins;
  const order: string[] = [];

  await host.register(
    definePlugin({
      id: 'slow',
      kind: 'source',

      setup(ctx) {
        ctx.on('track.stream', async (_, { signal }) => {
          await new Promise<void>((resolve) =>
            signal.addEventListener(
              'abort',
              () => {
                order.push('abort');
                resolve();
              },
              { once: true },
            ),
          );

          order.push('drained');

          return 'https://example.test/a';
        });
      },

      destroy() {
        order.push('destroy');
      },
    })(),
  );

  const call = host.execute('track.stream', { track: new Track() });
  const rejected = expect(call).rejects.toMatchObject({ name: 'AbortError' });

  await tick();
  await host.unregister('slow');
  await rejected;

  expect(order).toEqual(['abort', 'drained', 'destroy']);

  await expect(
    host.execute('track.stream', { track: new Track() }, { signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});

it('cleans setup failures without leaking other constructor registrations', async () => {
  const cleanup = vi.fn();
  const p = new DiscordPlayer({
    nodes: [],

    send() {},

    plugins: [
      definePlugin({
        id: 'good',
        kind: 'source',

        setup(ctx) {
          ctx.onCleanup(cleanup);
        },
      })(),
      definePlugin({
        id: 'bad',
        kind: 'source',

        setup() {
          throw new Error('failed');
        },
      })(),
    ],
  });

  await expect(p.initialize('bot')).rejects.toThrow('failed');

  expect(cleanup).toHaveBeenCalledOnce();
});

it('drains setup/removal races and executes cleanup exactly once in reverse order', async () => {
  const host = player().plugins;
  let release!: () => void;
  const seen: number[] = [];
  const setup = host.register(
    definePlugin({
      id: 'pending',
      kind: 'source',

      async setup(ctx) {
        ctx.onCleanup(() => {
          seen.push(1);
        });

        ctx.onCleanup(() => {
          seen.push(2);
        });

        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },

      destroy() {
        seen.push(3);
      },
    })(),
  );

  await tick();

  const removed = host.unregister('pending');
  const twice = host.unregister('pending');

  release();
  await Promise.all([setup, removed, twice]);

  expect(seen).toEqual([3, 2, 1]);
  expect(host.has('pending')).toBe(false);

  await host.register(
    definePlugin({
      id: 'pending',
      kind: 'source',

      setup(ctx) {
        const remove = ctx.on('track.stream', () => 'https://example.test/removed');

        remove();
        remove();
      },
    })(),
  );

  expect(await host.execute('track.stream', { track: new Track() })).toBeUndefined();

  await host.destroy();
});

it('removes all registrations even when one destructor fails', async () => {
  const p = player();
  const cleanup = vi.fn();

  await p.plugins.register(
    definePlugin({
      id: 'failure',
      kind: 'source',

      setup() {},

      destroy() {
        throw new Error('failure');
      },
    })(),
  );

  await p.plugins.register(
    definePlugin({
      id: 'success',
      kind: 'source',

      setup(ctx) {
        ctx.onCleanup(cleanup);
      },
    })(),
  );

  await expect(p.destroy()).rejects.toThrow('cleanup failed');

  expect(cleanup).toHaveBeenCalledOnce();
  expect(p.plugins.has('failure')).toBe(false);
  expect(p.plugins.has('success')).toBe(false);
});
