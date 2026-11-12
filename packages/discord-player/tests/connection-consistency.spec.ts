import { afterEach, expect, it, vi } from 'vitest';
import { DiscordPlayer, definePlugin } from '../src/index.js';
import { IndependentBackend } from './mocks/independent-backend.js';
import { createRemediaMock } from './mocks/remedia.js';

const players: DiscordPlayer[] = [];

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

async function fixture(custom: boolean) {
  const independent = new IndependentBackend({ sources: ['url'], filters: true, crossfade: false });
  const remedia = createRemediaMock();
  const player = new DiscordPlayer({
    send() {},
    plugins: custom
      ? [
          definePlugin({
            id: 'backend',
            setup(ctx) {
              ctx.provide('playback.backend', independent);
            },
          })(),
        ]
      : [],
  });
  players.push(player);
  if (custom) await player.initialize('bot-user');
  else {
    player.remedia = remedia.asClient();
    player.getClientId = () => 'bot-user';
  }
  const queue = await player.nodes.create('guild', { volume: 60, selfDeaf: true, selfMute: false, filterGraph: null });
  const sessions = custom ? independent.sessions : remedia.sessions;
  return { player, queue, sessions, independent, remedia };
}

for (const custom of [false, true]) {
  const label = custom ? 'custom' : 'default';

  it(`${label}: failed initial connection retains previous queue defaults, including when disposal fails`, async () => {
    const { queue, sessions, independent, remedia } = await fixture(custom);
    const joinError = new Error('join failed');
    const disposeError = new Error('dispose failed');
    if (custom) independent.sessionConfigs.push({ connectError: joinError, disposeError });
    else {
      const create = remedia.client.createDiscordSession.getMockImplementation()!;
      remedia.client.createDiscordSession.mockImplementation((options) => {
        const session = create(options);
        vi.spyOn(session, 'connect').mockRejectedValue(joinError);
        vi.spyOn(session, 'dispose').mockRejectedValue(disposeError);
        return session;
      });
    }
    const error = await queue
      .connect({ channelId: 'voice', volume: 30, selfDeaf: false, selfMute: true, filterGraph: 'volume=0.3' })
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([joinError, disposeError]);
    expect(queue.options).toMatchObject({ volume: 60, selfDeaf: true, selfMute: false, filterGraph: null });
    expect(queue.node.volume).toBe(60);
    expect(queue.node.session).toBeNull();
    expect(sessions[0]?.listenerCount('playbackCompleted')).toBe(0);
  });

  it(`${label}: partially applied controls reconcile from the real retained session`, async () => {
    const { queue, sessions } = await fixture(custom);
    await queue.connect({ channelId: 'voice' });
    const session = sessions[0]!;
    const failure = new Error('mute update failed after commit');
    vi.spyOn(session, 'setSelfMute').mockImplementation(async (enabled) => {
      session.selfMute = enabled;
      throw failure;
    });
    await expect(queue.connect({ channelId: 'moved', selfDeaf: false, selfMute: true, volume: 20 })).rejects.toBe(
      failure,
    );
    expect(queue.options).toMatchObject({ selfDeaf: false, selfMute: true, volume: 60, filterGraph: null });
    expect(session.channelId).toBe('voice');
    expect(queue.node.session).toBe(session);
    expect(queue.node.volume).toBe(session.volume * 100);
  });

  it(`${label}: a failed move retains actual controls and allows recovery on the same session`, async () => {
    const { queue, sessions } = await fixture(custom);
    await queue.connect({ channelId: 'voice' });
    const session = sessions[0]!;
    const connection = vi.fn();
    queue.player.events.on('connection', connection);
    vi.spyOn(session, 'move').mockImplementationOnce(async (channelId) => {
      session.channelId = channelId;
      session.connectionState = 'disconnected';
      throw new Error('move failed after changing destination');
    });
    await expect(
      queue.connect({ channelId: 'moved', volume: 20, selfDeaf: false, filterGraph: 'volume=0.2' }),
    ).rejects.toThrow(/move failed/);
    expect(queue.options).toMatchObject({ volume: 20, selfDeaf: false, filterGraph: 'volume=0.2' });
    expect(queue.node.session?.channelId).toBe('moved');
    expect(queue.node.session?.connectionState).toBe('disconnected');
    expect(connection).not.toHaveBeenCalled();
    await queue.connect({ channelId: 'moved' });
    expect(queue.node.session).toBe(session);
    expect(session.connectionState).toBe('connected');
    expect(connection).toHaveBeenCalledOnce();
    expect(sessions).toHaveLength(1);
  });
}

for (const custom of [false, true]) {
  const label = custom ? 'custom' : 'default';

  it(`${label}: destruction cancels a pending connection without waiting for the node lock`, async () => {
    const { queue, sessions } = await fixture(custom);
    await queue.node.createSession({ channelId: 'voice' });
    const session = sessions[0]!;
    const { deferred } = await import('./mocks/async.js');
    const entered = deferred<void>();
    vi.spyOn(session, 'connect').mockImplementation(async (options) => {
      entered.resolve();
      await new Promise<void>((_resolve, reject) =>
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true }),
      );
    });
    const connection = expect(queue.connect({ channelId: 'voice' })).rejects.toThrow();
    await entered.promise;
    await queue.destroy();
    await connection;
    expect(session.disposeCalls).toBe(1);
    expect(queue.node.session).toBeNull();
  });

  it(`${label}: destruction disposes a pending move once and fences connection success`, async () => {
    const { queue, sessions } = await fixture(custom);
    await queue.connect({ channelId: 'voice' });
    const session = sessions[0]!;
    const { deferred } = await import('./mocks/async.js');
    const entered = deferred<void>();
    const pending = deferred<void>();
    const dispose = session.dispose.bind(session);
    vi.spyOn(session, 'move').mockImplementation(async () => {
      entered.resolve();
      await pending.promise;
    });
    vi.spyOn(session, 'dispose').mockImplementation(async () => {
      pending.reject(new Error('move cancelled by disposal'));
      await dispose();
    });
    const connected = vi.fn();
    queue.player.events.on('connection', connected);
    const connection = expect(queue.connect({ channelId: 'moved' })).rejects.toThrow(/cancelled by disposal/);
    await entered.promise;
    await queue.destroy();
    await connection;
    expect(connected).not.toHaveBeenCalled();
    expect(session.disposeCalls).toBe(1);
    expect(session.listenerCount('playbackStarted')).toBe(0);
    expect(queue.node.session).toBeNull();
  });

  it(`${label}: raw pending playback is disposed before teardown waits for its node lock`, async () => {
    const { queue, sessions } = await fixture(custom);
    await queue.connect({ channelId: 'voice' });
    const session = sessions[0]!;
    const { deferred } = await import('./mocks/async.js');
    const entered = deferred<void>();
    const pending = deferred<never>();
    const dispose = session.dispose.bind(session);
    vi.spyOn(session, 'play').mockImplementation(async () => {
      entered.resolve();
      return pending.promise;
    });
    vi.spyOn(session, 'dispose').mockImplementation(async () => {
      pending.reject(new Error('play cancelled by disposal'));
      await dispose();
    });
    const playback = expect(queue.node.play({ url: 'https://example.test/audio' })).rejects.toThrow(
      /cancelled by disposal/,
    );
    await entered.promise;
    await queue.destroy();
    await playback;
    expect(session.disposeCalls).toBe(1);
    expect(queue.node.session).toBeNull();
  });
}
