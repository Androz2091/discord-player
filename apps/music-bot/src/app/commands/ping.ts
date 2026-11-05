import { musicCommand } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = {
  name: 'ping',
  description: 'Check whether the bot is online.',
};

export const chatInput = musicCommand((interaction) => {
  const latency = interaction.client.ws.ping;
  return latency < 0
    ? 'Connected to Discord; gateway latency is not available yet.'
    : `Gateway latency: **${latency} ms**`;
});
