import { Collection } from '@discord-player/utils';
import { DiscordGatewayAdapterLibraryMethods, joinVoiceChannel, VoiceConnection } from '@discordjs/voice';
import { WorkerEvents } from '../utils/enums';
import { AudioNode } from './AudioNode';
import { notify } from './notifier';

export interface SubscriptionPayload {
    channelId: string;
    guildId: string;
    deafen?: boolean;
}

export class SubscriptionClient {
    public subscriptions = new Collection<string, AudioNode>();
    public adapters = new Collection<string, DiscordGatewayAdapterLibraryMethods>();
    public constructor(public clientId: string) {}

    public connect(config: SubscriptionPayload) {
        const voiceConnection = joinVoiceChannel({
            channelId: config.channelId,
            guildId: config.guildId,
            selfDeaf: Boolean(config.deafen),
            adapterCreator: (adapter) => {
                this.adapters.set(config.guildId, adapter);
                return {
                    sendPayload: (payload) => {
                        notify({
                            t: WorkerEvents.VOICE_STATE_UPDATE,
                            d: payload
                        });
                        return true;
                    },
                    destroy: () => {
                        this.adapters.delete(config.guildId);
                        this.subscriptions.delete(config.guildId);
                        notify({
                            t: WorkerEvents.CONNECTION_DESTROY,
                            d: {
                                client_id: this.clientId,
                                guild_id: config.guildId,
                                channel_id: config.channelId
                            }
                        });
                    }
                };
            }
        });

        this.subscriptions.set(voiceConnection.joinConfig.guildId, new AudioNode(voiceConnection, this.clientId));
    }

    public disconnect(config: Pick<SubscriptionPayload, 'guildId'>) {
        const node = this.subscriptions.get(config.guildId);
        if (node) {
            node.connection.destroy();
            this.subscriptions.delete(config.guildId);
        }
    }

    public disconnectAll() {
        for (const [id, node] of this.subscriptions) {
            node.connection.destroy();
            this.subscriptions.delete(id);
        }
    }
}
