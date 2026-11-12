import { musicCommand, requireQueue, requireTrack } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = { name: 'resume', description: 'Resume the paused track.' };

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);

  requireTrack(queue);

  if (queue.node.isPlaying()) return 'Playback is already playing.';

  await queue.node.resume();

  return 'Playback resumed.';
});
