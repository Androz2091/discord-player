import { interaction, embed, runChatInput, queueFixture, sessionFixture, type OptionValues } from './mocks/discord.ts';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, afterEach, beforeEach, vi, test } from 'vitest';
import { Track, SearchResult, TrackSkipReason, type AudioFilterName, type AudioFilterPresetName } from 'discord-player';
import { player } from '../src/lib/discord-player.ts';
import { chatInput as play } from '../src/app/commands/play.ts';

beforeEach(() => {
  vi.stubEnv('MUSIC_DIRECTORY', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  player.nodes.cache.clear();
});

test('/play resolves a normal Track through the raw HTTP extractor without requiring /join', async () => {
  const request = interaction('play', { query: 'https://example.test/audio.mp3' });
  const playMock = vi.spyOn(player, 'play').mockImplementation(async (channel, result, options) => {
    expect(channel).toMatchObject({ id: 'voice' });
    expect(result).toBeInstanceOf(SearchResult);

    if (!(result instanceof SearchResult)) throw new Error('Expected a resolved SearchResult');

    const track = result.tracks[0]!;

    expect(track.constructor).toBe(Track);
    expect(track.sourceReference?.pluginId).toBe('org.example.raw-http');
    expect(await player.plugins.resolveStream(track)).toEqual({ url: 'https://example.test/audio.mp3' });
    expect(track.requestedBy).toBe('requester');
    expect(options?.nodeOptions?.metadata).toEqual({ textChannel: request.channel });

    return { queue: queueFixture({ size: 1 }), resource: result, searchResult: result, track, playerResult: null };
  });

  await runChatInput(play, request);

  expect(playMock).toHaveBeenCalledTimes(1);
  expect(embed(request.replies[0]).title).toMatch(/Added to queue/);
});

test('/play rejects invalid sources and another voice channel with formatted errors', async () => {
  const playMock = vi
    .spyOn(player, 'play')
    .mockImplementation(async () => expect.unreachable('play must not be called'));

  for (const url of ['not a URL', 'file:///private/audio.mp3']) {
    const request = interaction('play', { query: url });

    await runChatInput(play, request);

    expect(embed(request.replies[0]).color).toBe(0xed4245);
  }

  player.nodes.cache.set('guild', queueFixture({ node: { session: { channelId: 'another-voice' } } }));

  const request = interaction('play', { query: 'https://example.test/audio.mp3' });

  await runChatInput(play, request);

  expect(embed(request.replies[0]).description).toMatch(/Join my voice channel/);
  expect(playMock).toHaveBeenCalledTimes(0);
});

test('controls use queue APIs and produce embeds, including /ping', async () => {
  const calls: Array<string | [string, number | string]> = [];
  const record = (call: string | [string, number | string]): void => {
    calls.push(call);
  };
  const queue = {
    currentTrack: new Track({ title: 'Current' }),
    size: 1,
    tracks: { toArray: () => [new Track({ title: 'Upcoming' })] },
    node: {
      session: { channelId: 'voice' }, // Deliberately no raw session playback controls.

      isPaused: () => false,

      isPlaying: () => false,

      pause: async () => record('pause'),

      resume: async () => record('resume'),

      seek: async (position: number) => record(['seek', position]),

      setVolume: async (value: number) => {
        record(['volume', value]);

        return value;
      },

      totalDuration: 60_000,
      playbackTime: 10_000,
      volume: 80,

      createProgressBar: () => '0:10 ┃ ▬🔘▬▬ ┃ 1:00',

      filters: {
        graph: null,
        enabled: [],

        toggle: async (name: AudioFilterName) => {
          calls.push(['filter', name]);

          return true;
        },

        clear: async () => record('filter-clear'),
      },
    },

    skip: async () => {
      record('skip');

      return null;
    },

    stop: async () => record('stop'),

    setRepeatMode: (mode: number) => record(['loop', mode]),

    toggleShuffle: () => {
      queue.isShuffling = true;

      return queue.isShuffling;
    },

    isShuffling: false,
  };

  player.nodes.cache.set('guild', queueFixture(queue));

  const cases: Array<[string, OptionValues]> = [
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
    const { chatInput } = await import(`../src/app/commands/${name}.ts`);
    const request = interaction(name, values);

    await runChatInput(chatInput, request);

    const result = embed(request.replies[0]);

    expect(result.color, `${name} should succeed`).not.toBe(0xed4245);
    expect(result.footer?.text).toMatch(/Listener/);
  }

  expect(calls.slice(0, 4)).toEqual(['pause', 'resume', 'skip', 'stop']);
  expect(calls.some((call) => Array.isArray(call) && call[0] === 'seek' && call[1] === 30_000)).toBeTruthy();
  expect(calls.some((call) => Array.isArray(call) && call[0] === 'volume' && call[1] === 80)).toBeTruthy();
  expect(calls.some((call) => Array.isArray(call) && call[0] === 'loop' && call[1] === 1)).toBeTruthy();
  expect(calls.some((call) => Array.isArray(call) && call[0] === 'filter')).toBeTruthy();
});

test('validation failures and direct messages also receive embeds', async () => {
  const { chatInput } = await import('../src/app/commands/pause.ts');
  const noVoice = interaction('pause');

  noVoice.member.voice.channel = null;
  await runChatInput(chatInput, noVoice);

  expect(embed(noVoice.replies[0]).description).toMatch(/Join a voice channel/);

  const dm = interaction('pause');

  dm.inCachedGuild = () => false;
  await runChatInput(chatInput, dm);

  expect(embed(dm.replies[0]).description).toMatch(/server/);
});

test('queue creation/deletion announce outside the cache and connection repeats are deduplicated', async () => {
  const request = interaction('join');
  const queue = await player.nodes.create('guild', { metadata: { textChannel: request.channel } });

  expect(embed(request.announcements[0]).title).toMatch(/Queue created/);

  const session = { sessionId: '00000000-0000-0000-0000-000000000001' as const, channelId: 'voice' };

  vi.spyOn(queue.node, 'session', 'get').mockReturnValue(sessionFixture(session));
  player.events.emit('connection', queue);
  player.events.emit('connection', queue);

  expect(request.announcements.length).toBe(2);

  session.channelId = 'moved';
  player.events.emit('connection', queue);

  expect(embed(request.announcements[2]).title).toMatch(/Voice channel changed/);

  player.nodes.cache.delete('guild');
  player.events.emit('queueDelete', queue);

  expect(embed(request.announcements[3]).title).toMatch(/Queue deleted/);
});

test('playback announcements preserve Track arguments and report queue and player changes', async () => {
  const request = interaction('play');
  const queue = await player.nodes.create('guild', { metadata: { textChannel: request.channel } });
  const track = new Track({ title: 'Song', requestedBy: 'requester' });
  const identity = {
    sessionId: '00000000-0000-0000-0000-000000000001' as const,
    guildId: 'guild',
    nodeId: 'node',
    generation: 1,
    customMetadata: undefined,
  };
  const cases = [
    () => player.events.emit('audioTrackAdd', queue, track),
    () => player.events.emit('audioTracksAdd', queue, [track]),
    () => player.events.emit('audioTrackRemove', queue, track),
    () => player.events.emit('audioTracksRemove', queue, [track]),
    () => player.events.emit('playerStart', queue, track, undefined),
    () => player.events.emit('playerFinish', queue, track, undefined),
    () => player.events.emit('playerSkip', queue, track, TrackSkipReason.Manual, 'Skipped by user', undefined),
    () => player.events.emit('playerStop', queue, track, undefined),
    () => player.events.emit('playerPause', queue, { ...identity, previousState: 'playing', state: 'paused' }),
    () => player.events.emit('playerResume', queue, { ...identity, previousState: 'paused', state: 'playing' }),
    () => player.events.emit('playerSeek', queue, { ...identity, previousPositionMs: 0, positionMs: 30_000 }),
    () => player.events.emit('volumeChange', queue, 80, 60),
    () => player.events.emit('emptyQueue', queue),
  ];

  for (const emit of cases) emit();

  expect(request.announcements.length).toBe(cases.length + 1);

  for (const message of request.announcements) embed(message);

  expect(embed(request.announcements[5]).description).toMatch(/Song/);
});

test('voice recovery announces once per transition and playback failures use safe public details', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  const request = interaction('play');
  const queue = await player.nodes.create('guild', { metadata: { textChannel: request.channel } });

  player.events.emit('voiceConnectionStateChange', queue, 'connected', 'reconnecting', {
    sessionId: 'session',
    guildId: 'guild',
    nodeId: 'node',
    previousState: 'connected',
    state: 'reconnecting',
  });

  player.events.emit('voiceConnectionStateChange', queue, 'connected', 'reconnecting', {
    sessionId: 'session',
    guildId: 'guild',
    nodeId: 'node',
    previousState: 'connected',
    state: 'reconnecting',
  });

  player.events.emit('voiceConnectionStateChange', queue, 'reconnecting', 'connected', {
    sessionId: 'session',
    guildId: 'guild',
    nodeId: 'node',
    previousState: 'reconnecting',
    state: 'connected',
  });

  player.events.emit('voiceConnectionStateChange', queue, 'reconnecting', 'connected', {
    sessionId: 'session',
    guildId: 'guild',
    nodeId: 'node',
    previousState: 'reconnecting',
    state: 'connected',
  });

  expect(request.announcements.length).toBe(3);
  expect(embed(request.announcements[1]).title).toMatch(/Reconnecting/);
  expect(embed(request.announcements[2]).title).toMatch(/Voice restored/);

  player.events.emit(
    'playerError',
    queue,
    new Error('private engine credentials'),
    new Track({ title: 'Song' }),
    undefined,
  );

  const failure = embed(request.announcements[3]);

  expect(failure.color).toBe(0xed4245);
  expect(failure.description).toMatch(/Song/);
  expect(failure.description).not.toMatch(/private engine credentials/);
});

