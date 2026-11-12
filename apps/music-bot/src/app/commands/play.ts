import { player } from '@/lib/discord-player.ts';
import { displayTrack, formatTime, musicCommand, MusicCommandError, requireVoiceChannel } from '@/lib/music-command.ts';
import type { QueueMetadata } from '@/lib/common.ts';
import { musicEmbed } from '@/lib/embeds.ts';
import type { AutocompleteCommand, CommandData } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';

export const command: CommandData = {
  name: 'play',
  description: 'Play a direct media URL or search the local music directory.',
  options: [
    {
      name: 'query',
      description: 'An HTTP(S) media URL or a file name from the local music directory.',
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],
};

function autocompleteLabel(value: string): string {
  let label = '';

  for (const character of value) {
    if (label.length + character.length > 100) {
      break;
    }

    label += character;
  }

  return label;
}

/** Suggest media through the same source plugin used by playback. */
export const autocomplete: AutocompleteCommand = async ({ interaction }) => {
  const query = interaction.options.getString('query', false) ?? '';
  const signal = AbortSignal.timeout(2_000);
  const choices = new Map<string, { name: string; value: string }>();

  try {
    const result = await player.search(query, { requestedBy: interaction.user.id, signal });

    for (const track of result.tracks) {
      const data = track.sourceReference?.data;
      const file =
        data && typeof data === 'object' && !Array.isArray(data) && typeof data.file === 'string' ? data.file : null;
      const value = file ?? track.url;

      // Keep values intact so choosing a suggestion resolves that exact file.
      if (!value || value.length > 100 || choices.has(value)) {
        continue;
      }

      choices.set(value, {
        name: autocompleteLabel(file ?? (track.title || value)),
        value,
      });

      if (choices.size === 25) {
        break;
      }
    }
  } catch (error) {
    if (!signal.aborted) {
      console.error('Search autocomplete failed:', error);
    }
  }

  await interaction.respond([...choices.values()]);
};

export const chatInput = musicCommand(async (interaction) => {
  const channel = requireVoiceChannel(interaction);

  if (!channel.joinable) throw new MusicCommandError('I cannot join your voice channel. Check my permissions.');

  const existingQueue = player.nodes.get<QueueMetadata>(interaction.guildId);

  if (existingQueue?.node.session && existingQueue.node.session.channelId !== channel.id) {
    throw new MusicCommandError('Join my voice channel to add music, or use /join to move me.');
  }

  const textChannel = interaction.channel;

  if (!textChannel?.isSendable()) throw new MusicCommandError('Use a channel where I can send playback updates.');

  const query = interaction.options.getString('query', true);
  const searchResult = await player.search(query, { requestedBy: interaction.user.id });
  const track = searchResult.tracks[0];

  if (!track) {
    throw new MusicCommandError(
      'No matching media found. Enter an HTTP(S) URL or a file name from the local music directory.',
    );
  }

  if (existingQueue) existingQueue.metadata = { textChannel };

  const result = await player.play<QueueMetadata>(channel, searchResult, {
    nodeOptions: { metadata: { textChannel } },
  });

  if (result.playerResult) {
    const duration = result.playerResult.audioStream.durationMs;

    return musicEmbed('🎶 Playback started', displayTrack(track), 0x57f287).addFields(
      { name: 'Voice channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Duration', value: duration === null ? 'Unknown' : formatTime(duration), inline: true },
    );
  }

  return musicEmbed('➕ Added to queue', displayTrack(track)).addFields({
    name: 'Upcoming tracks',
    value: String(result.queue.size),
    inline: true,
  });
});
