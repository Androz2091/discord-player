import { afterEach, expect, it, vi } from 'vitest';
import { RemediaClient } from '@remedia/client';
import { DiscordPlayer, Track, definePlugin } from '../src/index.js';
import type { PlaybackSession } from '../src/index.js';
import { createRemediaMock } from './mocks/remedia.js';
import { IndependentBackend, IndependentSession } from './mocks/independent-backend.js';
import { deferred, settle } from './mocks/async.js';

const players: DiscordPlayer[] = [];

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

function fixture(backend = new IndependentBackend()) {
  const plugin = definePlugin({
    id: 'independent',
    setup(ctx) {
      ctx.provide('playback.backend', backend);
    },
  });
  const player = new DiscordPlayer({ send: backend.send, plugins: [plugin()] });
  players.push(player);

  return { player, backend };
}

const track = (title = 'track') => new Track({ title, sourceReference: { pluginId: 'source', data: null } });

async function source(player: DiscordPlayer) {
  await player.plugins.register(
    definePlugin({
      id: 'source',
      setup(ctx) {
        ctx.on('track.stream', ({ track: input }) => ({ url: `https://example.test/${input.title}` }));
      },
    })(),
  );
}

it('retains the initial Gateway stream in order until an independent backend is ready', async () => {
  const entered = deferred<void>();
  const gate = deferred<void>();
  const backend = new IndependentBackend();
  backend.initializeHook = async () => {
    entered.resolve();
    await gate.promise;
  };
  const { player } = fixture(backend);
  const ready = { t: 'READY', s: 1, d: {} };
  const voice = {
    t: 'VOICE_STATE_UPDATE',
    s: 2,
    d: { guild_id: 'guild', user_id: 'bot-user', channel_id: 'voice' },
  };
  const member = { t: 'GUILD_CREATE', s: 3, d: { id: 'guild' } };
  const observed = vi.fn();
  player.on('voiceStateUpdate', observed);

  player.receive(ready);
  player.receive(voice);
  expect(backend.received).toEqual([]);

  const initialization = player.initialize('bot-user');
  await entered.promise;
  player.receive(member);
  expect(backend.received).toEqual([]);

  gate.resolve();
  await initialization;
  expect(backend.received).toEqual([ready, voice, member]);
  expect(observed).toHaveBeenCalledWith('guild', voice);
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('rejects incomplete Gateway history before custom backend initialization', async () => {
  const { player, backend } = fixture();
  for (let index = 0; index < 1025; index++) player.receive({ t: 'MESSAGE_CREATE', s: index, d: { index } });
  await expect(player.initialize('bot-user')).rejects.toThrow(/Gateway startup exceeded 1024/);
  expect(backend.initializeCalls).toBe(0);
  expect(backend.received).toEqual([]);
  expect(backend.destroyCalls).toBe(1);
  expect(() => player.getBackend()).toThrow(/not active/);
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('does not replay buffered dispatches on the default Remedia path', async () => {
  const mock = createRemediaMock();
  vi.mocked(RemediaClient.create).mockResolvedValue(mock.asClient());
  const player = new DiscordPlayer({ send() {} });
  players.push(player);
  player.receive({ t: 'READY', s: 1, d: {} });

  await player.initialize('bot-user');
  expect(mock.client.receive).not.toHaveBeenCalled();

  const packet = { t: 'READY', s: 2, d: {} };
  player.receive(packet);
  expect(mock.client.receive).toHaveBeenCalledExactlyOnceWith(packet);
});

it('connects, progresses two tracks, and applies raw controls without native playback code', async () => {
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  await source(player);
  const queue = await player.nodes.create('guild');
  const started = vi.fn();
  const finished = vi.fn();
  const paused = vi.fn();
  const resumed = vi.fn();
  const seeked = vi.fn();
  player.events.on('playerStart', started);
  player.events.on('playerFinish', finished);
  player.events.on('playerPause', paused);
  player.events.on('playerResume', resumed);
  player.events.on('playerSeek', seeked);

  await queue.connect({ channelId: 'voice' });
  const session = backend.sessions[0]!;
  expect(queue.node.session).toBe(session);
  expect(session.connectionState).toBe('connected');

  const first = track('first');
  const second = track('second');
  await queue.play([first, second]);
  expect(started.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
  expect(started.mock.calls[0]?.[2]).toMatchObject({ sessionId: session.sessionId, generation: 1 });

  session.complete();
  await settle();
  expect(queue.currentTrack).toBe(second);
  expect(finished.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
  expect(started).toHaveBeenCalledTimes(2);
  expect(started.mock.calls[1]?.[2]).toMatchObject({ sessionId: session.sessionId, generation: 2 });

  await queue.node.pause();
  expect(session.state).toBe('paused');
  expect(paused.mock.calls[0]?.[0]).toBe(queue);
  await queue.node.resume();
  expect(session.state).toBe('playing');
  expect(resumed.mock.calls[0]?.[0]).toBe(queue);

  await queue.node.seek(1500);
  expect(session.position.mediaMs).toBe(1500);
  expect(queue.node.playbackTime).toBe(1500);
  expect(seeked.mock.calls[0]?.[0]).toBe(queue);

  await queue.node.setVolume(40);
  expect(session.volume).toBe(0.4);
  expect(queue.node.volume).toBe(40);

  await queue.stop();
  expect(session.state).toBe('stopped');
  expect(queue.currentTrack).toBeNull();
});

it('replaces an independent session through framework-owned creation and detaches listeners', async () => {
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const previous = backend.sessions[0]!;
  const observer = vi.fn();
  previous.on('playbackStarted', observer);

  const replacement = await queue.node.createSession({ channelId: 'replacement' });
  expect(replacement).toBeInstanceOf(IndependentSession);
  expect(queue.node.session).toBe(replacement);
  expect(previous.disposed).toBe(true);
  expect(previous.listenerCount('playbackCompleted')).toBe(0);
  expect(previous.listenerCount('playbackStarted')).toBe(1);
  expect(() => Object.assign(queue.node, { session: previous })).toThrow();

  await player.destroy();
  expect(backend.sessions[1]?.disposed).toBe(true);
});

it('disposes a new session when listener attachment fails and preserves both errors', async () => {
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  backend.sessionConfigs.push({ failListenerAt: 3, disposeError: new Error('dispose failed') });

  const error = await queue.connect({ channelId: 'voice' }).catch((value: unknown) => value);
  expect(error).toBeInstanceOf(AggregateError);

  const aggregate = error as AggregateError;
  expect(aggregate.errors.map(String)).toEqual([
    expect.stringContaining('listener registration failed'),
    expect.stringContaining('dispose failed'),
  ]);

  const session = backend.sessions[0]!;
  expect(session.disposeCalls).toBe(1);
  expect(session.listenerCount('playbackCompleted')).toBe(0);
  expect(queue.node.session).toBeNull();
});

it('disposes a session when voice connection fails while preserving the connection error', async () => {
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  backend.sessionConfigs.push({ connectError: new Error('voice join failed') });

  await expect(queue.connect({ channelId: 'voice' })).rejects.toThrow(/voice join failed/);
  expect(backend.sessions[0]?.disposeCalls).toBe(1);
  expect(queue.node.session).toBeNull();
});

it('disposes a session that resolves after its queue has been destroyed', async () => {
  const entered = deferred<Parameters<IndependentBackend['createSession']>[0]>();
  const pending = deferred<PlaybackSession>();
  const backend = new IndependentBackend();
  backend.createSessionHook = async (options, signal) => {
    signal.throwIfAborted();
    entered.resolve(options);
    return pending.promise;
  };
  const { player } = fixture(backend);
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  const connection = queue.connect({ channelId: 'voice' });
  const options = await entered.promise;
  const destruction = queue.destroy();
  const late = new IndependentSession(options);
  backend.sessions.push(late);
  pending.resolve(late);

  await expect(connection).rejects.toThrow();
  await destruction;
  expect(late.disposed).toBe(true);
  expect(queue.node.session).toBeNull();
});

it('clears buffered dispatches and disposes the provider when initialization fails', async () => {
  const backend = new IndependentBackend();
  backend.initializeHook = async () => {
    throw new Error('independent startup failed');
  };
  const { player } = fixture(backend);
  player.receive({ t: 'READY', s: 1, d: {} });

  await expect(player.initialize('bot-user')).rejects.toThrow(/independent startup failed/);
  player.receive({ t: 'READY', s: 2, d: {} });
  expect(backend.received).toEqual([]);
  expect(backend.destroyCalls).toBe(1);
});

it('aborts initialization immediately if Gateway history overflows while the provider starts', async () => {
  const backend = new IndependentBackend();
  const entered = deferred<AbortSignal>();
  backend.initializeHook = async ({ signal }) => {
    entered.resolve(signal);
    await new Promise<void>((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
    );
  };
  const { player } = fixture(backend);
  const initialization = expect(player.initialize('bot-user')).rejects.toThrow(/initial Gateway history is incomplete/);
  const signal = await entered.promise;
  for (let index = 0; index < 1025; index++) player.receive({ t: 'GUILD_CREATE', s: index, d: {} });
  await initialization;
  expect(signal.aborted).toBe(true);
  expect(backend.received).toEqual([]);
  expect(backend.destroyCalls).toBe(1);
});

it('replays reentrant Gateway packets after older packets and accepts the full 1024-packet boundary', async () => {
  const { player, backend } = fixture();
  const receive = backend.receive.bind(backend);
  vi.spyOn(backend, 'receive').mockImplementation((packet) => {
    receive(packet);
    if (packet.s === 0) player.receive({ t: 'GUILD_CREATE', s: 1023, d: {} });
  });
  for (let index = 0; index < 1023; index++) player.receive({ t: 'GUILD_CREATE', s: index, d: {} });
  await player.initialize('bot-user');
  expect(backend.received.map((packet) => packet.s)).toEqual(Array.from({ length: 1024 }, (_, index) => index));
});

it('does not replay incomplete history when overflow happens reentrantly during replay', async () => {
  const { player, backend } = fixture();
  const initialized = vi.fn();
  await player.plugins.register(
    definePlugin({
      id: 'observer',
      setup(ctx) {
        ctx.on('player.initialized', initialized);
      },
    })(),
  );
  vi.spyOn(backend, 'receive').mockImplementation(() => {
    player.receive({ t: 'GUILD_CREATE', s: 1024, d: {} });
  });
  for (let index = 0; index < 1024; index++) player.receive({ t: 'GUILD_CREATE', s: index, d: {} });
  await expect(player.initialize('bot-user')).rejects.toThrow(/initial Gateway history is incomplete/);
  expect(initialized).not.toHaveBeenCalled();
  expect(backend.destroyCalls).toBe(1);
});

it('stops Gateway replay and releases the backend if a packet consumer fails', async () => {
  const { player, backend } = fixture();
  const failure = new Error('Gateway consumer failed');
  vi.spyOn(backend, 'receive').mockImplementation(() => {
    throw failure;
  });
  player.receive({ t: 'READY', s: 0, d: {} });
  player.receive({ t: 'GUILD_CREATE', s: 1, d: {} });
  await expect(player.initialize('bot-user')).rejects.toBe(failure);
  expect(backend.receive).toHaveBeenCalledOnce();
  expect(backend.destroyCalls).toBe(1);
  player.receive({ t: 'READY', s: 2, d: {} });
  expect(backend.receive).toHaveBeenCalledOnce();
});

it('fences the rest of Gateway replay when a consumer destroys the Player', async () => {
  const { player, backend } = fixture();
  let destruction: Promise<void> | undefined;
  vi.spyOn(backend, 'receive').mockImplementation(() => {
    destruction = player.destroy();
  });
  player.receive({ t: 'READY', s: 0, d: {} });
  player.receive({ t: 'GUILD_CREATE', s: 1, d: {} });
  await expect(player.initialize('bot-user')).rejects.toThrow();
  await destruction;
  expect(backend.receive).toHaveBeenCalledOnce();
  expect(backend.destroyCalls).toBe(1);
});

it('keeps default Remedia initialization unaffected by pre-initialization Gateway overflow', async () => {
  const mock = createRemediaMock();
  vi.mocked(RemediaClient.create).mockResolvedValue(mock.asClient());
  const player = new DiscordPlayer({ send() {} });
  players.push(player);
  for (let index = 0; index < 1025; index++) player.receive({ t: 'READY', s: index, d: {} });
  await player.initialize('bot-user');
  expect(player.getRemedia()).toBe(mock.asClient());
  expect(mock.client.receive).not.toHaveBeenCalled();
  player.receive({ t: 'READY', s: 1025, d: {} });
  expect(mock.client.receive).toHaveBeenCalledExactlyOnceWith({ t: 'READY', s: 1025, d: {} });
});

it('stages, cancels, promotes and reconciles independent crossfade generations during recovery', async () => {
  const { player, backend } = fixture(new IndependentBackend({ sources: ['url'], crossfade: true, filters: false }));
  await player.initialize('bot-user');
  await source(player);
  const queue = await player.nodes.create('guild', { crossfade: { enabled: true } });
  await queue.connect({ channelId: 'voice' });
  const first = track('first');
  const second = track('second');
  const third = track('third');
  const started = vi.fn();
  const finished = vi.fn();
  player.events.on('playerStart', started);
  player.events.on('playerFinish', finished);
  await queue.play([first, second, third]);
  const session = backend.sessions[0]!;
  session.requestPreparation();
  await settle();
  expect(session.staged?.entryId).toBe(queue.tracks.entryId(0));
  expect(started).toHaveBeenCalledOnce();
  await queue.node.seek(1200);
  expect(session.staged).toBeNull();
  session.requestPreparation();
  await settle();
  const outgoing = session.promote(false);
  session.connectionState = 'disconnected';
  await queue.connect({ channelId: 'voice' });
  await settle();
  expect(queue.currentTrack).toBe(second);
  expect(started).toHaveBeenCalledTimes(2);
  expect(started.mock.calls[1]?.[2]).toBeUndefined();
  outgoing();
  await settle();
  expect(finished.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
  expect(queue.currentTrack).toBe(second);
  expect(session.playCalls).toBe(1);
  session.requestPreparation();
  await settle();
  session.promote()();
  await settle();
  expect(queue.currentTrack).toBe(third);
  expect(started.mock.calls[2]?.[2]).toMatchObject({ generation: 3 });
  expect(session.playCalls).toBe(1);
});

it('unregisters an independent provider during pending source resolution and disposes abandoned bytes', async () => {
  const { Readable } = await import('node:stream');
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  const entered = deferred<void>();
  const output = Readable.from(['encoded']);
  await player.plugins.register(
    definePlugin({
      id: 'source',
      setup(ctx) {
        ctx.on('track.stream', async (_input, { signal }) => {
          entered.resolve();
          await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
          return output;
        });
      },
    })(),
  );
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const playback = queue.play(track());
  await entered.promise;
  await player.plugins.unregister('independent');
  await playback;
  expect(queue.destroyed).toBe(true);
  expect(output.destroyed).toBe(true);
  expect(backend.sessions[0]?.playCalls).toBe(0);
  expect(backend.sessions[0]?.disposeCalls).toBe(1);
  expect(backend.destroyCalls).toBe(1);
});

it('attempts every listener cleanup and preserves disposal and detach failures', async () => {
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  backend.createSessionHook = async (options) => {
    const session = new IndependentSession(options);
    const off = session.off;
    let failed = false;
    vi.spyOn(session, 'off').mockImplementation(((name: string, listener: (...args: unknown[]) => void) => {
      Reflect.apply(off, session, [name, listener]);
      if (!failed) {
        failed = true;
        throw new Error('detach failed');
      }
    }) as typeof session.off);
    backend.sessions.push(session);
    return session;
  };
  await queue.connect({ channelId: 'voice' });
  const session = backend.sessions[0]!;
  const dispose = session.dispose.bind(session);
  vi.spyOn(session, 'dispose').mockImplementation(async () => {
    await dispose();
    throw new Error('dispose failed');
  });
  const failure = await queue.node.destroySession().catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map(String)).toEqual([
    expect.stringContaining('dispose failed'),
    expect.stringContaining('detach failed'),
  ]);
  expect(session.listenerCount('playbackCompleted')).toBe(0);
  expect(session.listenerCount('playbackStarted')).toBe(0);
  expect(queue.node.session).toBeNull();
});

it('composes byte transformations by priority while retaining independent playback policies and source identity', async () => {
  const { Readable, Transform } = await import('node:stream');
  const { player, backend } = fixture();
  await player.initialize('bot-user');
  const streams: InstanceType<typeof Readable>[] = [];
  const order: string[] = [];
  await player.plugins.register(
    definePlugin({
      id: 'source',
      setup(ctx) {
        ctx.on('track.stream', () => {
          const stream = Readable.from(['encoded']);
          streams.push(stream);
          return stream;
        });
      },
    })(),
  );
  for (const [id, priority] of [
    ['low', 0],
    ['high', 10],
  ] as const) {
    await player.plugins.register(
      definePlugin({
        id,
        setup(ctx) {
          ctx.on(
            'media.transform',
            (input) => {
              order.push(id);
              return {
                ...input,
                stream: input.stream.pipe(
                  new Transform({
                    transform(chunk, _encoding, callback) {
                      callback(null, id === 'high' ? String(chunk).toUpperCase() : `${String(chunk)}!`);
                    },
                  }),
                ),
              };
            },
            { priority },
          );
        },
      })(),
    );
  }
  await player.plugins.register(
    definePlugin({
      id: 'admission',
      setup(ctx) {
        ctx.on('playback.beforeStart', () => ({ action: 'cancel', reason: 'admission denied' }));
      },
    })(),
  );
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const current = track();
  await expect(queue.play(current)).rejects.toThrow(/admission denied/);
  expect(streams).toEqual([]);
  await player.plugins.unregister('admission');
  const session = backend.sessions[0]!;
  const play = session.play.bind(session);
  let bytes = '';
  vi.spyOn(session, 'play').mockImplementation(async (input, options) => {
    if (!input || typeof input !== 'object' || !('stream' in input) || !(input.stream instanceof Readable))
      throw new Error('Expected encoded stream');
    for await (const chunk of input.stream) bytes += String(chunk);
    return play(input, options);
  });
  await queue.play(current);
  expect(bytes).toBe('ENCODED!');
  expect(order).toEqual(['high', 'low']);
  expect(current.sourceReference?.pluginId).toBe('source');
  expect(streams[0]?.destroyed).toBe(true);
  expect(queue.currentTrack).toBe(current);
});

for (const operation of ['connect', 'play'] as const) {
  it(`unregisters an independent provider during pending ${operation} without deadlocking its session lock`, async () => {
    const { player, backend } = fixture();
    await player.initialize('bot-user');
    const queue = await player.nodes.create('guild');
    await queue.node.createSession({ channelId: 'voice' });
    const session = backend.sessions[0]!;
    const entered = deferred<void>();
    const pending = deferred<never>();
    const dispose = session.dispose.bind(session);
    vi.spyOn(session, operation).mockImplementation(async () => {
      entered.resolve();
      return pending.promise;
    });
    vi.spyOn(session, 'dispose').mockImplementation(async () => {
      pending.reject(new Error('provider removed'));
      await dispose();
    });
    const work = expect(
      operation === 'connect'
        ? queue.connect({ channelId: 'voice' })
        : queue.node.play({ url: 'https://example.test/audio' }),
    ).rejects.toThrow(/provider removed/);
    await entered.promise;
    await player.plugins.unregister('independent');
    await work;
    expect(queue.destroyed).toBe(true);
    expect(session.disposeCalls).toBe(1);
    expect(backend.destroyCalls).toBe(1);
    expect(session.listenerCount('playbackCompleted')).toBe(0);
    session.complete();
    expect(queue.currentTrack).toBeNull();
  });
}
