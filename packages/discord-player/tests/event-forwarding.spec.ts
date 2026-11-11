import { expect, it, vi } from 'vitest';
import { RemediaClient, type DiscordSessionEvents, type RemediaClientEvents } from '@remedia/client';
import { DiscordPlayer } from '../src/index.js';
import { setup, TestTrack } from './mocks/queue.js';
import { settle } from './mocks/async.js';
import { createRemediaMock } from './mocks/remedia.js';

it('observes every native session event without inventing managed playback', async () => {
  const { player, queue, session } = await setup();
  const identity = { sessionId: session.sessionId, guildId: queue.id, nodeId: session.nodeId, generation: 0 };
  const stage = { ...identity, entryId: 'missing', queueRevision: 1, sourceRevision: 1 };
  const events = {
    playbackStarted: { ...identity, state: 'playing', info: session.info },
    playbackCompleted: { ...identity, state: 'completed', position: session.position },
    playbackStopped: { ...identity, state: 'stopped' },
    playbackFailed: { ...identity, state: 'failed', error: new Error('decode') },
    playbackPaused: { ...identity, previousState: 'playing', state: 'paused' },
    playbackResumed: { ...identity, previousState: 'paused', state: 'playing' },
    playbackSeeked: { ...identity, previousPositionMs: 0, positionMs: 100 },
    prepareRequested: { ...identity, remainingMs: 1000, transitionInMs: 500 },
    stageReady: stage,
    stageFailed: { ...stage, reason: 'stage' },
    stageInvalidated: stage,
    transitionCancelled: { ...identity, entryId: stage.entryId, failedGeneration: 1 },
    filterChanged: { ...identity, previousGraph: null, graph: 'atempo=1.2' },
    volumeChanged: { ...identity, previousVolume: 1, volume: 0.4 },
    voiceStateChanged: { ...identity, previousState: 'connected', state: 'disconnected' },
    voiceFailed: { ...identity, state: 'failed', error: new Error('voice') },
    sessionDisposed: identity,
  } satisfies { [Name in keyof DiscordSessionEvents]: DiscordSessionEvents[Name][0] };
  const observe = vi.fn();
  const start = vi.fn();
  const volume = vi.fn();
  const filter = vi.fn();
  const equalizer = vi.fn();
  const failure = vi.fn();
  const transport = vi.fn();

  player.events.on('sessionEvent', observe);
  player.events.on('playerStart', start);
  player.events.on('volumeChange', volume);
  player.events.on('audioFiltersUpdate', filter);
  player.events.on('equalizerUpdate', equalizer);
  player.events.on('error', failure);
  player.events.on('voiceConnectionStateChange', transport);

  for (const [name, event] of Object.entries(events)) {
    session.emit(name, event);
    expect(observe.mock.lastCall).toEqual([queue, name, event]);
    expect(observe.mock.lastCall?.[2]).toBe(event);
  }

  expect(observe).toHaveBeenCalledTimes(Object.keys(events).length);
  expect(start).not.toHaveBeenCalled();
  expect(volume).toHaveBeenCalledExactlyOnceWith(queue, 100, 40, events.volumeChanged);
  expect(filter).toHaveBeenCalledExactlyOnceWith(queue, null, 'atempo=1.2', events.filterChanged);
  expect(equalizer).not.toHaveBeenCalled();
  expect(failure).toHaveBeenCalledExactlyOnceWith(queue, events.voiceFailed.error, events.voiceFailed);
  expect(transport).toHaveBeenCalledExactlyOnceWith(queue, 'connected', 'disconnected', events.voiceStateChanged);
  expect(queue.options.volume).toBe(40);
  expect(queue.options.filterGraph).toBe('atempo=1.2');

  await player.destroy();
});

it('prepares before resolving and stages without starting playback; promotion preserves Track identity', async () => {
  const { player, queue, session } = await setup({ queueOptions: { crossfade: { enabled: true } } });
  const a = new TestTrack('a');
  const b = new TestTrack('b');
  const prepare = vi.fn();
  const ready = vi.fn();
  const start = vi.fn();

  b.resolver = async () => {
    expect(prepare).toHaveBeenCalledOnce();
    return { url: b.url };
  };
  player.events.on('willPrepareNextTrack', prepare);
  player.events.on('stageReady', ready);
  player.events.on('playerStart', start);

  await queue.play([a, b]);
  session.requestPreparation();
  await settle();

  expect(prepare.mock.lastCall?.[1]).toBe(b);
  expect(ready.mock.lastCall?.[1]).toBe(b);
  expect(start).toHaveBeenCalledOnce();

  session.promote()();
  await settle();

  expect(start).toHaveBeenCalledTimes(2);
  expect(start.mock.lastCall?.[1]).toBe(b);
  expect(prepare).toHaveBeenCalledOnce();

  await player.destroy();
});

