import { UserResolvable as DjsUserResolvable } from "discord.js";
import { User as ErisUser } from "eris";

type User = DjsUserResolvable | ErisUser;

export const ChannelType = {
    Text: 0,
    DM: 1,
    GuildVoice: 2,
    GroupDM: 3
    // ...
} as const

export type ChannelType = typeof ChannelType[keyof typeof ChannelType]

export type Channel = {
    id: string;
    name: string;
    isSpeakable: boolean;
    type: ChannelType;
}

export const ClientType = {
    DiscordJS: "discord.js",
    Eris: "eris",
    Unknown: "unknown"
} as const;

export type ClientType = typeof ClientType[keyof typeof ClientType]

export interface IClientAdapter {
    clientType: ClientType;
    validateIntents(): void;
    getClientName(): string;
    getClientVersion(): string;
    getUserId(user: User): string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addVoiceStateUpdateListener(listener: (...args: any[]) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeVoiceStateUpdateListener(listener: (...args: any[]) => void): void;
    decrementMaxListeners(): void;
    incrementMaxListeners(): void;
}
