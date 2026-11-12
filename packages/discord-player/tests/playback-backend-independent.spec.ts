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

it('bounds pre-initialization buffering and reports overflow without dropping the initial state', async () => {
  const backend = new IndependentBackend();
  const { player } = fixture(backend);
  const debug = vi.fn();
  player.on('debug', debug);

  for (let index = 0; index < 1025; index++) player.receive({ t: 'MESSAGE_CREATE', s: index, d: { index } });

  await player.initialize('bot-user');
  expect(backend.received).toHaveLength(1024);
  expect(backend.received[0]).toMatchObject({ s: 0 });
  expect(backend.received.at(-1)).toMatchObject({ s: 1023 });
  expect(debug).toHaveBeenCalledOnce();
  expect(debug.mock.calls[0]?.[0]).toMatch(/pre-initialization buffer/);
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