it('releases owned listeners through disposal and preserves caller listeners', async () => {
  const { player, queue, session } = await setup();
  const external = vi.fn();
  const disposal = vi.fn();
  const pause = vi.fn();

  session.on('sessionDisposed', external);
  player.events.on('sessionDisposed', disposal);
  player.events.on('playerPause', pause);
  await queue.node.createSession({ channelId: 'replacement' });

  expect(external).toHaveBeenCalledOnce();
  expect(disposal).toHaveBeenCalledOnce();
  expect(session.listenerCount('sessionDisposed')).toBe(1);
  expect(session.listenerCount('playbackPaused')).toBe(0);
  session.emit('playbackPaused', { generation: 0 });
  expect(pause).not.toHaveBeenCalled();

  await player.destroy();
});

it('forwards client lifecycle events globally and projects existing guild ownership once', async () => {
  const backend = createRemediaMock();
  vi.spyOn(RemediaClient, 'create').mockResolvedValue(backend.asClient());
  const player = new DiscordPlayer({ nodes: [], send() {} });
  const queue = await player.createQueue('guild');
  await player.initialize('123');
  const node = backend.client.nodes[0]!;
  const assignment = { guildId: queue.id, nodeId: node.id, nodeType: 'embedded', status: 'assigned' } as const;
  const events = {
    nodeConnected: node,
    nodeDisconnected: { node, error: null },
    sessionResumed: { node, guildIds: [queue.id, 'missing'] },
    sessionLost: { node, guildIds: [queue.id, 'missing'], reason: 'lost' },
    nodeEvent: { nodeId: node.id, sessionId: 'server', sequence: 1, event: 'diagnostic', data: {} },
    eventsLost: { nodeId: node.id, count: 1 },
    guildAssigned: assignment,
    guildReleased: assignment,
    guildMigrated: { guildId: queue.id, fromNodeId: 'old', toNodeId: node.id, nodeType: 'embedded' },
  } satisfies {
    [
      Name in
        | 'nodeConnected'
        | 'nodeDisconnected'
        | 'sessionResumed'
        | 'sessionLost'
        | 'nodeEvent'
        | 'eventsLost'
        | 'guildAssigned'
        | 'guildReleased'
        | 'guildMigrated'
    ]: RemediaClientEvents[Name][0];
  };

  for (const name of ['sessionResumed', 'sessionLost', 'guildAssigned', 'guildReleased', 'guildMigrated'] as const) {
    const scoped = vi.fn();
    const global = vi.fn();
    player.on(name, global);
    player.events.on(name, scoped);
    backend.client.emit(name, events[name]);
    expect(global).toHaveBeenCalledExactlyOnceWith(events[name]);
    expect(scoped).toHaveBeenCalledExactlyOnceWith(queue, events[name]);
  }

  for (const name of ['nodeConnected', 'nodeDisconnected', 'nodeEvent', 'eventsLost'] as const) {
    const listener = vi.fn();
    player.on(name, listener);
    backend.client.emit(name, events[name]);
    expect(listener).toHaveBeenCalledExactlyOnceWith(events[name]);
  }

  expect(player.queues.cache.size).toBe(1);
  await player.destroy();
  expect(backend.client.eventNames()).toEqual([]);
});

it('emits connected volume changes once and rejects stale pause state while retaining diagnostics', async () => {
  const { player, queue, session } = await setup();
  const volume = vi.fn();
  const pause = vi.fn();
  const native = vi.fn();

  player.events.on('volumeChange', volume);
  player.events.on('playerPause', pause);
  player.events.on('sessionEvent', native);

  await queue.node.setVolume(25);

  expect(volume).toHaveBeenCalledOnce();
  expect(volume.mock.lastCall?.slice(0, 3)).toEqual([queue, 100, 25]);
  expect(volume.mock.lastCall?.[3].volume).toBe(0.25);

  await queue.play(new TestTrack('current'));

  const stale = {
    sessionId: session.sessionId,
    guildId: queue.id,
    nodeId: session.nodeId,
    generation: session.generation - 1,
    previousState: 'playing',
    state: 'paused',
  } satisfies DiscordSessionEvents['playbackPaused'][0];

  session.emit('playbackPaused', stale);

  expect(pause).not.toHaveBeenCalled();
  expect(native.mock.lastCall).toEqual([queue, 'playbackPaused', stale]);
  expect(queue.currentTrack?.title).toBe('current');

  await player.destroy();
});
