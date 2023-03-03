import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { usePlayer } from 'discord-player';

export class VolumeCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Changes the volume of the track and entire queue'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addIntegerOption((option) =>
					option
						.setName('amount')
						.setDescription('The amount of volume you want to change to')
						.setMinValue(0)
						.setMaxValue(100)
						.setRequired(false)
				);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member instanceof GuildMember) {
			const player = usePlayer(interaction.guildId!);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const volume = interaction.options.getInteger('amount');

			if (!player) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!player.queue.currentTrack)
				return interaction.reply({
					content: `${this.container.client.dev.error} | There is no track **currently** playing`,
					ephemeral: true
				});

			await interaction.deferReply();

			if (typeof volume !== 'number') {
				return interaction.followUp({
					content: `🔊 | **Current** volume is **${player.volume}%**`
				});
			}
			player.setVolume(volume!);
			return interaction.followUp({
				content: `${this.container.client.dev.success} | I **changed** the volume to: **${player.volume}%**`
			});
		}
	}
}
