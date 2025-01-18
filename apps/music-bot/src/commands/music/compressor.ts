import { SlashCommandProps } from 'commandkit';
import { useQueue } from 'discord-player';
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('compressor')
  .setDescription('Set compressor filter');

export async function run({ interaction }: SlashCommandProps) {
  if (!interaction.inCachedGuild()) return;

  const queue = useQueue(interaction.guildId);

  if (!queue) {
    return interaction.reply('I am not playing anything here.');
  }

  const currentTrack = queue.currentTrack;

  if (!currentTrack) {
    return interaction.reply('There is no track playing.');
  }

  await interaction.deferReply();

  if (!queue.filters.compressor) {
    return interaction.editReply('This filter is not supported.');
  }

  const enabled = queue.filters.compressor.toggle();

  await interaction.editReply(
    `Compressor is now ${enabled ? 'enabled' : 'disabled'}`,
  );
}
