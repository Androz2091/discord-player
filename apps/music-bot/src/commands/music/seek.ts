import { SlashCommandProps } from 'commandkit';
import { useQueue } from 'discord-player';
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Set seek filter')
  .addIntegerOption((option) =>
    option.setName('seek').setDescription('The seek value').setRequired(true),
  );

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

  if (!queue.filters.seeker) {
    return interaction.editReply('This filter is not supported.');
  }

  const time = interaction.options.getInteger('seek')!;

  const success = await queue.node.seek(time);

  await interaction.editReply(
    `Seeked to ${time}ms: ${success ? 'success' : 'failed'}`,
  );
}
