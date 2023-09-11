import { container, Listener } from '@sapphire/framework';
import type { GuildQueue, Track } from 'discord-player';
import { Client, GuildTextBasedChannel, PermissionsBitField } from 'discord.js';

export class PlayerEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			emitter: container.client.player.events,
			event: 'audioTrackAdd'
		});
	}

	public run(
		queue: GuildQueue<{
			channel: GuildTextBasedChannel;
			client: Client<true>;
		}>,
		track: Track
	) {
		const resolved = new PermissionsBitField([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);
		const missingPerms = queue.metadata.channel.permissionsFor(queue.metadata.client!.user)?.missing(resolved);
		if (missingPerms?.length) return;

		return queue.metadata.channel.send({
			embeds: [
				{
					title: 'Track Added!',
					description: `🎵 | Track **${track.title || 'Unknown Title'}** added to the queue!`,
					color: 0xffaaaa,
					footer: {
						text: `Extractor: ${track.extractor?.identifier || 'N/A'}`
					},
					thumbnail: {
						url: track.thumbnail
					}
				}
			]
		});
	}
}
