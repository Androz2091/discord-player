import { setTimeout } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

it('aborts queue consumers before asynchronous destruction completes', async () => {
  const { player, queue, session } = await setup();
  const signal = queue.signal;
  const cleanup = deferred<void>();
  const dispose = vi.spyOn(session, 'dispose').mockImplementation(() => cleanup.promise);
  const consumer = setTimeout(60_000, undefined, { signal });
  const cancelled = expect(consumer).rejects.toMatchObject({ name: 'AbortError' });
  const abort = vi.fn(() => expect(queue.destroyed).toBe(true));

  signal.addEventListener('abort', abort);

  expect(signal.aborted).toBe(false);
  expect(queue.signal).toBe(signal);

  const destruction = queue.destroy();

  expect(signal.aborted).toBe(true);
  expect(signal.reason).toMatchObject({ name: 'AbortError' });
  expect(player.signal.aborted).toBe(false);

  await cancelled;
  await settle();

  expect(dispose).toHaveBeenCalledOnce();

  cleanup.resolve();
  await destruction;
  await queue.destroy();

  expect(abort).toHaveBeenCalledOnce();
  expect(queue.signal).toBe(signal);

  await player.destroy();
});

it('keeps queue lifetime independent of playback, session replacement and other queues', async () => {
  const { player, queue } = await setup();
  const other = await player.createQueue('other');

  await queue.play(new TestTrack('a'));
  await queue.stop();
  await queue.node.destroySession();
  await queue.connect({ channelId: 'replacement' });

  expect(queue.signal.aborted).toBe(false);

  const previousSignal = queue.signal;

  await player.deleteQueue(queue.id);

  expect(previousSignal.aborted).toBe(true);
  expect(other.signal.aborted).toBe(false);
  expect(player.signal.aborted).toBe(false);

  const replacement = await player.createQueue(queue.id);

  expect(replacement.signal).not.toBe(previousSignal);
  expect(replacement.signal.aborted).toBe(false);

  await player.destroy();

  expect(other.signal.aborted).toBe(true);
  expect(replacement.signal.aborted).toBe(true);
});

it('aborts Player consumers and every owned queue at the beginning of destruction', async () => {
  const { player, queue, session } = await setup();
  const other = await player.createQueue('other');
  const signal = player.signal;
  const abort = vi.fn();
  const cleanup = deferred<void>();
  const dispose = vi.spyOn(session, 'dispose').mockImplementation(() => cleanup.promise);
  const consumer = setTimeout(60_000, undefined, { signal });
  const cancelled = expect(consumer).rejects.toMatchObject({ name: 'AbortError' });

  signal.addEventListener('abort', abort);

  expect(signal.aborted).toBe(false);
  expect(player.signal).toBe(signal);

  const destruction = player.destroy();

  expect(signal.aborted).toBe(true);
  expect(queue.signal.aborted).toBe(true);
  expect(other.signal.aborted).toBe(true);

  await cancelled;
  await settle();

  expect(dispose).toHaveBeenCalledOnce();

  cleanup.resolve();
  await destruction;
  await player.destroy();

  expect(abort).toHaveBeenCalledOnce();
  expect(player.signal).toBe(signal);
});

it('keeps lifetime signals aborted when resource cleanup fails', async () => {
  const { player, queue, session } = await setup();

  vi.spyOn(session, 'dispose').mockRejectedValue(new Error('disposal failed'));

  await expect(player.destroy()).rejects.toThrow('disposal failed');

  expect(player.signal.aborted).toBe(true);
  expect(queue.signal.aborted).toBe(true);
});
