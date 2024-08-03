import { Adapter } from 'discord-player';

export class DiscordJsAdapter extends Adapter {
    /**
     * @type {import('discord.js').Client<true>}
     */
    metadata;

    constructor(client) {
        super(client);
    }

    getClientId() {
        return this.metadata.user.id;
    }

    isVoiceChannel(guild, channel) {
        const c = this.metadata.guilds.resolve(guild)?.channels.resolve(channel);

        return c.isVoiceBased();
    }

    isStageChannel(guild, channel) {
        const c = this.metadata.guilds.resolve(guild)?.channels.resolve(channel);

        return c.isVoiceBased();
    }

    onPacket(packet) {
        const guild = packet.guild || packet.d?.guild || packet.d?.d?.guild;
        if (!guild) return;

        this.player.queue.store.get(guild)?.send({
            metadata: {
                clientId: this.metadata.id,
                guildId: guild,
                channelId: null
            },
            payload: packet
        });
    }

    sendPacket(packet) {
        const guild = packet.guild || packet.d?.guild || packet.d?.d?.guild;
        if (!guild) return;

        this.metadata.guilds.resolve(guild)?.shard.send(packet);
    }

    // handleVoiceStateUpdate(oldState: IVoiceStateUpdateData, newState: IVoiceStateUpdateData): void;
    // getVoiceChannelMembersCount(guild: string, channel: string): number;
    // resolveChannel(channel: string): string;
    // resolveGuild(guild: string): string;
    // resolveGuildByChannel(channel: string): string;
    // resolveUser(user: string): string;
    // setRequestToSpeak(guild: string, channel: string, value: boolean): void;
}