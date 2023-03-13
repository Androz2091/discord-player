import { Command } from '@sapphire/framework';
import { useQueue } from 'discord-player';

export class removeCommand extends Command {
	public constructor(context: Command.Context, options: Command.Options) {
		super(context, {
			...options,
			description: 'Removes the given track'
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => {
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addIntegerOption((option) =>
					option.setName('track').setDescription('The track you want to remove').setMinValue(1).setRequired(true).setAutocomplete(true)
				);
		});
	}

	public override async autocompleteRun(interaction: Command.AutocompleteInteraction) {
		const queue = useQueue(interaction.guild!.id);
		const track = interaction.options.getInteger('track');
		const remove = queue?.tracks.at(track!);
		const position = queue?.node.getTrackPosition(remove!);

		const tracks = queue!.tracks.map((t, idx) => ({
			name: t.title,
			value: ++idx
		}));

		if (remove?.title && !tracks.some((t) => t.name === remove.title)) {
			tracks.unshift({
				name: remove.title,
				value: position!
			});
		}

		let slicedTracks = tracks.slice(0, 5);
		if (track) {
			slicedTracks = tracks.slice(track - 1, track + 4);
			if (slicedTracks.length > 5) {
				slicedTracks = slicedTracks.slice(0, 5);
			}
		}

		return interaction.respond(slicedTracks);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const queue = useQueue(interaction.guild!.id);
		const permissions = this.container.client.perms.voice(interaction, this.container.client);

		if (!queue) return interaction.reply({ content: `${this.container.client.dev.error} | I am **not** in a voice channel`, ephemeral: true });
		if (!queue.tracks)
			return interaction.reply({ content: `${this.container.client.dev.error} | There are **no tracks** to **remove**`, ephemeral: true });
		if (permissions.clientToMember()) return interaction.reply({ content: permissions.clientToMember(), ephemeral: true });

		const remove = interaction.options.getInteger('track')! - 1;
		const trackResolvable = queue.tracks.at(remove!);

		if (!trackResolvable)
			return interaction.reply({ content: `${this.container.client.dev.error} | The **requested track** doesn't **exist**`, ephemeral: true });

		queue.node.remove(trackResolvable);
		return interaction.reply({
			content: `${this.container.client.dev.success} | I have **removed** the track: **${trackResolvable.title}**`
		});
	}
}
