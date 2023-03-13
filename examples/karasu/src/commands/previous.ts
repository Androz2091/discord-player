import { Command } from '@sapphire/framework';
import { useHistory, useQueue } from 'discord-player';

export class PreviousCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Plays the previous track'
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
		const queue = useQueue(interaction.guild!.id);
		const history = useHistory(interaction.guild!.id);
		const permissions = this.container.client.perms.voice(interaction, this.container.client);

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am **not** in a voice channel`, ephemeral: true });
		if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

		if (!history?.previousTrack)
			return interaction.reply({
				content: `${this.container.client.dev.error} | There is **no** previous track in the **history**`,
				ephemeral: true
			});

		await history.previous();
		return interaction.reply({
			content: `🔁 | I am **replaying** the previous track`
		});
	}
}
