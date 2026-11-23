import {
  definePlugin,
  type SourcePluginRuntime,
  type DiscordPlayer,
  type GuildQueue,
  type Track,
  type GuildQueueConnectionOptions,
  type GuildQueueOptions,
  type PlayerPlayOptions,
  type GuildQueuePlayOptions,
  type GuildQueueConnectOptions,
} from '../src/index.js';
import type { DiscordSessionEvents } from '@remedia/client';

/** Compile representative v7-style listeners and playback calls against the public v8 API. */
export function wireV7CommandHandler(
  player: DiscordPlayer,
  queue: GuildQueue,
  channel: { id: string; guild: { id: string } },
  track: Track,
): void {
  player.events.on('playerStart', (eventQueue, eventTrack, rawEvent) => {
    const queueId: string = eventQueue.id;
    const title: string = eventTrack.title;
    const event: DiscordSessionEvents['playbackStarted'][0] | undefined = rawEvent;

    void [queueId, title, event];
  });

  player.events.on('playerFinish', (eventQueue, eventTrack, rawEvent) => {
    void [eventQueue.guildId, eventTrack.url, rawEvent?.generation];
  });

  player.events.on('playerError', (eventQueue, error, eventTrack, rawEvent) => {
    void [eventQueue.id, error.message, eventTrack.title, rawEvent?.error];
  });

  void player.play(channel, track, { nodeOptions: { metadata: { command: 'play' }, maxSize: 3 } });
  void queue.history.back();
  void queue.node.setPaused(true);
}

/** Compile the public filter facade and its typed named operations. */
export async function configureAudioFilters(queue: GuildQueue): Promise<void> {
  const graph: string | null = queue.node.filters.get();
  const enabled: boolean = queue.node.filters.get('nightcore');

  void [graph, enabled];

  await queue.node.filters.set(['8d', 'nightcore']);
  await queue.node.filters.set('volume=0.5');
  await queue.node.filters.setRaw('tremolo');
  await queue.node.filters.remove(['nightcore', '8D']);

  const toggled: boolean = await queue.node.filters.toggle('vaporwave');

  void toggled;

  // @ts-expect-error only built-in preset names can be toggled
  await queue.node.filters.toggle('unknown');
  // @ts-expect-error named arrays cannot contain raw graphs
  await queue.node.filters.set(['volume=0.5']);
  // @ts-expect-error named lookups require a built-in preset
  queue.node.filters.get('unknown');
}

/** Compile read-only lifetime signals for consumers of the public API. */
export function consumeLifetimeSignals(player: DiscordPlayer, queue: GuildQueue): void {
  const playerSignal: AbortSignal = player.signal;
  const queueSignal: AbortSignal = queue.signal;

  playerSignal.throwIfAborted();
  queueSignal.throwIfAborted();

  // @ts-expect-error consumers cannot replace the Player lifetime signal
  player.signal = new AbortController().signal;

  // @ts-expect-error consumers cannot replace the queue lifetime signal
  queue.signal = new AbortController().signal;
}

/** Reject flat session options while retaining v7-style search and queue defaults. */
export async function groupedPlayOptions(player: DiscordPlayer, queue: GuildQueue, track: Track): Promise<void> {
  const signal = new AbortController().signal;
  await player.play<{ textChannel: string }, { request: number }>({ guildId: 'guild', channelId: 'voice' }, track, {
    requestedBy: { id: 'user' },
    searchEngine: 'auto',
    nodeOptions: { metadata: { textChannel: 'text' }, playback: { volume: 80 }, lifecycle: { leaveOnEmpty: true } },
    connectionOptions: {
      selfDeaf: true,
      selfMute: false,
      nodeId: 'remote',
      connectTimeoutMs: 30_000,
      volume: 50,
      filterGraph: null,
    },
    customMetadata: { request: 1 },
    signal,
  });
  await queue.play(track, { connectionOptions: { channelId: 'voice', volume: 50 }, customMetadata: 1, signal });
  await queue.connect({ channelId: 'voice', selfDeaf: true, signal });

  // @ts-expect-error connection settings belong in connectionOptions
  void player.play('voice', track, { selfDeaf: true });
  // @ts-expect-error connection settings belong in connectionOptions
  void player.play('voice', track, { selfMute: true });
  // @ts-expect-error connection settings belong in connectionOptions
  void player.play('voice', track, { connectTimeoutMs: 1000 });
  // @ts-expect-error placement belongs in connectionOptions
  void player.play('voice', track, { nodeId: 'remote' });
  // @ts-expect-error session volume belongs in connectionOptions or creation defaults in nodeOptions
  void player.play('voice', track, { volume: 80 });
  // @ts-expect-error session filtering belongs in connectionOptions
  void player.play('voice', track, { filterGraph: null });
  // @ts-expect-error Player.play receives its channel through the first argument
  void player.play('voice', track, { connectionOptions: { channelId: 'voice' } });
  // @ts-expect-error placement is not a queue initialization policy
  void player.play('voice', track, { nodeOptions: { nodeId: 'remote' } });
  // @ts-expect-error per-play metadata is separate from queue metadata
  void player.play<{ textChannel: string }, number>('voice', track, { customMetadata: 'wrong' });
  // @ts-expect-error queue.play groups connection settings too
  void queue.play(track, { channelId: 'voice' });
  // @ts-expect-error queue.play groups session overrides too
  void queue.play(track, { volume: 50 });
  // @ts-expect-error queue.connect remains flat
  void queue.connect({ connectionOptions: { channelId: 'voice' } });
  // @ts-expect-error plugin-host requirements are derived from Tracks, not supplied publicly
  void queue.connect({ channelId: 'voice', pluginHosts: ['host'] });
  // @ts-expect-error crossfade is a queue initialization default
  void player.play('voice', track, { connectionOptions: { crossfade: { enabled: true } } });
  // @ts-expect-error playback cancellation has one top-level signal
  void queue.play(track, { connectionOptions: { signal } });
}

/** Plugins narrow the runtime and receive a nullable, fully typed owning queue. */
export function pluginRuntimeContexts(): void {
  definePlugin({
    id: 'typed.context',
    setup(ctx) {
      if (ctx.player.isPartial()) {
        const runtime: SourcePluginRuntime = ctx.player;
        void runtime;
        // @ts-expect-error standalone source execution does not own guild nodes
        void ctx.player.nodes;
      } else {
        const player: DiscordPlayer = ctx.player;
        void [player.nodes, player.events, player.context, player.play];
      }
      ctx.on('track.stream', (_input, { queue, guildId, signal }) => {
        const current: GuildQueue | null = queue;
        const guild: string | null = guildId;
        if (current) void [current.currentTrack, current.history, current.guildId];
        void [guild, signal.aborted];
        return 'https://fixture.test/audio';
      });
    },
  });
}

/** The location of connection configuration never changes its type. */
export function sharedConnectionConfiguration(configuration: GuildQueueConnectionOptions): void {
  type QueueConnection = NonNullable<GuildQueueOptions['connectionOptions']>;
  type CallConnection = NonNullable<PlayerPlayOptions['connectionOptions']>;
  type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
  const same: Equal<QueueConnection, CallConnection> = true;
  const queue: QueueConnection = configuration;
  const call: CallConnection = queue;
  const playback: GuildQueuePlayOptions = { connectionOptions: call };
  const direct: GuildQueueConnectOptions = { ...call, channelId: 'voice' };

  void [same, playback, direct];
}
