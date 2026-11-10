import { musicCommand, requireQueue, requireTrack } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = { name: 'pause', description: 'Pause the current track.' };

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);

  requireTrack(queue);

  if (queue.node.isPaused()) return 'Playback is already paused.';

  await queue.node.pause();

  return 'Playback paused. Use /resume to continue.';
});
