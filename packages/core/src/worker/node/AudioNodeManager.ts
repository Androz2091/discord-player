import { Collection } from '@discord-player/utils';
import { AudioNode, VoiceConnectionCreateOptions } from './AudioNode';
import { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from 'discord-voip';
import type { WorkerListener } from '../entrypoint';

export class AudioNodeManager {
    /**
     * The nodes collection mapped by voice channel id.
     */
    public nodes = new Collection<string, AudioNode>();

    /**
     * The transmitters collection mapped by guild id, used to receive gateway events.
     */
    public transmitters = new Collection<string, DiscordGatewayAdapterLibraryMethods>();

    /**
     * Creates a new audio node manager.
     * @param worker The worker listener.
     */
    public constructor(public readonly worker: WorkerListener) {}

    /**
     * Creates a voice connection.
     * @param data The voice connection create options.
     */
    public connect(data: VoiceConnectionCreateOptions) {
        const transmitter: DiscordGatewayAdapterCreator = (methods) => {
            const { guildId } = data;

            this.transmitters.set(guildId, methods);

            return {
                sendPayload: (payload) => {
                    void payload;
                    return true;
                },
                destroy: () => {
                    this.transmitters.delete(guildId);
                },
            };
        };

        const node = AudioNode.create(this, data, transmitter);

        this.nodes.set(data.channelId, node);

        return node;
    }
}
