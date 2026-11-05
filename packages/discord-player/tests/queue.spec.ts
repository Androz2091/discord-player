import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DiscordSessionOptions, MediaSource, PlayOptions } from '@remedia/client';
import {
  DiscordPlayer,
  GuildQueueEvents,
  type GuildQueueOptions,
  NoResultError,
  Playlist,
  Queue,
  QueueRepeatMode,
  Stack,
  Track,
  useMainPlayer,
  useQueue,
  deserialize,
  encode,
  decode,
} from '../src/index.js';

/** Minimal deterministic Remedia session used by lifecycle tests. */
class FakeSession extends EventEmitter {
  /** Stable identity exposed in lifecycle events. */
  public readonly sessionId = randomUUID();
  /** Bot guild identifier. */
  public readonly guildId: string;
  /** Current voice channel identifier. */
  public channelId: string;
  /** Bot user identifier. */
  public readonly userId = 'bot-user';
  /** Selected Remedia node identifier. */
  public readonly nodeId: string;
  /** Embedded or remote node kind. */
  public readonly nodeType: 'embedded' | 'remote';
  /** Current raw playback state. */
  public state: 'idle' | 'playing' | 'paused' | 'stopped' | 'completed' | 'failed' = 'idle';
  /** Current voice connection state. */
  public connectionState: 'connected' | 'disconnected' = 'disconnected';
  /** Current linear gain value. */
  public volume: number;
  /** Current Gateway self-deaf setting. */
  public selfDeaf: boolean;
  /** Current Gateway self-mute setting. */
  public selfMute: boolean;
  /** Current position snapshot. */
  public position = {
    mediaMs: 0 as number | null,
    mediaPositionAccuracy: 'estimated' as const,
    submittedMs: 0,
    playedMs: 0 as number | null,
  };
  /** Current source duration. */
  public durationMs: number | null = 60_000;
  /** Filtergraph controls exposed by Remedia. */
  public filters = {
    graph: null as string | null,
    set: async (graph: string) => {
      this.filters.graph = graph;
    },
    clear: async () => {
      this.filters.graph = null;
    },
  };
  /** Persistent session configuration snapshot. */
  public get snapshot() {
    return { filterGraph: this.filters.graph };
  }
  /** Count of raw play calls. */
  public playCalls = 0;
  /** Count of disconnect calls. */
  public disconnectCalls = 0;
  /** Current Remedia generation. */
  public generation = 0;
  /** Metadata attached to the current raw generation. */
  public customMetadata: unknown;

  /** Create a deterministic fake session. */
  public constructor(options: DiscordSessionOptions, nodeType: 'embedded' | 'remote') {
    super();
    this.guildId = options.guildId;
    this.channelId = options.channelId;
    this.nodeId = options.nodeId ?? 'fake-node';
    this.nodeType = nodeType;
    this.volume = options.volume ?? 1;
    this.selfDeaf = options.selfDeaf ?? true;
    this.selfMute = options.selfMute ?? false;
    this.filters.graph = options.filterGraph ?? null;
  }

  /** Mark the fake voice session connected. */
  public async connect(): Promise<void> {
    this.connectionState = 'connected';
  }
  /** Move this logical session to another voice channel. */
  public async move(channelId: string): Promise<void> {
    this.channelId = channelId;
    this.connectionState = 'connected';
  }
  /** Stop and disconnect the fake voice session. */
  public async disconnect(): Promise<void> {
    this.disconnectCalls++;
    this.connectionState = 'disconnected';
  }
  /** Set linear gain. */
  public async setVolume(gain: number): Promise<void> {
    this.volume = gain;
  }
  /** Set the Gateway self-deaf flag. */
  public async setSelfDeaf(enabled: boolean): Promise<void> {
    this.selfDeaf = enabled;
  }
  /** Set the Gateway self-mute flag. */
  public async setSelfMute(enabled: boolean): Promise<void> {
    this.selfMute = enabled;
  }
  /** Pause raw playback. */
  public async pause(): Promise<void> {
    this.state = 'paused';
  }
  /** Resume raw playback. */
  public async resume(): Promise<void> {
    this.state = 'playing';
  }
  /** Seek raw playback. */
  public async seek(positionMs: number): Promise<void> {
    this.position = { ...this.position, mediaMs: positionMs, playedMs: positionMs };
  }

