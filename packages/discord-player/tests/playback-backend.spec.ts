import { afterEach, expect, it, vi } from 'vitest';
import { RemediaClient } from '@remedia/client';
import { SourcePluginRuntime } from '@discord-player/plugin-host';
import {
  DiscordPlayer,
  Track,
  definePlugin,
  type PlaybackBackendEvents,
  type PlaybackBackend,
  type PlaybackBackendContext,
  type PlaybackSession,
  type PlaybackSessionOptions,
} from '../src/index.js';
import { FakeSession } from './mocks/remedia-session.js';
import { deferred, settle } from './mocks/async.js';

class CustomSession extends FakeSession implements PlaybackSession {
  private identity() {
    return {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
    };
  }

  public override async pause(): Promise<void> {
    const previousState = this.state;
    await super.pause();
    this.emit('playbackPaused', {
      ...this.identity(),
      previousState,
      state: 'paused',
    } satisfies PlaybackBackendEvents['playbackPaused'][0]);
  }

  public override async resume(): Promise<void> {
    const previousState = this.state;
    await super.resume();
    this.emit('playbackResumed', {
      ...this.identity(),
      previousState,
      state: 'playing',
    } satisfies PlaybackBackendEvents['playbackResumed'][0]);
  }

  public override async seek(positionMs: number): Promise<void> {
    const previousPositionMs = this.position.mediaMs;
    await super.seek(positionMs);
    this.emit('playbackSeeked', {
      ...this.identity(),
      positionMs,
      previousPositionMs,
    } satisfies PlaybackBackendEvents['playbackSeeked'][0]);
  }
}

const players: DiscordPlayer[] = [];

afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
});

