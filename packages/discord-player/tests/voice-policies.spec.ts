import { afterEach, expect, it, vi } from 'vitest';
import type { DiscordSessionEvents } from '@remedia/client';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred } from './mocks/async.js';
import { definePlugin, QueueRepeatMode } from '../src/index.js';

const players: Awaited<ReturnType<typeof setup>>['player'][] = [];
async function fixture(options: Parameters<typeof setup>[0] = {}) {
  const value = await setup(options);
  players.push(value.player);
  return value;
}
async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}
function state(userId: string, channelId: string | null, extra = {}) {
  return { t: 'VOICE_STATE_UPDATE', d: { guild_id: 'guild-one', user_id: userId, channel_id: channelId, ...extra } };
}
afterEach(async () => {
  await Promise.all(players.splice(0).map((player) => player.destroy()));
  vi.useRealTimers();
});

it('forwards raw Gateway packets and emits normalized previous/current states without disabling defaults', async () => {
  const { player, queue, backend } = await fixture();
  const listener = vi.fn();
  player.events.on('voiceStateUpdate', listener);
  const first = state('member', 'voice-one');
  const second = state('member', null);
  player.receive(first);
  player.receive(second);
  expect(backend.client.receive).toHaveBeenCalledWith(first);
  expect(listener.mock.calls[0]).toEqual([
    queue,
    null,
    { guildId: queue.id, userId: 'member', channelId: 'voice-one' },
    first,
  ]);
  expect(listener.mock.calls[1]).toEqual([
    queue,
    listener.mock.calls[0]![2],
    { guildId: queue.id, userId: 'member', channelId: null },
    second,
  ]);
  expect(queue.destroyed).toBe(false);
});

it('handles bot mute/suppression, moves and disconnects without a membership resolver', async () => {
  const { player, queue, session } = await fixture();
  await queue.play(new TestTrack('one'));
  player.receive(state('bot-user', 'voice-one', { mute: true, suppress: false }));
  await flush();
  expect(session.state).toBe('paused');
  player.receive(state('bot-user', 'voice-one', { mute: false, suppress: true }));
  await flush();
  expect(session.state).toBe('paused');
  player.receive(state('bot-user', 'voice-one', { mute: false, suppress: false }));
  await flush();
  expect(session.state).toBe('playing');
  player.receive(state('bot-user', 'voice-two'));
  await flush();
  expect(session.channelId).toBe('voice-two');
  const disconnect = vi.fn();
  player.events.on('disconnect', disconnect);
  player.receive(state('bot-user', null));
  await flush();
  expect(queue.destroyed).toBe(true);
  expect(disconnect).toHaveBeenCalledExactlyOnceWith(queue, state('bot-user', null));
});

it('uses authoritative empty/populate snapshots, owns automatic pause and respects a manual pause', async () => {
  let users: readonly string[] | null = ['member'];
  const resolveVoiceChannelUsers = vi.fn(async () => users);
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers },
    queueOptions: { pauseOnEmpty: true },
  });
  const empty = vi.fn();
  const populate = vi.fn();
  player.events.on('emptyChannel', empty);
  player.events.on('channelPopulate', populate);
  await queue.play(new TestTrack('one'));
  await flush();
  users = [];
  player.receive(state('member', null));
  // Unknown Gateway history does not establish occupancy; trigger a relevant update.
  player.receive(state('other', 'voice-one'));
  await flush();
  expect(session.state).toBe('paused');
  expect(empty).toHaveBeenCalledOnce();
  users = ['member', 'member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(populate).toHaveBeenCalledOnce();
  expect(session.state).toBe('playing');
  await queue.node.pause();
  users = [];
  player.receive(state('member', null));
  await flush();
  users = ['member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(session.state).toBe('paused');
});

it.each([null, undefined] as const)('does not infer emptiness when occupancy is %s', async (snapshot) => {
  vi.useFakeTimers();
  const { player, queue, session } = await fixture({
    playerOptions: snapshot === undefined ? {} : { resolveVoiceChannelUsers: async () => snapshot },
    queueOptions: { leaveOnEmpty: true, leaveOnEmptyCooldown: 10, pauseOnEmpty: true },
  });
  await queue.play(new TestTrack('one'));
  player.receive(state('member', 'voice-one'));
  player.receive(state('member', null));
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
  expect(session.state).toBe('playing');
});

