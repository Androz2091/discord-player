import { lyricsExtractor } from '@discord-player/extractor';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';
import { EmbedBuilder } from 'discord.js';

const genius = lyricsExtractor();

export class LyricsCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Displays lyrics of the given track'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((option) => {
					return option.setName('track').setDescription('The track of the lyrics to search');
				});
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const queue = useQueue(interaction.guild!.id);
		const track = interaction.options.getString('track') || (queue?.currentTrack?.title as string);
		const lyrics = await genius.search(track).catch(() => null);

		if (!lyrics)
			return interaction.reply({ content: `${this.container.client.dev.error} | There are **no** lyrics for this track`, ephemeral: true });
		const trimmedLyrics = lyrics.lyrics.substring(0, 1997);

		const embed = new EmbedBuilder()
			.setTitle(lyrics.title)
			.setURL(lyrics.url)
			.setThumbnail(lyrics.thumbnail)
			.setAuthor({
				name: lyrics.artist.name,
				iconURL: lyrics.artist.image,
				url: lyrics.artist.url
			})
			.setDescription(trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics)
			.setColor('Yellow');

		return interaction.reply({ embeds: [embed] });
	}
}