function fixture(overrides: Partial<PlaybackBackend> = {}) {
  const sessions: CustomSession[] = [];
  let context: PlaybackBackendContext | undefined;
  const backend: PlaybackBackend = {
    id: 'custom',
    capabilities: { sources: ['url', 'stream', 'buffer'], crossfade: false, filters: false },
    initialize: vi.fn(async (value) => {
      context = value;
    }),
    receive: vi.fn(),
    createSession: vi.fn((options: PlaybackSessionOptions) => {
      const session = new CustomSession(options, 'embedded');
      sessions.push(session);
      return session;
    }),
    destroy: vi.fn(async () => {}),
    ...overrides,
  };
  const send = vi.fn();
  const plugin = definePlugin({
    id: 'backend',
    setup(ctx) {
      ctx.provide('playback.backend', backend);
    },
  });
  const player = new DiscordPlayer({ send, plugins: [plugin()] });
  players.push(player);
  return { player, backend, sessions, send, context: () => context };
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

it('selects a modern provider before native initialization and forwards the complete Gateway stream', async () => {
  const { player, backend, context, send } = fixture();
  expect(() => player.getBackend()).toThrow(/not active/);
  const first = player.initialize('bot-user');
  expect(player.initialize('bot-user')).toBe(first);
  await first;
  expect(RemediaClient.create).not.toHaveBeenCalled();
  expect(player.getRemedia(false)).toBeNull();
  expect(() => player.getRemedia()).toThrow(/custom playback backend/);
  expect(player.getBackend()).toBe(backend);
  expect(context()?.clientId).toBe('bot-user');
  await context()?.send('guild', {
    op: 4,
    d: { guild_id: 'guild', channel_id: 'voice', self_mute: false, self_deaf: true },
  });
  expect(send).toHaveBeenCalledWith('guild', {
    op: 4,
    d: { guild_id: 'guild', channel_id: 'voice', self_mute: false, self_deaf: true },
  });
  const ready = { t: 'READY', s: 1, d: {} };
  const voice = { t: 'VOICE_STATE_UPDATE', s: 2, d: { guild_id: 'guild', user_id: 'bot-user', channel_id: 'voice' } };
  const observed = vi.fn();
  player.on('voiceStateUpdate', observed);
  player.receive(ready);
  player.receive(voice);
  expect(backend.receive).toHaveBeenNthCalledWith(1, ready);
  expect(backend.receive).toHaveBeenNthCalledWith(2, voice);
  expect(observed).toHaveBeenCalledWith('guild', voice);
  await player.destroy();
  player.receive(ready);
  expect(backend.receive).toHaveBeenCalledTimes(2);
  expect(backend.destroy).toHaveBeenCalledOnce();
});

it('preserves queue scheduling, actual event tuples, history, controls and generation fences', async () => {
  const { player, sessions } = fixture();
  await player.initialize('bot-user');
  await source(player);
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const session = sessions[0]!;
  expect(queue.node.session).toBe(session);
  const started = vi.fn();
  const finished = vi.fn();
  const paused = vi.fn();
  player.events.on('playerStart', started);
  player.events.on('playerFinish', finished);
  player.events.on('playerPause', paused);
  const first = track('first');
  const second = track('second');
  await queue.play([first, second]);
  expect(started.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
  expect(started.mock.calls[0]?.[2]).toMatchObject({ sessionId: session.sessionId, generation: 1 });
  await queue.node.pause();
  expect(session.state).toBe('paused');
  expect(paused.mock.calls[0]).toEqual([queue, expect.objectContaining({ generation: 1 })]);
  await queue.node.resume();
  await queue.node.seek(1000);
  await queue.node.setVolume(30);
  expect(queue.node.playbackTime).toBe(1000);
  expect(session.volume).toBe(0.3);
  session.complete();
  await settle();
  expect(queue.currentTrack).toBe(second);
  expect(finished.mock.calls[0]?.slice(0, 2)).toEqual([queue, first]);
  session.emit('playbackCompleted', {
    sessionId: session.sessionId,
    generation: 1,
    customMetadata: started.mock.calls[0]?.[2]?.customMetadata,
    state: 'completed',
    position: session.position,
  });
  await settle();
  expect(queue.currentTrack).toBe(second);
  expect(finished).toHaveBeenCalledOnce();
  await queue.stop();
  expect(session.state).toBe('stopped');
  expect(queue.currentTrack).toBeNull();
});

it('moves and replaces sessions only through owned operations and detaches obsolete listeners', async () => {
  const { player, sessions } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const previous = sessions[0]!;
  await queue.connect({ channelId: 'moved' });
  expect(sessions).toHaveLength(1);
  expect(previous.channelId).toBe('moved');
  const observer = vi.fn();
  previous.on('playbackStarted', observer);
  const replacement = await queue.node.createSession({ channelId: 'new' });
  expect(queue.node.session).toBe(replacement);
  expect(previous.disposeCalls).toBe(1);
  expect(previous.listenerCount('playbackCompleted')).toBe(0);
  expect(previous.listenerCount('playbackStarted')).toBe(1);
  expect(() => Object.assign(queue.node, { session: previous })).toThrow();
  await player.destroy();
  expect(sessions[1]?.disposeCalls).toBe(1);
});

it('rejects duplicate, late and standalone providers without silently choosing one', async () => {
  const { player, backend } = fixture();
  await player.ready();
  const duplicate = definePlugin({
    id: 'duplicate',
    setup(ctx) {
      ctx.provide('playback.backend', backend);
    },
  });
  await expect(player.plugins.register(duplicate())).rejects.toThrow(/Duplicate provider/);
  await player.initialize('bot-user');
  expect(player.plugins.describe().find((provider) => provider.id === 'backend')?.provides).toEqual([
    'playback.backend',
  ]);
  await expect(player.plugins.register(duplicate())).rejects.toThrow(/sealed/);
  const runtime = new SourcePluginRuntime();
  await expect(runtime.plugins.register(duplicate())).rejects.toThrow(/Unsupported local provider/);
  await runtime.destroy();
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('unregisters an active provider by disposing queues before plugin resources and never falls back', async () => {
  const { player, backend, sessions, context } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  await player.plugins.unregister('backend');
  expect(context()?.signal.aborted).toBe(true);
  expect(queue.destroyed).toBe(true);
  expect(sessions[0]?.disposeCalls).toBe(1);
  expect(backend.destroy).toHaveBeenCalledOnce();
  expect(() => player.getBackend()).toThrow(/not active/);
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('destroys a partially initialized provider on failure and retains the failure on repeated initialization', async () => {
  const { player, backend } = fixture({
    initialize: vi.fn(async () => {
      throw new Error('startup failed');
    }),
  });
  await expect(player.initialize('bot-user')).rejects.toThrow(/startup failed/);
  expect(backend.destroy).toHaveBeenCalledOnce();
  await expect(player.initialize('bot-user')).rejects.toThrow(/startup failed/);
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('cancels and drains pending initialization before provider teardown', async () => {
  const entered = deferred<void>();
  const { player, backend } = fixture({
    initialize: vi.fn(async ({ signal }) => {
      entered.resolve();
      await new Promise<void>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      );
    }),
  });
  const initialization = expect(player.initialize('bot-user')).rejects.toThrow();
  await entered.promise;
  await player.plugins.unregister('backend');
  await initialization;
  expect(backend.destroy).toHaveBeenCalledOnce();
});

it('disposes late session creation after queue destruction and rejects unsupported capabilities', async () => {
  const pending = deferred<PlaybackSession>();
  const entered = deferred<PlaybackSessionOptions>();
  const { player, backend } = fixture({
    createSession: vi.fn(async (options) => {
      entered.resolve(options);
      return pending.promise;
    }),
  });
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  await expect(queue.node.filters.set('nightcore')).rejects.toThrow(/does not support audio filters/);
  const crossfadeQueue = await player.nodes.create('other', { crossfade: { enabled: true } });
  await expect(crossfadeQueue.connect({ channelId: 'voice' })).rejects.toThrow(/does not support crossfade/);
  await expect(queue.connect({ channelId: 'voice', nodeId: 'node' })).rejects.toThrow(/node selection/);
  const connection = expect(queue.connect({ channelId: 'voice' })).rejects.toThrow();
  const options = await entered.promise;
  const destruction = queue.destroy();
  const late = new CustomSession(options, 'embedded');
  pending.resolve(late);
  await connection;
  await destruction;
  expect(late.disposeCalls).toBe(1);
  expect(queue.node.session).toBeNull();
  expect(backend.createSession).toHaveBeenCalledOnce();
});

it('uses explicitly declared staging and processing capabilities without a native runtime', async () => {
  const { player, sessions } = fixture({ capabilities: { sources: ['url'], crossfade: true, filters: true } });
  await player.initialize('bot-user');
  await source(player);
  const queue = await player.nodes.create('guild', { crossfade: { enabled: true } });
  await queue.connect({ channelId: 'voice' });
  await queue.node.filters.setRaw('volume=0.5');
  expect(sessions[0]?.filters.graph).toBe('volume=0.5');
  const started = vi.fn();
  player.events.on('playerStart', started);
  const first = track('first');
  const second = track('second');
  await queue.play([first, second]);
  const session = sessions[0]!;
  session.requestPreparation();
  await settle();
  expect(started).toHaveBeenCalledOnce();
  expect(session.stageOptions).toHaveLength(1);
  session.promote()();
  await settle();
  expect(queue.currentTrack).toBe(second);
  expect(started).toHaveBeenCalledTimes(2);
  expect(session.playCalls).toBe(1);
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('fails unsupported media and filters predictably before mutating the connected session', async () => {
  const { player, sessions } = fixture({ capabilities: { sources: ['url'], filters: false, crossfade: false } });
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  await expect(queue.node.play({ buffer: Buffer.from('encoded') })).rejects.toThrow(/does not support buffer sources/);
  await expect(queue.connect({ channelId: 'voice', filterGraph: 'volume=0.5' })).rejects.toThrow(
    /does not support audio filters/,
  );
  expect(sessions[0]?.playCalls).toBe(0);
  expect(sessions[0]?.filters.graph).toBeNull();
});

it('cancels source preparation during backend session replacement', async () => {
  const { player, sessions } = fixture();
  await player.initialize('bot-user');
  const entered = deferred<AbortSignal>();
  await player.plugins.register(
    definePlugin({
      id: 'source',
      setup(ctx) {
        ctx.on('track.stream', async (_input, { signal }) => {
          entered.resolve(signal);
          await new Promise<void>((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
          );
          return { url: 'https://example.test/audio' };
        });
      },
    })(),
  );
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const playback = queue.play(track());
  const signal = await entered.promise;
  await queue.node.createSession({ channelId: 'replacement' });
  await playback;
  expect(signal.aborted).toBe(true);
  expect(sessions[0]?.playCalls).toBe(0);
  expect(sessions[0]?.disposeCalls).toBe(1);
  expect(queue.node.session).toBe(sessions[1]);
});

it('initializes the built public package in a process that rejects native runtime imports', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { fileURLToPath } = await import('node:url');
  const script = fileURLToPath(new URL('./fixtures/custom-backend-smoke.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [script]);
});

it('does not allocate either backend after destruction overtakes plugin readiness', async () => {
  const { player, backend } = fixture();
  const initialization = expect(player.initialize('bot-user')).rejects.toThrow();
  await player.destroy();
  await initialization;
  expect(backend.initialize).not.toHaveBeenCalled();
  expect(RemediaClient.create).not.toHaveBeenCalled();
});

it('exposes the default Remedia client through getBackend and seals selection without a provider', async () => {
  const { createRemediaMock } = await import('./mocks/remedia.js');
  const mock = createRemediaMock();
  vi.mocked(RemediaClient.create).mockResolvedValue(mock.asClient());
  const player = new DiscordPlayer({ send() {} });
  players.push(player);
  await player.initialize('bot-user');
  expect(player.getBackend()).toBe(mock.asClient());
  expect(player.getRemedia()).toBe(mock.asClient());
  await expect(
    player.plugins.register(
      definePlugin({
        id: 'late-backend',
        setup(ctx) {
          ctx.provide('playback.backend', {} as PlaybackBackend);
        },
      })(),
    ),
  ).rejects.toThrow(/sealed/);
});

it('disposes late default initialization while retaining the default Remedia path', async () => {
  const { createRemediaMock } = await import('./mocks/remedia.js');
  const mock = createRemediaMock();
  const pending = deferred<RemediaClient>();
  const entered = deferred<void>();
  vi.mocked(RemediaClient.create).mockImplementation(async () => {
    entered.resolve();
    return pending.promise;
  });
  const player = new DiscordPlayer({ send() {} });
  players.push(player);
  const initialization = expect(player.initialize('bot-user')).rejects.toThrow();
  await entered.promise;
  await player.destroy();
  pending.resolve(mock.asClient());
  await initialization;
  expect(mock.client.close).toHaveBeenCalledOnce();
  expect(player.getRemedia(false)).toBeNull();
});

it('retains custom playback interception and real failure events without progressing a failed generation', async () => {
  const { player, sessions } = fixture();
  await player.initialize('bot-user');
  await source(player);
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  await player.plugins.register(
    definePlugin({
      id: 'policy',
      setup(ctx) {
        ctx.on('playback.beforeStart', () => ({ action: 'cancel', reason: 'blocked' }));
      },
    })(),
  );
  const current = track();
  await expect(queue.play(current)).rejects.toThrow(/blocked/);
  expect(sessions[0]?.playCalls).toBe(0);
  await player.plugins.unregister('policy');
  const failed = vi.fn();
  player.events.on('playerError', failed);
  await queue.play([current, track('next')]);
  const error = new Error('source failed');
  sessions[0]?.fail(error);
  await settle();
  expect(failed.mock.calls[0]).toEqual([queue, error, current, expect.objectContaining({ error, generation: 1 })]);
  expect(queue.currentTrack).toBeNull();
  expect(queue.tracks.at(0)).toBe(current);
  expect(sessions[0]?.playCalls).toBe(1);
});

it('rejects reinitialization after provider removal and a conflicting bot identity', async () => {
  const { player } = fixture();
  await player.initialize('bot-user');
  await expect(player.initialize('other-user')).rejects.toThrow(/different clientId/);
  await player.plugins.unregister('backend');
  await expect(player.initialize('bot-user')).rejects.toThrow(/disposed/);
});

it('continues provider cleanup when session disposal fails', async () => {
  const { player, backend, sessions } = fixture();
  await player.initialize('bot-user');
  const queue = await player.nodes.create('guild');
  await queue.connect({ channelId: 'voice' });
  const session = sessions[0]!;
  vi.spyOn(session, 'dispose').mockRejectedValueOnce(new Error('dispose failed'));
  players.splice(players.indexOf(player), 1);
  await expect(player.destroy()).rejects.toThrow(/dispose failed/);
  expect(backend.destroy).toHaveBeenCalledOnce();
  expect(queue.node.session).toBeNull();
  expect(session.listenerCount('playbackCompleted')).toBe(0);
});

it.each(['equalPower', 'adaptive'] as const)('accepts a custom backend snapshot with the %s curve', async (curve) => {
  const { player, sessions } = fixture({ capabilities: { sources: ['url'], crossfade: true, filters: false } });

  await player.initialize('bot-user');

  const queue = await player.nodes.create('guild', { crossfade: { enabled: true, curve } });

  await queue.connect({ channelId: 'voice' });

  expect(sessions[0]?.snapshot.crossfade?.curve).toBe(curve);
});
