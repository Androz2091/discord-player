import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { usePlayer } from 'discord-player';

export class SkipCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Skips the current track and automatically plays the next'
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
			const player = usePlayer(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);

			if (!player) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

			await interaction.deferReply();

			player.skip();
			return interaction.followUp({
				content: `⏯ | I have skipped to the next track`
			});
		}
	}
}
