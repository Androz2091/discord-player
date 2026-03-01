import { ChatInputCommand } from 'commandkit';

export const command = {
  name: 'ping',
  description: 'Ping pong!',
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await interaction.reply('Pong!');
};
