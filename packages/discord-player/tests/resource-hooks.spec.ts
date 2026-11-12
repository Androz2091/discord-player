import { Readable } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { onBeforeCreateStream, onStreamExtracted, onAfterCreateStream, useMainPlayer } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(options: Parameters<typeof setup>[0] = {}) {
  const value = await setup(options);
  cleanups.push(() => value.player.destroy());
  return value;
}

it('applies queue, Player and global precedence in the correct Player async context', async () => {
  const global = vi.fn(async () => ({ url: 'https://fixture.test/global' }));
  cleanups.push(onBeforeCreateStream(global));
  const playerHook = vi.fn(async () => ({ url: 'https://fixture.test/player' }));
  const { player, queue, session } = await fixture({ playerOptions: { onBeforeCreateStream: playerHook } });
  queue.onBeforeCreateStream = async (_track, _queryType, owner) => {
    expect(owner).toBe(queue);
    expect(useMainPlayer()).toBe(player);
    await settle();
    expect(useMainPlayer()).toBe(player);
    return { url: 'https://fixture.test/queue' };
  };
  const play = vi.spyOn(session, 'play');
  const track = new TestTrack('one', async () => {
    throw new Error('provider should be bypassed');
  });
  await queue.play(track);
  expect(play.mock.lastCall?.[0]).toEqual({ url: 'https://fixture.test/queue' });
  expect(playerHook).not.toHaveBeenCalled();
  expect(global).not.toHaveBeenCalled();
  await queue.stop();
  queue.onBeforeCreateStream = undefined;
  await queue.play(track);
  expect(play.mock.lastCall?.[0]).toEqual({ url: 'https://fixture.test/player' });
  const other = await fixture();
  await other.queue.play(track);
  expect(global).toHaveBeenCalledOnce();
});

it('uses arbitrary as the v7 query fallback and runs descriptor interception after provider resolution', async () => {
  const { queue, session } = await fixture();
  const stream = Readable.from(['encoded']);
  const queryTypes: unknown[] = [];
  queue.onBeforeCreateStream = async (_track, queryType) => {
    queryTypes.push(queryType);

    return null;
  };
  const extracted = vi.fn(async (input) => input);
  cleanups.push(onStreamExtracted(extracted));
  const after = vi.fn(async (input: Readable) => ({ stream: input, type: 'legacy' }));
  cleanups.push(onAfterCreateStream(after));
  const play = vi.spyOn(session, 'play');
  const track = new TestTrack('one', async () => ({ stream }));

  await queue.play(track);

  expect(queryTypes).toEqual(['arbitrary']);
  expect(extracted).toHaveBeenCalledExactlyOnceWith({ stream }, track, queue, expect.any(AbortSignal));
  expect(after).toHaveBeenCalledExactlyOnceWith(stream, queue, track, expect.any(AbortSignal));
  expect(play.mock.lastCall?.[0]).toEqual({ stream });
});

it('keeps v7 onBeforeCreateStream precedence over descriptor interception', async () => {
  const { queue, session } = await fixture();
  const stream = Readable.from(['intercepted']);
  queue.onBeforeCreateStream = async () => stream;
  const extracted = vi.fn(async (input) => input);
  cleanups.push(onStreamExtracted(extracted));
  const play = vi.spyOn(session, 'play');

  await queue.play(
    new TestTrack('one', async () => {
      throw new Error('provider should be bypassed');
    }),
  );

  expect(extracted).not.toHaveBeenCalled();
  expect(play.mock.lastCall?.[0]).toEqual({ stream });
});

it('keeps the resolved source when descriptor interception returns nullish', async () => {
  const { queue, session } = await fixture();
  const resolved = { stream: Readable.from(['resolved']) };
  const extracted = vi.fn(async () => undefined);
  cleanups.push(onStreamExtracted(extracted));
  const play = vi.spyOn(session, 'play');

  await queue.play(new TestTrack('nullish', async () => resolved));

  expect(extracted).toHaveBeenCalledOnce();
  expect(play.mock.lastCall?.[0]).toEqual(resolved);
});

it('rejects remote process-local bytes with an actionable error and preserves assignment', async () => {
  const { queue, session } = await fixture({ nodeType: 'remote' });
  const stream = Readable.from(['encoded']);
  queue.onBeforeCreateStream = async () => stream;
  await expect(queue.play(new TestTrack('one'))).rejects.toThrow('embedded node');
  expect(stream.destroyed).toBe(true);
  expect(session.nodeId).toBe('fake-node');
  expect(session.playCalls).toBe(0);
  queue.onBeforeCreateStream = async () => ({ url: 'https://fixture.test/remote' });
  await queue.play(new TestTrack('two'));
  expect(session.playCalls).toBe(1);
});

it('discards and closes a hook resource returned after cancellation', async () => {
  const { queue, session } = await fixture();
  const source = deferred<Readable>();
  const entered = deferred<void>();
  queue.onBeforeCreateStream = async () => {
    entered.resolve();
    return source.promise;
  };
  const playing = queue.play(new TestTrack('one'));
  const caught = playing.catch(() => undefined);
  await entered.promise;
  const stopping = queue.stop();
  const stream = Readable.from(['encoded']);
  source.resolve(stream);
  await Promise.all([caught, stopping]);
  expect(stream.destroyed).toBe(true);
  expect(session.playCalls).toBe(0);
});

it('prepares crossfade hooks once during staging and reuses the prepared native resource on promotion', async () => {
  const { queue, session } = await fixture({ queueOptions: { crossfade: { enabled: true } } });
  const hook = vi.fn(async (track: { url: string }) => ({ url: track.url }));
  queue.onBeforeCreateStream = hook;
  await queue.play([new TestTrack('one'), new TestTrack('two')]);
  session.requestPreparation();
  await settle();
  expect(hook).toHaveBeenCalledTimes(2);
  session.promote()();
  await settle();
  expect(queue.currentTrack?.title).toBe('two');
  expect(hook).toHaveBeenCalledTimes(2);
  expect(session.playCalls).toBe(1);
});

it('cancels a prepared resource across session replacement instead of playing it on the new session', async () => {
  const { queue, backend } = await fixture();
  const source = deferred<Readable>();
  const entered = deferred<void>();
  let preparationSignal: AbortSignal | undefined;
  queue.onBeforeCreateStream = async (_track, _type, _owner, signal) => {
    preparationSignal = signal;
    entered.resolve();
    return source.promise;
  };
  const playing = queue.play(new TestTrack('one'));
  await entered.promise;
  await queue.node.createSession({ channelId: 'replacement' });
  expect(preparationSignal?.aborted).toBe(true);
  const stream = Readable.from(['late bytes']);
  source.resolve(stream);
  await playing;
  expect(stream.destroyed).toBe(true);
  expect(backend.sessions.at(-1)?.playCalls).toBe(0);
  expect(queue.currentTrack).toBeNull();
});

it.each([false, true])(
  'normalizes local byte buffers and rejects them on remote execution (remote=%s)',
  async (remote) => {
    const { queue, session } = await fixture({ nodeType: remote ? 'remote' : 'embedded' });
    const bytes = Buffer.from('encoded fixture');
    queue.onBeforeCreateStream = async () => bytes;
    const play = vi.spyOn(session, 'play');
    if (remote) {
      await expect(queue.play(new TestTrack('buffer'))).rejects.toThrow('embedded node');
      expect(play).not.toHaveBeenCalled();
    } else {
      await queue.play(new TestTrack('buffer'));
      expect(play.mock.lastCall?.[0]).toEqual({ buffer: bytes });
    }
  },
);
