import { SlashCommandProps } from 'commandkit';

export const data = {
  name: 'ping',
  description: 'Ping pong!',
};

export async function run({ interaction }: SlashCommandProps) {
  await interaction.reply('Pong!');
}
