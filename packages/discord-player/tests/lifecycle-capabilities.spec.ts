import { Readable, Transform } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { SourcePluginRuntime } from '@discord-player/plugin-host';
import { CapabilityCancelledError, DiscordPlayer, Track, definePlugin } from '../src/index.js';

const players: DiscordPlayer[] = [];

function player() {
  const p = new DiscordPlayer({ nodes: [], send() {} });
  players.push(p);
  return p;
}

afterEach(async () => {
  await Promise.all(players.splice(0).map((p) => p.destroy()));
});

it('composes admissions in priority order before validating capacity and committing', async () => {
  const p = player();
  const first = new Track({ title: 'first' });
  const second = new Track({ title: 'second' });
  const seen: string[] = [];
  for (const [id, priority] of [
    ['low', 0],
    ['high', 10],
    ['equal', 10],
  ] as const) {
    await p.plugins.register(
      definePlugin({
        id,
        setup(ctx) {
          ctx.on(
            'queue.beforeAdd',
            (input) => {
              seen.push(id);
              return { action: 'replace', value: { ...input, tracks: id === 'high' ? [second] : input.tracks } };
            },
            { priority },
          );
        },
      })(),
    );
  }
  const queue = await p.nodes.create('guild', { maxSize: 1 });
  queue.addTrack([first, first]);
  expect(queue.tracks.toArray()).toEqual([second]);
  expect(seen).toEqual(['high', 'equal', 'low']);
  expect(() => queue.addTrack(first)).toThrow(/capacity/i);
  expect(queue.tracks.toArray()).toEqual([second]);
});

it('supports explicit vetoes without mutating occurrences or emitting admission events', async () => {
  const p = player();
  const queue = await p.nodes.create('guild');
  const track = new Track();
  queue.addTrack(track);
  const identity = queue.tracks.entryId(0);
  const removed = vi.fn();
  p.events.on('audioTrackRemove', removed);
  await p.plugins.register(
    definePlugin({
      id: 'policy',
      setup(ctx) {
        ctx.on('queue.beforeRemove', () => ({ action: 'cancel', reason: 'protected' }));
      },
    })(),
  );
  expect(() => queue.removeTrack(0)).toThrow(CapabilityCancelledError);
  expect(queue.tracks.entryId(0)).toBe(identity);
  expect(removed).not.toHaveBeenCalled();
  await p.plugins.unregister('policy');
  expect(queue.removeTrack(0)).toBe(track);
});

it('rejects invalid transformations and recursive admission before mutation', async () => {
  const p = player();
  const queue = await p.nodes.create('guild');
  await p.plugins.register(
    definePlugin({
      id: 'recursive',
      setup(ctx) {
        ctx.on('queue.beforeAdd', () => {
          queue.addTrack(new Track());
        });
      },
    })(),
  );
  expect(() => queue.addTrack(new Track())).toThrow(/Reentrant/);
  expect(queue.size).toBe(0);
  await p.plugins.unregister('recursive');
  await p.plugins.register(
    definePlugin({
      id: 'invalid',
      setup(ctx) {
        ctx.on('queue.beforeAdd', (input) => ({ action: 'replace', value: { ...input, guildId: 'other' } }));
      },
    })(),
  );
  expect(() => queue.addTrack(new Track())).toThrow(/Invalid replacement/);
  expect(queue.size).toBe(0);
});

it('scopes local handlers by guild and removes dynamic subscriptions from introspection', async () => {
  const p = player();
  let remove = () => {};
  await p.plugins.register(
    definePlugin({
      id: 'scoped',
      setup(ctx) {
        remove = ctx.on('queue.beforeAdd', () => ({ action: 'cancel', reason: 'guild policy' }), { guildIds: ['one'] });
      },
    })(),
  );
  const one = await p.nodes.create('one');
  const two = await p.nodes.create('two');
  two.addTrack(new Track());
  expect(() => one.addTrack(new Track())).toThrow(/guild policy/);
  expect(p.plugins.describe()[0]?.operations).toContain('queue.beforeAdd');
  remove();
  remove();
  expect(p.plugins.hasCapability('queue.beforeAdd')).toBe(false);
  expect(p.plugins.describe()[0]?.operations).not.toContain('queue.beforeAdd');
  one.addTrack(new Track());
});

