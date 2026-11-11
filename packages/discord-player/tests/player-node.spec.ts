import { expect, it, vi } from 'vitest';
import { setup, TestTrack } from './mocks/queue.js';
import { FakeSession } from './mocks/remedia.js';

it('creates, replaces, reconnects and destroys sessions while retaining configuration', async () => {
  const { queue, player, session, sessions, backend } = await setup();
  const node = queue.node;

  expect(node.getSession()).toBeDefined();
  expect(node.filters.graph).toBe(session.filters.graph);

  const created = backend.asSession(
    await node.createSession({ channelId: 'new', volume: 0.4, selfMute: true, filterGraph: 'volume=0.4' }),
  );

  expect(session.disconnectCalls).toBe(1);
  expect(session.disposeCalls).toBe(1);
  expect(created.connectionState).toBe('disconnected');
  expect(node.volume).toBe(40);

  await node.connect({ channelId: 'new', volume: 0.5, selfMute: false, selfDeaf: false, filterGraph: null });

  expect(created.connectionState).toBe('connected');
  expect(created.filters.graph).toBeNull();
  expect(created.volume).toBe(0.5);
  expect(created.selfMute).toBe(false);
  expect(created.selfDeaf).toBe(false);

  await node.connect({ channelId: 'moved', filterGraph: 'volume=0.2' });

  expect(created.channelId).toBe('moved');
  expect(created.filters.graph).toBe('volume=0.2');

  await expect(node.connect({ channelId: 'moved', nodeId: 'another' })).rejects.toThrow('Changing a Remedia node');

  expect(sessions).toHaveLength(2);

  await node.destroySession();

  expect(created.disposeCalls).toBe(1);
  expect(backend.activeSessions.size).toBe(0);
  expect(node.getSession(false)).toBeNull();
  expect(node.filters.graph).toBe(queue.options.filterGraph);
  expect(() => node.getSession()).toThrow('initialized');
  expect(node.isIdle()).toBe(true);
  expect(node.isPlaying()).toBe(false);
  expect(node.isPaused()).toBe(false);
  expect(node.playbackTime).toBe(0);
  expect(node.totalDuration).toBe(0);

  await node.stopSession();

  expect(await node.setVolume(35)).toBe(35);
  expect(node.volume).toBe(35);

  await player.destroy();
  await expect(node.createSession({ channelId: 'no' })).rejects.toThrow('destroyed');
});

it('forwards a per-join timeout to Remedia without putting it in session configuration', async () => {
  const { queue, player, backend } = await setup();

  await queue.node.destroySession();
  await queue.connect({ channelId: 'new', connectTimeoutMs: 120_000 });

  const session = backend.sessions.at(-1)!;

  expect(backend.client.createDiscordSession.mock.lastCall?.[0]).not.toHaveProperty('connectTimeoutMs');
  expect(session.connectOptions.at(-1)).toEqual({ timeoutMs: 120_000 });

  const connect = vi.spyOn(session, 'connect');

  session.connectionState = 'disconnected';
  await queue.connect({ channelId: 'new', connectTimeoutMs: 110_000 });

  expect(connect).toHaveBeenCalledWith({ timeoutMs: 110_000 });

  await player.destroy();
});

it('connects five guild queues independently without a shared voice deadline', async () => {
  const { player, backend } = await setup({ nodeType: 'remote' });
  const destinations = Array.from({ length: 5 }, (_, index) => ({
    guildId: `guild-${index}`,
    channelId: `voice-${index}`,
  }));
  const queues = await Promise.all(destinations.map(({ guildId }) => player.createQueue(guildId)));

  const results = await Promise.allSettled(
    queues.map((queue, index) =>
      queue.connect({ channelId: destinations[index]!.channelId, connectTimeoutMs: 120_000 }),
    ),
  );

  expect(results.every((result) => result.status === 'fulfilled')).toBe(true);

  const guildIds = new Set(destinations.map(({ guildId }) => guildId));
  const sessions = backend.sessions.filter((session) => guildIds.has(session.guildId));

  expect(sessions).toHaveLength(5);
  expect(new Set(sessions.map((session) => session.sessionId)).size).toBe(5);

  for (const session of sessions) {
    expect(session.connectionState).toBe('connected');
    expect(session.connectOptions).toEqual([{ timeoutMs: 120_000 }]);
  }

  await player.destroy();
});

it('cleans up sessions whose connect method rejects and permits a subsequent connection', async () => {
  const { queue, player, backend } = await setup();

  await queue.node.destroySession();

  const connect = vi.spyOn(FakeSession.prototype, 'connect').mockRejectedValueOnce(new Error('voice failed'));

  await expect(queue.connect({ channelId: 'new' })).rejects.toThrow('voice failed');
  connect.mockRestore();

  const broken = backend.sessions.at(-1)!;

  expect(queue.node.getSession(false)).toBeNull();
  expect(broken.disconnectCalls).toBe(1);
  expect(broken.disposeCalls).toBe(1);
  expect(backend.activeSessions.has(queue.guildId)).toBe(false);
  expect(broken.eventNames()).toHaveLength(0);

  await queue.connect({ channelId: 'recovered' });

  expect(queue.node.getSession().channelId).toBe('recovered');

  await player.destroy();
});