  /** Start one raw Remedia generation and emit its start lifecycle event. */
  public async play(
    _source: MediaSource,
    options?: PlayOptions<unknown>,
  ): Promise<{
    streamIndex: number;
    codec: string;
    sampleRate: number;
    channels: number;
    channelLayout: string;
    durationMs: number | null;
    bitRate: number;
    metadata: Record<string, string>;
  }> {
    this.playCalls++;
    this.generation++;
    this.state = 'playing';
    this.customMetadata = options?.customMetadata;
    const event = {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'playing' as const,
      info: {
        streamIndex: 0,
        codec: 'opus',
        sampleRate: 48_000,
        channels: 2,
        channelLayout: 'stereo',
        durationMs: this.durationMs,
        bitRate: 128_000,
        metadata: {},
      },
    };
    this.emit('playbackStarted', event);
    return event.info;
  }

  /** Emit natural completion for the current generation. */
  public complete(reconstructed = false): void {
    this.state = 'completed';
    this.emit('playbackCompleted', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      reconstructed,
      state: 'completed',
      position: this.position,
    });
  }

  /** Emit a stop event for the current generation. */
  public async stop(): Promise<void> {
    this.state = 'stopped';
    this.emit('playbackStopped', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'stopped',
      reason: 'test-stop',
    });
  }

  /** Emit a failed event for the current generation. */
  public fail(error = new Error('decode failed')): void {
    this.state = 'failed';
    this.emit('playbackFailed', {
      sessionId: this.sessionId,
      guildId: this.guildId,
      nodeId: this.nodeId,
      generation: this.generation,
      customMetadata: this.customMetadata,
      state: 'failed',
      error,
    });
  }
}

/** Track fixture with a deterministic Remedia source. */
class TestTrack extends Track {
  /** Optional source preparation function. */
  public resolver: (signal?: AbortSignal) => Promise<MediaSource>;

  /** Create one controlled Track fixture. */
  public constructor(title: string, resolver?: (signal?: AbortSignal) => Promise<MediaSource>) {
    super({ title, author: 'fixture', duration: '1:00', url: `https://example.test/${title}` });
    this.resolver = resolver ?? (async () => ({ url: this.url }));
  }

  /** Resolve this fixture to a controlled Remedia source. */
  public override getStreamableSource(options?: { signal?: AbortSignal }): Promise<MediaSource> {
    return this.resolver(options?.signal);
  }
}

/** Create a Player, mocked Remedia client, connected queue, and fake session. */
async function setup(
  options: {
    nodeType?: 'embedded' | 'remote';
    maxSize?: number;
    maxHistorySize?: number;
    queueOptions?: Partial<GuildQueueOptions>;
  } = {},
) {
  const player = new DiscordPlayer({ nodes: [], send: vi.fn() });
  player.getClientId = () => 'bot-user';
  const sessions: FakeSession[] = [];
  player.remedia = {
    nodes: [{ id: 'fake-node', type: options.nodeType ?? 'embedded' }],
    createDiscordSession: (sessionOptions: DiscordSessionOptions) => {
      const session = new FakeSession(sessionOptions, options.nodeType ?? 'embedded');
      sessions.push(session);
      return session;
    },
    receive: vi.fn(),
  } as unknown as NonNullable<typeof player.remedia>;
  const queue = await player.queues.create('guild-one', {
    maxSize: options.maxSize,
    maxHistorySize: options.maxHistorySize,
    ...options.queueOptions,
  });
  const session = (await queue.connect({ channelId: 'voice-one' })) as unknown as FakeSession;
  return { player, queue, session, sessions };
}

