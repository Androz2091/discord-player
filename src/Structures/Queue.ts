import { Collection, Guild, Snowflake, StageChannel, VoiceChannel } from "discord.js";
import { Player } from "../Player";
import { StreamDispatcher } from "../VoiceInterface/BasicStreamDispatcher";
import Track from "./Track";
import { PlayerOptions, PlayOptions, QueueRepeatMode } from "../types/types";
import ytdl from "discord-ytdl-core";
import { AudioResource, StreamType } from "@discordjs/voice";
import { Util } from "../utils/Util";
import YouTube from "youtube-sr";

class Queue<T = unknown> {
    public readonly guild: Guild;
    public readonly player: Player;
    public connection: StreamDispatcher;
    public tracks: Track[] = [];
    public previousTracks: Track[] = [];
    public options: PlayerOptions;
    public playing = false;
    public metadata?: T = null;
    public repeatMode: QueueRepeatMode = 0;
    public _cooldownsTimeout = new Collection<string, NodeJS.Timeout>();

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

    nowPlaying() {
        return this.current;
    }

    async connect(channel: StageChannel | VoiceChannel) {
        if (!["stage", "voice"].includes(channel?.type)) throw new TypeError(`Channel type must be voice or stage, got ${channel?.type}!`);
        const connection = await this.player.voiceUtils.connect(channel);
        this.connection = connection;

        // it's ok to use this here since Queue listens to the events 1 time per play and destroys the listener
        this.connection.setMaxListeners(Infinity);

        if (channel.type === "stage") await channel.guild.me.voice.setRequestToSpeak(true).catch(() => {});

        this.connection.on("error", (err) => this.player.emit("error", this, err));
        this.connection.on("debug", (msg) => this.player.emit("debug", this, msg));

        this.player.emit("connectionCreate", this, this.connection);

        return this;
    }

    destroy() {
        this.connection.end();
        this.connection.disconnect();
        this.player.queues.delete(this.guild.id);
    }

    skip() {
        if (!this.connection) return false;
        this.connection.end();
        return true;
    }

    addTrack(track: Track) {
        this.tracks.push(track);
        this.player.emit("trackAdd", this, track);
    }

    addTracks(tracks: Track[]) {
        this.tracks.push(...tracks);
        this.player.emit("tracksAdd", this, tracks);
    }

    setPaused(paused?: boolean) {
        if (!this.connection) return false;
        return paused ? this.connection.pause() : this.connection.resume();
    }

    setBitrate(bitrate: number | "auto") {
        if (!this.connection?.audioResource?.encoder) return;
        if (bitrate === "auto") bitrate = this.connection.channel?.bitrate ?? 64000;
        this.connection.audioResource.encoder.setBitrate(bitrate);
    }

    setVolume(amount: number) {
        if (!this.connection) return false;
        this.options.initialVolume = amount;
        return this.connection.setVolume(amount);
    }

    setRepeatMode(mode: QueueRepeatMode) {
        if (![QueueRepeatMode.OFF, QueueRepeatMode.QUEUE, QueueRepeatMode.TRACK].includes(mode)) throw new Error(`Unknown repeat mode "${mode}"!`);
        const prev = this.repeatMode;
        if (mode === prev) return false;
        this.repeatMode = mode;
        return true;
    }

    get volume() {
        if (!this.connection) return 100;
        return this.connection.volume;
    }

    async back() {
        return await this.play(Util.last(this.previousTracks), { immediate: true });
    }

    async play(src?: Track, options: PlayOptions = {}): Promise<void> {
        if (!this.connection || !this.connection.voiceConnection) throw new Error("Voice connection is not available, use <Queue>.connect()!");
        if (src && (this.playing || this.tracks.length) && !options.immediate) return this.addTrack(src);
        const track = options.filtersUpdate && !options.immediate ? this.current : src ?? this.tracks.shift();
        if (!track) return;

        if (!options.filtersUpdate) {
            this.previousTracks = this.previousTracks.filter((x) => x._trackID !== track._trackID);
            this.previousTracks.push(track);
        }

        let stream;
        if (["youtube", "spotify"].includes(track.raw.source)) {
            if (track.raw.source === "spotify" && !track.raw.engine) {
                track.raw.engine = await YouTube.search(`${track.author} ${track.title}`, { type: "video" })
                    .then((x) => x[0].url)
                    .catch(() => null);
            }
            const link = track.raw.source === "spotify" ? track.raw.engine : track.url;
            if (!link) return void this.play(this.tracks.shift(), { immediate: true });

            stream = ytdl(link, {
                // because we don't wanna decode opus into pcm again just for volume, let discord.js handle that
                opusEncoded: false,
                fmt: "s16le",
                encoderArgs: options.encoderArgs ?? [],
                seek: options.seek
            });
        } else {
            stream = ytdl.arbitraryStream(
                track.raw.source === "soundcloud" ? await track.raw.engine.downloadProgressive() : typeof track.raw.engine === "function" ? await track.raw.engine() : track.raw.engine,
                {
                    // because we don't wanna decode opus into pcm again just for volume, let discord.js handle that
                    opusEncoded: false,
                    fmt: "s16le",
                    encoderArgs: options.encoderArgs ?? [],
                    seek: options.seek
                }
            );
        }

        const resource: AudioResource<Track> = this.connection.createStream(stream, {
            type: StreamType.Raw,
            data: track
        });

        const dispatcher = await this.connection.playStream(resource);
        dispatcher.setVolume(this.options.initialVolume);

        // need to use these events here
        dispatcher.once("start", () => {
            this.playing = true;
            if (!options.filtersUpdate) this.player.emit("trackStart", this, this.current);
        });

        dispatcher.once("finish", () => {
            this.playing = false;
            if (options.filtersUpdate) return;

            if (!this.tracks.length && this.repeatMode === QueueRepeatMode.OFF) {
                this.destroy();
                this.player.emit("queueEnd", this);
            } else {
                if (this.repeatMode === QueueRepeatMode.TRACK) return void this.play(Util.last(this.previousTracks), { immediate: true });
                if (this.repeatMode === QueueRepeatMode.QUEUE) this.tracks.push(Util.last(this.previousTracks));
                const nextTrack = this.tracks.shift();
                this.play(nextTrack, { immediate: true });
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
