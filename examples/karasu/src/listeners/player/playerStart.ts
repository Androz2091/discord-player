import { container, Listener } from '@sapphire/framework';
import { PermissionsBitField } from 'discord.js';

export class PlayerEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			emitter: container.client.player.events,
			event: 'playerStart'
		});
	}

	public run(queue, track) {
		const resolved = new PermissionsBitField([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);
		const missingPerms = queue.metadata.channel.permissionsFor(queue.metadata.client).missing(resolved);
		if (missingPerms.length) return;

		return queue.metadata.channel
			.send(`▶ | Now playing: **${track.title || 'Unknown Title'}**`)
			.then((m: { delete: () => void }) => setTimeout(() => m.delete(), 5000));
	}
}
