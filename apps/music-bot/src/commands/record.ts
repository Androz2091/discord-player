import { EndBehaviorType } from 'discord-voip';
import { Command } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { createWriteStream } from 'fs';

export class RecordCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Records and plays back the recording'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addUserOption((option) => {
					return option.setName('user').setRequired(false).setDescription('The user to record');
				});
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const member = interaction.member as GuildMember;
		const user = interaction.options.getUser('user');
		const target = user ? interaction.guild!.members.resolve(user) : interaction.guild!.members.resolve(member);
		const permissions = this.container.client.perms.voice(interaction, this.container.client);

		if (permissions.member(target)) return interaction.reply({ content: permissions.member(target), ephemeral: true });
		if (permissions.client()) return interaction.reply({ content: permissions.client(), ephemeral: true });
		if (permissions.memberToMember(target)) return interaction.reply({ content: permissions.memberToMember(target), ephemeral: true });
		if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

		await interaction.deferReply();

		const queue = this.container.client.player.nodes.create(interaction.guildId!, {
			// just in case if someone decides to play music
			metadata: {
				channel: interaction.channel,
				client: interaction.guild?.members.me,
				requestedBy: interaction.user.username
			},
			leaveOnEmptyCooldown: 300000,
			leaveOnEmpty: true,
			leaveOnEnd: false,
			bufferingTimeout: 0
		});

		try {
			await queue.connect(member.voice.channelId!, { deaf: false });
		} catch {
			return interaction.followUp('Failed to connect to your channel');
		}

		const stream = queue.voiceReceiver?.recordUser(target!.id, {
			mode: 'pcm',
			end: EndBehaviorType.AfterSilence
		});
		if (!stream) return interaction.followUp('Failed to record that user');

		stream.once('error', (err) => {
			console.error(err);
			if (interaction.isRepliable()) interaction.followUp('Something went wrong while recording!');
			queue.delete();
		});

		const writer = stream.pipe(createWriteStream(`${this.container.client.recordingPath}/recording-${target!.id}.pcm`));
		writer.once('finish', () => {
			if (interaction.isRepliable()) interaction.followUp(`Finished writing audio!`);
			queue.delete();
		});

		writer.once('error', (err) => {
			console.error(err);
			if (interaction.isRepliable()) interaction.followUp('Something went wrong while recording!');
			queue.delete();
		});
	}
}
