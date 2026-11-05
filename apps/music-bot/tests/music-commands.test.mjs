import assert from 'node:assert/strict';
import { afterEach, vi, test } from 'vitest';
import { Track } from 'discord-player';
import { player } from '../dist/lib/discord-player.js';
import { chatInput as play } from '../dist/app/commands/play.js';

afterEach(() => {
  vi.restoreAllMocks();
  player.queues.cache.clear();
});

function interaction(commandName, values = {}) {
  const replies = [];
  const announcements = [];
  return {
    commandName,
    guildId: 'guild',
    inCachedGuild: () => true,
    member: { voice: { channel: { id: 'voice', joinable: true } } },
    channel: { isSendable: () => true, send: async (message) => announcements.push(message) },
    user: { id: 'requester', displayName: 'Listener', displayAvatarURL: () => 'https://example.test/avatar.png' },
    client: { ws: { ping: 25 } },
    options: {
      getString: (key) => values[key] ?? null,
      getNumber: (key) => values[key] ?? null,
      getInteger: (key) => values[key] ?? null,
      getBoolean: (key) => values[key] ?? null,
      getSubcommand: () => values.action ?? 'list',
    },
    deferReply: async (options) => {
      assert.equal(options.flags, 64);
    },
    reply: async (reply) => replies.push(reply),
    editReply: async (reply) => replies.push(reply),
    replies,
    announcements,
  };
}

function embed(reply) {
  assert.equal(reply.content, undefined, 'responses must use embeds');
  assert.equal(reply.embeds.length, 1);
  const data = reply.embeds[0].toJSON();
  assert.ok(data.title);
  assert.ok(data.description);
  assert.ok(data.color);
  assert.ok(data.timestamp);
  return data;
}

test('/play passes a real URL Track through player.play without requiring /join', async () => {
  const request = interaction('play', { url: 'https://example.test/audio.mp3' });
  const playMock = vi.spyOn(player, 'play').mockImplementation(async (channel, track, options) => {
    assert.equal(channel.id, 'voice');
    assert.ok(track instanceof Track);
    assert.deepEqual(await track.getStreamableSource(), { url: 'https://example.test/audio.mp3' });
    assert.equal(track.requestedBy, 'requester');
    assert.equal(options.nodeOptions.metadata.textChannel, request.channel);
    return { queue: { size: 1 }, track, playerResult: null };
  });
  await play({ interaction: request });
  assert.equal(playMock.mock.calls.length, 1);
  assert.match(embed(request.replies[0]).title, /Added to queue/);
});

test('/play rejects invalid sources and another voice channel with formatted errors', async () => {
  const playMock = vi.spyOn(player, 'play').mockImplementation(async () => assert.fail('play must not be called'));
  for (const url of ['not a URL', 'file:///private/audio.mp3']) {
    const request = interaction('play', { url });
    await play({ interaction: request });
    assert.equal(embed(request.replies[0]).color, 0xed4245);
  }
  player.queues.cache.set('guild', { node: { session: { channelId: 'another-voice' } } });
  const request = interaction('play', { url: 'https://example.test/audio.mp3' });
  await play({ interaction: request });
  assert.match(embed(request.replies[0]).description, /Join my voice channel/);
  assert.equal(playMock.mock.calls.length, 0);
});

test('controls use queue APIs and produce embeds, including /ping', async () => {
  const calls = [];
  const queue = {
    currentTrack: new Track({ title: 'Current' }),
    size: 1,
    tracks: { toArray: () => [new Track({ title: 'Upcoming' })] },
    node: {
      session: { channelId: 'voice' }, // Deliberately no raw session playback controls.
      isPaused: () => false,
      isPlaying: () => false,
      pause: async () => calls.push('pause'),
      resume: async () => calls.push('resume'),
      seek: async (position) => calls.push(['seek', position]),
      setVolume: async (value) => calls.push(['volume', value]),
      totalDuration: 60_000,
      playbackTime: 10_000,
      volume: 80,
      createProgressBar: () => '0:10 ┃ ▬🔘▬▬ ┃ 1:00',
      filters: {
        graph: null,
        set: async (graph) => calls.push(['filter', graph]),
        clear: async () => calls.push('filter-clear'),
      },
    },
    skip: async () => calls.push('skip'),
    stop: async () => calls.push('stop'),
    setRepeatMode: (mode) => calls.push(['loop', mode]),
    toggleShuffle: () => {
      queue.isShuffling = true;
    },
    isShuffling: false,
  };
  player.queues.cache.set('guild', queue);
  const cases = [
    ['pause', {}],
    ['resume', {}],
    ['skip', {}],
    ['stop', {}],
    ['queue', {}],
    ['loop', { mode: 'track' }],
    ['seek', { seconds: 30 }],
    ['volume', { percent: 80 }],
    ['filter', { preset: 'bassboost' }],
    ['shuffle', {}],
    ['nowplaying', {}],
    ['ping', {}],
  ];
  for (const [name, values] of cases) {
    const { chatInput } = await import(`../dist/app/commands/${name}.js`);
    const request = interaction(name, values);
    await chatInput({ interaction: request });
    const result = embed(request.replies[0]);
    assert.notEqual(result.color, 0xed4245, `${name} should succeed`);
    assert.match(result.footer.text, /Listener/);
  }
  assert.deepEqual(calls.slice(0, 4), ['pause', 'resume', 'skip', 'stop']);
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'seek' && call[1] === 30_000));
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'volume' && call[1] === 80));
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'loop' && call[1] === 1));
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'filter'));
});

