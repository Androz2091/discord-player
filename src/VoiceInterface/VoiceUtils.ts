import { VoiceChannel, StageChannel, Collection, Snowflake } from "discord.js";
import { entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { VoiceSubscription } from "./VoiceSubscription";

class VoiceUtils {
    public cache = new Collection<Snowflake, VoiceSubscription>();

    /**
     * Joins a voice channel
     * @param {StageChannel|VoiceChannel} channel The voice channel
     * @param {({deaf?: boolean;maxTime?: number;})} [options] Join options
     * @returns {Promise<VoiceSubscription>}
     */
    public async connect(
        channel: VoiceChannel | StageChannel,
        options?: {
            deaf?: boolean;
            maxTime?: number;
        }
    ): Promise<VoiceSubscription> {
        let conn = joinVoiceChannel({
            guildId: channel.guild.id,
            channelId: channel.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: Boolean(options?.deaf)
        });

        try {
            conn = await entersState(conn, VoiceConnectionStatus.Ready, options?.maxTime ?? 20000);
            const sub = new VoiceSubscription(conn);
            this.cache.set(channel.guild.id, sub);
            return sub;
        } catch (err) {
            conn.destroy();
            throw err;
        }
    }

    /**
     * Disconnects voice connection
     * @param {VoiceConnection} connection The voice connection
     */
    public disconnect(connection: VoiceConnection | VoiceSubscription) {
        if (connection instanceof VoiceSubscription) return connection.voiceConnection.destroy();
        return connection.destroy();
    }

    public getConnection(guild: Snowflake) {
        return this.cache.get(guild);
    }
}

export { VoiceUtils };
