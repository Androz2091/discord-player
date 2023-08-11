import { Listener } from '@sapphire/framework';
import { useMainPlayer } from 'discord-player';
import { YouTubeExtractor } from '@discord-player/extractor';

export class UserEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			once: true
		});
	}

	public async run() {
		console.log(`Logged in as ${this.container.client.user?.username}`);

		const player = useMainPlayer();
		if (player) {
			await player.extractors.loadDefault();
			console.log(player.scanDeps());
		}
	}
}
