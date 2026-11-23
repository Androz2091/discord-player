import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscordSessionEvents } from '@remedia/client';
import { BaseExtractor, definePlugin, QueueRepeatMode, Track, type QueueSelection } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

async function fixture(crossfade: boolean, prepare = false, nodeType: 'embedded' | 'remote' = 'embedded') {
  const result = await setup({
    nodeType,
    crossfadeAvailable: true,
    queueOptions: {
      playback: { repeatMode: QueueRepeatMode.AUTOPLAY, crossfade: crossfade ? { enabled: true } : false },
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

describe.each([
  ['embedded', false],
  ['embedded', true],
  ['remote', false],
  ['remote', true],
] as const)('AutoPlay on %s with crossfade %s', (nodeType, crossfade) => {
  it.each([false, true])('discovers once after natural completion (metadata %s)', async (metadata) => {
    const { player, queue, session, related, discover, first, next, completion } = await fixture(
      crossfade,
      false,
      nodeType,
    );
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
    expect(discover.mock.calls[0]?.[0]).toEqual({ track: first, history: { tracks: [first] } });
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
    const { queue, session, related, discover, next, completion } = await fixture(crossfade, false, nodeType);

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
    const { queue, session, discover, first, completion } = await fixture(crossfade, false, nodeType);

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
    const { queue, session, related, discover, next, completion } = await fixture(crossfade, false, nodeType);

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
  const { queue, session, related, discover, first, next } = await fixture(true);

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

  expect(discover).toHaveBeenCalledExactlyOnceWith(
    { track: next, history: { tracks: [first, next] } },
    expect.anything(),
  );

  const third = new TestTrack('third');

  related.resolve({ tracks: [third], playlist: null });
  await settle();

  expect(queue.currentTrack).toBe(third);
  expect(session.playCalls).toBe(2);
});

describe('early crossfade AutoPlay discovery', () => {
  it.each(['embedded', 'remote'] as const)(
    'discovers, stages and promotes without another play on %s',
    async (nodeType) => {
      const { player, queue, session, related, discover, first, next } = await fixture(true, true, nodeType);
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
      expect(start).toHaveBeenCalledExactlyOnceWith(
        queue,
        next,
        expect.objectContaining({
          sessionId: session.sessionId,
          generation: 2,
          state: 'playing',
          transition: expect.objectContaining({ type: 'crossfade', outgoingGeneration: 1 }),
        }),
      );
      expect(finish).toHaveBeenCalledOnce();
      expect(finish).toHaveBeenCalledExactlyOnceWith(
        queue,
        first,
        expect.objectContaining({
          sessionId: session.sessionId,
          generation: 1,
          state: 'completed',
        }),
      );
      expect(queue.history.tracks.toArray()).toEqual([first]);
      expect(queue.size).toBe(0);
      expect(queue.stats.tracksFinished).toBe(1);
      expect(next.sourceReference).toEqual({ pluginId: 'fixture', data: null });
      expect(session.playCalls).toBe(1);
      expect(discover).toHaveBeenCalledOnce();
    },
  );

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

  it.each(['stop', 'seek', 'delete', 'enqueue', 'repeat'] as const)(
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
    expect.objectContaining({
      phase: 'provider execution',
      cause: expect.objectContaining({ cause: failure, pluginId: 'fixture', operation: 'track.related' }),
    }),
  );
  expect(empty).not.toHaveBeenCalled();

  session.requestPreparation();
  session.complete();
  await settle();

  expect(discover).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledOnce();
  expect(empty).toHaveBeenCalledExactlyOnceWith(queue);
});

it.each([false, true])('bounds a willAutoPlay listener that never calls done (crossfade %s)', async (crossfade) => {
  const { player, queue, session, related, next } = await fixture(crossfade);
  (queue.options.autoplay ??= {}).autoplayTimeoutMs = 25;
  const error = vi.fn();
  const empty = vi.fn();
  const selected = deferred<void>();

  player.events.on('error', error);
  player.events.on('emptyQueue', empty);
  player.events.on('willAutoPlay', () => selected.resolve());
  const ended = new Promise<void>((resolve) => player.events.once('emptyQueue', () => resolve()));

  session.complete();
  related.resolve({ tracks: [next], playlist: null });
  await selected.promise;
  await ended;

  expect(error).toHaveBeenCalledExactlyOnceWith(
    queue,
    expect.objectContaining({
      phase: 'candidate selection / willAutoPlay',
      cause: expect.objectContaining({ name: 'TimeoutError' }),
      nodeId: session.nodeId,
      operationId: expect.any(String),
      elapsedMs: expect.any(Number),
    }),
  );
  expect(empty).toHaveBeenCalledOnce();
  expect(queue.currentTrack).toBeNull();
  expect(session.playCalls).toBe(1);
});

it('times out early discovery once, ignores late results and can play again', async () => {
  const { player, queue, session, related, next, discover } = await fixture(true);
  (queue.options.autoplay ??= {}).autoplayTimeoutMs = 25;
  const error = vi.fn();
  player.events.on('error', error);
  const failed = new Promise<void>((resolve) => player.events.once('error', () => resolve()));

  session.requestPreparation();
  await failed;
  session.requestPreparation();
  session.complete();
  await settle();
  related.resolve({ tracks: [next], playlist: null });
  await settle();

  expect(error).toHaveBeenCalledExactlyOnceWith(queue, expect.objectContaining({ phase: 'provider execution' }));
  expect(discover).toHaveBeenCalledOnce();
  expect(queue.currentTrack).toBeNull();
  await queue.play(new TestTrack('manual'));
  expect(session.playCalls).toBe(2);
});

it('does not retry a failed AutoPlay playback transition indefinitely', async () => {
  const { player, queue, session, related } = await fixture(false);
  const resolve = vi.spyOn(player, 'resolvePlaybackSource').mockRejectedValue(new Error('Source unavailable'));
  const failed = new Promise<void>((done) => player.events.once('error', () => done()));

  session.complete();
  related.resolve({ tracks: [new TestTrack('failed')], playlist: null });
  await failed;
  await settle();

  expect(resolve).toHaveBeenCalledOnce();
  expect(queue.currentTrack).toBeNull();
  expect(queue.size).toBe(1);
  expect(queue.stats.tracksFailed).toBe(1);
});

it('ends empty discovery when the selection callback declines', async () => {
  const { player, queue, session, related } = await fixture(false);
  const select = vi.fn((_queue, _tracks, done) => done(null));
  const empty = vi.fn();
  player.events.on('willAutoPlay', select);
  player.events.on('emptyQueue', empty);

  session.complete();
  related.resolve({ tracks: [], playlist: null });
  await settle();

  expect(select).toHaveBeenCalledExactlyOnceWith(queue, [], expect.any(Function));
  expect(empty).toHaveBeenCalledExactlyOnceWith(queue);
});

it.each([false, true])('continues across three AutoPlay transitions (crossfade %s)', async (crossfade) => {
  const { player, queue, session, related, discover } = await fixture(crossfade);
  related.resolve({ tracks: [], playlist: null });
  discover.mockImplementation(async ({ track }) => ({
    tracks: [new TestTrack(`next:${track.title}`)],
    playlist: null,
  }));
  const finish = vi.fn();
  player.events.on('playerFinish', finish);

  for (let index = 0; index < 3; index++) {
    const previous = queue.currentTrack!;
    if (crossfade) {
      session.requestPreparation();
      await settle();
      expect(session.stage).not.toBeNull();
      session.promote()();
    } else session.complete();
    await settle();
    expect(queue.currentTrack?.title).toBe(`next:${previous.title}`);
  }

  expect(discover).toHaveBeenCalledTimes(3);
  expect(finish).toHaveBeenCalledTimes(3);
  expect(session.playCalls).toBe(crossfade ? 1 : 4);
});

it.each([false, true])('passes seeded history to legacy related discovery (crossfade %s)', async (crossfade) => {
  const result = await setup({
    queueOptions: {
      playback: { repeatMode: QueueRepeatMode.AUTOPLAY, crossfade: crossfade ? { enabled: true } : false },
    },
  });
  players.push(result.player);
  const { player, queue, session } = result;
  const selected = new Track({ title: 'B', url: 'https://fixture.test/B' });
  const histories: Track[][] = [];

  class Provider extends BaseExtractor {
    static override identifier = 'fixture.history';

    override async stream() {
      return 'https://fixture.test/audio';
    }

    override async getRelatedTracks(track: Track, history?: Parameters<BaseExtractor['getRelatedTracks']>[1]) {
      const previous = history?.tracks.toArray() ?? [];
      histories.push(previous);
      return this.createResponse(null, history?.tracks.some((item) => item.id === track.id) ? [selected] : []);
    }
  }

  await player.extractors.register(Provider);
  const first = new Track({
    title: 'A',
    url: 'https://fixture.test/A',
    sourceReference: { pluginId: Provider.identifier, data: null },
  });
  const previous = new Track({ title: 'previous', url: 'https://fixture.test/previous' });
  queue.history.push(previous);
  await queue.play(first);
  if (crossfade) session.requestPreparation();
  else session.complete();
  await settle();

  expect(histories).toEqual([[first, previous]]);
  if (crossfade) {
    expect(session.stage).not.toBeNull();
    expect(queue.currentTrack).toBe(first);
    session.promote()();
    await settle();
  }
  expect(queue.currentTrack).toBe(selected);
  expect(queue.history.tracks.toArray()).toEqual([previous, first]);
  expect(session.playCalls).toBe(crossfade ? 1 : 2);
  expect(selected.sourceReference?.pluginId).toBe(Provider.identifier);
});

it('uses ordinary playback when the speculative stage RPC outlives natural completion', async () => {
  const { queue, session, related, next, discover } = await fixture(true, true);
  const staging = deferred<Awaited<ReturnType<typeof session.stageNext>>>();
  const entered = deferred<void>();
  vi.spyOn(session, 'stageNext').mockImplementation(() => {
    entered.resolve();
    return staging.promise;
  });
  related.resolve({ tracks: [next], playlist: null });
  await entered.promise;
  session.complete();
  await settle();
  expect(queue.currentTrack).toBe(next);
  expect(session.playCalls).toBe(2);
  staging.reject(new Error('Outgoing generation ended'));
  await settle();
  expect(queue.currentTrack).toBe(next);
  expect(session.playCalls).toBe(2);
  expect(discover).toHaveBeenCalledOnce();
});

it('discards speculative discovery on session replacement', async () => {
  const { queue, related, next, session } = await fixture(true, true);
  await queue.node.createSession({ channelId: 'voice-two' });
  related.resolve({ tracks: [next], playlist: null });
  await settle();
  expect(queue.tracks.toArray()).not.toContain(next);
  expect(session.stageOptions).toHaveLength(0);
  expect(session.playCalls).toBe(1);
});

it('preserves queue.selectRelated selection while staging a speculative result', async () => {
  const { player, queue, related, session, next } = await fixture(true, true);
  const select = vi.fn((input: QueueSelection) => ({ action: 'replace' as const, value: { ...input, index: 1 } }));
  await player.plugins.register(
    definePlugin({
      id: 'fixture.selection',
      setup(ctx) {
        ctx.on('queue.selectRelated', select);
      },
    })(),
  );
  related.resolve({ tracks: [new TestTrack('ignored'), next], playlist: null });
  await settle();
  expect(select).toHaveBeenCalledOnce();
  expect(select.mock.calls[0]?.[0]).toMatchObject({ crossfade: true, guildId: queue.id });
  expect(queue.tracks.toArray()).toEqual([next]);
  session.promote()();
  await settle();
  expect(queue.currentTrack).toBe(next);
  expect(session.playCalls).toBe(1);
});

it.each(['embedded', 'remote'] as const)(
  'manual skip discovers AutoPlay on %s without a natural finish',
  async (nodeType) => {
    const { player, queue, related, discover, next, first } = await fixture(false, false, nodeType);
    const finish = vi.fn();
    const skip = vi.fn();
    player.events.on('playerFinish', finish);
    player.events.on('playerSkip', skip);
    const pending = queue.skip();
    await settle();
    expect(discover).toHaveBeenCalledOnce();
    related.resolve({ tracks: [next], playlist: null });
    await pending;
    expect(queue.currentTrack).toBe(next);
    expect(skip.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
    expect(finish).not.toHaveBeenCalled();
  },
);

it('skip uses a queued successor without related discovery', async () => {
  const { queue, discover, next } = await fixture(false);
  queue.addTrack(next);
  await queue.skip();
  expect(queue.currentTrack).toBe(next);
  expect(discover).not.toHaveBeenCalled();
});

it('stop cancels AutoPlay initiated by skip', async () => {
  const { queue, related, discover, next } = await fixture(false);
  const pending = queue.skip();
  await settle();
  expect(discover).toHaveBeenCalledOnce();
  await queue.stop();
  related.resolve({ tracks: [next], playlist: null });
  await pending;
  expect(queue.currentTrack).toBeNull();
});
