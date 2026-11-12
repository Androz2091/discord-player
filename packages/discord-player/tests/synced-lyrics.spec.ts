import type { DiscordSessionEvents } from '@remedia/client';
import { afterEach, expect, it, vi } from 'vitest';
import { setup, TestTrack } from './mocks/queue.js';
import { settle } from './mocks/async.js';
import { parseLyrics } from '../src/index.js';

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];
async function fixture(options: Parameters<typeof setup>[0] = {}) {
  const value = await setup(options);
  players.push(value.player);
  return value;
}
afterEach(async () => {
  await Promise.all(players.splice(0).map((p) => p.destroy()));
  vi.useRealTimers();
});

it('normalizes fractional timestamps, offsets, repeated timestamps and unsorted large collections once', async () => {
  const { queue } = await fixture();
  expect(parseLyrics('[offset:100]\n[00:01.25][00:02.005]a\n[00:01.250]b')).toEqual([
    { timestampMs: 1350, line: 'b' },
    { timestampMs: 2105, line: 'a' },
  ]);
  const lines = Array.from({ length: 100_000 }, (_, index) => ({
    timestampMs: index * 10,
    line: String(index),
  })).reverse();
  queue.syncedLyrics.load(lines);
  expect(queue.syncedLyrics.at(-1)).toBeNull();
  expect(queue.syncedLyrics.at(0)).toEqual({ timestamp: 0, line: '0' });
  expect(queue.syncedLyrics.at(999_999)).toEqual({ timestamp: 999_990, line: '99999' });
  expect(queue.syncedLyrics.at(123_455)).toEqual({ timestamp: 123_450, line: '12345' });
  expect(() => queue.syncedLyrics.load([{ timestampMs: NaN, line: 'bad' }])).toThrow(RangeError);
});

it('uses the native timeline with one timer, independent subscriptions, pause, seek and speed changes', async () => {
  vi.useFakeTimers();
  const { queue, session } = await fixture();
  await queue.play(new TestTrack('one'));
  queue.syncedLyrics.load('[00:00.000]zero\n[00:01.000]one\n[00:02.000]two');
  expect(vi.getTimerCount()).toBe(0);
  const first = vi.fn();
  const second = vi.fn();
  const removeFirst = queue.syncedLyrics.subscribe(first);
  const removeSecond = queue.syncedLyrics.subscribe(second);
  expect(first).toHaveBeenCalledExactlyOnceWith('zero', 0);
  expect(second).toHaveBeenCalledExactlyOnceWith('zero', 0);
  expect(vi.getTimerCount()).toBe(1);
  session.position.mediaMs = 1000;
  await vi.advanceTimersByTimeAsync(1000);
  expect(first.mock.lastCall).toEqual(['one', 1000]);
  removeFirst();
  const identity = {
    sessionId: session.sessionId,
    guildId: queue.id,
    nodeId: session.nodeId,
    generation: session.generation,
  };
  session.filters.graph = 'atempo=2';
  session.emit('filterChanged', {
    ...identity,
    previousGraph: null,
    graph: 'atempo=2',
  } satisfies DiscordSessionEvents['filterChanged'][0]);
  session.position.mediaMs = 2000;
  await vi.advanceTimersByTimeAsync(250);
  expect(second.mock.lastCall).toEqual(['two', 2000]);
  expect(first).toHaveBeenCalledTimes(2);
  session.position.mediaMs = 0;
  session.emit('playbackSeeked', {
    ...identity,
    positionMs: 0,
    previousPositionMs: 2000,
  } satisfies DiscordSessionEvents['playbackSeeked'][0]);
  expect(second.mock.lastCall).toEqual(['zero', 0]);
  session.state = 'paused';
  session.emit('playbackPaused', {
    ...identity,
    previousState: 'playing',
    state: 'paused',
  } satisfies DiscordSessionEvents['playbackPaused'][0]);
  expect(vi.getTimerCount()).toBe(0);
  session.state = 'playing';
  session.emit('playbackResumed', {
    ...identity,
    previousState: 'paused',
    state: 'playing',
  } satisfies DiscordSessionEvents['playbackResumed'][0]);
  expect(vi.getTimerCount()).toBe(1);
  removeSecond();
  removeSecond();
  expect(queue.syncedLyrics.isSubscribed()).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('clears old lyrics on crossfade promotion, stop, replay and queue destruction', async () => {
  const { queue, session } = await fixture({ queueOptions: { crossfade: { enabled: true } } });
  const track = new TestTrack('one');
  await queue.play([track, new TestTrack('two')]);
  queue.syncedLyrics.load('[00:00.00]old');
  const listener = vi.fn();
  queue.syncedLyrics.subscribe(listener);
  session.requestPreparation();
  await settle();
  expect(queue.syncedLyrics.at(0)?.line).toBe('old');
  session.promote()();
  await settle();
  expect(queue.syncedLyrics.at(0)).toBeNull();
  queue.syncedLyrics.load('[00:00.00]new');
  await queue.stop();
  expect(queue.syncedLyrics.at(0)).toBeNull();
  await queue.play(track);
  queue.syncedLyricsProvider.onChange(listener);
  queue.syncedLyricsProvider.load('[00:00.00]replay');
  queue.syncedLyricsProvider.subscribe();
  expect(queue.syncedLyricsProvider).toBe(queue.syncedLyrics);
  const removed = vi.fn();
  queue.syncedLyrics.onUnsubscribe(removed);
  await queue.destroy();
  expect(queue.syncedLyrics.isSubscribed()).toBe(false);
  expect(queue.syncedLyrics.at(0)).toBeNull();
  expect(removed).toHaveBeenCalledOnce();
});

it('retains opt-in preloaded lyrics for their Track and rejects a late result for another Track', async () => {
  const { queue } = await fixture();
  const a = new TestTrack('a');
  const b = new TestTrack('b');
  const lyrics = (track: TestTrack) => ({
    trackId: track.id,
    plain: { available: false as const },
    synced: { available: true as const, lines: [{ timestampMs: 0, line: track.title }] },
  });
  queue.syncedLyrics.load(lyrics(a));
  await queue.play(a);
  expect(queue.syncedLyrics.at(0)?.line).toBe('a');
  await queue.stop();
  await queue.play(b);
  queue.syncedLyrics.load(lyrics(b));
  expect(() => queue.syncedLyrics.load(lyrics(a))).toThrow('different Track');
  expect(queue.syncedLyrics.at(0)?.line).toBe('b');
});