/** Let queued async lock continuations and event callbacks finish. */
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('managed queue playback', () => {
  it('applies GuildQueueOptions defaults when creating its Remedia session', async () => {
    const { queue, session } = await setup({
      queueOptions: {
        volume: 65,
        filterGraph: 'bass=gain=6',
        selfDeaf: false,
        selfMute: true,
      },
    });
    expect(session.volume).toBe(0.65);
    expect(session.filters.graph).toBe('bass=gain=6');
    expect(session.selfDeaf).toBe(false);
    expect(session.selfMute).toBe(true);
    expect(queue.node.volume).toBe(65);
  });

  it('serializes concurrent play requests while preserving all inserted tracks', async () => {
    const { queue, session } = await setup();
    let releaseSource!: (source: MediaSource) => void;
    const firstTrack = new TestTrack(
      'first',
      () =>
        new Promise((resolve) => {
          releaseSource = resolve;
        }),
    );
    const secondTrack = new TestTrack('second');
    const thirdTrack = new TestTrack('third');

    const firstPlay = queue.play(firstTrack);
    const secondPlay = await queue.play([secondTrack, thirdTrack]);
    expect(queue.currentTrack).toBe(firstTrack);
    expect(queue.tracks.toArray()).toEqual([secondTrack, thirdTrack]);
    expect(secondPlay.playerResult).toBeNull();

    releaseSource({ url: firstTrack.url });
    const result = await firstPlay;
    expect(result.track).toBe(firstTrack);
    expect(session.playCalls).toBe(1);

    session.complete();
    await settle();
    expect(queue.currentTrack).toBe(secondTrack);
    expect(queue.tracks.toArray()).toEqual([thirdTrack]);
  });

  it('lets a natural completion win a simultaneous skip without skipping the next track', async () => {
    const { queue, session, player } = await setup();
    const tracks = [new TestTrack('one'), new TestTrack('two'), new TestTrack('three')];
    const finishes: Track[] = [];
    const skips: Track[] = [];
    player.events.on(GuildQueueEvents.PlayerFinish, (_queue, track) => finishes.push(track));
    player.events.on(GuildQueueEvents.PlayerSkip, (_queue, track) => skips.push(track));
    await queue.play(tracks);

    session.complete();
    await queue.skip();
    await settle();

    expect(queue.currentTrack).toBe(tracks[1]);
    expect(finishes).toEqual([tracks[0]]);
    expect(skips).toEqual([]);
  });

  it('cancels source preparation on stop and destroy without starting late playback', async () => {
    const { queue, session, sessions, player } = await setup();
    let resolveStop!: (source: MediaSource) => void;
    const pending = new TestTrack(
      'pending-stop',
      () =>
        new Promise((resolve) => {
          resolveStop = resolve;
        }),
    );
    const playStopped = queue.play(pending);
    await queue.stop();
    resolveStop({ url: pending.url });
    await expect(playStopped).resolves.toMatchObject({ playerResult: null });
    expect(session.playCalls).toBe(0);
    expect(queue.currentTrack).toBeNull();

    let resolveDestroy!: (source: MediaSource) => void;
    const pendingDestroy = new TestTrack(
      'pending-destroy',
      () =>
        new Promise((resolve) => {
          resolveDestroy = resolve;
        }),
    );
    const playDestroyed = queue.play(pendingDestroy);
    await settle();
    const destroyed = queue.destroy();
    await destroyed;
    resolveDestroy({ url: pendingDestroy.url });
    await expect(playDestroyed).resolves.toMatchObject({ playerResult: null });
    expect(player.queues.has(queue.guildId)).toBe(false);
    expect(sessions[0]!.disconnectCalls).toBe(1);
    expect(session.playCalls).toBe(0);
  });

  it('requeues a Track when source preparation fails and emits one Track-aware error', async () => {
    const { queue, player } = await setup();
    const failed = new TestTrack('unresolved', async () => {
      throw new Error('source failed');
    });
    const errors: Array<{ track: Track; error: Error }> = [];
    player.events.on(GuildQueueEvents.PlayerError, (_queue, error, track) => errors.push({ track, error }));

    await expect(queue.play(failed)).rejects.toThrow('source failed');
    expect(queue.currentTrack).toBeNull();
    expect(queue.tracks.peek()).toBe(failed);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.track).toBe(failed);
  });

  it('updates history once on natural completion and once on manual skip', async () => {
    const { queue, session, player } = await setup({ maxHistorySize: 10 });
    const [first, second, third] = [
      new TestTrack('history-one'),
      new TestTrack('history-two'),
      new TestTrack('history-three'),
    ];
    let finishCount = 0;
    let skipCount = 0;
    player.events.on(GuildQueueEvents.PlayerFinish, () => finishCount++);
    player.events.on(GuildQueueEvents.PlayerSkip, () => skipCount++);
    await queue.play([first!, second!, third!]);

    const completion = {
      sessionId: session.sessionId,
      guildId: session.guildId,
      nodeId: session.nodeId,
      generation: session.generation,
      customMetadata: session.customMetadata,
      state: 'completed' as const,
      position: session.position,
    };
    session.complete();
    session.emit('playbackCompleted', completion);
    await settle();
    expect(finishCount).toBe(1);
    expect(queue.history.tracks.toArray()).toEqual([first]);

    await queue.skip();
    await settle();
    expect(skipCount).toBe(1);
    expect(queue.history.tracks.toArray()).toEqual([first, second]);
  });

  it('implements repeat-track, repeat-queue, and the autoplay boundary', async () => {
    const { queue, session, player } = await setup();
    const first = new TestTrack('repeat-one');
    const second = new TestTrack('repeat-two');
    queue.setRepeatMode(QueueRepeatMode.TRACK);
    await queue.play([first, second]);
    session.complete();
    await settle();
    expect(queue.currentTrack).toBe(first);
    expect(queue.tracks.toArray()).toEqual([second]);

    queue.setRepeatMode(QueueRepeatMode.QUEUE);
    session.complete();
    await settle();
    expect(queue.currentTrack).toBe(second);
    expect(queue.tracks.toArray()).toEqual([first]);
    session.complete();
    await settle();
    expect(queue.currentTrack).toBe(first);
    expect(queue.history.isEmpty()).toBe(true);

    queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
    queue.clear();
    const autoplayBoundary = vi.fn();
    player.events.on(GuildQueueEvents.WillAutoPlay, autoplayBoundary);
    session.complete();
    await settle();
    expect(autoplayBoundary).toHaveBeenCalledOnce();
    expect(queue.currentTrack).toBeNull();
  });

  it('supports dynamic shuffle and immediate in-place shuffle', async () => {
    const { queue, session } = await setup();
    const tracks = ['shuffle-one', 'shuffle-two', 'shuffle-three', 'shuffle-four'].map((title) => new TestTrack(title));
    queue.addTracks(tracks);
    const originalOrder = queue.tracks.toArray();
    expect(queue.enableShuffle(true)).toBe(true);
    expect(queue.isShuffling).toBe(true);
    expect(queue.tracks.toArray()).toEqual(originalOrder);

    await queue.playNext();
    session.complete();
    await settle();
    expect(originalOrder).toContain(queue.currentTrack);
    expect(queue.size).toBe(2);

    queue.disableShuffle();
    expect(queue.isShuffling).toBe(false);
    queue.tracks.clear();
    queue.addTracks(tracks);
    const beforeStatic = queue.tracks.toArray();
    queue.enableShuffle(false);
    expect(queue.isShuffling).toBe(false);
    expect(queue.tracks.toArray().sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      beforeStatic.sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it('keeps raw node playback separate from managed queue progression', async () => {
    const { queue, session, player } = await setup();
    const upcoming = new TestTrack('raw-upcoming');
    queue.addTrack(upcoming);
    const finish = vi.fn();
    player.events.on(GuildQueueEvents.PlayerFinish, finish);

    await queue.node.play({ url: 'https://example.test/raw' });
    session.complete();
    await settle();

    expect(queue.currentTrack).toBeNull();
    expect(queue.tracks.toArray()).toEqual([upcoming]);
    expect(finish).not.toHaveBeenCalled();
  });

  it('emits the familiar Track argument and appends the raw Remedia event', async () => {
    const { queue, session, player } = await setup();
    const track = new TestTrack('event-track');
    const starts: unknown[][] = [];
    const finishes: unknown[][] = [];
    player.events.on(GuildQueueEvents.PlayerStart, (...args) => starts.push(args));
    player.events.on(GuildQueueEvents.PlayerFinish, (...args) => finishes.push(args));
    await queue.play(track);
    session.complete();
    await settle();

    expect(starts[0]?.[0]).toBe(queue);
    expect(starts[0]?.[1]).toBe(track);
    expect(starts[0]?.[2]).toMatchObject({ generation: 1 });
    expect(finishes[0]?.[0]).toBe(queue);
    expect(finishes[0]?.[1]).toBe(track);
    expect(finishes[0]?.[2]).toMatchObject({ state: 'completed' });
  });

  it.each(['embedded', 'remote'] as const)('handles %s session lifecycle reconstruction once', async (nodeType) => {
    const { queue, session } = await setup({ nodeType });
    const first = new TestTrack(`${nodeType}-first`);
    const second = new TestTrack(`${nodeType}-second`);
    await queue.play([first, second]);
    session.complete(true);
    session.complete(true);
    await settle();
    expect(queue.currentTrack).toBe(second);
    expect(queue.stats.tracksFinished).toBe(1);
  });

  it('cleans sessions on reconnect cycles and preserves queue state during channel moves', async () => {
    const { queue, sessions } = await setup();
    const previous = new TestTrack('existing-history');
    queue.history.push(previous);
    const current = new TestTrack('moving-current');
    await queue.play(current);
    const session = queue.node.getSession();
    await queue.node.setVolume(76);
    await queue.node.filters?.set('bass=gain=8');

    const moved = await queue.connect({ channelId: 'voice-two' });
    expect(moved).toBe(session);
    expect(queue.currentTrack).toBe(current);
    expect(queue.history.previousTrack).toBe(previous);
    expect(queue.node.volume).toBe(76);
    expect(queue.node.filters?.graph).toBe('bass=gain=8');
    expect(sessions).toHaveLength(1);

    await queue.stop();
    await queue.node.destroySession();
    await queue.connect({ channelId: 'voice-two' });
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.disconnectCalls).toBe(1);
    expect(sessions[1]!.volume).toBe(0.76);
    expect(sessions[1]!.filters.graph).toBe('bass=gain=8');
  });

  it.each(['embedded', 'remote'] as const)(
    'initializes Remedia voice flags, linear gain, and filters for %s sessions',
    async (nodeType) => {
      const { queue, sessions } = await setup({ nodeType });
      expect(sessions[0]!.selfDeaf).toBe(true);
      expect(sessions[0]!.selfMute).toBe(false);
      expect(sessions[0]!.volume).toBe(1);
      expect(sessions[0]!.filters.graph).toBeNull();
      await queue.node.destroySession();
      await queue.connect({
        channelId: 'voice-configured',
        selfDeaf: false,
        selfMute: true,
        volume: 80,
        filterGraph: 'bass=gain=8',
      });
      const configured = sessions.at(-1)!;
      expect(configured.channelId).toBe('voice-configured');
      expect(configured.selfDeaf).toBe(false);
      expect(configured.selfMute).toBe(true);
      expect(configured.volume).toBe(0.8);
      expect(configured.filters.graph).toBe('bass=gain=8');
      expect(queue.options.volume).toBe(80);
      expect(queue.options.selfDeaf).toBe(false);
      expect(queue.options.selfMute).toBe(true);
      expect(queue.options.filterGraph).toBe('bass=gain=8');
    },
  );

  it('moves the same session and rejects attempts to switch its Remedia node', async () => {
    const { queue } = await setup();
    const track = new TestTrack('moving-session');
    await queue.play(track);
    const session = queue.node.getSession();
    const moved = await queue.connect({ channelId: 'voice-two' });
    expect(moved).toBe(session);
    expect(session.channelId).toBe('voice-two');
    await expect(queue.connect({ channelId: 'voice-three', nodeId: 'another-node' })).rejects.toThrow(
      'Changing a Remedia node while preserving this session',
    );
    expect(queue.node.getSession()).toBe(session);
    expect(queue.currentTrack).toBe(track);
  });

  it('preserves v7 queue navigation, insertion limits, and aliases', async () => {
    const { queue, player } = await setup({ maxSize: 3 });
    const [one, two, three, four] = ['nav-one', 'nav-two', 'nav-three', 'nav-four'].map(
      (title) => new TestTrack(title),
    );
    queue.addTracks([one!, two!]);
    queue.insertTrack(three!, 1);
    expect(queue.tracks.toArray()).toEqual([one, three, two]);
    expect(queue.isFull()).toBe(true);
    expect(queue.getCapacity()).toBe(0);
    expect(() => queue.addTrack(four!)).toThrow('remaining capacity');

    queue.moveTrack(two!, 0);
    expect(queue.tracks.toArray()).toEqual([two, one, three]);
    queue.swapTracks(two!, three!);
    expect(queue.tracks.toArray()).toEqual([three, one, two]);
    expect(queue.removeTrack(one!)).toBe(one);
    expect(queue.getSize()).toBe(2);
    queue.copyTrack(two!, 1);
    expect(queue.size).toBe(3);
    expect(queue.id).toBe(queue.guildId);
    expect(player.nodes).toBe(player.queues);
    expect(queue.maxSize).toBe(queue.getMaxSize());
  });

  it('navigates backward and forward through history while preserving the displaced Track', async () => {
    const { queue, session } = await setup();
    const [first, second, third] = ['nav-history-one', 'nav-history-two', 'nav-history-three'].map(
      (title) => new TestTrack(title),
    );
    await queue.play([first!, second!, third!]);
    session.complete();
    await settle();
    expect(queue.currentTrack).toBe(second);

    await queue.history.back();
    expect(queue.currentTrack).toBe(first);
    expect(queue.tracks.toArray()).toEqual([second, third]);
    expect(queue.history.previousTrack).toBeNull();

    await queue.history.next();
    expect(queue.currentTrack).toBe(second);
    expect(queue.tracks.toArray()).toEqual([third]);
  });

  it('isolates AsyncLocalStorage contexts across Player instances and guild IDs', async () => {
    const firstPlayer = new DiscordPlayer({ nodes: [], send: vi.fn() });
    const secondPlayer = new DiscordPlayer({ nodes: [], send: vi.fn() });
    const firstQueue = await firstPlayer.queues.create('guild-a');
    const secondQueue = await secondPlayer.queues.create('guild-b');
    const first = firstPlayer.context.provide({ guildId: 'guild-a' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { main: useMainPlayer(), queue: useQueue() };
    });
    const second = secondPlayer.context.provide({ guildId: 'guild-b' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { main: useMainPlayer(), queue: useQueue() };
    });
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual({ main: firstPlayer, queue: firstQueue });
    expect(secondResult).toEqual({ main: secondPlayer, queue: secondQueue });
  });

  it('round-trips Track and Playlist serialization and collection unlimited limits', () => {
    const track = new TestTrack('serialized', async () => ({ url: 'https://example.test/serialized' }));
    const playlist = new Playlist({
      id: 'list',
      title: 'List',
      author: { name: 'Artist', url: 'https://example.test' },
      tracks: [track],
    });
    const decodedPlaylist = deserialize(decode(encode(playlist.serialize()))) as Playlist;
    const decodedTrack = deserialize(track.serialize()) as Track;
    expect(decodedPlaylist.tracks[0]?.title).toBe(track.title);
    expect(decodedTrack.durationMS).toBe(60_000);
    expect(playlist.durationFormatted).toBe('1:00');

    const queue = new Queue<number>(0);
    expect(queue.merge([1, 2, 3])).toBe(3);
    expect(queue.isFull()).toBe(false);
    expect(queue.getCapacity()).toBe(Infinity);
    const stack = new Stack<number>(0);
    stack.push(1);
    stack.push(2);
    expect(stack.toArray()).toEqual([1, 2]);
  });

  it('reports player and node timeline controls without claiming unsupported metrics', async () => {
    const { player, queue, session } = await setup();
    const track = new TestTrack('controls');
    await queue.play(track);
    expect(queue.node.isPlaying()).toBe(true);
    await queue.node.pause();
    expect(queue.node.isPaused()).toBe(true);
    expect(queue.isPlaying()).toBe(true);
    await queue.node.resume();
    await queue.node.seek(30_000);
    expect(queue.node.playbackTime).toBe(30_000);
    expect(queue.node.getTimestamp()?.current.value).toBe(30_000);
    expect(queue.node.createProgressBar()).toContain('🔘');
    expect(await queue.node.setVolume(80)).toBe(80);
    expect(session.volume).toBe(0.8);
    expect(player.statistics.activeQueues).toBe(1);
    await queue.setSelfDeaf(false);
    await queue.setSelfMute(true);
    expect(session.selfDeaf).toBe(false);
    expect(session.selfMute).toBe(true);
    expect(queue.options.selfDeaf).toBe(false);
    expect(queue.options.selfMute).toBe(true);
  });
});

describe('public collection and history utilities', () => {
  it('bounds history from oldest to newest and rejects empty navigation', async () => {
    const { queue } = await setup({ maxHistorySize: 2 });
    const [one, two, three] = ['history-limit-one', 'history-limit-two', 'history-limit-three'].map(
      (title) => new TestTrack(title),
    );
    queue.history.push([one!, two!, three!]);
    expect(queue.history.tracks.toArray()).toEqual([two, three]);
    expect(queue.history.previousTrack).toBe(three);
    await expect(queue.history.next()).rejects.toBeInstanceOf(NoResultError);
  });
});
