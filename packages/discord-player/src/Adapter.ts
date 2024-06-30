import { unsafe } from './common/types';
import type { Player } from './Player';

export type OnGatewayPacket = (packet: unsafe) => void;

export interface IVoiceStateUpdateData {
    guild: string;
    channel: string;
    user: string;
    me: string;
    selfDeaf: boolean;
    selfMute: boolean;
    serverDeaf: boolean;
    serverMute: boolean;
    suppress: boolean;
    memberCount: number;
}

export type VoiceStateUpdateDispatch = (oldState: IVoiceStateUpdateData, newState: IVoiceStateUpdateData) => void;

export interface AdapterImpl {
    onPacket: OnGatewayPacket;
    handleVoiceStateUpdate: VoiceStateUpdateDispatch;
}

export class Adapter<T> implements AdapterImpl {
    protected player!: Player;

    public constructor(protected readonly metadata: T) {}

    public setPlayer(player: Player): void {
        this.player = player;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    public onPacket(packet: unsafe): void {
        throw new Error('Not implemented');
    }

    public handleVoiceStateUpdate(oldState: IVoiceStateUpdateData, newState: IVoiceStateUpdateData): void {
        throw new Error('Not implemented');
    }

    public getVoiceChannelMembersCount(guild: string, channel: string): number {
        throw new Error('Not implemented');
    }

    public isStageChannel(guild: string, channel: string): boolean {
        throw new Error('Not implemented');
    }

    public isVoiceChannel(guild: string, channel: string): boolean {
        throw new Error('Not implemented');
    }

    public resolveChannel(channel: string): string {
        throw new Error('Not implemented');
    }

    public resolveGuild(guild: string): string {
        throw new Error('Not implemented');
    }

    public resolveGuildByChannel(channel: string): string {
        throw new Error('Not implemented');
    }

    public resolveUser(user: string): string {
        throw new Error('Not implemented');
    }

    public setRequestToSpeak(guild: string, channel: string, value: boolean): void {
        throw new Error('Not implemented');
    }

    public sendPacket(packet: unsafe): void {
        throw new Error('Not implemented');
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */
}
