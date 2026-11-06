import { expect, it } from 'vitest';
import {
  createContext,
  useContext,
  useMainPlayer,
  usePlayer,
  useQueue,
  useHistory,
  useMetadata,
  useVolume,
  useTimeline,
} from '../src/index.js';
import { setup } from './mocks/queue.js';
import { settle } from './mocks/async.js';

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

it('scopes every hook to the owning Player and restores outside values', async () => {
  const a = await setup({ queueOptions: { metadata: { owner: 'queue' } } });
  const b = await setup();
  expect(useMainPlayer()).toBeNull();
  expect(usePlayer()).toBeNull();
  expect(useQueue()).toBeNull();
  expect(useHistory()).toBeNull();
  expect(useMetadata()).toBeUndefined();
  expect(useVolume()).toBeNull();
  expect(useTimeline()).toBeNull();
  await a.player.context.provide({ guild: { id: a.queue.id } }, async () => {
    await settle();
    expect(usePlayer()).toBe(a.player);
    expect(useQueue()).toBe(a.queue);
    expect(useQueue(a.queue.id)).toBe(a.queue);
    expect(useQueue('missing')).toBeNull();
    expect(useHistory()).toBe(a.queue.history);
    expect(useMetadata()).toEqual({ owner: 'queue' });
    expect(useVolume()).toBe(100);
    expect(useTimeline()).toBeNull();
    b.player.context.provide(
      {
        queue: b.queue,
        metadata: 'command',
        volume: 42,
        timeline: { current: { label: '0:01', value: 1000 }, total: { label: '1:00', value: 60000 }, progress: 2 },
      },
      () => {
        expect(usePlayer()).toBe(b.player);
        expect(useQueue()).toBe(b.queue);
        expect(useMetadata()).toBe('command');
        expect(useVolume()).toBe(42);
        expect(useTimeline()?.current.value).toBe(1000);
      },
    );
    expect(usePlayer()).toBe(a.player);
  });
  a.player.context.provide({}, () => {
    expect(useQueue()).toBeNull();
    expect(useVolume()).toBeNull();
    expect(useTimeline()).toBeNull();
  });
  expect(useMainPlayer()).toBeNull();
  await Promise.all([a.player.destroy(), b.player.destroy()]);
});
