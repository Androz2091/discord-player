import { ChatInputCommand } from 'commandkit';
import { useQueue } from 'discord-player';
import { SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('bassboost')
  .setDescription('Toggle bassboost filter')
  .addBooleanOption((option) =>
    option
      .setName('on')
      .setDescription('Enable or disable the filter')
      .setRequired(true),
  );

export const chatInput: ChatInputCommand = async ({ interaction }) => {
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

  if (!queue.filters.equalizer) {
    return interaction.editReply('This filter is not supported.');
  }

  const on = interaction.options.getBoolean('on', true);

  if (on) {
    queue.filters.equalizer.setEQ([
      { band: 0, gain: 1.25 },
      { band: 1, gain: 1.25 },
      { band: 2, gain: 1.25 },
    ]);
  } else {
    queue.filters.equalizer.resetEQ();
  }

  await interaction.editReply(
    `Bassboost is now ${on ? 'enabled' : 'disabled'}`,
  );
};