it('coalesces snapshots and discards results from obsolete channels and destroyed queues', async () => {
  const first = deferred<readonly string[] | null>();
  const resolver = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(['member']);
  const { player, queue } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: resolver },
    queueOptions: { leaveOnEmpty: true },
  });
  await flush();
  await queue.connect({ channelId: 'voice-two' });
  player.receive(state('member', 'voice-two'));
  first.resolve([]);
  await flush();
  expect(resolver.mock.calls.at(-1)).toEqual([queue.id, 'voice-two']);
  expect(queue.destroyed).toBe(false);
  const pending = deferred<readonly string[] | null>();
  resolver.mockReturnValueOnce(pending.promise);
  player.receive(state('member', null));
  await flush();
  await queue.destroy();
  pending.resolve([]);
  await flush();
  expect(queue.destroyed).toBe(true);
});

it('reports resolver failures while keeping occupancy unknown', async () => {
  const error = new Error('snapshot unavailable');
  const resolver = vi.fn(async () => ['member'] as readonly string[]);
  const { player, queue } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: resolver },
    queueOptions: { leaveOnEmpty: true },
  });
  await flush();
  const failure = vi.fn();
  player.events.on('error', failure);
  resolver.mockRejectedValueOnce(error);
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(failure).toHaveBeenCalledExactlyOnceWith(queue, error);
  expect(queue.destroyed).toBe(false);
});

it('rechecks empty cooldown occupancy and cancels after repopulation', async () => {
  vi.useFakeTimers();
  let users: readonly string[] = [];
  const { player, queue } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { leaveOnEmpty: true, leaveOnEmptyCooldown: 100 },
  });
  await flush();
  users = ['member'];
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
  users = [];
  player.receive(state('member', 'voice-one'));
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(true);
});

it.each(['end', 'stop'] as const)(
  'implements leaveOn%s without a resolver and cancels obsolete cooldowns',
  async (reason) => {
    vi.useFakeTimers();
    const { queue, session } = await fixture({
      queueOptions: { leaveOnEnd: true, leaveOnEndCooldown: 100, leaveOnStop: true, leaveOnStopCooldown: 100 },
    });
    await queue.play(new TestTrack('one'));
    if (reason === 'end') session.complete();
    else await queue.stop();
    await flush();
    await vi.advanceTimersByTimeAsync(50);
    await queue.play(new TestTrack('two'));
    await vi.advanceTimersByTimeAsync(100);
    expect(queue.destroyed).toBe(false);
    if (reason === 'end') session.complete();
    else await queue.stop();
    await flush();
    await vi.advanceTimersByTimeAsync(100);
    expect(queue.destroyed).toBe(true);
  },
);

it('does not apply natural-end leave after skip, and rejects invalid cooldowns', async () => {
  vi.useFakeTimers();
  const { player, queue } = await fixture({ queueOptions: { leaveOnEnd: true, leaveOnEndCooldown: 10 } });
  await queue.play(new TestTrack('one'));
  await queue.skip();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
  await expect(player.createQueue('invalid', { leaveOnEmptyCooldown: -1 })).rejects.toThrow(RangeError);
});

it('invalidates a pending occupancy request on session replacement and reconciles reconnect', async () => {
  const pending = deferred<readonly string[] | null>();
  const resolver = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(['member']);
  const { player, queue } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: resolver },
    queueOptions: { leaveOnEmpty: true },
  });
  await flush();
  const empty = vi.fn();
  player.events.on('emptyChannel', empty);
  await queue.node.createSession({ channelId: 'voice-two' });
  pending.resolve([]);
  await flush();
  expect(empty).not.toHaveBeenCalled();
  await queue.connect({ channelId: 'voice-two' });
  await flush();
  expect(resolver.mock.calls.at(-1)).toEqual([queue.id, 'voice-two']);
  expect(queue.destroyed).toBe(false);
});

