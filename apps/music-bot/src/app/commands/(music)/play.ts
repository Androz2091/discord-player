import { ChatInputCommand } from 'commandkit';
import { useMainPlayer } from 'discord-player';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('The song to play')
      .setRequired(true),
  );

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  if (!interaction.inCachedGuild()) return;

  const player = useMainPlayer();

  const channel = interaction.member?.voice.channel;

  if (!channel) {
    return interaction.reply({
      content: 'You must be in a voice channel to use this command.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const query = interaction.options.getString('query')!;

  // @ts-ignore
  const result = await player.play(channel, query, {
    nodeOptions: {
      metadata: {
        channel: interaction.channel,
      },
      enableStreamInterceptor: true,
      volume: 50,
      disableReverb: false,
      disableCompressor: false,
      disableSeeker: true,
    },
  });

  await interaction.editReply(`Playing ${result.track} in ${channel}`);
};
