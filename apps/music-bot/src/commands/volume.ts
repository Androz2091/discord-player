import { Command } from '@sapphire/framework';
import { useQueue, useTimeline } from 'discord-player';

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
					option.setName('amount').setDescription('The amount of volume you want to change to').setMinValue(0).setMaxValue(100)
				);
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const queue = useQueue(interaction.guild!.id);
		const timeline = useTimeline(interaction.guild!.id)!;
		const permissions = this.container.client.perms.voice(interaction, this.container.client);
		const volume = interaction.options.getInteger('amount');

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am not in a voice channel`, ephemeral: true });
		if (!queue.currentTrack)
			return interaction.reply({ content: `${this.container.client.dev.error} | There is no track **currently** playing`, ephemeral: true });
		if (!volume) return interaction.reply({ content: `🔊 | **Current** volume is **${timeline.volume}%**` });
		if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

		timeline.setVolume(volume!);
		return interaction.reply({
			content: `${this.container.client.dev.success} | I **changed** the volume to: **${timeline.volume}%**`
		});
	}
}
