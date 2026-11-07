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
  expect(backend.client.createDiscordSession).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ connectTimeoutMs: expect.anything() }),
  );

  const connect = vi.spyOn(session, 'connect');
  session.connectionState = 'disconnected';
  await queue.connect({ channelId: 'new', connectTimeoutMs: 110_000 });
  expect(connect).toHaveBeenCalledWith({ timeoutMs: 110_000 });
  await player.destroy();
});

it('cleans up sessions whose connect method rejects and permits a subsequent connection', async () => {
  const { queue, player, backend } = await setup();
  await queue.node.destroySession();
  let broken!: FakeSession;
  backend.client.createDiscordSession.mockImplementationOnce((options) => {
    broken = new FakeSession(options, 'embedded');
    vi.spyOn(broken, 'connect').mockRejectedValue(new Error('voice failed'));
    return broken;
  });
  await expect(queue.connect({ channelId: 'new' })).rejects.toThrow('voice failed');
  expect(queue.node.getSession(false)).toBeNull();
  expect(broken.disconnectCalls).toBe(1);
  expect(broken.eventNames()).toHaveLength(0);
  await queue.connect({ channelId: 'recovered' });
  expect(queue.node.getSession().channelId).toBe('recovered');
  await player.destroy();
});

it('keeps raw controls separate from managed queue state and forwards playback events', async () => {
  const { queue, player, session } = await setup();
  const node = queue.node;
  await node.playRaw({ url: 'https://example.test/raw.mp3' });
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
  for (const volume of [-1, 101, NaN, Infinity]) await expect(node.setVolume(volume)).rejects.toThrow(RangeError);
  const events = ['playerPause', 'playerResume', 'playerSeek', 'voiceStateUpdate', 'error'] as const;
  const listeners = events.map((event) => {
    const listener = vi.fn();
    player.events.on(event, listener);
    return listener;
  });
  session.emit('playbackPaused', {});
  session.emit('playbackResumed', {});
  session.emit('playbackSeeked', {});
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