it('shares cooldown revalidation with Gateway reconciliation without overlapping resolver calls', async () => {
  vi.useFakeTimers();
  const expiry = deferred<readonly string[] | null>();
  const resolver = vi.fn().mockResolvedValueOnce([]).mockReturnValueOnce(expiry.promise).mockResolvedValue(['member']);
  const { player, queue } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: resolver },
    queueOptions: { leaveOnEmpty: true, leaveOnEmptyCooldown: 100 },
  });
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(resolver).toHaveBeenCalledTimes(2);
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(resolver).toHaveBeenCalledTimes(2);
  expiry.resolve([]);
  await flush();
  expect(resolver).toHaveBeenCalledTimes(3);
  expect(queue.destroyed).toBe(false);
});

it.each(['embedded', 'remote'] as const)(
  'gives leave precedence and keeps the original deadline on %s',
  async (nodeType) => {
    vi.useFakeTimers();
    const { player, queue, session } = await fixture({
      nodeType,
      playerOptions: { resolveVoiceChannelUsers: async () => [] },
      queueOptions: { leaveOnEmpty: true, pauseOnEmpty: true, leaveOnEmptyCooldown: 100 },
    });
    const pause = vi.spyOn(session, 'pause');
    await queue.play(new TestTrack('one'));
    await flush();
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(20);
      player.receive(state('member', null));
      await flush();
    }
    expect(pause).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(queue.destroyed).toBe(true);
    expect(session.disposeCalls).toBe(1);
  },
);

it('cancels empty departure when a member returns during cooldown', async () => {
  vi.useFakeTimers();
  let users: readonly string[] = [];
  const { player, queue } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { leaveOnEmpty: true, leaveOnEmptyCooldown: 100 },
  });
  await flush();
  await vi.advanceTimersByTimeAsync(50);
  users = ['member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
});

it.each(['resolve', 'reject'] as const)(
  'does not block session disposal behind a slow policy pause (%s)',
  async (outcome) => {
    let users: readonly string[] = ['member'];
    const { player, queue, session } = await fixture({
      nodeType: 'remote',
      playerOptions: { resolveVoiceChannelUsers: async () => users },
      queueOptions: { pauseOnEmpty: true },
    });
    await queue.play(new TestTrack('one'));
    await flush();
    const pending = deferred<void>();
    const pause = vi.spyOn(session, 'pause').mockReturnValue(pending.promise);
    const error = vi.fn();
    player.events.on('error', error);
    users = [];
    player.receive(state('member', null));
    await flush();
    player.receive(state('member', null));
    await flush();
    expect(pause).toHaveBeenCalledOnce();
    await queue.node.destroySession();
    expect(session.disposeCalls).toBe(1);
    await queue.connect({ channelId: 'voice-two' });
    users = ['member'];
    if (outcome === 'reject') pending.reject(new Error('request_timeout'));
    else pending.resolve();
    await flush();
    expect(queue.node.session?.channelId).toBe('voice-two');
    expect(queue.destroyed).toBe(false);
    expect(error).toHaveBeenCalledTimes(outcome === 'reject' ? 1 : 0);
  },
);

it('resumes after a confirmed slow pause when occupancy changed during the RPC', async () => {
  let users: readonly string[] = ['member'];
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { pauseOnEmpty: true },
  });
  await queue.play(new TestTrack('one'));
  await flush();
  const pending = deferred<void>();
  const pause = vi.spyOn(session, 'pause').mockImplementation(async () => {
    await pending.promise;
    session.state = 'paused';
  });
  const resume = vi.spyOn(session, 'resume');
  users = [];
  player.receive(state('member', null));
  await flush();
  users = ['member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(resume).not.toHaveBeenCalled();
  pending.resolve();
  await flush();
  expect(pause).toHaveBeenCalledOnce();
  expect(resume).toHaveBeenCalledOnce();
  expect(session.state).toBe('playing');
});

it('does not acquire ownership after a rejected pause or lose ownership after a rejected resume', async () => {
  let users: readonly string[] = ['member'];
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { pauseOnEmpty: true },
  });
  await queue.play(new TestTrack('one'));
  await flush();
  const pause = vi.spyOn(session, 'pause').mockRejectedValueOnce(new Error('request_timeout'));
  const resume = vi.spyOn(session, 'resume');
  const errors = vi.fn();
  player.events.on('error', errors);
  users = [];
  player.receive(state('member', null));
  await flush();
  expect(pause).toHaveBeenCalledOnce();
  session.state = 'paused';
  users = ['member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(resume).not.toHaveBeenCalled();
  session.state = 'playing';
  users = [];
  player.receive(state('member', null));
  await flush();
  resume.mockRejectedValueOnce(new Error('request_timeout'));
  users = ['member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(session.state).toBe('paused');
  player.receive(state('member', 'voice-one'));
  await flush();
  expect(session.state).toBe('playing');
  expect(errors).toHaveBeenCalledTimes(2);
});

