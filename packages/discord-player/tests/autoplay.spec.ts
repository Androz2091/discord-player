import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscordSessionEvents } from '@remedia/client';
import { definePlugin, QueueRepeatMode, type Track } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

async function fixture(crossfade: boolean, prepare = false) {
  const result = await setup({
    queueOptions: {
      repeatMode: QueueRepeatMode.AUTOPLAY,
      crossfade: crossfade ? { enabled: true } : false,
    },
  });
  players.push(result.player);

  const related = deferred<{ tracks: TestTrack[]; playlist: null }>();
  const discover = vi.fn((_input: { track: Track }) => related.promise);

  await result.player.plugins.unregister('fixture');
  await result.player.plugins.register(
    definePlugin({
      id: 'fixture',
      setup(ctx) {
        ctx.on('track.stream', ({ track }) => ({ url: track.url }));
        ctx.on('track.related', discover);
      },
    })(),
  );

  const first = new TestTrack('first');
  const next = new TestTrack('related');

  await result.queue.play(first);

  if (crossfade && prepare) {
    result.session.requestPreparation();
    await settle();
    expect(result.session.stage).toBeNull();
  }

  // Remedia's event identity permits customMetadata to be absent.
  const completion: DiscordSessionEvents['playbackCompleted'][0] = {
    sessionId: result.session.sessionId,
    guildId: result.queue.id,
    nodeId: result.session.nodeId,
    generation: result.session.generation,
    state: 'completed',
    position: result.session.position,
  };

  return { ...result, related, discover, first, next, completion };
}

describe.each([false, true])('AutoPlay with crossfade %s', (crossfade) => {
  it.each([false, true])('discovers once after natural completion (metadata %s)', async (metadata) => {
    const { player, queue, session, related, discover, first, next, completion } = await fixture(crossfade);
    const finish = vi.fn();
    const empty = vi.fn();

    player.events.on('playerFinish', finish);
    player.events.on('emptyQueue', empty);

    if (metadata) completion.customMetadata = session.customMetadata;

    session.state = 'completed';
    session.emit('playbackCompleted', completion);
    session.emit('playbackCompleted', completion);
    await settle();

    expect(discover).toHaveBeenCalledOnce();
    expect(discover.mock.calls[0]?.[0]).toEqual({ track: first });
    expect(finish).toHaveBeenCalledExactlyOnceWith(queue, first, completion);
    expect(empty).not.toHaveBeenCalled();

    related.resolve({ tracks: [next], playlist: null });
    await settle();

    expect(queue.currentTrack).toBe(next);
    expect(session.playCalls).toBe(2);
    expect(session.stageOptions).toHaveLength(0);

    session.emit('playbackCompleted', completion);
    await settle();

    expect(discover).toHaveBeenCalledOnce();
    expect(queue.currentTrack).toBe(next);
  });

  it.each(['skip', 'stop', 'delete'] as const)('rejects a late discovery after %s', async (action) => {
    const { queue, session, related, discover, next, completion } = await fixture(crossfade);

    session.state = 'completed';
    session.emit('playbackCompleted', completion);
    await settle();
    expect(discover).toHaveBeenCalledOnce();

    await queue[action]();
    related.resolve({ tracks: [next], playlist: null });
    await settle();

    expect(queue.currentTrack).toBeNull();
    expect(session.playCalls).toBe(1);
  });

  it('rejects foreign metadata, foreign sessions and stale generations', async () => {
    const { queue, session, discover, first, completion } = await fixture(crossfade);

    session.emit('playbackCompleted', {
      ...completion,
      customMetadata: { __discordPlayer: { operationId: 'foreign' } },
    });
    session.emit('playbackCompleted', { ...completion, sessionId: 'foreign' });
    session.emit('playbackCompleted', { ...completion, generation: completion.generation - 1 });
    await settle();

    expect(discover).not.toHaveBeenCalled();
    expect(queue.currentTrack).toBe(first);
    expect(queue.stats.tracksFinished).toBe(0);
  });

  it('cancels a selected result while it waits for the transition lock', async () => {
    const { queue, session, related, discover, next, completion } = await fixture(crossfade);

    session.state = 'completed';
    session.emit('playbackCompleted', completion);
    await settle();
    expect(discover).toHaveBeenCalledOnce();

    const lock = await queue.tasks.acquire('queue.playback-transition');

    related.resolve({ tracks: [next], playlist: null });
    await settle();

    const stopped = queue.stop();

    lock.release();
    await stopped;
    await settle();

    expect(queue.currentTrack).toBeNull();
    expect(session.playCalls).toBe(1);
  });
});

it('keeps a prepared successor and discovers only after that successor finishes', async () => {
  const { queue, session, related, discover, next } = await fixture(true);

  queue.addTrack(next);
  session.requestPreparation();
  await settle();

  const finishOutgoing = session.promote();

  finishOutgoing();
  finishOutgoing();
  await settle();

  expect(queue.currentTrack).toBe(next);
  expect(session.playCalls).toBe(1);
  expect(discover).not.toHaveBeenCalled();

  session.requestPreparation();
  session.complete();
  await settle();

  expect(discover).toHaveBeenCalledExactlyOnceWith({ track: next }, expect.anything());

  const third = new TestTrack('third');

  related.resolve({ tracks: [third], playlist: null });
  await settle();

  expect(queue.currentTrack).toBe(third);
  expect(session.playCalls).toBe(2);
});