it('vetoes creation before cache insertion and observes mandatory destruction', async () => {
  const p = player();
  const seen: string[] = [];
  await p.plugins.register(
    definePlugin({
      id: 'lifecycle',
      setup(ctx) {
        ctx.on('queue.beforeCreate', ({ guildId }) =>
          guildId === 'denied' ? { action: 'cancel', reason: 'denied' } : undefined,
        );
        ctx.on('queue.created', ({ guildId }) => {
          seen.push(`created:${guildId}`);
        });
        ctx.on('queue.destroyed', ({ guildId }) => {
          seen.push(`destroyed:${guildId}`);
        });
      },
    })(),
  );
  await expect(p.nodes.create('denied')).rejects.toThrow(/denied/);
  expect(p.nodes.has('denied')).toBe(false);
  await p.nodes.create('allowed');
  await p.destroy();
  expect(seen).toEqual(['created:allowed', 'destroyed:allowed']);
});

it('does not let observer failures interrupt collection invariants', async () => {
  const p = player();
  const errors: Error[] = [];
  p.on('error', (error) => {
    errors.push(error);
  });
  await p.plugins.register(
    definePlugin({
      id: 'observer',
      setup(ctx) {
        ctx.on('queue.changed', () => {
          throw new Error('observer failed');
        });
      },
    })(),
  );
  const queue = await p.nodes.create('guild');
  queue.addTrack(new Track());
  expect(queue.stats.tracksAdded).toBe(1);
  expect(queue.size).toBe(1);
  expect(errors[0]?.message).toMatch(/observer.*queue.changed/);
});

it('standalone runtimes reject local-only contracts and release failed registrations', async () => {
  const runtime = new SourcePluginRuntime();
  await expect(
    runtime.plugins.register(
      definePlugin({
        id: 'unsupported',
        setup(ctx) {
          ctx.on('queue.beforeAdd', () => undefined);
        },
      })(),
    ),
  ).rejects.toThrow(/Undefined operation: queue.beforeAdd/);
  expect(runtime.plugins.describe()).toEqual([]);
  await runtime.destroy();
});

it('rejects asynchronous callbacks at registration for synchronous capabilities', async () => {
  const p = player();
  await expect(
    p.plugins.register(
      definePlugin({
        id: 'async',
        setup(ctx) {
          // @ts-expect-error synchronous capabilities deliberately exclude Promise results
          ctx.on('queue.beforeAdd', async () => undefined);
        },
      })(),
    ),
  ).rejects.toThrow(/synchronous callback/);
});

it('dispatch inspects subscribers rather than unrelated handlers', async () => {
  const p = player();
  const unrelated = vi.fn();
  for (let i = 0; i < 300; i++) {
    await p.plugins.register(
      definePlugin({
        id: `unrelated-${i}`,
        setup(ctx) {
          ctx.on('lyrics.search', unrelated);
        },
      })(),
    );
  }
  const subscribed = vi.fn();
  await p.plugins.register(
    definePlugin({
      id: 'subscribed',
      setup(ctx) {
        ctx.on('queue.beforeAdd', subscribed);
      },
    })(),
  );
  const queue = await p.nodes.create('guild');
  for (let i = 0; i < 100; i++) queue.addTrack(new Track());
  expect(subscribed).toHaveBeenCalledTimes(100);
  expect(unrelated).not.toHaveBeenCalled();
});

it('modern byte transformations compose across providers and destroy upstream streams', async () => {
  const p = player();
  const input = Readable.from(['encoded']);
  await p.plugins.register(
    definePlugin({
      id: 'source',
      setup(ctx) {
        ctx.on('track.stream', () => input);
      },
    })(),
  );
  await p.plugins.register(
    definePlugin({
      id: 'transformer',
      setup(ctx) {
        ctx.on('media.transform', ({ track, stream }) => ({
          track,
          stream: stream.pipe(
            new Transform({
              transform(chunk, _encoding, callback) {
                callback(null, Buffer.from(String(chunk).toUpperCase()));
              },
            }),
          ),
        }));
      },
    })(),
  );
  const track = new Track({ sourceReference: { pluginId: 'source', data: null } });
  const result = await p.plugins.resolveStream(track);
  if (!('stream' in result)) throw new Error('Expected encoded stream');
  const chunks: Buffer[] = [];
  for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe('ENCODED');
  expect(input.destroyed).toBe(true);
});

