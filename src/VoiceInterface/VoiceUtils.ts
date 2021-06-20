import { VoiceChannel, StageChannel, Collection, Snowflake } from "discord.js";
import { entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { StreamDispatcher } from "./BasicStreamDispatcher";

class VoiceUtils {
    public cache = new Collection<Snowflake, StreamDispatcher>();

    /**
     * Joins a voice channel
     * @param {StageChannel|VoiceChannel} channel The voice channel
     * @param {({deaf?: boolean;maxTime?: number;})} [options] Join options
     * @returns {Promise<BasicStreamDispatcher>}
     */
    public async connect(
        channel: VoiceChannel | StageChannel,
        options?: {
            deaf?: boolean;
            maxTime?: number;
        }
    ): Promise<StreamDispatcher> {
        const conn = await this.join(channel, options);
        const sub = new StreamDispatcher(conn, channel);
        this.cache.set(channel.guild.id, sub);
        return sub;
    }

    public async join(
        channel: VoiceChannel | StageChannel,
        options?: {
            deaf?: boolean;
            maxTime?: number;
        }
    ) {
        let conn = joinVoiceChannel({
            guildId: channel.guild.id,
            channelId: channel.id,
            adapterCreator: (channel.guild as any).voiceAdapterCreator,
            selfDeaf: Boolean(options.deaf)
        });

        try {
            conn = await entersState(conn, VoiceConnectionStatus.Ready, options?.maxTime ?? 20000);
            return conn;
        } catch (err) {
            conn.destroy();
            throw err;
        }
    }

    /**
     * Disconnects voice connection
     * @param {VoiceConnection} connection The voice connection
     */
    public disconnect(connection: VoiceConnection | StreamDispatcher) {
        if (connection instanceof StreamDispatcher) return connection.voiceConnection.destroy();
        return connection.destroy();
    }

    public getConnection(guild: Snowflake) {
        return this.cache.get(guild);
    }
}

export { VoiceUtils };
