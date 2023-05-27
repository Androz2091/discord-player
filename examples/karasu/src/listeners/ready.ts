import { Listener } from '@sapphire/framework';
import { useMasterPlayer } from 'discord-player';
import { SpotifyExtractor } from '@discord-player/extractor';

export class UserEvent extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			once: true
		});
	}

	public async run() {
		console.log(`Logged in as ${this.container.client.user?.username}`);

		const player = useMasterPlayer();
		if (player) {
			await player.extractors.register(SpotifyExtractor, {
				bridgeFrom: "Soundcloud"
			})
			
			await player.extractors.loadDefault();
		}
	}
}