it('validates audio interception before contacting Remedia', async () => {
  const p = player();
  const queue = await p.nodes.create('guild');
  await p.plugins.register(
    definePlugin({
      id: 'volume',
      setup(ctx) {
        ctx.on('audio.beforeVolume', (input) => ({ action: 'replace', value: { ...input, volume: 250 } }));
      },
    })(),
  );
  await expect(queue.node.setVolume(20)).rejects.toThrow(/Volume/);
  expect(queue.options.volume).toBeUndefined();
});

it('selects a real queued occurrence for playback and crossfade without changing occurrence identity', async () => {
  const { setup, TestTrack } = await import('./mocks/queue.js');
  const { settle } = await import('./mocks/async.js');
  const { player: p, queue, session } = await setup({ queueOptions: { crossfade: { enabled: true } } });
  players.push(p);
  const phases: boolean[] = [];
  await p.plugins.register(
    definePlugin({
      id: 'scheduler',
      setup(ctx) {
        ctx.on('queue.selectNext', (input) => {
          phases.push(input.crossfade);
          return { action: 'replace', value: { ...input, index: input.candidates.length - 1 } };
        });
      },
    })(),
  );
  const tracks = [new TestTrack('first'), new TestTrack('second'), new TestTrack('third')];
  await queue.play(tracks);
  expect(queue.currentTrack).toBe(tracks[2]);
  const identity = queue.tracks.entryId(1);
  session.requestPreparation();
  await settle();
  expect(phases).toEqual([false, true]);
  expect(queue.tracks.entryId(1)).toBe(identity);
  expect(session.stageOptions).toHaveLength(1);
});

it('cancels an active encoded transformation on unregister and drains its cleanup', async () => {
  const p = player();
  const cleanup = vi.fn();
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await p.plugins.register(
    definePlugin({
      id: 'transform',
      setup(ctx) {
        ctx.onCleanup(cleanup);
        ctx.on('media.transform', async (input, { signal }) => {
          started();
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          });
          return input;
        });
      },
    })(),
  );
  const stream = Readable.from(['bytes']);
  const execution = p.plugins.execute('media.transform', { track: new Track(), stream });
  const rejection = expect(execution).rejects.toThrow();
  await entered;
  await p.plugins.unregister('transform');
  await rejection;
  expect(cleanup).toHaveBeenCalledOnce();
  expect(p.plugins.hasCapability('media.transform')).toBe(false);
});

it('validates persistence transforms and keeps the synchronous serialization API unchanged', async () => {
  const p = player();
  const track = new Track({ title: 'original' });
  await p.plugins.register(
    definePlugin({
      id: 'persistence',
      setup(ctx) {
        ctx.on('serialization.afterSerialize', (input) =>
          input.type === 'track' ? { ...input, data: { ...input.data, title: 'persisted' } } : input,
        );
      },
    })(),
  );
  const payload = await p.plugins.serialize(track);
  const restored = await p.plugins.restore(payload);
  expect(restored.title).toBe('persisted');
  expect(track.serialize().data.title).toBe('original');
});

it('rejects recursive asynchronous capability dispatch', async () => {
  const p = player();
  await p.plugins.register(
    definePlugin({
      id: 'recursive-async',
      setup(ctx) {
        ctx.on('search.beforeQuery', (input) => p.plugins.execute('search.beforeQuery', input));
      },
    })(),
  );
  await expect(p.plugins.execute('search.beforeQuery', { query: 'test' })).rejects.toThrow(
    /Recursive capability dispatch/,
  );
});

it('observes strongly typed public event argument ordering', async () => {
  const p = player();
  const observed: unknown[][] = [];
  await p.plugins.register(
    definePlugin({
      id: 'events',
      setup(ctx) {
        ctx.on('queue.event', (input) => {
          if (input.event === 'audioTrackAdd') {
            const [track] = input.args;
            observed.push([input.guildId, track]);
          }
        });
      },
    })(),
  );
  const queue = await p.nodes.create('guild');
  const track = new Track();
  queue.addTrack(track);
  expect(observed).toEqual([['guild', track]]);
});
