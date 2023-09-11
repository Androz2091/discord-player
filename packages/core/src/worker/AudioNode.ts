import { createAudioPlayer, createAudioResource, StreamType, VoiceConnection } from 'discord-voip';

export interface NodePlayerOptions {
    query: string;
    metadata: unknown;
    initialVolume?: number;
}

export class AudioNode {
    public audioPlayer = createAudioPlayer();
    public constructor(public connection: VoiceConnection, public client: string) {
        connection.subscribe(this.audioPlayer);
    }

    public get guild() {
        return this.connection.joinConfig.guildId;
    }

    public get channel() {
        return this.connection.joinConfig.channelId;
    }

    public play(options: NodePlayerOptions) {
        const resource = createAudioResource(options.query, {
            inputType: StreamType.Arbitrary,
            inlineVolume: typeof options.initialVolume === 'number',
            metadata: options.metadata
        });

        if ('initialVolume' in options && resource.volume) {
            resource.volume.setVolumeLogarithmic(options.initialVolume!);
        }

        this.audioPlayer.play(resource);
    }

    public destroy() {
        this.connection.destroy();
    }
}
