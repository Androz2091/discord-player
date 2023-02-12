import { ApplyOptions } from '@sapphire/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { Command } from '@sapphire/framework';

@ApplyOptions<Command.Options>({
	description: 'Displays the queue'
})
export class QueueCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const queue = this.container.client.player.nodes.get(interaction.guild?.id!);

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
		if (!queue.tracks || !queue.currentTrack)
			return interaction.reply({ content: `${this.container.client.dev.error} | There is no queue`, ephemeral: true });

		await interaction.deferReply();

		const { title, url } = queue.currentTrack;
		let pagesNum = Math.ceil(queue.tracks.size / 5);

		if (pagesNum === 0) {
			pagesNum = 1;
		}

		const tracks: any = [];
		for (let i = 0; i < queue.tracks.size; i++) {
			const song = queue.tracks.toArray()[i];
			tracks.push(
				`**${i + 1})** [${song.title}](${song.url})
		`
			);
		}

		const paginatedMessage = new PaginatedMessage();

		// handle error if pages exceed 25 pages
		if (pagesNum > 25) pagesNum = 25;

		for (let i = 0; i < pagesNum; i++) {
			const str = tracks.slice(i * 5, i * 5 + 5).join('');

			paginatedMessage.addPageEmbed((embed) =>
				embed
					.setColor('Red')
					.setDescription(
						`**Queue** for **session** in **${queue.channel?.name}:**\n${str === '' ? '*No more queued songs*' : `\n${str}`}
						**Now Playing:** [${title}](${url})\n`
					)
					.setFooter({
						text: `${queue.tracks.size} song(s) in queue`
					})
			);
		}

		return paginatedMessage.run(interaction);
	}
}
