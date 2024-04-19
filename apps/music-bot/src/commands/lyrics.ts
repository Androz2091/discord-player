import { Command } from '@sapphire/framework';
import { useQueue, useMainPlayer } from 'discord-player';
import { EmbedBuilder } from 'discord.js';

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
					return option.setName('name').setDescription('The track of the lyrics to search');
				});
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const player = useMainPlayer();
		const queue = useQueue(interaction.guild!.id);
		const track = interaction.options.getString('name') || (queue?.currentTrack?.title as string);

		const results = await player.lyrics
			.search({
				q: track
			})
			.catch((e) => {
				console.log(e);
			});

		const lyrics = results?.[0];
		console.log(lyrics);
		if (!lyrics?.plainLyrics)
			return interaction.reply({ content: `${this.container.client.dev.error} | There are **no** lyrics for this track`, ephemeral: true });

		const syncedLyrics = queue?.syncedLyrics(lyrics);

		syncedLyrics?.onChange(async (lyrics, timestamp) => {
			console.log(timestamp, lyrics);
			await interaction.channel?.send({
				content: `[${timestamp}]: ${lyrics}`
			});
		});

		syncedLyrics?.subscribe();

		const trimmedLyrics = lyrics.plainLyrics.substring(0, 1997);

		const embed = new EmbedBuilder()
			.setTitle(lyrics.trackName)
			.setAuthor({
				name: lyrics.artistName
			})
			.setDescription(trimmedLyrics.length === 1997 ? `${trimmedLyrics}...` : trimmedLyrics)
			.setColor('Yellow');

		return interaction.reply({ embeds: [embed] });
	}
}
