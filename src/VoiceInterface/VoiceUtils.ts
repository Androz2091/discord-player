import { VoiceChannel, StageChannel } from "discord.js";
import { entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { VoiceSubscription } from "./VoiceSubscription";

class VoiceUtils {

    constructor() {
        throw new Error("Cannot instantiate static class!");
    }

    /**
     * Joins a voice channel
     * @param {StageChannel|VoiceChannel} channel The voice channel
     * @param {({deaf?: boolean;maxTime?: number;})} [options] Join options
     * @returns {Promise<VoiceSubscription>}
     */
    public static async connect(
        channel: VoiceChannel | StageChannel,
        options?: {
            deaf?: boolean,
            maxTime?: number
    }): Promise<VoiceSubscription> {
        let conn = joinVoiceChannel({
            guildId: channel.guild.id,
            channelId: channel.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: Boolean(options?.deaf)
        });

        try {
            conn = await entersState(conn, VoiceConnectionStatus.Ready, options?.maxTime ?? 20000);
            return new VoiceSubscription(conn);
        } catch(err) {
            conn.destroy();
            throw err;
        }
    }

    /**
     * Disconnects voice connection
     * @param {VoiceConnection} connection The voice connection
     */
    public static disconnect(connection: VoiceConnection) {
        connection.destroy();
    }

}

export { VoiceUtils }