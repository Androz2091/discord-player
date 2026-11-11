import { afterEach, expect, it, vi } from 'vitest';
import { definePlugin, QueueRepeatMode } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];
afterEach(async () => {
  await Promise.all(players.splice(0).map((p) => p.destroy()));
  vi.useRealTimers();
});

it('preserves v7 queue/node access and real queue mutation methods without parallel state', async () => {
  const { player, queue, session } = await setup();
  players.push(player);
  const a = new TestTrack('a');
  const b = new TestTrack('b');
  expect(queue.player).toBe(player);
  expect(queue.filters).toBe(queue.node.filters);
  expect(queue.deleted).toBe(false);
  queue.node.insert(a);
  queue.node.insert(b, 1);
  queue.node.swap(0, 1);
  expect(queue.tracks.at(0)).toBe(b);
  queue.node.move(b, 1);
  expect(queue.tracks.at(0)).toBe(a);
  queue.node.copy(b, 0);
  expect(queue.tracks.at(0)).toBe(b);
  expect(queue.node.remove(0)).toBe(b);
  expect(await queue.node.play()).toBe(a);
  const result = await queue.node.play(new TestTrack('c'));
  expect(result.track?.title).toBe('c');
  expect(session.playCalls).toBe(1);
  const volume = vi.fn();
  player.events.on('volumeChange', volume);
  await queue.node.setVolume(200);
  expect(session.volume).toBe(2);
  expect(volume.mock.lastCall?.slice(0, 3)).toEqual([queue, 100, 200]);
  await queue.node.stop(true);
  expect(queue.deleted).toBe(true);
});

it('autoplay awaits related metadata, continues through managed playback and does not prematurely leave', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const { player, queue, session } = await setup({
    queueOptions: { repeatMode: QueueRepeatMode.AUTOPLAY, leaveOnEnd: true },
  });
  players.push(player);
  const related = deferred<{ tracks: TestTrack[]; playlist: null }>();
  await player.plugins.unregister('fixture');
  await player.plugins.register(
    definePlugin({
      id: 'fixture',
      setup(ctx) {
        ctx.on('track.stream', ({ track }) => ({ url: track.url }));
        ctx.on('track.related', () => related.promise);
      },
    })(),
  );
  await queue.play(new TestTrack('one'));
  session.complete();
  await settle();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
  related.resolve({ tracks: [new TestTrack('two')], playlist: null });
  await settle();
  expect(queue.currentTrack?.title).toBe('two');
  expect(session.playCalls).toBe(2);
});

it('cancels stale autoplay when a user enqueues another Track', async () => {
  const { player, queue, session } = await setup({ queueOptions: { repeatMode: QueueRepeatMode.AUTOPLAY } });
  players.push(player);
  const related = deferred<{ tracks: TestTrack[]; playlist: null }>();
  await player.plugins.register(
    definePlugin({
      id: 'related',
      setup(ctx) {
        ctx.on('track.related', () => related.promise);
      },
    })(),
  );
  // The source provider explicitly owns related lookup; replacing its registration preserves identity.
  await player.plugins.unregister('fixture');
  await player.plugins.register(
    definePlugin({
      id: 'fixture',
      setup(ctx) {
        ctx.on('track.stream', ({ track }) => ({ url: track.url }));
        ctx.on('track.related', () => related.promise);
      },
    })(),
  );
  await queue.play(new TestTrack('one'));
  session.complete();
  await settle();
  await queue.play(new TestTrack('manual'));
  related.resolve({ tracks: [new TestTrack('stale')], playlist: null });
  await settle();
  expect(queue.currentTrack?.title).toBe('manual');
  expect(queue.size).toBe(0);
});

it('preserves asynchronous v7 willAutoPlay selection and invalidates late callbacks after stop', async () => {
  const { player, queue, session } = await setup({ queueOptions: { repeatMode: QueueRepeatMode.AUTOPLAY } });
  players.push(player);
  const next = new TestTrack('candidate');
  await player.plugins.unregister('fixture');
  await player.plugins.register(
    definePlugin({
      id: 'fixture',
      setup(ctx) {
        ctx.on('track.stream', ({ track }) => ({ url: track.url }));
        ctx.on('track.related', () => ({ tracks: [next], playlist: null }));
      },
    })(),
  );
  let select: ((track: TestTrack | null) => void) | undefined;
  player.events.on('willAutoPlay', (owner, tracks, done) => {
    expect(owner).toBe(queue);
    expect(tracks).toEqual([next]);
    select = done;
  });
  await queue.play(new TestTrack('one'));
  session.complete();
  await settle();
  expect(queue.currentTrack).toBeNull();
  select?.(next);
  await settle();
  expect(queue.currentTrack).toBe(next);
  await queue.stop();
  await queue.play(new TestTrack('seed-two'));
  session.complete();
  await settle();
  const plays = session.playCalls;
  await queue.stop();
  select?.(next);
  await settle();
  expect(queue.currentTrack).toBeNull();
  expect(session.playCalls).toBe(plays);
});
