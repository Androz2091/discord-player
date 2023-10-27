import { Listener } from '@sapphire/framework';
import { useMainPlayer } from 'discord-player';

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
			// await player.extractors.loadDefault(/* (ext) => ext !== 'YouTubeExtractor' */);
			// console.log(player.scanDeps());
			await player.extractors.loadDefault((ext) => ext === 'YouTubeExtractor' || ext === 'SpotifyExtractor' || ext === 'AttachmentExtractor');
		}
	}
}
