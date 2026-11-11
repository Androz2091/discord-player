import { describe, expect, it, vi } from 'vitest';
import type { MediaSource } from '@remedia/client';
import { QueueRepeatMode } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred, settle } from './mocks/async.js';

const enabled = { crossfade: { enabled: true as const } };

async function prepare() {
  const fixture = await setup({ queueOptions: enabled });
  const a = new TestTrack('a');
  const b = new TestTrack('b');
  const c = new TestTrack('c');

  await fixture.queue.play([a, b, c]);
  fixture.session.requestPreparation();
  await settle();

  return { ...fixture, a, b, c };
}

describe('automatic crossfading', () => {
  it('is disabled by default and retains ordinary progression', async () => {
    const { queue, session } = await setup();

    await queue.play([new TestTrack('a'), new TestTrack('b')]);
    session.requestPreparation();
    await settle();

    expect(session.crossfade).toBeUndefined();
    expect(session.stageOptions).toHaveLength(0);

    session.complete();
    await settle();

    expect(session.playCalls).toBe(2);
  });

  it('opts embedded sessions in with native defaults', async () => {
    const { session } = await setup({ queueOptions: enabled });

    expect(session.crossfade).toEqual({ enabled: true, durationMs: 5000, prepareBeforeMs: 30000, curve: 'equalPower' });
  });

  it('uses global settings and allows a queue to disable them', async () => {
    const { session } = await setup({ playerOptions: enabled });

    expect(session.crossfade).toMatchObject({ enabled: true });

    const override = await setup({ playerOptions: enabled, queueOptions: { crossfade: false } });

    expect(override.session.crossfade).toBeUndefined();
  });

  it('falls back on unsupported remote nodes', async () => {
    const { queue, session } = await setup({ nodeType: 'remote', queueOptions: enabled });

    expect(session.crossfade).toBe(false);

    await queue.play([new TestTrack('a'), new TestTrack('b')]);
    session.requestPreparation();
    await settle();

    expect(session.stageOptions).toHaveLength(0);

    session.complete();
    await settle();

    expect(session.playCalls).toBe(2);
  });

  it('opts supported remote sessions in', async () => {
    const { session } = await setup({ nodeType: 'remote', crossfadeAvailable: true, queueOptions: enabled });

    expect(session.crossfade).toMatchObject({ enabled: true });
  });

  it('resolves once on request, keeps the reservation queued, and promotes A-B-C with one play', async () => {
    const { queue, session, player, a, b, c } = await prepare();
    const resolve = vi.spyOn(player.plugins, 'resolveStream');
    const order: string[] = [];

    player.events.on('playerStart', (_, track) => order.push(`start:${track.title}`));
    player.events.on('playerFinish', (_, track) => order.push(`finish:${track.title}`));
    session.requestPreparation();
    await settle();

    expect(resolve).not.toHaveBeenCalled();
    expect(session.stageOptions).toHaveLength(1);
    expect(queue.size).toBe(2);

    const finishA = session.promote();

    expect(queue.currentTrack).toBe(b);
    expect(queue.size).toBe(1);
    expect(queue.stats.tracksStarted).toBe(2);
    expect(queue.stats.tracksFinished).toBe(0);

    finishA();
    finishA();
    await settle();

    expect(queue.currentTrack).toBe(b);
    expect(queue.history.tracks.toArray()).toEqual([a]);

    session.requestPreparation();
    await settle();

    const finishB = session.promote();

    finishB();
    await settle();

    expect(queue.currentTrack).toBe(c);
    expect(queue.size).toBe(0);
    expect(queue.stats.tracksFinished).toBe(2);
    expect(order).toEqual(['start:b', 'finish:a', 'start:c', 'finish:b']);
    expect(resolve).toHaveBeenCalledOnce();
    expect(session.playCalls).toBe(1);

    session.complete();
    await settle();

    expect(queue.currentTrack).toBeNull();
    expect(queue.stats.tracksFinished).toBe(3);
  });

  it('assigns different identities to two occurrences of the same object', async () => {
    const { queue, session } = await setup({ queueOptions: enabled });
    const track = new TestTrack('same');

    await queue.play([track, track, track]);
    session.requestPreparation();
    await settle();

    const first = session.stageOptions[0]!.entryId;

    session.promote()();
    await settle();
    session.requestPreparation();
    await settle();

    expect(session.stageOptions[1]!.entryId).not.toBe(first);

    session.promote()();
    await settle();

    expect(queue.size).toBe(0);
    expect(session.playCalls).toBe(1);
  });

  it.each(['prepend', 'remove', 'clear', 'swap', 'move', 'store'] as const)(
    'invalidates %s during slow preparation',
    async (mutation) => {
      const { queue, session } = await setup({ queueOptions: enabled });
      const result = deferred<MediaSource>();
      const b = new TestTrack('b', () => result.promise);

      await queue.play([new TestTrack('a'), b, new TestTrack('c')]);
      session.requestPreparation();
      await settle();

      const obsolete = queue.tracks.entryId(0);

      if (mutation === 'prepend') queue.prepend(new TestTrack('d'));

      if (mutation === 'remove') queue.removeTrack(0);

      if (mutation === 'clear') queue.clear();

      if (mutation === 'swap') queue.swapTracks(0, 1);

      if (mutation === 'move') queue.moveTrack(0, 1);

      if (mutation === 'store') queue.tracks.store.splice(0, 1);

      result.resolve({ url: b.url });
      await settle();

      expect(session.stageOptions.every((stage) => stage.entryId !== obsolete)).toBe(true);

      if (mutation === 'clear') expect(session.stageOptions).toHaveLength(0);
      else expect(session.stageOptions.at(-1)?.entryId).toBe(queue.tracks.entryId(0));
    },
  );

  it.each([QueueRepeatMode.OFF, QueueRepeatMode.TRACK, QueueRepeatMode.QUEUE, QueueRepeatMode.AUTOPLAY])(
    'respects repeat mode %s',
    async (mode) => {
      const { queue, session } = await setup({ queueOptions: { ...enabled, repeatMode: mode } });
      const a = new TestTrack('a'),
        b = new TestTrack('b');

      await queue.play([a, b]);
      session.requestPreparation();
      await settle();
      session.promote()();
      await settle();

      expect(queue.currentTrack).toBe(mode === QueueRepeatMode.TRACK ? a : b);
      expect(session.playCalls).toBe(1);

      if (mode === QueueRepeatMode.QUEUE) expect(queue.tracks.toArray()).toEqual([a]);
    },
  );

  it('does not fabricate an autoplay source at an empty boundary', async () => {
    const { queue, session } = await setup({ queueOptions: { ...enabled, repeatMode: QueueRepeatMode.AUTOPLAY } });

    await queue.play(new TestTrack('a'));
    session.requestPreparation();
    await settle();

    expect(session.stageOptions).toHaveLength(0);
  });

  it('preserves a dynamic shuffle choice through promotion', async () => {
    const { queue, session } = await prepare();

    await queue.cancelPreparation();
    queue.enableShuffle(true);
    session.requestPreparation();
    await settle();

    const id = session.stageOptions.at(-1)!.entryId;
    const selected = queue.tracks.toArray().find((_, index) => queue.tracks.entryId(index) === id);

    session.promote()();
    await settle();

    expect(queue.currentTrack).toBe(selected);
    expect(session.playCalls).toBe(1);
  });

  it.each(['skip', 'stop', 'seek', 'destroy'] as const)('cancels preparation on %s', async (action) => {
    const { queue, session } = await prepare();

    if (action === 'skip') await queue.skip();

    if (action === 'stop') await queue.stop();

    if (action === 'seek') await queue.node.seek(0);

    if (action === 'destroy') await queue.destroy();

    expect(session.stage).toBeNull();
  });

  it('retains staged playback through pause and resume', async () => {
    const { queue, session, b } = await prepare();

    await queue.node.pause();
    await queue.node.resume();
    session.promote()();
    await settle();

    expect(queue.currentTrack).toBe(b);
    expect(session.playCalls).toBe(1);
  });

  it('reports rejected resolution and falls back to ordinary playback', async () => {
    const { queue, session, player } = await setup({ queueOptions: enabled });
    const resolver = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue({ url: 'https://example.test/b' });
    const error = vi.fn();

    player.events.on('stageFailed', error);
    await queue.play([new TestTrack('a'), new TestTrack('b', resolver)]);
    session.requestPreparation();
    await settle();

    expect(error).toHaveBeenCalledOnce();

    session.complete();
    await settle();

    expect(session.playCalls).toBe(2);
  });

  it('reprepares invalidated sources with a higher revision', async () => {
    const { session, queue } = await prepare();
    const old = session.stageOptions[0]!;

    session.emit('stageInvalidated', { sessionId: session.sessionId, generation: session.generation, ...old });
    await settle();
    session.requestPreparation();
    await settle();

    const fresh = session.stageOptions.at(-1)!;

    expect(fresh.entryId).toBe(old.entryId);
    expect(fresh.sourceRevision).toBeGreaterThan(old.sourceRevision!);

    session.emit('stageFailed', { sessionId: session.sessionId, generation: session.generation, ...old });
    await settle();

    expect(session.stage).not.toBeNull();
    expect(queue.size).toBe(2);
  });

  it('keeps raw node playback independent of automatic scheduling', async () => {
    const { queue, session } = await setup({ queueOptions: enabled });

    queue.addTrack(new TestTrack('queued'));
    await queue.node.play({ url: 'https://example.test/raw' });
    session.requestPreparation();
    await settle();

    expect(session.stageOptions).toHaveLength(0);
    expect(queue.currentTrack).toBeNull();
    expect(queue.size).toBe(1);
  });

  it('recovers a lost incoming start from continuation without replaying the source', async () => {
    const { player, queue, session, b } = await prepare();
    const start = vi.fn();

    player.events.on('playerStart', start);

    const emit = session.emit.bind(session);
    const spy = vi
      .spyOn(session, 'emit')
      .mockImplementation((name, ...args) => (name === 'playbackStarted' ? false : emit(name, ...args)));
    const finish = session.promote();

    spy.mockRestore();
    finish();
    await settle();

    expect(queue.currentTrack).toBe(b);
    expect(start).toHaveBeenCalledExactlyOnceWith(queue, b, undefined);
    expect(queue.stats.tracksStarted).toBe(2);
    expect(queue.stats.tracksFinished).toBe(1);
    expect(session.playCalls).toBe(1);
  });

  it('recovers an already promoted source after reconnect', async () => {
    const { player, queue, session, b } = await prepare();
    const start = vi.fn();

    player.events.on('playerStart', start);

    const emit = session.emit.bind(session);
    const spy = vi
      .spyOn(session, 'emit')
      .mockImplementation((name, ...args) => (name === 'playbackStarted' ? false : emit(name, ...args)));
    const finish = session.promote();

    spy.mockRestore();
    await queue.reconcileCrossfade(queue.node.getSession());
    finish();
    await settle();

    expect(queue.currentTrack).toBe(b);
    expect(start).toHaveBeenCalledExactlyOnceWith(queue, b, undefined);
    expect(session.playCalls).toBe(1);
  });

  it('restores the outgoing source on native transition cancellation', async () => {
    const { queue, session, a, b } = await prepare();

    session.promote();

    session.emit('transitionCancelled', {
      sessionId: session.sessionId,
      generation: 1,
      failedGeneration: 2,
      entryId: session.stageOptions[0]!.entryId,
    });

    expect(queue.currentTrack).toBe(a);
    expect(queue.tracks.at(0)).toBe(b);
    expect(queue.stats.tracksFailed).toBe(1);
    expect(session.playCalls).toBe(1);
  });

  it.each(['skip', 'stop'] as const)('reconciles both generations on overlap %s', async (action) => {
    const { queue, session, c } = await prepare();
    const finish = session.promote();

    if (action === 'skip') await queue.skip();
    else await queue.stop();

    finish();
    await settle();

    expect(queue.currentTrack).toBe(action === 'skip' ? c : null);
    expect(session.playCalls).toBe(action === 'skip' ? 2 : 1);
    expect(queue.stats.tracksFinished).toBe(0);
  });

  it('passes provider expiration without inventing one for other sources', async () => {
    const { queue, session } = await setup({ queueOptions: enabled });
    const expiresAtMs = Date.now() + 60000;

    await queue.play([
      new TestTrack('a'),
      new TestTrack('b', async () => ({ url: 'https://example.test/b', expiresAtMs })),
    ]);

    session.requestPreparation();
    await settle();

    expect(session.stageOptions[0]!.expiresAtMs).toBe(expiresAtMs);
  });

  it('ignores duplicate and foreign-session promotion events', async () => {
    const { queue, session, a, b } = await prepare();
    const event = {
      sessionId: 'foreign',
      generation: 2,
      customMetadata: session.stageOptions[0]!.customMetadata,
      state: 'playing' as const,
      info: session.info,
      transition: { type: 'crossfade' as const, outgoingGeneration: 1, entryId: session.stageOptions[0]!.entryId },
    };

    session.emit('playbackStarted', event);

    expect(queue.currentTrack).toBe(a);

    session.promote();
    session.emit('playbackStarted', { ...event, sessionId: session.sessionId });

    expect(queue.currentTrack).toBe(b);
    expect(queue.stats.tracksStarted).toBe(2);
    expect(queue.size).toBe(1);
  });

  it('prepares a late enqueue after Remedia already requested the next source', async () => {
    const { queue, session } = await setup({ queueOptions: enabled });

    await queue.play(new TestTrack('a'));
    session.requestPreparation();
    await settle();

    expect(session.stageOptions).toHaveLength(0);

    await queue.play(new TestTrack('b'));
    await settle();

    expect(session.stageOptions).toHaveLength(1);

    session.promote()();
    await settle();

    expect(session.playCalls).toBe(1);
  });

  it('does not change the native worker policy when options change on an existing session', async () => {
    const { queue, session } = await setup();

    queue.options.crossfade = { enabled: true };
    await queue.connect({ channelId: session.channelId });
    await queue.play([new TestTrack('a'), new TestTrack('b')]);
    session.requestPreparation();
    await settle();

    expect(session.crossfade).toBeUndefined();
    expect(session.stageOptions).toHaveLength(0);
  });

  it('falls back after a native stage submission rejects', async () => {
    const { queue, session } = await setup({ queueOptions: enabled });

    vi.spyOn(session, 'stageNext').mockRejectedValue(new Error('native stage rejected'));
    await queue.play([new TestTrack('a'), new TestTrack('b')]);
    session.requestPreparation();
    await settle();

    expect(queue.size).toBe(1);

    session.complete();
    await settle();

    expect(session.playCalls).toBe(2);
  });

  it('restores the outgoing source when cancellation follows an incoming failure', async () => {
    const { queue, session, a, b } = await prepare();

    session.promote();
    session.fail();
    await settle();

    session.emit('transitionCancelled', {
      sessionId: session.sessionId,
      generation: 1,
      failedGeneration: 2,
      entryId: session.stageOptions[0]!.entryId,
    });

    expect(queue.currentTrack).toBe(a);
    expect(queue.tracks.toArray().filter((track) => track === b)).toHaveLength(1);
    expect(queue.stats.tracksFailed).toBe(1);
  });
});