it('waits for transport readiness while preserving mute policy with leave precedence', async () => {
  const { player, queue, session } = await fixture({ queueOptions: { leaveOnEmpty: true, pauseOnEmpty: true } });
  await queue.play(new TestTrack('one'));
  const pause = vi.spyOn(session, 'pause');
  session.connectionState = 'negotiating_dave';
  player.receive(state('bot-user', 'voice-one', { mute: true }));
  await flush();
  expect(pause).not.toHaveBeenCalled();
  expect(queue.destroyed).toBe(false);
  session.connectionState = 'connected';
  const ready: DiscordSessionEvents['voiceStateChanged'][0] = {
    sessionId: session.sessionId,
    guildId: queue.id,
    nodeId: session.nodeId,
    previousState: 'negotiating_dave',
    state: 'connected',
  };
  session.emit('voiceStateChanged', ready);
  await flush();
  expect(pause).toHaveBeenCalledOnce();
});

it('keeps natural-end and empty deadlines independent', async () => {
  vi.useFakeTimers();
  let users: readonly string[] = [];
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { leaveOnEmpty: true, leaveOnEmptyCooldown: 500, leaveOnEnd: true, leaveOnEndCooldown: 100 },
  });
  await queue.play(new TestTrack('one'));
  session.complete();
  await flush();
  await vi.advanceTimersByTimeAsync(50);
  users = ['member'];
  player.receive(state('member', 'voice-one'));
  await flush();
  await vi.advanceTimersByTimeAsync(50);
  expect(queue.destroyed).toBe(true);
  expect(session.disposeCalls).toBe(1);
});

it('does not leave between queued tracks or after stop/failure, and cancels end on insertion', async () => {
  vi.useFakeTimers();
  const { queue, session } = await fixture({ queueOptions: { leaveOnEnd: true, leaveOnEndCooldown: 100 } });
  await queue.play(new TestTrack('one'));
  queue.addTrack(new TestTrack('two'));
  session.complete();
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.currentTrack?.title).toBe('two');
  expect(queue.destroyed).toBe(false);
  session.complete();
  await flush();
  queue.addTrack(new TestTrack('three'));
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
  await queue.playNext();
  await queue.stop();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
  await queue.play(new TestTrack('four'));
  session.fail();
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.destroyed).toBe(false);
});

it('keeps concurrent guild timers and pending controls independent', async () => {
  vi.useFakeTimers();
  const { player, queue, session, backend } = await fixture({
    nodeType: 'remote',
    playerOptions: { resolveVoiceChannelUsers: async () => [] },
    queueOptions: { pauseOnEmpty: true },
  });
  const pending = deferred<void>();
  vi.spyOn(session, 'pause').mockReturnValue(pending.promise);
  await queue.play(new TestTrack('one'));
  await flush();
  const others = await Promise.all(
    Array.from({ length: 4 }, async (_, index) => {
      const other = await player.nodes.create(`guild-${index}`, { leaveOnEmpty: true, leaveOnEmptyCooldown: 100 });
      const otherSession = backend.asSession(await other.connect({ channelId: 'voice-one' }));
      await other.play(new TestTrack(`track-${index}`));
      return { other, otherSession };
    }),
  );
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  for (const { other, otherSession } of others) {
    expect(other.destroyed).toBe(true);
    expect(otherSession.disposeCalls).toBe(1);
  }
  expect(queue.destroyed).toBe(false);
  await queue.destroy();
  pending.reject(new Error('cancelled'));
  await flush();
  expect(session.disposeCalls).toBe(1);
});

