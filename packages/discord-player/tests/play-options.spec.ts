import { afterEach, expect, it, vi } from 'vitest';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred } from './mocks/async.js';

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];

async function fixture(nodeType: 'embedded' | 'remote' = 'embedded') {
  const value = await setup({ nodeType });
  players.push(value.player);
  return value;
}

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

it.each(['embedded', 'remote'] as const)(
  'groups queue defaults, search, connection and generation metadata on %s',
  async (nodeType) => {
    const { player, queue, backend } = await fixture(nodeType);
    await queue.destroy();
    const signal = new AbortController().signal;
    const search = vi.spyOn(player, 'search');
    const resource = new TestTrack('first');
    const result = await player.play<{ textChannel: string }, { request: string }>('voice-new', resource, {
      guildId: 'new-guild',
      requestedBy: 'requester',
      searchEngine: 'auto',
      signal,
      nodeOptions: {
        metadata: { textChannel: 'text' },
        volume: 80,
        selfDeaf: false,
        filterGraph: 'bass=gain=2',
        leaveOnEnd: true,
      },
      connectionOptions: {
        selfDeaf: true,
        selfMute: true,
        volume: 25,
        filterGraph: null,
        nodeId: 'fake-node',
        connectTimeoutMs: 30_000,
        enableFallbackSeeking: true,
      },
      customMetadata: { request: 'one' },
    });
    const session = backend.asSession(result.queue.node.getSession());
    expect(search).toHaveBeenCalledExactlyOnceWith(resource, {
      requestedBy: 'requester',
      searchEngine: 'auto',
      signal,
    });
    expect(result.queue.metadata).toEqual({ textChannel: 'text' });
    expect(result.queue.options.leaveOnEnd).toBe(true);
    expect(backend.client.createDiscordSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        guildId: 'new-guild',
        channelId: 'voice-new',
        volume: 0.25,
        filterGraph: null,
        selfDeaf: true,
        selfMute: true,
        nodeId: 'fake-node',
        enableFallbackSeeking: true,
      }),
    );
    expect(session.connectOptions[0]).toMatchObject({ timeoutMs: 30_000 });
    expect(session.connectOptions[0]?.signal?.aborted).toBe(false);
    expect(session.customMetadata).toMatchObject({ userMetadata: { request: 'one' } });
    expect(backend.client.createDiscordSession.mock.lastCall?.[0]).not.toHaveProperty('connectionOptions');
    expect(backend.client.createDiscordSession.mock.lastCall?.[0]).not.toHaveProperty('signal');
  },
);

it('uses creation defaults, retains existing configuration, then applies explicit session overrides', async () => {
  const { player, queue, backend } = await fixture();
  await queue.destroy();
  const first = await player.play({ guildId: 'new', channelId: 'voice' }, new TestTrack('one'), {
    nodeOptions: { metadata: 'original', volume: 80, filterGraph: 'bass=gain=2', selfDeaf: false, selfMute: true },
  });
  const session = backend.asSession(first.queue.node.getSession());
  expect(session).toMatchObject({ volume: 0.8, selfDeaf: false, selfMute: true });
  expect(session.filters.graph).toBe('bass=gain=2');
  await player.play({ guildId: 'new', channelId: 'voice' }, new TestTrack('two'), {
    nodeOptions: { metadata: 'ignored', volume: 10, filterGraph: null, selfDeaf: true, maxSize: 1 },
  });
  expect(first.queue.metadata).toBe('original');
  expect(session.volume).toBe(0.8);
  expect(session.filters.graph).toBe('bass=gain=2');
  await player.play({ guildId: 'new', channelId: 'moved' }, new TestTrack('three'), {
    connectionOptions: { volume: 0, filterGraph: null, selfDeaf: true, selfMute: false },
  });
  expect(session).toMatchObject({ volume: 0, selfDeaf: true, selfMute: false, channelId: 'moved' });
  expect(session.filters.graph).toBeNull();
  expect(session.playCalls).toBe(1);
  expect(first.queue.size).toBe(2);
  await expect(
    player.play({ guildId: 'new', channelId: 'moved' }, new TestTrack('four'), {
      connectionOptions: { nodeId: 'different-node' },
    }),
  ).rejects.toThrow('Changing a Remedia node');
  expect(first.queue.size).toBe(2);
});

it('lets queue.play connect explicitly or configure its existing channel without an extra connect wrapper', async () => {
  const { queue, session } = await fixture();
  await queue.play(new TestTrack('one'), {
    connectionOptions: { volume: 20, filterGraph: 'volume=0.2' },
    customMetadata: { request: 1 },
  });
  expect(session.volume).toBe(0.2);
  expect(session.filters.graph).toBe('volume=0.2');
  await queue.connect({ channelId: 'moved', volume: 50 });
  expect(session.channelId).toBe('moved');
  expect(session.volume).toBe(0.5);
  await queue.node.destroySession();
  await expect(queue.play(new TestTrack('missing'), { connectionOptions: { selfDeaf: true } })).rejects.toThrow(
    'connectionOptions.channelId',
  );
  await queue.play(new TestTrack('two'), { connectionOptions: { channelId: 'new', connectTimeoutMs: 1234 } });
  expect(queue.node.session?.channelId).toBe('new');
});

