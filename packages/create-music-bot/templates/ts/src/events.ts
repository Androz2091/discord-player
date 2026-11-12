import { escapeMarkdown, type SendableChannels } from 'discord.js';
import type { GuildQueue, Player } from 'discord-player';

/** Data stored on each queue when it is created by `/play`. */
export interface QueueMetadata {
  /** Channel that receives playback updates. */
  channel: SendableChannels | null;
}

/** Formats a track title for a message. */
export function formatTitle(title: string): string {
  return `**${escapeMarkdown(title)}**`;
}

/** Posts a message to the channel that started the queue. */
function announce(queue: GuildQueue, content: string): void {
  // `/play` is the only thing that creates queues, and it always sets this metadata.
  const { channel } = queue.metadata as QueueMetadata;

  channel?.send({ content, allowedMentions: { parse: [] } }).catch((error: unknown) => {
    console.error('Could not send a playback update:', error);
  });
}

/**
 * Reports playback events in the text channel and logs errors.
 *
 * @param player Player to listen to.
 */
export function registerPlayerEvents(player: Player): void {
  player.events.on('playerStart', (queue, track) => {
    console.log(`Now playing ${track.title} in guild ${queue.guildId}`);
    announce(queue, `Now playing ${formatTitle(track.title)}`);
  });

  player.events.on('emptyQueue', (queue) => {
    announce(queue, 'The queue is empty. Add more with `/play`.');
  });

  player.events.on('playerError', (queue, error, track) => {
    console.error(`Could not play ${track.url}:`, error);
    announce(queue, `Could not play ${formatTitle(track.title)}. Skipping it.`);

    // The failed track returns to the front of the queue once this listener returns.
    // Wait a tick, drop it, and start the next track.
    queueMicrotask(async () => {
      try {
        queue.removeTrack(track);
        await queue.playNext();
      } catch (nextError) {
        console.error('Could not continue after a playback error:', nextError);
      }
    });
  });

  // Without these listeners, errors are ignored silently.
  player.events.on('error', (queue, error) => {
    console.error(`Queue ${queue.guildId} failed:`, error);
  });

  player.on('error', (error) => {
    console.error('Player error:', error);
  });
}
