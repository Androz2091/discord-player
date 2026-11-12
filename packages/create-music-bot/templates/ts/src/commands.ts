import {
  ApplicationCommandOptionType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputApplicationCommandData,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { GuildQueue, Player } from 'discord-player';
import type { Config } from './config.ts';
import { formatTitle, type QueueMetadata } from './events.ts';
import { checkMediaUrl } from './media-source.ts';

/** A slash command and its handler. */
export interface Command {
  /** Definition registered with Discord. */
  data: ChatInputApplicationCommandData;

  /** Runs the command. */
  run(interaction: ChatInputCommandInteraction<'cached'>): Promise<unknown>;
}

/** How many upcoming tracks `/queue` lists. */
const QUEUE_PAGE_SIZE = 10;

/** Replies that only the sender can see. */
function reject(interaction: ChatInputCommandInteraction<'cached'>, content: string) {
  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

/** Replies publicly without mentioning anyone. */
function say(interaction: ChatInputCommandInteraction<'cached'>, content: string) {
  return interaction.reply({ content, allowedMentions: { parse: [] } });
}

/** Builds a command that takes no options and is registered in servers only. */
function simple(
  name: string,
  description: string,
  run: (interaction: ChatInputCommandInteraction<'cached'>) => Promise<unknown>,
): Command {
  return { data: { name, description, contexts: [InteractionContextType.Guild] }, run };
}

/**
 * Builds the bot's commands.
 *
 * @param player Player that owns the queues.
 * @param config Bot configuration.
 */
export function createCommands(player: Player, config: Config): Command[] {
  /** Finds the queue the member is allowed to control, or explains why they cannot. */
  function findQueue(
    interaction: ChatInputCommandInteraction<'cached'>,
  ): { queue: GuildQueue<QueueMetadata> } | { error: string } {
    const queue = player.getQueue<QueueMetadata>(interaction.guildId);

    if (!queue) return { error: 'Nothing is queued. Start with `/play`.' };

    if (interaction.member.voice.channelId !== queue.node.session?.channelId) {
      return { error: 'Join the voice channel the bot is in to control playback.' };
    }

    return { queue };
  }

  const play: Command = {
    data: {
      name: 'play',
      description: 'Play an audio file from a direct link',
      contexts: [InteractionContextType.Guild],
      options: [
        {
          name: 'url',
          description: 'Link to an audio file on an allowed host',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },

    async run(interaction) {
      const query = interaction.options.getString('url', true);

      if (config.allowedMediaHosts.length === 0) {
        return reject(interaction, 'Playback is disabled. Set ALLOWED_MEDIA_HOSTS in `.env` and restart the bot.');
      }

      const checked = checkMediaUrl(query, config.allowedMediaHosts);

      if ('error' in checked) return reject(interaction, checked.error);

      const channel = interaction.member.voice.channel;

      if (!channel) return reject(interaction, 'Join a voice channel first.');

      const permissions = channel.permissionsFor(interaction.guild.members.me ?? interaction.client.user);

      if (
        !permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])
      ) {
        return reject(interaction, 'I need permission to view, connect to, and speak in your voice channel.');
      }

      const botChannelId = player.getQueue(interaction.guildId)?.node.session?.channelId;

      if (botChannelId && botChannelId !== channel.id) {
        return reject(interaction, `I am already playing in <#${botChannelId}>.`);
      }

      // Searching and connecting can take longer than Discord's 3 second reply window.
      await interaction.deferReply();

      const result = await player.search(checked.url.href, { requestedBy: interaction.user.id }).catch((error) => {
        console.error(`Could not read ${checked.url.href}:`, error);

        return null;
      });

      if (!result || result.isEmpty()) {
        return interaction.editReply('I could not read audio from that link.');
      }

      const metadata: QueueMetadata = { channel: interaction.channel };
      const { track, queue } = await player.play(channel, result, {
        nodeOptions: { metadata, leaveOnEnd: true, leaveOnEndCooldown: 30_000 },
      });

      if (!track) return interaction.editReply('I could not read audio from that link.');

      return interaction.editReply({
        content: `Added ${formatTitle(track.title)} (${queue.size} waiting in the queue).`,
        allowedMentions: { parse: [] },
      });
    },
  };

  const pause = simple('pause', 'Pause playback', async (interaction) => {
    const found = findQueue(interaction);

    if ('error' in found) return reject(interaction, found.error);

    if (found.queue.node.isPaused()) return reject(interaction, 'Playback is already paused.');

    await found.queue.node.pause();

    return say(interaction, 'Paused.');
  });

  const resume = simple('resume', 'Resume playback', async (interaction) => {
    const found = findQueue(interaction);

    if ('error' in found) return reject(interaction, found.error);

    if (!found.queue.node.isPaused()) return reject(interaction, 'Playback is not paused.');

    await found.queue.node.resume();

    return say(interaction, 'Resumed.');
  });

  const skip = simple('skip', 'Skip the current track', async (interaction) => {
    const found = findQueue(interaction);

    if ('error' in found) return reject(interaction, found.error);

    if (!found.queue.currentTrack) return reject(interaction, 'Nothing is playing.');

    // Skipping needs time to prepare the next track.
    await interaction.deferReply();

    const next = await found.queue.skip();

    return interaction.editReply({
      content: next ? `Skipped. Now playing ${formatTitle(next.title)}.` : 'Skipped. The queue is empty.',
      allowedMentions: { parse: [] },
    });
  });

  const stop = simple('stop', 'Stop playback, clear the queue, and leave', async (interaction) => {
    const found = findQueue(interaction);

    if ('error' in found) return reject(interaction, found.error);

    await interaction.deferReply();
    await found.queue.delete();

    return interaction.editReply('Stopped playback, cleared the queue, and left the voice channel.');
  });

  const queue = simple('queue', 'Show what is playing and what is next', async (interaction) => {
    const found = player.getQueue<QueueMetadata>(interaction.guildId);
    const current = found?.currentTrack;

    if (!found || !current) return reject(interaction, 'The queue is empty.');

    const upcoming = found.tracks.toArray();
    const lines = upcoming.slice(0, QUEUE_PAGE_SIZE).map((track, index) => `${index + 1}. ${formatTitle(track.title)}`);

    if (upcoming.length > QUEUE_PAGE_SIZE) lines.push(`…and ${upcoming.length - QUEUE_PAGE_SIZE} more`);

    return say(interaction, [`Now playing: ${formatTitle(current.title)}`, ...lines].join('\n'));
  });

  return [play, pause, resume, skip, stop, queue];
}
