import { type Snowflake } from 'discord-api-types/globals';
import { ChannelType } from 'discord-api-types/v10';
import { AudioPlayerState, DiscordGatewayAdapterCreator } from "discord-voip";

export const ClientType = {
    DiscordJS: "discord.js",
    Eris: "eris",
    Unknown: "unknown"
};

export type ClientUser = {
    setSelfDeaf(state: boolean, reason?: string): Promise<void>;
    setSelfMute(state: boolean, reason?: string): Promise<void>;
    setSuppressed(state: boolean): Promise<void>;
    requestToSpeak(): Promise<void>;
} & User;

export type User = {
    id: Snowflake;
    username: string;
    isBot: boolean;
};

export type Guild = {
    id: Snowflake;
    name: string;
    clientUser: ClientUser;
    voiceAdapterCreator: DiscordGatewayAdapterCreator;
};

export type VoiceBasedChannel = {
    canSpeak(): boolean;
    members?: Map<string, User>;
    bitrate: number;
    type: ChannelType.GuildVoice | ChannelType.GuildStageVoice;
} & Channel;

export type Channel = {
    id: Snowflake;
    name: string;
    type: ChannelType;
    guild: Guild;
    clientUser: ClientUser;
    isVoiceBased(): boolean;
}

export type VoiceState = AudioPlayerState

export type ClientType = typeof ClientType[keyof typeof ClientType]

export interface IClientAdapter {
    clientType: ClientType;
    getClientName(): string;
    getClientVersion(): string;
    getClientUserId(): string;
    validateIntents(): void;
    getUser(userId: Snowflake): User | null;
    getGuild(guildId: Snowflake): Guild | null;
    getChannel(channelId: Snowflake): Channel | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addVoiceStateUpdateListener(listener: (...args: any[]) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeVoiceStateUpdateListener(listener: (...args: any[]) => void): void;
    decrementMaxListeners(): void;
    incrementMaxListeners(): void;
}
