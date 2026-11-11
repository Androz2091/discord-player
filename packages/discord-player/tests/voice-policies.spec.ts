import { afterEach, expect, it, vi } from 'vitest';
import { setup, TestTrack } from './mocks/queue.js';
import { deferred } from './mocks/async.js';

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
