import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { usePlayer } from 'discord-player';

export class PauseCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Pauses or resumes the current track'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addBooleanOption((option) => option.setName('state').setDescription('The paused state to set to').setRequired(true));
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const player = usePlayer(interaction.guild!.id);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const state = interaction.options.getBoolean('state') as boolean;

			if (!player) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

			if (!player.queue.currentTrack)
				return interaction.reply({
					content: `${this.container.client.dev.error} | There is no track **currently** playing`,
					ephemeral: true
				});

			await interaction.deferReply();

			const result = player.setPaused(state);

			return interaction.followUp({
				content: `${this.container.client.dev.success} | **Playback** has been **${result ? 'paused' : 'resumed'}**`
			});
		}
	}
}
