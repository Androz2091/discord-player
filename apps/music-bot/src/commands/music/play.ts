import { SlashCommandProps } from 'commandkit';
import { useMainPlayer } from 'discord-player';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('The song to play')
      .setRequired(true),
  );

export async function run({ interaction }: SlashCommandProps) {
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

  const result = await player.play(channel, query, {
    nodeOptions: {
      metadata: {
        channel: interaction.channel,
      },
      enableStreamInterceptor: true,
      volume: 50,
      disableReverb: true,
      disableCompressor: false,
      disableSeeker: true,
    },
  });

  await interaction.editReply(`Playing ${result.track} in ${channel}`);
}
