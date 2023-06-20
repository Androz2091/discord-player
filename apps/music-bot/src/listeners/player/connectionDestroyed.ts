import { container, Listener } from '@sapphire/framework';
import type { GuildQueue } from 'discord-player';

export class PlayerEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			emitter: container.client.player.events,
			event: 'connectionDestroyed'
		});
	}

	public run(queue: GuildQueue) {
		console.log(`Voice connection destroyed for ${queue.guild.name}`);
		queue.delete();
	}
}
