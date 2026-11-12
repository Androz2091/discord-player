import { displayTrack, musicCommand, requireQueue, requireTrack } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';

export const command: CommandData = { name: 'skip', description: 'Skip the current track and start the next one.' };

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);
  const track = requireTrack(queue);

  await queue.skip();

  return `Skipped ${displayTrack(track)}.${queue.currentTrack ? '' : ' The queue is empty.'}`;
});