test('validation failures and direct messages also receive embeds', async () => {
  const { chatInput } = await import('../dist/app/commands/pause.js');
  const noVoice = interaction('pause');
  noVoice.member.voice.channel = null;
  await chatInput({ interaction: noVoice });
  assert.match(embed(noVoice.replies[0]).description, /Join a voice channel/);
  const dm = interaction('pause');
  dm.inCachedGuild = () => false;
  await chatInput({ interaction: dm });
  assert.match(embed(dm.replies[0]).description, /server/);
});

test('queue creation/deletion announce outside the cache and connection repeats are deduplicated', async () => {
  const request = interaction('join');
  const queue = await player.queues.create('guild', { metadata: { textChannel: request.channel } });
  assert.match(embed(request.announcements[0]).title, /Queue created/);
  queue.node.session = { sessionId: 'session', channelId: 'voice' };
  player.events.emit('connection', queue);
  player.events.emit('connection', queue);
  assert.equal(request.announcements.length, 2);
  queue.node.session.channelId = 'moved';
  player.events.emit('connection', queue);
  assert.match(embed(request.announcements[2]).title, /Voice channel changed/);
  player.queues.cache.delete('guild');
  player.events.emit('queueDelete', queue);
  assert.match(embed(request.announcements[3]).title, /Queue deleted/);
});

test('playback announcements preserve Track arguments and report queue and player changes', async () => {
  const request = interaction('play');
  const queue = await player.queues.create('guild', { metadata: { textChannel: request.channel } });
  const track = new Track({ title: 'Song', requestedBy: 'requester' });
  const cases = [
    ['audioTrackAdd', [track]],
    ['audioTracksAdd', [[track]]],
    ['audioTrackRemove', [track]],
    ['audioTracksRemove', [[track]]],
    ['playerStart', [track, undefined]],
    ['playerFinish', [track, undefined]],
    ['playerSkip', [track, 'MANUAL', 'Skipped by user', undefined]],
    ['playerStop', [track, undefined]],
    ['playerPause', [{}]],
    ['playerResume', [{}]],
    ['playerSeek', [{ positionMs: 30_000 }]],
    ['volumeChange', [80, 60]],
    ['emptyQueue', []],
  ];
  for (const [event, args] of cases) player.events.emit(event, queue, ...args);
  assert.equal(request.announcements.length, cases.length + 1);
  for (const message of request.announcements) embed(message);
  assert.match(embed(request.announcements[5]).description, /Song/);
});

test('voice recovery announces once per transition and playback failures use safe public details', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const request = interaction('play');
  const queue = await player.queues.create('guild', { metadata: { textChannel: request.channel } });
  player.events.emit('voiceStateUpdate', queue, { state: 'reconnecting' });
  player.events.emit('voiceStateUpdate', queue, { state: 'reconnecting' });
  player.events.emit('voiceStateUpdate', queue, { state: 'connected' });
  player.events.emit('voiceStateUpdate', queue, { state: 'connected' });
  assert.equal(request.announcements.length, 3);
  assert.match(embed(request.announcements[1]).title, /Reconnecting/);
  assert.match(embed(request.announcements[2]).title, /Voice restored/);
  player.events.emit(
    'playerError',
    queue,
    new Error('private engine credentials'),
    new Track({ title: 'Song' }),
    undefined,
  );
  const failure = embed(request.announcements[3]);
  assert.equal(failure.color, 0xed4245);
  assert.match(failure.description, /Song/);
  assert.doesNotMatch(failure.description, /private engine credentials/);
});
