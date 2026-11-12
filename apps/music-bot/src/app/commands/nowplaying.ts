import { displayTrack, formatTime, musicCommand, requireQueue, requireTrack } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { musicEmbed } from '@/lib/embeds.ts';

export const command: CommandData = {
  name: 'nowplaying',
  description: 'Show the current track and playback position.',
};

export const chatInput = musicCommand((interaction) => {
  const queue = requireQueue(interaction);
  const track = requireTrack(queue);
  const timeline =
    queue.node.totalDuration > 0
      ? queue.node.createProgressBar()
      : `Position: ${formatTime(queue.node.playbackTime)} (duration unknown)`;

  return musicEmbed('🎶 Now playing', `${displayTrack(track)}\n\n${timeline}`).addFields(
    {
      name: 'Status',
      value: queue.node.isPaused() ? '⏸ Paused' : queue.node.isPlaying() ? '▶ Playing' : '⏳ Preparing',
      inline: true,
    },
    { name: 'Volume', value: `${Math.round(queue.node.volume)}%`, inline: true },
    { name: 'Upcoming', value: String(queue.size), inline: true },
  );
});