it('does not transfer pending pause ownership across a move, new generation, or manual control', async () => {
  let users: readonly string[] = ['member'];
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { pauseOnEmpty: true },
  });
  await queue.play(new TestTrack('one'));
  await flush();
  const pending = deferred<void>();
  vi.spyOn(session, 'pause').mockReturnValueOnce(pending.promise);
  const resume = vi.spyOn(session, 'resume');
  users = [];
  player.receive(state('member', null));
  await flush();
  users = ['member'];
  await queue.connect({ channelId: 'voice-two' });
  await queue.play(new TestTrack('two'));
  await queue.node.pause();
  pending.resolve();
  await flush();
  player.receive(state('member', 'voice-two'));
  await flush();
  expect(resume).not.toHaveBeenCalled();
  expect(session.state).toBe('paused');
});

it.each([QueueRepeatMode.TRACK, QueueRepeatMode.QUEUE])(
  'keeps repeat mode %s connected after completion',
  async (repeatMode) => {
    vi.useFakeTimers();
    const { queue, session } = await fixture({
      queueOptions: { repeatMode, leaveOnEnd: true, leaveOnEndCooldown: 100 },
    });
    await queue.play(new TestTrack('one'));
    session.complete();
    await flush();
    await vi.advanceTimersByTimeAsync(100);
    expect(queue.destroyed).toBe(false);
    expect(session.playCalls).toBe(2);
  },
);

it('waits for pending autoplay before scheduling natural-end departure', async () => {
  vi.useFakeTimers();
  const { player, queue, session } = await fixture({
    queueOptions: { repeatMode: QueueRepeatMode.AUTOPLAY, leaveOnEnd: true, leaveOnEndCooldown: 100 },
  });
  const related = deferred<{ tracks: TestTrack[]; playlist: null }>();
  await player.plugins.unregister('fixture');
  await player.plugins.register(
    definePlugin({
      id: 'fixture',
      setup(ctx) {
        ctx.on('track.stream', ({ track }) => ({ url: track.url }));
        ctx.on('track.related', () => related.promise);
      },
    })(),
  );
  await queue.play(new TestTrack('one'));
  session.complete();
  await flush();
  await vi.advanceTimersByTimeAsync(200);
  expect(queue.destroyed).toBe(false);
  related.resolve({ tracks: [], playlist: null });
  await flush();
  await vi.advanceTimersByTimeAsync(99);
  expect(queue.destroyed).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(queue.destroyed).toBe(true);
});

it('invalidates pending pause on a Gateway move and cancels the previous channel deadline', async () => {
  vi.useFakeTimers();
  let users: readonly string[] = ['member'];
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => users },
    queueOptions: { pauseOnEmpty: true },
  });
  await queue.play(new TestTrack('one'));
  await flush();
  const pending = deferred<void>();
  vi.spyOn(session, 'pause').mockReturnValueOnce(pending.promise);
  const resume = vi.spyOn(session, 'resume');
  users = [];
  player.receive(state('member', null));
  await flush();
  queue.options.leaveOnEmpty = true;
  queue.options.leaveOnEmptyCooldown = 100;
  player.receive(state('member', null));
  await flush();
  await vi.advanceTimersByTimeAsync(50);
  users = ['member'];
  player.receive(state('bot-user', 'voice-two'));
  await flush();
  session.state = 'paused';
  pending.resolve();
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(session.channelId).toBe('voice-two');
  expect(queue.destroyed).toBe(false);
  expect(resume).not.toHaveBeenCalled();
});

it('does not extend a leave-only deadline on repeated Gateway, start, or resume events', async () => {
  vi.useFakeTimers();
  const { player, queue, session } = await fixture({
    playerOptions: { resolveVoiceChannelUsers: async () => [] },
    queueOptions: { leaveOnEmpty: true, leaveOnEmptyCooldown: 100 },
  });
  await queue.play(new TestTrack('one'));
  await flush();
  await vi.advanceTimersByTimeAsync(40);
  player.receive(state('member', null));
  queue.addTrack(new TestTrack('two'));
  session.complete();
  await flush();
  await vi.advanceTimersByTimeAsync(40);
  const resumed: DiscordSessionEvents['playbackResumed'][0] = {
    sessionId: session.sessionId,
    guildId: queue.id,
    nodeId: session.nodeId,
    generation: session.generation,
    previousState: 'paused',
    state: 'playing',
  };
  session.emit('playbackResumed', resumed);
  await flush();
  await vi.advanceTimersByTimeAsync(20);
  expect(queue.destroyed).toBe(true);
  expect(session.disposeCalls).toBe(1);
});
