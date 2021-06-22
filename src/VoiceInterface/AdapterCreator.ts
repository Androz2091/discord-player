import { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from "@discordjs/voice";
import { VoiceChannel, Snowflake, Client, Constants, WebSocketShard, Guild, StageChannel } from "discord.js";
import { GatewayVoiceServerUpdateDispatchData, GatewayVoiceStateUpdateDispatchData } from "discord-api-types/v8";

const adapters = new Map<Snowflake, DiscordGatewayAdapterLibraryMethods>();
const trackedClients = new Set<Client>();

function trackClient(client: Client) {
    if (trackedClients.has(client)) return;
    trackedClients.add(client);
    client.ws.on(Constants.WSEvents.VOICE_SERVER_UPDATE, (payload: GatewayVoiceServerUpdateDispatchData) => {
        adapters.get(payload.guild_id)?.onVoiceServerUpdate(payload);
    });
    client.ws.on(Constants.WSEvents.VOICE_STATE_UPDATE, (payload: GatewayVoiceStateUpdateDispatchData) => {
        if (payload.guild_id && payload.session_id && payload.user_id === client.user?.id) {
            adapters.get(payload.guild_id)?.onVoiceStateUpdate(payload);
        }
    });
}

const trackedGuilds = new Map<WebSocketShard, Set<Snowflake>>();

function cleanupGuilds(shard: WebSocketShard) {
    const guilds = trackedGuilds.get(shard);
    if (guilds) {
        for (const guildID of guilds.values()) {
            adapters.get(guildID)?.destroy();
        }
    }
}

function trackGuild(guild: Guild) {
    let guilds = trackedGuilds.get(guild.shard);
    if (!guilds) {
        const cleanup = () => cleanupGuilds(guild.shard);
        guild.shard.on("close", cleanup);
        guild.shard.on("destroyed", cleanup);
        guilds = new Set();
        trackedGuilds.set(guild.shard, guilds);
    }
    guilds.add(guild.id);
}

export function VoiceAdapterCreator(channel: VoiceChannel | StageChannel): DiscordGatewayAdapterCreator {
    return (methods) => {
        adapters.set(channel.guild.id, methods);
        trackClient(channel.client);
        trackGuild(channel.guild);
        return {
            sendPayload(data) {
                if (channel.guild.shard.status === Constants.Status.READY) {
                    channel.guild.shard.send(data);
                    return true;
                }
                return false;
            },
            destroy() {
                return adapters.delete(channel.guild.id);
            }
        };
    };
}
