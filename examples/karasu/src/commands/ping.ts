import { ApplyOptions } from '@sapphire/decorators';
import { isMessageInstance } from '@sapphire/discord.js-utilities';
import { Command } from '@sapphire/framework';
import { ApplicationCommandType } from 'discord.js';

@ApplyOptions<Command.Options>({
	description: 'ping pong'
})
export class PingCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description);
		});
		registry.registerContextMenuCommand((builder) => {
			builder //
				.setName(this.name)
				.setType(ApplicationCommandType.Message);
		});
		registry.registerContextMenuCommand((builder) => {
			builder //
				.setName(this.name)
				.setType(ApplicationCommandType.User);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const msg = await interaction.reply({ content: `Ping?`, ephemeral: true, fetchReply: true });

		if (isMessageInstance(msg)) {
			const diff = msg.createdTimestamp - interaction.createdTimestamp;
			const ping = Math.round(this.container.client.ws.ping);
			return interaction.editReply(`Pong 🏓! The round trip took: ${diff}ms. Heartbeat: ${ping}ms.)`);
		}

		return interaction.editReply('Failed to retrieve ping :(');
	}

	// context menu command
	public async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
		const msg = await interaction.reply({ content: `Ping?`, ephemeral: true, fetchReply: true });

		if (isMessageInstance(msg)) {
			const diff = msg.createdTimestamp - interaction.createdTimestamp;
			const ping = Math.round(this.container.client.ws.ping);
			return interaction.editReply(`Pong 🏓! The round trip took: ${diff}ms. Heartbeat: ${ping}ms.)`);
		}

		return interaction.editReply('Failed to retrieve ping :(');
	}
}