test('/filter toggles named presets, shows combinations, and clears all filters', async () => {
  const { chatInput } = await import('../src/app/commands/filter.ts');
  const enabled = new Set<AudioFilterPresetName>();
  const filters = {
    get enabled() {
      return [...enabled];
    },

    get graph() {
      return enabled.size ? 'managed-graph' : null;
    },

    toggle: vi.fn(async (name: AudioFilterName) => {
      const canonical = name === '8d' ? '8D' : name;

      if (enabled.has(canonical)) {
        enabled.delete(canonical);

        return false;
      }

      enabled.add(canonical);

      return true;
    }),
    clear: vi.fn(async () => {
      enabled.clear();
    }),
  };

  player.nodes.cache.set('guild', queueFixture({ node: { session: { channelId: 'voice' }, filters } }));

  const invoke = async (preset?: string) => {
    const request = interaction('filter', preset === undefined ? {} : { preset });

    await runChatInput(chatInput, request);

    return embed(request.replies[0]).description;
  };

  expect(await invoke()).toMatch(/Off/);
  expect(await invoke('nightcore')).toMatch(/enabled.*Nightcore/);
  expect(await invoke('8d')).toMatch(/enabled.*8D/);
  expect(await invoke()).toMatch(/Nightcore, 8D/);
  expect(await invoke('nightcore')).toMatch(/disabled.*Nightcore/);
  expect([...enabled]).toEqual(['8D']);
  expect(await invoke('off')).toMatch(/cleared/);
  expect([...enabled]).toEqual([]);
  expect(filters.clear).toHaveBeenCalledTimes(1);
  expect(await invoke('unknown')).toMatch(/listed filter presets/);
  expect(filters.toggle).toHaveBeenCalledTimes(3);
});

