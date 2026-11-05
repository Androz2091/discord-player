import { musicCommand, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

export const command: CommandData = {
  name: 'volume',
  description: 'Show or set playback volume.',
  options: [
    {
      name: 'percent',
      description: 'Volume from 0 to 100 percent.',
      type: ApplicationCommandOptionType.Integer,
      min_value: 0,
      max_value: 100,
    },
  ],
};

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);
  const percent = interaction.options.getInteger('percent');
  if (percent === null) return `Current volume: ${Math.round(queue.node.volume)}%.`;
  await queue.node.setVolume(percent);
  return `Volume set to ${percent}%.`;
});
