import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { useHistory } from 'discord-player';

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
			const history = useHistory(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);

			if (!history) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

			if (!history.previousTrack) return interaction.reply({ content: 'No previous track in history!', ephemeral: true });

			await interaction.deferReply();

			await history.previous();

			return interaction.followUp({
				content: `⏯ | I have skipped to the next track`
			});
		}
	}
}
