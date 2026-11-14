import { afterEach, expect, expectTypeOf, it } from 'vitest';
import {
  GuildQueue,
  createContext,
  useContext,
  useHistory,
  useMainPlayer,
  useMetadata,
  usePlayer,
  useQueue,
  useTimeline,
  useVolume,
  type DiscordPlayer,
  type GuildQueueHistory,
  type GuildQueuePlayerNode,
  type GuildQueueTimeline,
  type SetterFN,
  type VolumeSetterFN,
} from '../src/index.js';
import { settle } from './mocks/async.js';
import { setup, TestTrack } from './mocks/queue.js';

const cleanups: (() => void | Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(options: Parameters<typeof setup>[0] = {}) {
  const value = await setup(options);
  cleanups.push(() => value.player.destroy());

  return value;
}

it('isolates generic asynchronous scopes, fallback values and explicit exits', async () => {
  const context = createContext('fallback');

  expect(context.isLost).toBe(true);
  expect(useContext(context)).toBe('fallback');

  await Promise.all(
    ['one', 'two'].map((value) =>
      context.provide(value, async () => {
        await settle();

        expect(useContext(context)).toBe(value);
        expect(context.isLost).toBe(false);

        context.exit(() => expect(context.consume()).toBe('fallback'));

        expect(context.consume()).toBe(value);
      }),
    ),
  );

  expect(() => context.provide(undefined as never, () => {})).toThrow('undefined');
  expect(() => context.provide('value', null as never)).toThrow(TypeError);
  expect(createContext().consume()).toBeUndefined();
});

it('resolves v7 hook targets from context, guilds and queue instances', async () => {
  const a = await fixture({ guildId: 'guild-a', queueOptions: { metadata: { owner: 'queue' } } });
  const b = await fixture({ guildId: 'guild-b' });

  expect(useMainPlayer()).toBe(a.player);

  await a.player.context.provide({ guild: { id: a.queue.id } }, async () => {
    expect(useMainPlayer()).toBe(a.player);
    expect(usePlayer()).toBe(a.queue.node);
    expect(useQueue()).toBe(a.queue);
    expect(useHistory()).toBe(a.queue.history);

    expectTypeOf(useMainPlayer()).toEqualTypeOf<DiscordPlayer>();
    expectTypeOf(usePlayer()).toEqualTypeOf<GuildQueuePlayerNode<unknown> | null>();
    expectTypeOf(useQueue()).toEqualTypeOf<GuildQueue<unknown> | null>();
    expectTypeOf(useHistory()).toEqualTypeOf<GuildQueueHistory<unknown> | null>();
  });

  expect(useQueue(a.queue.id)).toBe(a.queue);
  expect(useQueue({ id: a.queue.id })).toBe(a.queue);
  expect(useQueue({ guildId: a.queue.id })).toBe(a.queue);
  expect(useQueue(a.queue)).toBe(a.queue);
  expect(usePlayer(a.queue.id)).toBe(a.queue.node);
  expect(useHistory({ guildId: a.queue.id })).toBe(a.queue.history);
  expect(useQueue('missing')).toBeNull();
  expect(usePlayer('missing')).toBeNull();
  expect(useHistory('missing')).toBeNull();

  expect(() => useQueue()).toThrow('explicit guild argument');
  expect(() => usePlayer()).toThrow('explicit guild argument');
  expect(() => a.player.context.provide({}, () => useQueue())).toThrow('requires a guild or queue');

  await a.player.context.provide({ guildId: 'missing' }, () => {
    expect(useQueue()).toBeNull();
    expect(usePlayer()).toBeNull();
    expect(useHistory()).toBeNull();
    expect(useTimeline()).toBeNull();
    expect(useMetadata()[0]()).toBeUndefined();
    expect(useVolume()[0]()).toBeUndefined();
  });

  await a.player.context.provide({ queue: b.queue }, () => {
    expect(useMainPlayer()).toBe(a.player);
    expect(useQueue()).toBe(b.queue);
    expect(usePlayer()).toBe(b.queue.node);
  });

  expect(useMainPlayer()).toBe(a.player);
});

it('returns explicit queue instances but keeps cache-backed hooks aligned with v7', async () => {
  const { player } = await fixture();
  const detached = new GuildQueue(player.nodes, 'detached');

  try {
    expect(useQueue(detached)).toBe(detached);
    expect(usePlayer(detached)).toBeNull();
    expect(useHistory(detached)).toBeNull();
  } finally {
    await detached.destroy();
  }
});

it('reads and writes real queue metadata through v7 functional tuples', async () => {
  type Metadata = { count: number; label: string };

  const { player, queue } = await fixture({ queueOptions: { metadata: { count: 1, label: 'a' } } });

  await player.context.provide({ queue }, () => {
    const [getMetadata, setMetadata] = useMetadata<Metadata>();

    expect(getMetadata()).toEqual({ count: 1, label: 'a' });
    expectTypeOf(getMetadata).toEqualTypeOf<() => Metadata>();
    expectTypeOf(setMetadata).toEqualTypeOf<(metadata: Metadata | SetterFN<Metadata, Metadata>) => void>();

    setMetadata((previous) => ({ ...previous, count: previous.count + 1 }));

    expect(queue.metadata).toEqual({ count: 2, label: 'a' });
    expect(getMetadata()).toEqual({ count: 2, label: 'a' });

    setMetadata({ count: 5, label: 'b' });

    expect(queue.metadata).toEqual({ count: 5, label: 'b' });
    expect(getMetadata()).toEqual({ count: 5, label: 'b' });
  });

  const [getMissing, setMissing] = useMetadata('missing');

  expect(getMissing()).toBeUndefined();
  expect(() => setMissing(null)).not.toThrow();
});

it('reads and writes volume through awaited v7 tuples', async () => {
  const { player, queue } = await fixture();

  await player.context.provide({ guildId: queue.id }, async () => {
    const [getVolume, setVolume] = useVolume();

    expect(getVolume()).toBe(100);
    expectTypeOf(getVolume).toEqualTypeOf<() => number>();
    expectTypeOf(setVolume).toEqualTypeOf<(volume: number | VolumeSetterFN) => Promise<boolean | undefined>>();

    expect(await setVolume(42)).toBe(true);
    expect(getVolume()).toBe(42);
    expect(queue.node.volume).toBe(42);

    expect(await setVolume((previous) => previous + 8)).toBe(true);
    expect(getVolume()).toBe(50);
  });

  const [getMissing, setMissing] = useVolume('missing');

  expect(getMissing()).toBeUndefined();
  expect(await setMissing(10)).toBeUndefined();
});

it('exposes the v7 timeline controller with async controls and filter selection', async () => {
  const { player, queue, session } = await fixture();
  const track = new TestTrack('timeline');

  await queue.play(track);
  session.elapsedMs = 2500;
  session.position.mediaMs = 1000;

  await player.context.provide({ queue }, async () => {
    const timeline = useTimeline();

    expect(timeline).not.toBeNull();
    expectTypeOf(useTimeline()).toEqualTypeOf<GuildQueueTimeline | null>();

    if (!timeline) return;

    expect(timeline.track).toBe(track);
    expect(timeline.volume).toBe(100);
    expect(timeline.paused).toBe(false);
    expect(timeline.timestamp?.current.value).toBe(1000);
    expect(timeline.timestamp?.total.value).toBe(60_000);

    const sourceTimeline = useTimeline({ ignoreFilters: true });

    expect(sourceTimeline?.timestamp?.current.value).toBe(1000);

    expect(await timeline.pause()).toBe(true);
    expect(timeline.paused).toBe(true);
    expect(await timeline.resume()).toBe(true);
    expect(timeline.paused).toBe(false);
    expect(await timeline.setVolume(25)).toBe(true);
    expect(timeline.volume).toBe(25);
    expect(await timeline.setPosition(5000)).toBe(true);
    expect(session.position.mediaMs).toBe(5000);
  });

  expect(useTimeline({ node: 'missing' })).toBeNull();
  expect(useTimeline({ node: queue.id })?.track).toBe(track);
});

it('isolates nested and concurrent Player scopes and restores fallback order', async () => {
  const a = await fixture({ guildId: 'guild-a' });
  const b = await fixture({ guildId: 'guild-b' });

  expect(useMainPlayer()).toBe(a.player);

  await a.player.context.provide({ guildId: a.queue.id }, async () => {
    await Promise.all([
      (async () => {
        await settle();

        expect(useQueue()).toBe(a.queue);
        expect(usePlayer()).toBe(a.queue.node);
      })(),
      (async () => {
        await settle();

        await b.player.context.provide({ guildId: b.queue.id }, async () => {
          await settle();

          expect(useMainPlayer()).toBe(b.player);
          expect(useQueue()).toBe(b.queue);
          expect(usePlayer()).toBe(b.queue.node);
        });

        expect(useMainPlayer()).toBe(a.player);
        expect(useQueue()).toBe(a.queue);
      })(),
    ]);

    expect(useMainPlayer()).toBe(a.player);
    expect(useQueue()).toBe(a.queue);
  });

  expect(useMainPlayer()).toBe(a.player);

  await a.player.destroy();

  expect(useMainPlayer()).toBe(b.player);
  expect(() => useQueue()).toThrow('explicit guild argument');
  expect(useQueue(a.queue.id)).toBeNull();

  await b.player.destroy();

  expect(() => useMainPlayer()).toThrow('Player context is not available');
  expect(() => useQueue(a.queue.id)).toThrow('Player context is not available');
});
