import { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from '@discordjs/voice';
import {
    VoiceChannel,
    Snowflake,
    Client,
    Constants,
    WebSocketShard,
    Guild,
    StageChannel,
    Collection
} from 'discord.js';
import { GatewayVoiceServerUpdateDispatchData, GatewayVoiceStateUpdateDispatchData } from 'discord-api-types/v8';

class VoiceAdapter {
    public client: Client;
    public adapters = new Collection<Snowflake, DiscordGatewayAdapterLibraryMethods>();
    public clients = new Set<Client>();
    public guilds = new Collection<WebSocketShard, Set<Snowflake>>();

    constructor(client: Client) {
        this.client = client;

        Object.defineProperty(this, 'client', {
            enumerable: false,
            writable: true,
            configurable: true
        });
    }

    trackVoiceState() {
        if (this.clients.has(this.client)) return;
        this.clients.add(this.client);

        this.client.ws.on('VOICE_STATE_UPDATE', (data: GatewayVoiceServerUpdateDispatchData) => {
            this.adapters.get(data.guild_id)?.onVoiceServerUpdate(data);
        });

        this.client.ws.on(Constants.WSEvents.VOICE_STATE_UPDATE, (payload: GatewayVoiceStateUpdateDispatchData) => {
            if (payload.guild_id && payload.session_id && payload.user_id === this.client.user?.id) {
                this.adapters.get(payload.guild_id)?.onVoiceStateUpdate(payload);
            }
        });
    }

    cleanupGuilds(shard: WebSocketShard) {
        const guilds = this.guilds.get(shard);
        if (guilds) {
            for (const guildID of guilds.values()) {
                this.adapters.get(guildID)?.destroy();
            }
        }
    }

    trackGuild(guild: Guild) {
        let guilds = this.guilds.get(guild.shard);
        if (!guilds) {
            const cleanup = () => this.cleanupGuilds(guild.shard);
            guild.shard.on('close', cleanup);
            guild.shard.on('destroyed', cleanup);
            guilds = new Set();
            this.guilds.set(guild.shard, guilds);
        }

        guilds.add(guild.id);
    }
}

export default function createAdapter(channel: VoiceChannel | StageChannel): DiscordGatewayAdapterCreator {
    return (methods) => {
        const adapter = new VoiceAdapter(channel.client);
        adapter.adapters.set(channel.guild.id, methods);
        adapter.trackVoiceState();
        adapter.trackGuild(channel.guild);

        return {
            sendPayload(data) {
                if (channel.guild.shard.status === Constants.Status.READY) {
                    channel.guild.shard.send(data);
                    return true;
                }

                return false;
            },
            destroy() {
                return adapter.adapters.delete(channel.guild.id);
            }
        };
    };
}
