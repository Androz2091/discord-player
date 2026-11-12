import { musicCommand, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = { name: 'stop', description: 'Stop playback while keeping upcoming tracks.' };

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);

  await queue.stop();

  return 'Playback stopped. Upcoming tracks are retained; use /queue start to continue or /queue clear to remove them.';
});
