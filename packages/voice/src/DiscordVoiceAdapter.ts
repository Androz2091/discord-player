import { DiscordGatewayAdapterLibraryMethods } from 'discord-voip';
import { GatewayVoiceServerUpdateDispatch, GatewayVoiceStateUpdateDispatch } from 'discord-api-types/v10';
import { VoiceManager } from './VoiceManager';

export type VoiceAdapterData = DiscordGatewayAdapterLibraryMethods & {
    id: string;
};

export type VoiceAdapterIncomingPayload = GatewayVoiceServerUpdateDispatch | GatewayVoiceStateUpdateDispatch;

export class DiscordVoiceAdapter {
    public constructor(public readonly manager: VoiceManager, public methods: VoiceAdapterData) {}

    public onPayload(data: VoiceAdapterIncomingPayload) {
        void data;
    }

    public sendPayload(data: unknown) {
        // return this.manager.emit('payload', data);
        void data;
    }

    public destroy() {
        this.manager.internalAdaptersCache.delete(this.methods.id);
    }
}