it('unregisters deleted queues so a new queue can connect and play in the same guild', async () => {
  const { queue, player, session, backend } = await setup();

  await queue.play(new TestTrack('first'));

  expect(() =>
    backend.client.createDiscordSession({ guildId: queue.guildId, channelId: 'voice-one', userId: 'bot-user' }),
  ).toThrow(`a Discord session already exists for guild ${queue.guildId}`);

  expect(await player.deleteQueue(queue.guildId)).toBe(true);
  expect(session.disposeCalls).toBe(1);
  expect(session.disconnectCalls).toBe(1);
  expect(backend.activeSessions.has(queue.guildId)).toBe(false);
  expect(await player.deleteQueue(queue.guildId)).toBe(false);

  const replacement = await player.createQueue(queue.guildId);
  const nextSession = backend.asSession(await replacement.connect({ channelId: 'voice-two' }));

  expect(nextSession).not.toBe(session);

  await replacement.play(new TestTrack('second'));

  expect(nextSession.playCalls).toBe(1);
  expect(backend.activeSessions.get(queue.guildId)).toBe(nextSession);

  await player.destroy();

  expect(nextSession.disposeCalls).toBe(1);
  expect(backend.activeSessions.size).toBe(0);
});

it('keeps raw controls separate from managed queue state and forwards playback events', async () => {
  const { queue, player, session } = await setup();
  const node = queue.node;

  await node.play({ url: 'https://example.test/raw.mp3' });

  expect(queue.currentTrack).toBeNull();
  expect(queue.history.size).toBe(0);
  expect(node.isPlaying()).toBe(true);

  await node.setPaused(true);

  expect(node.isPaused()).toBe(true);

  await node.setPaused(false);

  expect(node.isPlaying()).toBe(true);

  await node.seek(-10);

  expect(node.streamTime).toBe(0);

  session.position.mediaMs = null;
  session.position.playedMs = 1234;

  expect(node.streamTime).toBe(1234);

  session.position.playedMs = null;

  expect(node.streamTime).toBe(0);

  for (const volume of [-1, 201, NaN, Infinity]) await expect(node.setVolume(volume)).rejects.toThrow(RangeError);

  const events = ['playerPause', 'playerResume', 'playerSeek', 'voiceConnectionStateChange', 'error'] as const;
  const listeners = events.map((event) => {
    const listener = vi.fn();

    player.events.on(event, listener);

    return listener;
  });

  session.emit('playbackPaused', { generation: session.generation });
  session.emit('playbackResumed', { generation: session.generation });
  session.emit('playbackSeeked', { generation: session.generation });
  session.emit('voiceStateChanged', {});
  session.emit('voiceFailed', { error: new Error('failed') });

  for (const listener of listeners) expect(listener).toHaveBeenCalledOnce();

  await player.destroy();
  await expect(node.play({ url: 'https://example.test/raw.mp3' })).rejects.toThrow('destroyed');
  await expect(node.setVolume(50)).rejects.toThrow('destroyed');
});

it('formats timelines and progress bars for absent, zero, long and completed media', async () => {
  const { queue, player, session } = await setup();

  expect(queue.node.createProgressBar()).toBeNull();

  await queue.play(new TestTrack('timeline'));
  session.position.mediaMs = 3661000;
  session.durationMs = 7322000;

  expect(queue.node.getTimestamp()).toEqual({
    current: { label: '1:01:01', value: 3661000 },
    total: { label: '2:02:02', value: 7322000 },
    progress: 50,
  });
  expect(
    queue.node.createProgressBar({ length: 4, leftChar: '=', rightChar: '-', indicator: '>', timecodes: false }),
  ).toBe('==>-');
  expect(queue.node.createProgressBar()).toContain('1:01:01');
  expect(() => queue.node.createProgressBar({ length: -1 })).toThrow(RangeError);

  session.durationMs = 0;

  expect(queue.node.getTimestamp()?.progress).toBe(0);
  expect(queue.node.createProgressBar({ length: 0, timecodes: false })).toBe('🔘');

  session.durationMs = null;

  expect(queue.node.totalDuration).toBe(60000);
  expect(queue.node.getTimestamp()?.progress).toBe(100);

  await player.destroy();
});

it('forwards navigation aliases to queue ownership rather than operating on raw sessions', async () => {
  const { queue, player } = await setup();
  const track = new TestTrack('target');
  const skip = vi.spyOn(queue, 'skip').mockResolvedValue(track);
  const skipTo = vi.spyOn(queue, 'skipTo').mockResolvedValue(track);
  const jump = vi.spyOn(queue, 'jump').mockResolvedValue(track);
  const stop = vi.spyOn(queue, 'stop').mockResolvedValue();

  expect(await queue.node.skip()).toBe(track);
  expect(await queue.node.skipTo(2)).toBe(track);
  expect(await queue.node.jump(track)).toBe(track);

  await queue.node.stop();

  expect(skip).toHaveBeenCalledOnce();
  expect(skipTo).toHaveBeenCalledWith(2);
  expect(jump).toHaveBeenCalledWith(track);
  expect(stop).toHaveBeenCalledOnce();

  await player.destroy();
});
