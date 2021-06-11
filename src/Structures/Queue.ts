import { Guild, StageChannel, VoiceChannel } from "discord.js";
import { Player } from "../Player";
import { VoiceUtils } from "../VoiceInterface/VoiceUtils";
import { VoiceSubscription } from "../VoiceInterface/VoiceSubscription";
import Track from "./Track";
import { PlayerOptions } from "../types/types";

class Queue {
    public readonly guild: Guild;
    public readonly player: Player;
    public voiceConnection: VoiceSubscription;
    public tracks: Track[] = [];
    public options: PlayerOptions;

    constructor(player: Player, guild: Guild, options: PlayerOptions = {}) {
        this.player = player;
        this.guild = guild;
        this.options = {};

        Object.assign(
            this.options,
            {
                leaveOnEnd: true,
                leaveOnEndCooldown: 1000,
                leaveOnStop: true,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: 1000,
                autoSelfDeaf: true,
                enableLive: false,
                ytdlDownloadOptions: {},
                useSafeSearch: false,
                disableAutoRegister: false,
                fetchBeforeQueued: false
            } as PlayerOptions,
            options
        );
    }

    async joinVoiceChannel(channel: StageChannel | VoiceChannel) {
        if (!["stage", "voice"].includes(channel.type))
            throw new TypeError(`Channel type must be voice or stage, got ${channel.type}!`);
        const connection = await VoiceUtils.connect(channel);
        this.voiceConnection = connection;

        return this;
    }

    destroy() {
        this.voiceConnection.stop();
        this.voiceConnection.disconnect();
        this.player.queues.delete(this.guild.id);
    }
}

export { Queue };