describe('early crossfade AutoPlay discovery', () => {
  it('discovers once, stages the selected Track, and promotes without another play', async () => {
    const { player, queue, session, related, discover, first, next } = await fixture(true, true);
    const start = vi.fn();
    const finish = vi.fn();
    const empty = vi.fn();

    player.events.on('playerStart', start);
    player.events.on('playerFinish', finish);
    player.events.on('emptyQueue', empty);

    session.requestPreparation();
    session.requestPreparation();
    await settle();

    expect(discover).toHaveBeenCalledOnce();
    expect(queue.currentTrack).toBe(first);

    related.resolve({ tracks: [next], playlist: null });
    await settle();

    expect(queue.currentTrack).toBe(first);
    expect(queue.tracks.toArray()).toEqual([next]);
    expect(session.stageOptions).toHaveLength(1);
    expect(session.playCalls).toBe(1);
    expect(start).not.toHaveBeenCalled();
    expect(empty).not.toHaveBeenCalled();

    const completed = session.promote();

    completed();
    completed();
    await settle();

    expect(queue.currentTrack).toBe(next);
    expect(start).toHaveBeenCalledOnce();
    expect(start.mock.calls[0]?.slice(0, 2)).toEqual([queue, next]);
    expect(finish).toHaveBeenCalledOnce();
    expect(finish.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
    expect(session.playCalls).toBe(1);
    expect(discover).toHaveBeenCalledOnce();
  });

  it('reuses pending early discovery when natural completion arrives first', async () => {
    const { queue, session, related, discover, next } = await fixture(true, true);

    session.complete();
    session.complete();
    await settle();

    expect(discover).toHaveBeenCalledOnce();

    related.resolve({ tracks: [next], playlist: null });
    await settle();

    expect(queue.currentTrack).toBe(next);
    expect(session.playCalls).toBe(2);
    expect(session.stageOptions).toHaveLength(0);
    expect(discover).toHaveBeenCalledOnce();
  });

  it('retains an empty early result until completion without ending playback early', async () => {
    const { player, queue, session, related, discover, first } = await fixture(true, true);
    const empty = vi.fn();

    player.events.on('emptyQueue', empty);
    related.resolve({ tracks: [], playlist: null });
    await settle();
    session.requestPreparation();
    await settle();

    expect(queue.currentTrack).toBe(first);
    expect(empty).not.toHaveBeenCalled();
    expect(discover).toHaveBeenCalledOnce();

    session.complete();
    session.complete();
    await settle();

    expect(queue.currentTrack).toBeNull();
    expect(empty).toHaveBeenCalledExactlyOnceWith(queue);
    expect(discover).toHaveBeenCalledOnce();
  });

  it.each(['skip', 'stop', 'seek', 'delete', 'enqueue', 'repeat'] as const)(
    'discards pending early discovery on %s',
    async (action) => {
      const { queue, session, related, discover, next } = await fixture(true, true);
      const manual = new TestTrack('manual');

      expect(discover).toHaveBeenCalledOnce();

      if (action === 'seek') await queue.node.seek(0);
      else if (action === 'enqueue') queue.addTrack(manual);
      else if (action === 'repeat') queue.setRepeatMode(QueueRepeatMode.OFF);
      else await queue[action]();

      related.resolve({ tracks: [next], playlist: null });
      await settle();

      expect(queue.currentTrack).not.toBe(next);
      expect(queue.tracks.toArray()).not.toContain(next);
      expect(session.playCalls).toBe(1);
      expect(session.stageOptions).toHaveLength(action === 'enqueue' ? 1 : 0);
    },
  );

  it('plays the discovered Track normally when native staging fails', async () => {
    const { queue, session, related, next, discover } = await fixture(true, true);

    vi.spyOn(session, 'stageNext').mockRejectedValueOnce(new Error('stage unavailable'));
    related.resolve({ tracks: [next], playlist: null });
    await settle();

    session.complete();
    await settle();

    expect(queue.currentTrack).toBe(next);
    expect(session.playCalls).toBe(2);
    expect(discover).toHaveBeenCalledOnce();
  });
});

it('preserves an early asynchronous willAutoPlay choice across natural completion', async () => {
  const { player, queue, session, related, discover, next } = await fixture(true, true);
  let select: ((track: Track | null) => void) | undefined;

  player.events.on('willAutoPlay', (owner, tracks, done) => {
    expect(owner).toBe(queue);
    expect(tracks).toEqual([next]);
    select = done;
  });
  related.resolve({ tracks: [next], playlist: null });
  await settle();

  expect(select).toBeTypeOf('function');
  expect(queue.currentTrack).not.toBeNull();

  session.complete();
  await settle();
  select?.(next);
  await settle();

  expect(queue.currentTrack).toBe(next);
  expect(session.playCalls).toBe(2);
  expect(discover).toHaveBeenCalledOnce();
});

it('reports an early discovery failure once and ends only after natural completion', async () => {
  const { player, queue, session, related, discover, first } = await fixture(true, true);
  const failure = new Error('Related-track lookup failed');
  const error = vi.fn();
  const empty = vi.fn();

  player.events.on('error', error);
  player.events.on('emptyQueue', empty);
  related.reject(failure);
  await settle();

  expect(queue.currentTrack).toBe(first);
  expect(error).toHaveBeenCalledExactlyOnceWith(
    queue,
    expect.objectContaining({ cause: failure, pluginId: 'fixture', operation: 'track.related' }),
  );
  expect(empty).not.toHaveBeenCalled();

  session.requestPreparation();
  session.complete();
  await settle();

  expect(discover).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledOnce();
  expect(empty).toHaveBeenCalledExactlyOnceWith(queue);
});
