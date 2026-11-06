import { expect, it, vi } from 'vitest';
import { Playlist, QueueRepeatMode, Track } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { settle } from './mocks/async.js';
import { deferred } from './mocks/async.js';
import type { MediaSource } from '@remedia/client';

it('selects explicit skip targets both while idle and during active playback', async () => {
  const { queue, player } = await setup();
  const [one, two, three] = ['one', 'two', 'three'].map((title) => new TestTrack(title));
  queue.addTracks([one!, two!, three!]);
  expect(await queue.skipTo('missing')).toBeNull();
  expect(await queue.skipTo(two!.id)).toBe(two);
  expect(queue.currentTrack).toBe(two);
  expect(await queue.jump(three!.url)).toBe(three);
  expect(queue.currentTrack).toBe(three);
  expect(queue.history.previousTrack).toBe(two);
  expect(queue.tracks.toArray()).toEqual([one]);
  expect(await queue.playNext()).toBe(three);
  await queue.stop();
  await queue.stop();
  expect(await queue.skip()).toBeNull();
  await queue.delete();
  await queue.destroy();
  await queue.stop();
  expect(player.queues.has(queue.id)).toBe(false);
});

it('cancels a pending source when skipping to a target and never starts the late source', async () => {
  const { queue, player, session } = await setup();
  const source = deferred<MediaSource>();
  const pending = new TestTrack('pending', () => source.promise);
  const target = new TestTrack('target');
  const playing = queue.play(pending);
  await settle();
  queue.addTrack(target);
  expect(await queue.skipTo(target)).toBe(target);
  source.resolve({ url: pending.url });
  expect((await playing).playerResult).toBeNull();
  expect(queue.currentTrack).toBe(target);
  expect(session.playCalls).toBe(1);
  await player.destroy();
});

it('requeues external cancellation without recording a decode failure', async () => {
  const { queue, player, session } = await setup();
  const source = deferred<MediaSource>();
  const pending = new TestTrack('pending', () => source.promise);
  const controller = new AbortController();
  const playing = queue.play(pending, { signal: controller.signal });
  await settle();
  controller.abort('request cancelled');
  source.resolve({ url: pending.url });
  expect((await playing).playerResult).toBeNull();
  expect(queue.tracks.peek()).toBe(pending);
  expect(queue.stats.tracksFailed).toBe(0);
  expect(session.playCalls).toBe(0);
  await player.destroy();
});

it('replaces pending preparation with history playback without starting the stale source', async () => {
  const { queue, player, session } = await setup();
  const source = deferred<MediaSource>();
  const pending = new TestTrack('pending', () => source.promise);
  const historical = new TestTrack('history');
  const playing = queue.play(pending);
  await settle();
  await queue.playHistoryTrack(historical, false);
  source.resolve({ url: pending.url });
  expect((await playing).playerResult).toBeNull();
  expect(queue.currentTrack).toBe(historical);
  expect(queue.tracks.toArray()).toEqual([]);
  expect(session.playCalls).toBe(1);
  await player.destroy();
});

it('reports failed automatic transitions once and restores the failed track at the queue head', async () => {
  const { queue, player, session } = await setup();
  const failure = vi.fn();
  player.events.on('playerError', failure);
  const broken = new TestTrack('broken', async () => {
    throw new Error('source failed');
  });
  await queue.play([new TestTrack('first'), broken]);
  session.complete();
  await settle();
  expect(failure).toHaveBeenCalledOnce();
  expect(queue.currentTrack).toBeNull();
  expect(queue.tracks.peek()).toBe(broken);
  expect(queue.stats.tracksFailed).toBe(1);
  await player.destroy();
});

it('bounds terminal deduplication while continuing repeated playback over many generations', async () => {
  const { queue, player, session } = await setup();
  queue.setRepeatMode(QueueRepeatMode.TRACK);
  const track = new TestTrack('repeated');
  await queue.play(track);
  for (let index = 0; index < 514; index++) {
    session.complete();
    await settle();
  }
  expect(queue.stats.tracksFinished).toBe(514);
  expect(session.playCalls).toBe(515);
  expect(queue.currentTrack).toBe(track);
  await player.destroy();
});

it('applies per-play policies, batches and dynamic shuffle without losing queued identities', async () => {
  const { queue, player, session } = await setup();
  queue.metadata = { updated: true };
  expect(queue.metadata).toEqual({ updated: true });
  expect(await queue.play([])).toEqual({ track: null, playerResult: null });
  queue.toggleShuffle(false);
  queue.enableShuffle();
  const tracks = ['one', 'two', 'three'].map((title) => new TestTrack(title));
  await queue.play(new Playlist({ tracks }), {
    selfDeaf: false,
    selfMute: true,
    volume: 20,
    filterGraph: 'volume=0.2',
  });
  expect(tracks).toContain(queue.currentTrack);
  expect(queue.tracks.size).toBe(2);
  expect(session.selfMute).toBe(true);
  expect(session.selfDeaf).toBe(false);
  expect(session.volume).toBe(0.2);
  expect(session.filters.graph).toBe('volume=0.2');
  await player.destroy();
});

it('validates queue policies and disconnected playback before inserting resources', async () => {
  const { queue, player } = await setup();
  for (const value of [NaN, -Infinity]) {
    expect(() => queue.setMaxSize(value)).toThrow(TypeError);
    expect(() => queue.setMaxHistorySize(value)).toThrow(TypeError);
  }
  expect(() => queue.setRepeatMode(-1 as never)).toThrow(RangeError);
  expect(() => queue.append(new Track(), -1)).toThrow(RangeError);
  await expect(queue.connect({ channelId: 'voice', volume: 101 })).rejects.toThrow(RangeError);
  await queue.node.destroySession();
  await expect(queue.play(new TestTrack('missing-session'))).rejects.toThrow('voice session');
  expect(queue.size).toBe(0);
  await player.destroy();
  await expect(player.createQueue('invalid', { volume: -1 })).rejects.toThrow(RangeError);
});

it('keeps upcoming tracks when disconnected navigation cannot start playback', async () => {
  const { queue, player } = await setup();
  const track = new TestTrack('retained');
  queue.addTrack(track);
  await queue.node.destroySession();

  await expect(queue.playNext()).rejects.toThrow('connected Remedia session');
  expect(queue.tracks.toArray()).toEqual([track]);

  await expect(queue.skipTo(track)).rejects.toThrow('connected Remedia session');
  expect(queue.tracks.toArray()).toEqual([track]);

  await player.destroy();
});
