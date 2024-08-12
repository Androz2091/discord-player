import { Client, Events, GuildChannel, IntentsBitField, version } from "discord.js";
import { Channel, ChannelType, ClientType, Guild, IClientAdapter, User, VoiceBasedChannel } from './IClientAdapter';
import { Util } from "../utils/Util";

export class DiscordJsClientAdapter implements IClientAdapter {
    private client: Client;
    private name = 'discord.js';

    public clientType: ClientType = ClientType.DiscordJS;

    constructor(client: unknown) {
        this.client = client as Client;
    }

    public getClientName(): string {
        return this.name;
    }

    public getClientVersion(): string {
        return version;
    }

    public getClientUserId(): string {
        return this.client.user?.id ?? '';
    }

    public validateIntents(): void {
        const intents: IntentsBitField = this.client.options.intents;

        if (!intents.has(IntentsBitField.Flags.GuildVoiceStates)) {
            Util.warn('Client is missing "GuildVoiceStates" intent', 'InvalidIntentsBitField');
        }
    }

    public getUser(userId: string): User | null {
        const user = this.client.users.cache.get(userId);
        if (!user) return null;

        return {
            id: user.id,
            username: user.username,
            isBot: user.bot
        };
    }

    public getGuild(guildId: string): Guild {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');

        return {
            id: guild.id,
            name: guild.name,
            clientUser: {
                id: guild.members.me!.user.id,
                username: guild.members.me!.user.username,
                isBot: guild.members.me!.user.bot,
                setSelfDeaf: async () => { },
                setSelfMute: async () => { },
                setSuppressed: async () => { },
                requestToSpeak: async () => { },
            },
            voiceAdapterCreator: guild.voiceAdapterCreator
        };
    }

    getChannel(channelId: string): Channel | null {
        const channel = this.client.channels.cache.get(channelId);
        if (!channel) return null;

        if (channel.isVoiceBased()) {
            return {
                id: channel.id,
                name: channel.name,
                type: (channel.type as unknown as ChannelType),
                guild: this.getGuild(channel.guild.id),
                clientUser: {
                    id: this.client.user!.id,
                    username: this.client.user!.username,
                    isBot: this.client.user!.bot,
                    setSelfDeaf: async () => { },
                    setSelfMute: async () => { },
                    setSuppressed: async () => { },
                    requestToSpeak: async () => { },
                },
                isVoiceBased: () => true,
                bitrate: channel.bitrate,
            } as VoiceBasedChannel;
        }

        const guildChannel = channel as GuildChannel;

        return {
            id: channel.id,
            name: '', // mock
            type: channel.type as unknown as ChannelType,
            guild: {
                id: guildChannel.guild.id,
                name: guildChannel.guild.name,
                clientUser: {
                    id: this.client.user!.id,
                    username: this.client.user!.username,
                    isBot: this.client.user!.bot,
                    setSelfDeaf: async () => { },
                    setSelfMute: async () => { },
                    setSuppressed: async () => { },
                    requestToSpeak: async () => { },
                },
                voiceAdapterCreator: guildChannel.guild.voiceAdapterCreator
            },
            clientUser: {
                id: this.client.user!.id,
                username: this.client.user!.username,
                isBot: this.client.user!.bot,
                setSelfDeaf: async () => { },
                setSelfMute: async () => { },
                setSuppressed: async () => { },
                requestToSpeak: async () => { },
            },
            isVoiceBased: () => false
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public addVoiceStateUpdateListener(listener: (...args: any[]) => void): void {
        this.client.on(Events.VoiceStateUpdate, listener);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public removeVoiceStateUpdateListener(listener: (...args: any[]) => void): void {
        this.client.off(Events.VoiceStateUpdate, listener);
    }

    public decrementMaxListeners(): void {
        // @ts-ignore private method
        this.client.decrementMaxListeners();
    }

    public incrementMaxListeners(): void {
        // @ts-ignore private method
        this.client.incrementMaxListeners();
    }
}
