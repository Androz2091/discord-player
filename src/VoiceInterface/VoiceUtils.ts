import { VoiceChannel, StageChannel, Collection, Snowflake } from "discord.js";
import { DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { StreamDispatcher } from "./StreamDispatcher";

class VoiceUtils {
    public cache: Collection<Snowflake, StreamDispatcher>;

    /**
     * The voice utils
     * @private
     */
    constructor() {
        /**
         * The cache where voice utils stores stream managers
         * @type {Collection<Snowflake, StreamDispatcher>}
         */
        this.cache = new Collection<Snowflake, StreamDispatcher>();
    }

    /**
     * Joins a voice channel, creating basic stream dispatch manager
     * @param {StageChannel|VoiceChannel} channel The voice channel
     * @param {object} [options={}] Join options
     * @returns {Promise<StreamDispatcher>}
     */
    public async connect(
        channel: VoiceChannel | StageChannel,
        options?: {
            deaf?: boolean;
            maxTime?: number;
        }
    ): Promise<StreamDispatcher> {
        const conn = await this.join(channel, options);
        const sub = new StreamDispatcher(conn, channel, options.maxTime);
        this.cache.set(channel.guild.id, sub);
        return sub;
    }

    /**
     * Joins a voice channel
     * @param {StageChannel|VoiceChannel} [channel] The voice/stage channel to join
     * @param {object} [options={}] Join options
     * @returns {VoiceConnection}
     */
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
            adapterCreator: channel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
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
     * @returns {void}
     */
    public disconnect(connection: VoiceConnection | StreamDispatcher) {
        if (connection instanceof StreamDispatcher) return connection.voiceConnection.destroy();
        return connection.destroy();
    }

    /**
     * Returns Discord Player voice connection
     * @param {Snowflake} guild The guild id
     * @returns {StreamDispatcher}
     */
    public getConnection(guild: Snowflake) {
        return this.cache.get(guild);
    }
}

export { VoiceUtils };
