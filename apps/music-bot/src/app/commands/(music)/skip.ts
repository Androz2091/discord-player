import { ChatInputCommand } from 'commandkit';
import { useQueue } from 'discord-player';
import { SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip current track');

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

  queue.node.skip();

  return interaction.reply(
    `Skipped: ${currentTrack.title} by ${currentTrack.author}`,
  );
};