test('/filter keeps acompressor synchronized with bass boost', async () => {
  const { chatInput } = await import('../src/app/commands/filter.ts');
  const enabled = new Set<AudioFilterPresetName>();
  const filters = {
    get enabled() {
      return [...enabled];
    },

    graph: null,
    toggle: vi.fn(async (name: AudioFilterName, state?: boolean) => {
      const canonical = name === '8d' ? '8D' : name;
      const next = state ?? !enabled.has(canonical);

      if (next) enabled.add(canonical);
      else enabled.delete(canonical);

      return next;
    }),
    clear: vi.fn(async () => enabled.clear()),
  };

  player.nodes.cache.set('guild', queueFixture({ node: { session: { channelId: 'voice' }, filters } }));

  const request = interaction('filter', { preset: 'bassboost' });

  await runChatInput(chatInput, request);

  expect([...enabled]).toEqual(['bassboost', 'normalizer']);
  expect(filters.toggle).toHaveBeenNthCalledWith(2, 'normalizer', true);
});

test('raw HTTP extraction normalizes URLs, preserves requesters, and rejects unsupported queries', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => expect.unreachable('raw HTTP extraction must not fetch media'));

  for (const [query, url, title] of [
    [' https://example.test/audio.mp3 ', 'https://example.test/audio.mp3', 'audio.mp3'],
    ['http://example.test/', 'http://example.test/', 'example.test'],
  ] as const) {
    const result = await player.search(query, { requestedBy: 'listener' });

    expect(result).toBeInstanceOf(SearchResult);

    if (!(result instanceof SearchResult)) throw new Error('Expected a resolved SearchResult');

    const track = result.tracks[0]!;

    expect(track.constructor).toBe(Track);
    expect(track.url).toBe(url);
    expect(track.title).toBe(title);
    expect(track.requestedBy).toBe('listener');
    expect(track.serialize().data.sourceReference?.pluginId).toBe('org.example.raw-http');
    expect(await player.plugins.resolveStream(track)).toEqual({ url });
  }

  for (const query of ['text query', 'https://', 'file:///tmp/audio.mp3', 'ftp://example.test/audio.mp3']) {
    expect((await player.search(query)).isEmpty()).toBe(true);
  }

  const direct = await player.plugins.execute(
    'search.query.resolve',
    { query: 'invalid' },
    { pluginId: 'org.example.raw-http' },
  );

  expect(direct?.tracks).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(0);
});

