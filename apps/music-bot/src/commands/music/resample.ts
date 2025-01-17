import { SlashCommandProps } from 'commandkit';
import { useQueue } from 'discord-player';
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('resample')
  .setDescription('Set resample filter')
  .addIntegerOption((option) =>
    option
      .setName('value')
      .setDescription('The value to set')
      .setMinValue(1)
      .setMaxValue(192000)
      .setRequired(true),
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

  if (!queue.filters.resampler) {
    return interaction.editReply('This filter is not supported.');
  }

  const oldValue = queue.filters.resampler.sampleRate;
  const newValue = interaction.options.getInteger('value', true);

  queue.filters.resampler?.setSampleRate(newValue);

  await interaction.editReply(
    `Sample rate set to ${newValue} Hz (was ${oldValue} Hz)`,
  );
}
