import { Collection } from '@discord-player/utils';
import { AudioPlayer, NoSubscriberBehavior } from '@discordjs/voice';

export class AudioPlayerRegistry {
    /**
     * The collection to store audio players
     */
    public store = new Collection<string, AudioPlayer>();

    /**
     * Resolve audio player instance by its name
     * @param name The name of the audio player
     * @returns Existing audio player or a new instance if it does not exist
     */
    public resolve(name: string) {
        if (this.store.has(name)) return this.store.get(name)!;

        const audioPlayer = new AudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        });

        this.store.set(name, audioPlayer);

        return audioPlayer;
    }

    /**
     * Remove the given audio player from this registry
     * @param name The name of the audio player to remove
     * @returns `true` if the audio player was successfully removed
     */
    public remove(name: string) {
        const player = this.store.get(name);
        if (!player) return false;

        player.stop(true);
        this.store.delete(name);

        return true;
    }

    /**
     * Clears all audio players from this registry
     */
    public clear() {
        for (const [name, player] of this.store) {
            player.stop(true);
            this.store.delete(name);
        }
    }
}

/**
 * The default registry instance
 */
export const audioPlayerRegistry = new AudioPlayerRegistry();
