import { formatTime, musicCommand, MusicCommandError, requireQueue, requireTrack } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

export const command: CommandData = {
  name: 'seek',
  description: 'Seek to a position in the current track.',
  options: [
    {
      name: 'seconds',
      description: 'Position in seconds from the start.',
      type: ApplicationCommandOptionType.Number,
      required: true,
      min_value: 0,
    },
  ],
};

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);

  requireTrack(queue);

  const position = interaction.options.getNumber('seconds', true) * 1000;
  const duration = queue.node.totalDuration;

  if (duration > 0 && position > duration) {
    throw new MusicCommandError(`Choose a position before ${formatTime(duration)}.`);
  }

  await queue.node.seek(position);

  return `Seeked to ${formatTime(position)}.`;
});
