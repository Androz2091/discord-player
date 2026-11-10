import { expect, it, vi } from 'vitest';
import { Queue, Playlist, QueueRepeatMode, NoResultError, QueueCapacityError } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { settle } from './mocks/async.js';

it('resolves guild queues and retains their original options and identities', async () => {
  const { player, queue } = await setup();

  expect(player.queues.resolve(queue.id)).toBe(queue);
  expect(player.queues.resolve({ id: queue.id })).toBe(queue);
  expect(player.queues.resolve({ guildId: queue.id })).toBe(queue);
  expect(player.queues.resolve('missing')).toBeNull();
  expect(player.queues.has(queue.id)).toBe(true);
  expect(await player.createQueue(queue.id, { metadata: 'ignored' })).toBe(queue);
  expect(await player.queues.delete('missing')).toBe(false);
  expect(await player.queues.delete(queue.id)).toBe(true);
  expect(player.queues.has(queue.id)).toBe(false);
});

it('supports track insertion, lookup, mutation and capacity limits without partial changes', async () => {
  const { queue, player } = await setup({ maxSize: 5 });
  const tracks = ['one', 'two', 'three', 'four'].map((title) => new TestTrack(title));

  queue.addTrack(new Playlist({ tracks: tracks.slice(0, 2) }));
  queue.append(tracks[2]!);
  queue.prepend(tracks[3]!);

  expect(queue.tracks.toArray()).toEqual([tracks[3], tracks[0], tracks[1], tracks[2]]);

  queue.moveTrack(tracks[3]!.id, 2);
  queue.swapTracks(tracks[0]!.title, tracks[2]!.url);
  queue.copyTrack('missing');
  queue.moveTrack('missing');
  queue.swapTracks('missing', 0);
  queue.copyTrack(tracks[0]!);

  expect(queue.size).toBe(5);
  expect(queue.getSize()).toBe(5);
  expect(queue.getMaxSize()).toBe(5);
  expect(queue.getCapacity()).toBe(0);
  expect(queue.isFull()).toBe(true);

  const before = queue.tracks.toArray();

  expect(() => queue.addTracks([new TestTrack('overflow')])).toThrow(QueueCapacityError);
  expect(queue.tracks.toArray()).toEqual(before);
  expect(queue.removeTrack('missing')).toBeUndefined();
  expect(queue.removeTrack(tracks[0]!.id)).toBe(tracks[0]);

  queue.setMaxSize(10);

  expect(queue.maxSize).toBe(10);

  queue.clear();

  const values = new Queue<(typeof tracks)[number]>();

  values.add(tracks.slice(0, 2));
  queue.append(values);
  queue.prepend([tracks[2]!], 1);
  queue.insertTrack(tracks[3]!, 3);

  expect(queue.estimatedDuration).toBe(240000);
  expect(queue.durationFormatted).toBe('4:00');
  expect(() => queue.prepend(tracks[0]!, -1)).toThrow(RangeError);

  queue.setRepeatMode(QueueRepeatMode.QUEUE);

  expect(queue.repeatMode).toBe(QueueRepeatMode.QUEUE);

  queue.repeatMode = QueueRepeatMode.OFF;

  expect(queue.repeatMode).toBe(QueueRepeatMode.OFF);

  queue.enableShuffle(false);

  expect(queue.isShuffling).toBe(false);

  queue.toggleShuffle();

  expect(queue.isShuffling).toBe(true);

  queue.toggleShuffle();

  expect(queue.isShuffling).toBe(false);

  queue.disableShuffle();
  queue.clear();

  expect(queue.isEmpty()).toBe(true);

  await player.destroy();

  expect(() => queue.addTrack(tracks[0]!)).toThrow('destroyed');
});

it('enforces history limits, disabled retention, navigation errors and failure restoration', async () => {
  const { queue, player } = await setup({ maxHistorySize: 2 });
  const tracks = ['one', 'two', 'three'].map((title) => new TestTrack(title));

  expect(queue.history.currentTrack).toBeNull();
  expect(queue.history.previousTrack).toBeNull();
  expect(queue.history.getSize()).toBe(0);
  expect(queue.history.isEmpty()).toBe(true);

  queue.history.push(tracks);

  expect(queue.history.previousTrack).toBe(tracks[2]);
  expect(queue.history.getSize()).toBe(2);

  queue.setMaxHistorySize(1);

  expect(queue.getMaxHistorySize()).toBe(1);
  expect(queue.history.getSize()).toBe(1);

  const failure = vi.spyOn(queue, 'playHistoryTrack').mockRejectedValueOnce(new Error('history failed'));

  await expect(queue.history.previous(false)).rejects.toThrow('history failed');

  expect(queue.history.previousTrack).toBe(tracks[2]);

  failure.mockRestore();
  queue.history.clear();
  await expect(queue.history.previous()).rejects.toBeInstanceOf(NoResultError);
  await expect(queue.history.next()).rejects.toBeInstanceOf(NoResultError);
  queue.options.disableHistory = true;

  expect(queue.history.push(tracks[0]!)).toBe(false);

  queue.options.disableHistory = false;
  queue.addTrack(tracks[0]!);
  await queue.history.next();

  expect(queue.history.currentTrack).toBe(tracks[0]);

  queue.addTrack(tracks[1]!);
  await queue.history.next();
  await settle();

  expect(queue.currentTrack).toBe(tracks[1]);

  await player.destroy();
});
