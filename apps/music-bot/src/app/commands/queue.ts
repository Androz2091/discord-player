import { displayTrack, musicCommand, requireQueue } from '@/lib/music-command.ts';
import type { CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';
import { musicEmbed } from '@/lib/embeds.ts';

export const command: CommandData = {
  name: 'queue',
  description: 'View or manage upcoming tracks.',
  options: [
    {
      name: 'list',
      description: 'Show the current track and upcoming queue.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'start',
      description: 'Start the next queued track after stopping.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'clear',
      description: 'Clear upcoming tracks and playback history.',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

export const chatInput = musicCommand(async (interaction) => {
  const queue = requireQueue(interaction);
  const action = interaction.options.getSubcommand();

  if (action === 'clear') {
    const count = queue.size;

    queue.clear();

    return `Removed ${count} upcoming track(s) and cleared history. Current playback continues.`;
  }

  if (action === 'start') {
    if (queue.isPlaying()) return 'A track is already active. Use /resume if it is paused.';

    const track = await queue.playNext();

    return track ? `Started ${displayTrack(track)}.` : 'There are no upcoming tracks.';
  }

  const upcoming = queue.tracks.toArray();
  const lines: string[] = [];

  if (queue.currentTrack) lines.push(`Now: ${displayTrack(queue.currentTrack)}`, '');

  lines.push(...upcoming.slice(0, 10).map((track, index) => `${index + 1}. ${displayTrack(track)}`));

  if (upcoming.length > 10) lines.push(`…and ${upcoming.length - 10} more.`);

  return musicEmbed('📋 Music queue', lines.join('\n') || 'The queue is empty.').addFields(
    { name: 'Upcoming', value: String(queue.size), inline: true },
    { name: 'Shuffle', value: queue.isShuffling ? 'On' : 'Off', inline: true },
  );
});
