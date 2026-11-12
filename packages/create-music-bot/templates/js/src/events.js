import { escapeMarkdown } from 'discord.js';

/**
 * Formats a track title for a message.
 *
 * @param {string} title Track title.
 */
export function formatTitle(title) {
  return `**${escapeMarkdown(title)}**`;
}

/**
 * Posts a message to the channel that started the queue.
 *
 * @param {import('discord-player').GuildQueue} queue Queue whose channel receives the message.
 * @param {string} content Message text.
 */
function announce(queue, content) {
  // `/play` is the only thing that creates queues, and it always sets `{ channel }` as the queue metadata.
  const { channel } = queue.metadata;

  channel?.send({ content, allowedMentions: { parse: [] } }).catch((error) => {
    console.error('Could not send a playback update:', error);
  });
}

/**
 * Reports playback events in the text channel and logs errors.
 *
 * @param {import('discord-player').Player} player Player to listen to.
 */
export function registerPlayerEvents(player) {
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