it.each(['embedded', 'remote'] as const)(
  'cancels voice negotiation and disposes partial sessions on %s',
  async (nodeType) => {
    const { player, queue, backend } = await fixture(nodeType);
    await queue.node.destroySession();
    const entered = deferred<AbortSignal>();
    const create = backend.client.createDiscordSession.getMockImplementation();
    if (!create) throw new Error('Missing session fixture');
    backend.client.createDiscordSession.mockImplementation((options) => {
      const session = create(options);
      vi.spyOn(session, 'connect').mockImplementation(async ({ signal } = {}) => {
        if (!signal) throw new Error('Missing connection signal');
        entered.resolve(signal);
        await new Promise<void>((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        );
      });
      return session;
    });
    const controller = new AbortController();
    const pending = player.play({ guildId: queue.id, channelId: 'voice' }, new TestTrack('cancel'), {
      signal: controller.signal,
    });
    const failed = expect(pending).rejects.toThrow('cancel join');
    const signal = await entered.promise;
    controller.abort(new Error('cancel join'));
    await failed;
    expect(signal.aborted).toBe(true);
    expect(queue.size).toBe(0);
    expect(queue.node.session).toBeNull();
    expect(backend.sessions.at(-1)?.disposeCalls).toBe(1);
    backend.client.createDiscordSession.mockImplementation(create);
    await queue.play(new TestTrack('recovery'), { connectionOptions: { channelId: 'voice' } });
  },
);

it('rejects pre-aborted playback before creating a queue or changing a session', async () => {
  const { player, backend } = await fixture();
  const signal = AbortSignal.abort(new Error('cancelled request'));
  const create = backend.client.createDiscordSession.mock.calls.length;
  await expect(
    player.play({ guildId: 'uncreated', channelId: 'voice' }, new TestTrack('one'), { signal }),
  ).rejects.toThrow('cancelled request');
  expect(player.getQueue('uncreated')).toBeNull();
  expect(backend.client.createDiscordSession).toHaveBeenCalledTimes(create);
});

it('cancels queued admission without waiting for the transition lock', async () => {
  const { queue, session } = await fixture();
  const lock = await queue.tasks.acquire('queue.playback-transition');
  const controller = new AbortController();
  const pending = queue.play(new TestTrack('one'), { signal: controller.signal, connectionOptions: { volume: 20 } });
  const cancelled = expect(pending).rejects.toThrow('cancel waiting');
  controller.abort(new Error('cancel waiting'));
  await cancelled;
  lock.release();
  expect(queue.size).toBe(0);
  expect(session.volume).toBe(1);
  expect(session.playCalls).toBe(0);
});

it('forwards reconnect deadlines and rejects creation-only settings before admission', async () => {
  const { queue, session } = await fixture();
  session.connectionState = 'disconnected';
  await queue.play(new TestTrack('one'), { connectionOptions: { connectTimeoutMs: 4567, selfMute: true } });
  expect(session.connectOptions.at(-1)).toMatchObject({ timeoutMs: 4567 });
  expect(session.selfMute).toBe(true);
  await expect(
    queue.play(new TestTrack('two'), { connectionOptions: { enableFallbackSeeking: true } }),
  ).rejects.toThrow('only be set when creating');
  expect(queue.size).toBe(0);
  expect(session.playCalls).toBe(1);
});

it('retains applied controls but stops further overrides after caller cancellation', async () => {
  const { queue, session } = await fixture();
  const entered = deferred<void>();
  const release = deferred<void>();
  vi.spyOn(session, 'setSelfDeaf').mockImplementation(async (enabled) => {
    entered.resolve();
    await release.promise;
    session.selfDeaf = enabled;
  });
  const controller = new AbortController();
  const pending = queue.play(new TestTrack('one'), {
    connectionOptions: { channelId: 'moved', selfDeaf: false, selfMute: true, volume: 20 },
    signal: controller.signal,
  });
  const cancelled = expect(pending).rejects.toThrow('cancel controls');
  await entered.promise;
  controller.abort(new Error('cancel controls'));
  release.resolve();
  await cancelled;
  expect(session).toMatchObject({ selfDeaf: false, selfMute: false, volume: 1, channelId: 'voice-one' });
  expect(queue.size).toBe(0);
  expect(session.disposeCalls).toBe(0);
  await queue.connect({ channelId: 'voice-one', volume: 80 });
  expect(session.volume).toBe(0.8);
});
