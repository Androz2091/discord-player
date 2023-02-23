import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';

export class PreviousCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Plays previous track'
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
		if (interaction.member instanceof GuildMember) {
			const queue = this.container.client.player.nodes.get(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

			if (!queue.history.previousTrack) return interaction.reply({ content: 'No previous track in queue!', ephemeral: true });

			await interaction.deferReply();

			await queue.history.previous();

			return interaction.followUp({
				content: `⏯ | I have skipped to the next track`
			});
		}
	}
}
