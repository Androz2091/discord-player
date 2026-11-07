import type { ChatInputCommand } from 'commandkit';
import type { GuildQueue, Track } from 'discord-player';
import { EmbedBuilder, escapeMarkdown, MessageFlags } from 'discord.js';
// Match the Discord types exposed by CommandKit's CommonJS declarations.
import type { ChatInputCommandInteraction } from 'discord.js' with { 'resolution-mode': 'require' };
import type { QueueMetadata } from './common.ts';
import { player } from './discord-player.ts';
import { musicEmbed } from './embeds.ts';

/** Expected command validation failure that can be shown directly to the user. */
export class MusicCommandError extends Error {}

type MusicReply = string | EmbedBuilder;

const commandTitles: Record<string, string> = {
  play: '🎵 Music added',
  join: '🔊 Voice connected',
  pause: '⏸ Playback paused',
  resume: '▶ Playback resumed',
  skip: '⏭ Track skipped',
  stop: '⏹ Playback stopped',
  queue: '📋 Music queue',
  loop: '🔁 Repeat mode',
  seek: '⏩ Playback position',
  volume: '🔊 Playback volume',
  filter: '🎛 Audio filter',
  shuffle: '🔀 Shuffle',
  nowplaying: '🎶 Now playing',
  disconnect: '👋 Voice disconnected',
  ping: '🏓 Pong!',
};

/**
 * Handle private command replies and report asynchronous playback failures.
 * @param action Command action, run after the interaction is deferred.
 * @returns A CommandKit slash-command handler.
 */
export function musicCommand(
  action: (interaction: ChatInputCommandInteraction<'cached'>) => MusicReply | Promise<MusicReply>,
): ChatInputCommand {
  return async ({ interaction }) => {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [musicEmbed('Server command', 'Use this command in a server.', 0xed4245)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const response = await action(interaction);
      const embed =
        response instanceof EmbedBuilder
          ? response
          : musicEmbed(commandTitles[interaction.commandName] ?? 'Music', response);
      embed.setFooter({
        text: `Requested by ${interaction.user.displayName}`,
        iconURL: interaction.user.displayAvatarURL(),
      });
      await interaction.editReply({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      if (!(error instanceof MusicCommandError)) console.error(`/${interaction.commandName} failed:`, error);
      await interaction.editReply({
        embeds: [
          musicEmbed(
            'Unable to complete command',
            error instanceof MusicCommandError ? error.message : 'The command failed. Check the bot logs for details.',
            0xed4245,
          ).setFooter({ text: `/${interaction.commandName} • ${interaction.user.displayName}` }),
        ],
        allowedMentions: { parse: [] },
      });
    }
  };
}

/**
 * Resolve the invoking member's voice channel.
 * @param interaction Cached guild interaction.
 * @returns The member's current voice channel.
 */
export function requireVoiceChannel(interaction: ChatInputCommandInteraction<'cached'>) {
  const channel = interaction.member.voice.channel;
  if (!channel) throw new MusicCommandError('Join a voice channel first.');
  return channel;
}

/**
 * Resolve a connected queue and require the member to share its voice channel.
 * @param interaction Cached guild interaction.
 * @returns This server's connected music queue.
 */
export function requireQueue(interaction: ChatInputCommandInteraction<'cached'>): GuildQueue<QueueMetadata> {
  const channel = requireVoiceChannel(interaction);
  const queue = player.queues.get<QueueMetadata>(interaction.guildId);
  if (!queue?.node.session) throw new MusicCommandError('There is no connected music queue. Use /play or /join first.');
  if (queue.node.session.channelId !== channel.id) {
    throw new MusicCommandError('Join my voice channel to control playback.');
  }
  return queue;
}

/**
 * Resolve a current managed Track, including paused playback.
 * @param queue Queue to inspect.
 * @returns The current Track.
 */
export function requireTrack(queue: GuildQueue): Track {
  if (!queue.currentTrack) throw new MusicCommandError('There is no track playing.');
  return queue.currentTrack;
}

/**
 * Format a short Track title for Discord messages.
 * @param track Track to display.
 * @returns An escaped title without exposing media URL credentials.
 */
export function displayTrack(track: Track): string {
  return `**${escapeMarkdown((track.title || 'Untitled track').slice(0, 120))}**`;
}

/**
 * Format a media position for command output.
 * @param milliseconds Media position or duration in milliseconds.
 * @returns A minutes/seconds or hours/minutes/seconds label.
 */
export function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}
