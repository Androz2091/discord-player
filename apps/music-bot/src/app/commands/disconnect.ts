import { musicCommand, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = {
  name: 'disconnect',
  description: 'Stop playback, delete the queue, and leave voice.',
};

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);
  await queue.delete();
  return 'Disconnected and deleted the music queue.';
});
