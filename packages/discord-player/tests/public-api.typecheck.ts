import type { DiscordPlayer, GuildQueue, Track } from '../src/index.js';
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

  void player.play(channel, track, { queueOptions: { metadata: { command: 'play' }, maxSize: 3 } });
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
