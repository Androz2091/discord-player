import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';

export class QueueCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Displays the queue in an embed'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const queue = useQueue(interaction.guild?.id!);

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
		if (!queue.tracks || !queue.currentTrack)
			return interaction.reply({ content: `${this.container.client.dev.error} | There is no queue`, ephemeral: true });

		await interaction.deferReply();

		let pagesNum = Math.ceil(queue.tracks.size / 5);

		if (pagesNum <= 0) {
			pagesNum = 1;
		}

		const tracks = queue.tracks.toArray().map((track, idx) => `**${++idx})** [${track.title}](${track.url})`);

		const paginatedMessage = new PaginatedMessage();

		// handle error if pages exceed 25 pages
		if (pagesNum > 25) pagesNum = 25;

		for (let i = 0; i < pagesNum; i++) {
			const list = tracks.slice(i * 5, i * 5 + 5).join('\n');

			paginatedMessage.addPageEmbed((embed) =>
				embed
					.setColor('Red')
					.setTitle('Tracks Queue')
					.setDescription(list || '**No more queued songs**')
					.addFields([{ name: '💿 Now Playing', value: `[${queue.currentTrack?.title}](${queue.currentTrack?.url})` }])
					.setFooter({
						text: `Page ${i + 1} of ${pagesNum} | Total ${queue.tracks.size} tracks`
					})
			);
		}

		return paginatedMessage.run(interaction);
	}
}
