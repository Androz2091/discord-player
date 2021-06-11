import { Guild, StageChannel, VoiceChannel } from "discord.js";
import { Player } from "../Player";
import { StreamDispatcher } from "../VoiceInterface/BasicStreamDispatcher";
import Track from "./Track";
import { PlayerOptions } from "../types/types";
import ytdl from "discord-ytdl-core";
import { AudioResource, StreamType } from "@discordjs/voice";

class Queue {
    public readonly guild: Guild;
    public readonly player: Player;
    public connection: StreamDispatcher;
    public tracks: Track[] = [];
    public options: PlayerOptions;
    public playing = false;

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
                fetchBeforeQueued: false,
                initialVolume: 100
            } as PlayerOptions,
            options
        );
    }

    get current() {
        return this.connection.audioResource?.metadata ?? this.tracks[0];
    }

    async connect(channel: StageChannel | VoiceChannel) {
        if (!["stage", "voice"].includes(channel?.type))
            throw new TypeError(`Channel type must be voice or stage, got ${channel?.type}!`);
        const connection = await this.player.voiceUtils.connect(channel);
        this.connection = connection;

        return this;
    }

    destroy() {
        this.connection.end();
        this.connection.disconnect();
        this.player.queues.delete(this.guild.id);
    }

    skip() {
        if (!this.connection) return false;
        return this.connection.end();
    }

    addTrack(track: Track) {
        this.addTracks([track]);
    }

    addTracks(tracks: Track[]) {
        this.tracks.push(...tracks);
    }

    async play(src?: Track) {
        if (!this.connection || !this.connection.voiceConnection)
            throw new Error("Voice connection is not available, use <Queue>.connect()!");
        const track = src ?? this.tracks.shift();
        if (!track) return;

        let resource: AudioResource<Track>;

        if (["youtube", "spotify"].includes(track.raw.source)) {
            const stream = ytdl(track.raw.source === "spotify" ? track.raw.engine : track.url, {
                // because we don't wanna decode opus into pcm again just for volume, let discord.js handle that
                opusEncoded: false,
                fmt: "s16le"
            });

            resource = this.connection.createStream(stream, {
                type: StreamType.Raw,
                data: track
            });
        } else {
            const stream = ytdl.arbitraryStream(
                track.raw.source === "soundcloud"
                    ? await track.raw.engine.downloadProgressive()
                    : (track.raw.engine as string),
                {
                    // because we don't wanna decode opus into pcm again just for volume, let discord.js handle that
                    opusEncoded: false,
                    fmt: "s16le"
                }
            );

            resource = this.connection.createStream(stream, {
                type: StreamType.Raw,
                data: track
            });
        }

        const dispatcher = this.connection.playStream(resource);
        dispatcher.setVolume(this.options.initialVolume);

        dispatcher.on("start", () => {
            this.playing = true;
            this.player.emit("trackStart", this, this.current);
        });

        dispatcher.on("finish", () => {
            this.playing = false;
            if (!this.tracks.length) {
                this.destroy();
                this.player.emit("queueEnd", this);
            } else {
                const nextTrack = this.tracks.shift();
                this.play(nextTrack);
            }
        });
    }

    *[Symbol.iterator]() {
        yield* this.tracks;
    }

    toJSON() {
        return {
            guild: this.guild.id,
            options: this.options,
            tracks: this.tracks.map((m) => m.toJSON())
        };
    }

    toString() {
        if (!this.tracks.length) return "No songs available to display!";
        return `**Upcoming Songs:**\n${this.tracks.map((m, i) => `${i + 1}. **${m.title}**`).join("\n")}`;
    }
}

export { Queue };
