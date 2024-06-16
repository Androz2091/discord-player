import { unsafe } from './common/types';
import { getPlayerAdapterContext } from './context';
import { Player } from './player';

export type OnGatewayPacket = (packet: unsafe) => void;

export interface IAdapter<T> {
    metadata: T;
    sendPacket: (packet: unsafe) => void;
    resolveGuild(guild: string): string;
    resolveGuildByChannel(channel: string): string;
    resolveChannel(channel: string): string;
    resolveUser(user: string): string;
    setRequestToSpeak(guild: string, channel: string, value: boolean): void;
    isVoiceChannel(guild: string, channel: string): boolean;
    isStageChannel(guild: string, channel: string): boolean;
    getVoiceChannelMembersCount(guild: string, channel: string): number;
}

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
    public readonly player: Player<T>;
    public constructor(private readonly config: IAdapter<T>) {
        this.player = getPlayerAdapterContext<T>();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onPacket(packet: unsafe): void {
        throw new Error('Not implemented');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public handleVoiceStateUpdate(oldState: IVoiceStateUpdateData, newState: IVoiceStateUpdateData): void {
        throw new Error('Not implemented');
    }
}

export function createAdapter<T>(adapterConfig: IAdapter<T>): Adapter<T> {
    return new Adapter<T>(adapterConfig);
}
