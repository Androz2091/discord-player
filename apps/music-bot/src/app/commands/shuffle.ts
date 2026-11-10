import { musicCommand, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

export const command: CommandData = {
  name: 'shuffle',
  description: 'Toggle random selection of upcoming tracks.',
  options: [
    {
      name: 'enabled',
      description: 'Enable or disable shuffle; omit to toggle.',
      type: ApplicationCommandOptionType.Boolean,
    },
  ],
};

export const chatInput = musicCommand((interaction) => {
  const queue = requireQueue(interaction);
  const enabled = interaction.options.getBoolean('enabled');

  if (enabled === null) queue.toggleShuffle();
  else if (enabled) queue.enableShuffle();
  else queue.disableShuffle();

  return `Shuffle is ${queue.isShuffling ? 'on' : 'off'}.`;
});
