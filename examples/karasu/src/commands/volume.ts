import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'A basic slash command'
})
export class VolumeCommand extends Command {
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
			const queue = this.container.client.player.nodes.get(interaction.guild?.id!);
			const permissions = this.container.client.perms.voice(interaction, this.container.client);
			const volume = interaction.options.getInteger('amount');

			if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
			if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });
			if (!queue.currentTrack)
				return interaction.reply({ content: `${this.container.client.dev.error} | There is nothing playing`, ephemeral: true });

			await interaction.deferReply();

			if (typeof volume !== 'number') {
				return interaction.followUp({
					content: `🔊 | Current volume is **${queue.node.volume}%**`
				});
			} else {
				queue.node.setVolume(volume!);
				return interaction.followUp({
					content: `${this.container.client.dev.success} | I changed the volume to: **${queue.node.volume}%**`
				});
			}
		}
	}
}
