import { DiscordPlayer, type GuildQueue, type Track } from 'discord-player';
import { useClient } from 'commandkit/hooks';
import { escapeMarkdown } from 'discord.js';
import type { QueueMetadata } from './common.ts';
import { musicEmbed } from './embeds.ts';
import { rawHTTPExtractor } from './raw-http-extractor.ts';

export const player = new DiscordPlayer({
  nodes: [{ id: 'local', type: 'embedded' }],
  plugins: [rawHTTPExtractor()],
  send(guildId, payload) {
    const client = useClient<true>();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Cannot dispatch Discord voice request: guild ${guildId} is not cached on this client.`);
    return guild.shard.send(payload);
  },
});

const localTest = './_legacy-extractor-test/extractor-001.ts' as string;
await import(localTest)
  .then((e) => {
    return player.extractors.register(e.default);
  })
  .catch(console.error);

function notify(queue: GuildQueue, title: string, description: string, color?: number): void {
  // Use the event's queue directly: creation happens before caching and deletion happens after eviction.
  const channel = (queue.metadata as QueueMetadata | undefined)?.textChannel;
  if (!channel?.isSendable()) return;
  void channel
    .send({
      embeds: [musicEmbed(title, description, color)],
      allowedMentions: { parse: [] },
    })
    .catch((error) => {
      console.error('Could not send a playback update:', error);
    });
}

function trackTitle(track: Track): string {
  return `**${escapeMarkdown((track.title || 'Untitled track').slice(0, 120))}**`;
}

const voiceConnections = new WeakMap<GuildQueue, string>();
const recoveringQueues = new WeakSet<GuildQueue>();

player.events.on('queueCreate', (queue) => {
  notify(queue, '📋 Queue created', 'A music queue is ready for this server. Add a media URL with `/play`.');
});

player.events.on('queueDelete', (queue) => {
  notify(queue, '🗑 Queue deleted', 'Playback stopped, voice disconnected, and upcoming tracks and history cleared.');
});

player.events.on('connection', (queue) => {
  const session = queue.node.session;
  if (!session) return;
  const identity = `${session.sessionId}:${session.channelId}`;
  const previous = voiceConnections.get(queue);
  if (previous === identity) return;
  voiceConnections.set(queue, identity);
  notify(
    queue,
    previous ? '🔊 Voice channel changed' : '🔊 Voice connected',
    `Connected to <#${session.channelId}>.`,
    0x57f287,
  );
});

player.events.on('connectionDestroyed', (queue) => {
  voiceConnections.delete(queue);
  recoveringQueues.delete(queue);
  if (!queue.destroyed) notify(queue, 'Voice disconnected', 'The voice connection was closed.');
});

player.events.on('voiceStateUpdate', (queue, event) => {
  if (event.state === 'reconnecting' && !recoveringQueues.has(queue)) {
    recoveringQueues.add(queue);
    notify(
      queue,
      'Reconnecting voice',
      'The voice connection is recovering. Playback will continue when it is ready.',
      0xfee75c,
    );
  } else if (event.state === 'connected' && recoveringQueues.has(queue)) {
    recoveringQueues.delete(queue);
    notify(queue, '🔊 Voice restored', 'The voice connection is ready again.', 0x57f287);
  }
});

player.events.on('audioTrackAdd', (queue, track) => {
  notify(queue, '➕ Track added', `${trackTitle(track)} was added to the queue.`);
});

player.events.on('audioTracksAdd', (queue, tracks) => {
  const preview = tracks
    .slice(0, 5)
    .map((track) => `• ${trackTitle(track)}`)
    .join('\n');
  notify(
    queue,
    '➕ Tracks added',
    `${tracks.length} tracks were added.\n${preview}${tracks.length > 5 ? '\n…and more.' : ''}`,
  );
});

player.events.on('audioTrackRemove', (queue, track) => {
  notify(queue, '➖ Track removed', `${trackTitle(track)} was removed from the upcoming queue.`);
});

player.events.on('audioTracksRemove', (queue, tracks) => {
  notify(queue, '➖ Tracks removed', `${tracks.length} tracks were removed from the upcoming queue.`);
});

player.events.on('emptyQueue', (queue) => {
  notify(queue, '📭 Queue finished', 'There are no more tracks to play. Add another media URL with `/play`.');
});

player.events.on('playerStart', (queue, track, rawEvent) => {
  const title = rawEvent?.info.metadata.title;
  const artist = rawEvent?.info.metadata.artist;
  if (title) track.title = title;
  if (artist) track.author = artist;
  notify(queue, '🎶 Now playing', trackTitle(track), 0x57f287);
});

player.events.on('playerFinish', (queue, track) => {
  notify(queue, '✅ Track finished', trackTitle(track));
});

player.events.on('playerSkip', (queue, track, _reason, description) => {
  notify(queue, '⏭ Track skipped', `${trackTitle(track)}\n${escapeMarkdown(description)}`);
});

player.events.on('playerStop', (queue, track) => {
  notify(
    queue,
    '⏹ Playback stopped',
    `${track ? trackTitle(track) + '\n' : ''}Upcoming tracks are retained. Use \`/queue start\` to continue.`,
  );
});

player.events.on('playerPause', (queue) => {
  notify(queue, '⏸ Playback paused', queue.currentTrack ? trackTitle(queue.currentTrack) : 'Playback is paused.');
});

player.events.on('playerResume', (queue) => {
  notify(queue, '▶ Playback resumed', queue.currentTrack ? trackTitle(queue.currentTrack) : 'Playback is running.');
});

player.events.on('playerSeek', (queue, event) => {
  notify(
    queue,
    '⏩ Playback position changed',
    `Moved to **${(event.positionMs / 1000).toFixed(1)} seconds**${queue.currentTrack ? ` in ${trackTitle(queue.currentTrack)}` : ''}.`,
  );
});

player.events.on('volumeChange', (queue, previous, current) => {
  notify(queue, '🔊 Volume changed', `**${Math.round(previous)}%** → **${Math.round(current)}%**`);
});

player.events.on('playerError', (queue, error, track) => {
  console.error(`Playback failed for Track ${track.id}:`, error);
  notify(
    queue,
    'Playback failed',
    `Could not play ${trackTitle(track)}. The track is retained at the queue head; use \`/queue start\` to retry.`,
    0xed4245,
  );
});

player.events.on('error', (queue, error) => {
  console.error(`Queue ${queue.guildId} failed:`, error);
  notify(queue, 'Queue error', 'A queue or voice operation failed. Check the bot logs for details.', 0xed4245);
});
player.on('error', (error) => console.error('Player error:', error));