test('/play queues local file search results through the source plugin', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'music-command-'));

  try {
    await writeFile(join(directory, 'song-one.mp3'), 'audio');
    await writeFile(join(directory, 'song-two.flac'), 'audio');
    vi.stubEnv('MUSIC_DIRECTORY', directory);

    const request = interaction('play', { query: 'song' });
    const playMock = vi.spyOn(player, 'play').mockImplementation(async (channel, result, options) => {
      expect(channel).toMatchObject({ id: 'voice' });

      if (!(result instanceof SearchResult)) throw new Error('Expected a resolved SearchResult');

      expect(result.tracks.map((track) => track.title)).toEqual(['song-one.mp3', 'song-two.flac']);
      expect(options?.nodeOptions?.metadata).toEqual({ textChannel: request.channel });

      for (const track of result.tracks) {
        expect(track.constructor).toBe(Track);
        expect(track.requestedBy).toBe('requester');
        expect(await player.plugins.resolveStream(track)).toEqual({
          file: await realpath(join(directory, track.title)),
        });
      }

      return {
        queue: queueFixture({ size: 2 }),
        resource: result,
        searchResult: result,
        track: result.tracks[0]!,
        playerResult: null,
      };
    });

    await runChatInput(play, request);

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(embed(request.replies[0]).title).toMatch(/Added to queue/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
