import { SlashCommandProps } from 'commandkit';
import { useQueue } from 'discord-player';
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('bassboost')
  .setDescription('Toggle bassboost filter');

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

  const on = await queue.filters.ffmpeg.toggle(['lofi']);

  await interaction.editReply(
    `Bassboost is now ${on ? 'enabled' : 'disabled'}`,
  );
}
