import { expect, it, vi } from 'vitest';
import { AsyncQueue, AsyncQueueLock } from '../src/utils/async-queue.js';

it('grants same-key acquisitions in FIFO order while different keys remain independent', async () => {
  const queue = new AsyncQueue();
  const first = await queue.acquire('one');
  const second = queue.acquire('one');
  const third = queue.acquire('one');
  const independent = await queue.acquire('two');
  expect(queue.has('one')).toBe(true);
  independent.release();
  expect(queue.has('two')).toBe(false);
  first.release();
  const next = await second;
  first.release();
  expect(queue.has('one')).toBe(true);
  next[Symbol.dispose]();
  (await third).release();
  expect(queue.has('one')).toBe(false);
});

it('removes aborted waiters without disturbing the current holder or later waiters', async () => {
  const queue = new AsyncQueue();
  const first = await queue.acquire('one');
  const controller = new AbortController();
  const pending = queue.acquire('one', { signal: controller.signal });
  const rejection = expect(pending).rejects.toBe('cancel');
  const next = queue.acquire('one');
  controller.abort('cancel');
  await rejection;
  first.release();
  (await next).release();
  expect(queue.has('one')).toBe(false);
  await expect(queue.acquire('one', { signal: AbortSignal.abort('pre-aborted') })).rejects.toBe('pre-aborted');
  expect(queue.has('one')).toBe(false);
});

it('clears pending acquisitions, removes abort listeners, and keeps holders usable', async () => {
  const queue = new AsyncQueue();
  const holder = await queue.acquire('one');
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const pending = queue.acquire('one', { signal: controller.signal });
  const rejection = expect(pending).rejects.toThrow('cleared');
  queue.clear();
  await rejection;
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(queue.has('one')).toBe(true);
  holder.release();
  expect(queue.has('one')).toBe(false);
  const release = vi.fn();
  const lock = new AsyncQueueLock(release);
  lock.release();
  lock[Symbol.dispose]();
  expect(release).toHaveBeenCalledOnce();
});
