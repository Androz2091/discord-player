import { AudioResource, StreamType } from "@discordjs/voice";
import ytdl from "discord-ytdl-core";
import { Collection, Guild, GuildChannelResolvable, Snowflake, SnowflakeUtil, StageChannel, VoiceChannel } from "discord.js";
import type { Readable } from "stream";
import YouTube from "youtube-sr";
import { Player } from "../Player";
import { PlayerOptions, PlayerProgressbarOptions, PlayerTimestamp, PlayOptions, QueueFilters, QueueJSON, QueueRepeatMode, TrackSource } from "../types/types";
import AudioFilters from "../utils/AudioFilters";
import { Util } from "../utils/Util";
import { StreamDispatcher } from "../VoiceInterface/StreamDispatcher";
import { VolumeTransformer } from "../VoiceInterface/VolumeTransformer";
import { ErrorStatusCode, PlayerError } from "./PlayerError";
import Track from "./Track";

export class Queue<T = unknown> {
    /**
     * The player that instantiated this queue
     * @type {Player}
     * @readonly
     */
    public readonly player: Player;
    /**
     * The guild that instantiated this queue
     * @type {Guild}
     * @readonly
     */
    public readonly guild: Guild;
    /**
     * The connection
     * @type {(StreamDispatcher|undefined)}
     * @name Queue#connection
     */
    public connection: StreamDispatcher | undefined;
    /**
     * Regular tracks
     * @type {Track[]}
     * @name Queue#tracks
     */
    public tracks: Track[] = [];
    /**
     * Previous tracks
     * @type {Track[]}
     * @name Queue#previousTracks
     */
    public previousTracks: Track[] = [];
    /**
     * The player options for this queue
     * @default
     * ```
     * const options = {
        leaveOnEnd: true,
        leaveOnStop: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 1000,
        autoSelfDeaf: true,
        ytdlOptions: {
            highWaterMark: 1 << 25
        },
        initialVolume: 100,
        bufferingTimeout: 3000,
        spotifyBridge: true,
        disableVolume: false
    };
     * ```
     * @type {PlayerOptions}
     */
    public options: PlayerOptions = {
        leaveOnEnd: true,
        leaveOnStop: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 1000,
        autoSelfDeaf: true,
        ytdlOptions: {
            highWaterMark: 1 << 25
        },
        initialVolume: 100,
        bufferingTimeout: 3000,
        spotifyBridge: true,
        disableVolume: false
    };
    public playing = false;
    /**
     * Queue metadata
     * @type {any}
     * @name Queue#metadata
     */
    public metadata?: T | undefined;
    /**
     * Queue repeat mode
     * @type {QueueRepeatMode}
     * @name Queue#repeatMode
     */
    public repeatMode: QueueRepeatMode = 0;
    /**
     * The ID of this queue
     * @type {Snowflake}
     * @name Queue#id
     */
    public readonly id: Snowflake = SnowflakeUtil.generate();
    private _streamTime = 0;
    public _cooldownsTimeout = new Collection<string, NodeJS.Timeout>();
    private _activeFilters: (keyof QueueFilters)[] = [];
    private _filtersUpdate = false;
    #lastVolume = 0;
    #destroyed = false;
    public onBeforeCreateStream: ((track: Track, source: TrackSource, queue: Queue) => Promise<Readable | undefined>) | null = null;

    /**
     * Queue constructor
     * @param {Player} player The player that should instantiate this queue
     * @param {Guild} guild The guild that should instantiate this queue
     * @param {PlayerOptions} [options={}] Player options for the queue
     */
    constructor(player: Player, guild: Guild, options: PlayerOptions = {}) {
        this.player = player;
        this.guild = guild;
        this.options = Object.assign(this.options, options);

        if (this.options.onBeforeCreateStream) this.onBeforeCreateStream = this.options.onBeforeCreateStream;

        this.player.emit("debug", this, `Queue initialized:\n\n${this.player.scanDeps()}`);
    }

    /**
     * Returns current track if available
     * @type {(Track|undefined)}
     */
    get current(): Track | undefined {
        if (this.#watchDestroyed()) return;
        return this.connection?.audioResource?.metadata ?? this.tracks[0];
    }

    /**
     * If this queue is destroyed
     * @type {boolean}
     */
    get destroyed() {
        return this.#destroyed;
    }

    /**
     * Returns current track if available. Same as queue.current
     * @returns {(Track|undefined)}
     */
    nowPlaying(): Track | undefined {
        return this.current;
    }

    /**
     * Connects to a voice channel
     * @param {GuildChannelResolvable} channel The voice/stage channel
     * @throws {PlayerError} Channel type must be GUILD_VOICE or GUILD_STAGE_VOICE, got ${_channel?.type}!
     * @returns {Promise<Queue>}
     */
    async connect(channel: GuildChannelResolvable): Promise<Queue | undefined> {
        if (this.#watchDestroyed()) return;
        const _channel = this.guild.channels.resolve(channel) as StageChannel | VoiceChannel;
        if (!["GUILD_STAGE_VOICE", "GUILD_VOICE"].includes(_channel?.type))
            throw new PlayerError(`Channel type must be GUILD_VOICE or GUILD_STAGE_VOICE, got ${_channel?.type}!`, ErrorStatusCode.INVALID_ARG_TYPE);

        const connection = await this.player.voiceUtils.connect(_channel, {
            deaf: this.options.autoSelfDeaf
        });
        this.connection = connection;

        if (_channel.type === "GUILD_STAGE_VOICE") {
            await _channel.guild.me?.voice.setSuppressed(false).catch(async () => {
                return await _channel.guild.me?.voice.setRequestToSpeak(true).catch(Util.noop);
            });
        }

        // register connection listeners
        this.connection
            .on("error", (err) => {
                if (this.#watchDestroyed(false)) return;
                this.player.emit("connectionError", this, err);
            })
            .on("debug", (msg) => {
                if (this.#watchDestroyed(false)) return;
                this.player.emit("debug", this, msg);
            })
            .on("start", (resource) => {
                if (this.#watchDestroyed(false)) return;
                this.playing = true;
                if (!this._filtersUpdate && resource?.metadata) this.player.emit("trackStart", this, resource?.metadata ?? this.current);
                this._filtersUpdate = false;
            })
            .on("finish", async (resource) => {
                if (this.#watchDestroyed(false)) return;
                this.playing = false;
                if (this._filtersUpdate) return;
                this._streamTime = 0;
                if (resource && resource.metadata) this.previousTracks.push(resource.metadata);

                this.player.emit("trackEnd", this, resource.metadata);

                if (!this.tracks.length && this.repeatMode === QueueRepeatMode.OFF) {
                    if (this.options.leaveOnEnd) this.destroy();
                    this.player.emit("queueEnd", this);
                } else if (!this.tracks.length && this.repeatMode === QueueRepeatMode.AUTOPLAY) {
                    const last = Util.last(this.previousTracks);
                    if (last) this._handleAutoplay(last);
                } else {
                    const last = Util.last(this.previousTracks);
                    if (this.repeatMode === QueueRepeatMode.TRACK) {
                        if (last) this.play(last, { immediate: true });
                        return;
                    }
                    if (this.repeatMode === QueueRepeatMode.QUEUE && last) this.tracks.push(last);
                    const nextTrack = this.tracks.shift();
                    this.play(nextTrack, { immediate: true });
                    return;
                }
            });

        this.player.emit("connectionCreate", this, this.connection);

        await this.player.voiceUtils.enterReady(this.connection.voiceConnection, {
            maxTime: this.player.options.connectionTimeout || 30_000
        });

        return this;
    }

    /**
     * Destroys this queue
     * @param {boolean} [disconnect=this.options.leaveOnStop] If it should leave on destroy
     * @returns {void}
     */
    destroy(disconnect = this.options.leaveOnStop) {
        if (this.#watchDestroyed()) return;
        this.#destroyed = true;
        if (this.connection) this.connection.end();
        if (disconnect) this.connection?.disconnect();
        this.player.queues.delete(this.guild.id);
        this.player.voiceUtils.cache.delete(this.guild.id);
    }

    /**
     * Skips current track
     * @returns {boolean} Whether the track has been skipped
     */
    skip(): boolean {
        if (this.#watchDestroyed()) return false;
        if (!this.connection) return false;
        this._filtersUpdate = false;
        this.connection.end();
        return true;
    }

    /**
     * Adds single track to the queue
     * @param {Track} track The track to add
     * @throws {PlayerError} invalid track
     * @returns {void}
     */
    addTrack(track: Track) {
        if (this.#watchDestroyed()) return;
        if (!(track instanceof Track)) throw new PlayerError("invalid track", ErrorStatusCode.INVALID_TRACK);
        this.tracks.push(track);
        this.player.emit("trackAdd", this, track);
    }

    /**
     * Adds multiple tracks to the queue
     * @param {Track[]} tracks Array of tracks to add
     * @throws {PlayerError} invalid track
     */
    addTracks(tracks: Track[]) {
        if (this.#watchDestroyed()) return;
        if (!tracks.every((y) => y instanceof Track)) throw new PlayerError("invalid track", ErrorStatusCode.INVALID_TRACK);
        this.tracks.push(...tracks);
        this.player.emit("tracksAdd", this, tracks);
    }

    /**
     * Sets paused state
     * @param {boolean} paused The paused state
     * @returns {boolean} Whether the queue has been paused
     */
    setPaused(paused?: boolean): boolean {
        if (this.#watchDestroyed()) return false;
        if (!this.connection) return false;
        return paused ? this.connection.pause(true) : this.connection.resume();
    }

    /**
     * Sets bitrate
     * @param  {number|auto} bitrate bitrate to set
     * @returns {void}
     */
    setBitrate(bitrate: number | "auto") {
        if (this.#watchDestroyed()) return;
        if (!this.connection?.audioResource?.encoder) return;
        if (bitrate === "auto") bitrate = this.connection.channel?.bitrate ?? 64000;
        this.connection.audioResource.encoder.setBitrate(bitrate);
    }

    /**
     * Sets volume
     * @param {number} amount The volume amount
     * @returns {boolean} Whether the volume has been set
     */
    setVolume(amount: number): boolean {
        if (this.#watchDestroyed()) return false;
        if (!this.connection) return false;
        this.#lastVolume = amount;
        this.options.initialVolume = amount;
        return this.connection.setVolume(amount);
    }
    /**
     * Sets repeat mode
     * @param  {QueueRepeatMode} mode The repeat mode
     * @throws {PlayerError} Unknown repeat mode "${mode}"!
     * @returns {boolean} Whether the repeat mode has been set. **false** if given mode is equal to current mode
     */
    setRepeatMode(mode: QueueRepeatMode): boolean {
        if (this.#watchDestroyed()) return false;
        if (![QueueRepeatMode.OFF, QueueRepeatMode.QUEUE, QueueRepeatMode.TRACK, QueueRepeatMode.AUTOPLAY].includes(mode))
            throw new PlayerError(`Unknown repeat mode "${mode}"!`, ErrorStatusCode.UNKNOWN_REPEAT_MODE);
        if (mode === this.repeatMode) return false;
        this.repeatMode = mode;
        return true;
    }

    /**
     * The current volume or 0 if queue is destroyed
     * @type {number}
     */
    get volume(): number {
        if (this.#watchDestroyed()) return 0;
        if (!this.connection) return 100;
        return this.connection.volume;
    }

    set volume(amount: number) {
        this.setVolume(amount);
    }

    /**
     * The stream time of this queue or 0 if queue is destroyed
     * @type {number}
     */
    get streamTime(): number {
        if (this.#watchDestroyed()) return 0;
        if (!this.connection) return 0;
        const playbackTime = this._streamTime + this.connection.streamTime;
        const NC = this._activeFilters.includes("nightcore") ? 1.25 : null;
        const VW = this._activeFilters.includes("vaporwave") ? 0.8 : null;

        if (NC && VW) return playbackTime * (NC + VW);
        return NC ? playbackTime * NC : VW ? playbackTime * VW : playbackTime;
    }

    set streamTime(time: number) {
        if (this.#watchDestroyed()) return;
        this.seek(time);
    }

    /**
     * Returns enabled filters
     * @returns {string[]}
     */
    getFiltersEnabled(): (keyof QueueFilters)[] {
        if (this.#watchDestroyed()) return [];
        return AudioFilters.names.filter((x) => this._activeFilters.includes(x));
    }

    /**
     * Returns disabled filters
     * @returns {string[]}
     */
    getFiltersDisabled(): (keyof QueueFilters)[] {
        if (this.#watchDestroyed()) return [];
        return AudioFilters.names.filter((x) => !this._activeFilters.includes(x));
    }

    /**
     * Sets filters
     * @param {QueueFilters} filters Queue filters
     * @returns {Promise<void>}
     */
    async setFilters(filters?: QueueFilters) {
        if (this.#watchDestroyed()) return;
        if (!filters || !Object.keys(filters).length) {
            // reset filters
            const streamTime = this.streamTime;
            this._activeFilters = [];
            return await this.play(this.current, {
                immediate: true,
                filtersUpdate: true,
                seek: streamTime,
                encoderArgs: []
            });
        }

        const _filters: (keyof QueueFilters)[] = [];

        for (const filterName in filters) {
            const key = filterName as keyof QueueFilters;
            if (filters[key] === true) _filters.push(key);
        }

        if (!this._activeFilters.length && !_filters.length) return;

        const newFilters = AudioFilters.create(_filters).trim();
        const streamTime = this.streamTime;
        this._activeFilters = _filters;

        return await this.play(this.current, {
            immediate: true,
            filtersUpdate: true,
            seek: streamTime,
            encoderArgs: !_filters.length ? undefined : ["-af", newFilters]
        });
    }

    /**
     * Seeks to the given time
     * @param {number} position The position
     * @returns {Promise<boolean>} Whether the seek was successful
     */
    async seek(position: number): Promise<boolean> {
        if (this.#watchDestroyed()) return false;
        if (!this.playing || !this.current) return false;
        if (position < 1) position = 0;
        if (position >= this.current.durationMS) return this.skip();

        await this.play(this.current, {
            immediate: true,
            filtersUpdate: true, // to stop events
            seek: position
        });

        return true;
    }

    /**
     * Plays previous track
     * @throws {PlayerError} Could not find previous track
     * @returns {Promise<void>}
     */
    async back() {
        if (this.#watchDestroyed()) return;
        const prev = this.previousTracks[this.previousTracks.length - 2]; // because last item is the current track
        if (!prev) throw new PlayerError("Could not find previous track", ErrorStatusCode.TRACK_NOT_FOUND);

        return await this.play(prev, { immediate: true });
    }

    /**
     * Clear this queue
     */
    clear() {
        if (this.#watchDestroyed()) return;
        this.tracks = [];
        this.previousTracks = [];
    }

    /**
     * Stops the player
     * @returns {void}
     */
    stop() {
        if (this.#watchDestroyed()) return;
        return this.destroy();
    }

    /**
     * Shuffles this queue
     * @returns {boolean} Whether the queue has been shuffled
     */
    shuffle(): boolean {
        if (this.#watchDestroyed()) return false;
        if (!this.tracks.length || this.tracks.length < 3) return false;
        const currentTrack = this.tracks.shift();

        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }

        if (currentTrack) this.tracks.unshift(currentTrack);

        return true;
    }

    /**
     * Removes a track from the queue
     * @param {Track|Snowflake|number} track The track to remove
     * @returns {Track} The removed track or undefined if no track available
     */
    remove(track: Track | Snowflake | number): Track | undefined {
        if (this.#watchDestroyed()) return;
        const trackFound = typeof track === "number" ? this.tracks[track] : this.tracks.find((s) => s.id === (track instanceof Track ? track.id : track));
        if (trackFound) {
            this.tracks = this.tracks.filter((s) => s.id !== trackFound.id);
        }
        return trackFound;
    }

    /**
     * Returns the index of the specified track
     * @param {number|Track|Snowflake} track The track
     * @returns {number} Track index or -1 if not found
     */
    getTrackPosition(track: number | Track | Snowflake): number {
        if (this.#watchDestroyed()) return -1;
        if (typeof track === "number") return this.tracks[track] != null ? track : -1;
        return this.tracks.findIndex((pred) => pred.id === (track instanceof Track ? track.id : track));
    }

    /**
     * Jumps to particular track
     * @param {Track|number} track The track
     * @throws {PlayerError} Track not found
     * @returns {void}
     */
    jump(track: Track | number): void {
        if (this.#watchDestroyed()) return;
        const foundTrack = this.remove(track);
        if (!foundTrack) throw new PlayerError("Track not found", ErrorStatusCode.TRACK_NOT_FOUND);

        this.tracks.splice(0, 0, foundTrack);
        this.skip();
    }

    /**
     * Jumps to particular track, removing other tracks on the way
     * @param {Track|number} track The track
     * @throws {PlayerError} Track not found
     * @returns {void}
     */
    skipTo(track: Track | number): void {
        if (this.#watchDestroyed()) return;
        const trackIndex = this.getTrackPosition(track);
        const removedTrack = this.remove(track);
        if (!removedTrack) throw new PlayerError("Track not found", ErrorStatusCode.TRACK_NOT_FOUND);

        this.tracks.splice(0, trackIndex, removedTrack);
        this.skip();
    }

    /**
     * Inserts the given track to specified index
     * @param {Track} track The track to insert
     * @param {number} [index=0] The index where this track should be
     * @throws {PlayerError} track must be the instance of Track
     * @throws {PlayerError} Invalid index "${index}"
     */
    insert(track: Track, index = 0) {
        if (this.#watchDestroyed()) return;
        if (!track || !(track instanceof Track)) throw new PlayerError("track must be the instance of Track", ErrorStatusCode.INVALID_TRACK);
        if (typeof index !== "number" || index < 0 || !Number.isFinite(index)) throw new PlayerError(`Invalid index "${index}"`, ErrorStatusCode.INVALID_ARG_TYPE);

        this.tracks.splice(index, 0, track);
        this.player.emit("trackAdd", this, track);
    }

    /**
     * Returns player stream timestamp
     * @returns {PlayerTimestamp} Player timestamp or undefined if not current track
     */
    getPlayerTimestamp(): PlayerTimestamp | undefined {
        if (this.#watchDestroyed() || !this.current) return;
        const currentStreamTime = this.streamTime;
        const totalTime = this.current.durationMS;

        const currentTimecode = Util.buildTimeCode(Util.parseMS(currentStreamTime));
        const endTimecode = Util.buildTimeCode(Util.parseMS(totalTime));

        return {
            current: currentTimecode,
            end: endTimecode,
            progress: Math.round((currentStreamTime / totalTime) * 100)
        };
    }

    /**
     * Creates progress bar string
     * @param {PlayerProgressbarOptions} options The progress bar options
     * @returns {string} Progress bar or empty string if no current track
     */
    createProgressBar(options: PlayerProgressbarOptions = { timecodes: true }): string {
        if (this.#watchDestroyed() || !this.current) return "";
        const length = typeof options.length === "number" ? (options.length <= 0 || options.length === Infinity ? 15 : options.length) : 15;

        const index = Math.round((this.streamTime / this.current.durationMS) * length);
        const indicator = typeof options.indicator === "string" && options.indicator.length > 0 ? options.indicator : "🔘";
        const line = typeof options.line === "string" && options.line.length > 0 ? options.line : "▬";

        const timestamp = this.getPlayerTimestamp();
        if (!timestamp) return "";

        if (index >= 1 && index <= length) {
            const bar = line.repeat(length - 1).split("");
            bar.splice(index, 0, indicator);
            if (options.timecodes) {
                return `${timestamp.current} ┃ ${bar.join("")} ┃ ${timestamp.end}`;
            } else {
                return `${bar.join("")}`;
            }
        } else {
            if (options.timecodes) {
                return `${timestamp.current} ┃ ${indicator}${line.repeat(length - 1)} ┃ ${timestamp.end}`;
            } else {
                return `${indicator}${line.repeat(length - 1)}`;
            }
        }
    }

    /**
     * Total duration or 0 if queue not available
     * @type {Number}
     */
    get totalTime(): number {
        if (this.#watchDestroyed()) return 0;
        return this.tracks.length > 0 ? this.tracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0;
    }

    /**
     * Play stream in a voice/stage channel
     * @param {Track} [src] The track to play (if empty, uses first track from the queue)
     * @param {PlayOptions} [options={}] The options
     * @throws {PlayerError} Voice connection is not available, use <Queue>.connect()!
     * @returns {Promise<void>}
     */
    async play(src?: Track, options: PlayOptions = {}): Promise<void> {
        if (this.#watchDestroyed(false)) return;
        if (!this.connection || !this.connection.voiceConnection) throw new PlayerError("Voice connection is not available, use <Queue>.connect()!", ErrorStatusCode.NO_CONNECTION);
        if (src && (this.playing || this.tracks.length) && !options.immediate) return this.addTrack(src);
        const track = options.filtersUpdate && !options.immediate ? src || this.current : src ?? this.tracks.shift();
        if (!track) return;

        this.player.emit("debug", this, "Received play request");

        if (!options.filtersUpdate) {
            this.previousTracks = this.previousTracks.filter((x) => x.id !== track.id);
            this.previousTracks.push(track);
        }

        let stream = null;
        const customDownloader = typeof this.onBeforeCreateStream === "function";

        if (["youtube", "spotify"].includes(track.raw.source ?? "")) {
            let spotifyResolved = false;
            if (this.options.spotifyBridge && track.raw.source === "spotify" && !track.raw.engine) {
                track.raw.engine = await YouTube.search(`${track.author} ${track.title}`, { type: "video" })
                    .then((x) => x[0].url)
                    .catch(() => null);
                spotifyResolved = true;
            }
            const link = track.raw.source === "spotify" ? track.raw.engine : track.url;
            if (!link) return void this.play(this.tracks.shift(), { immediate: true });

            if (customDownloader) {
                stream = (await this.onBeforeCreateStream?.(track, spotifyResolved ? "youtube" : track.raw.source ?? "youtube", this)) ?? null;
                if (stream) {
                    stream = ytdl
                        .arbitraryStream(stream, {
                            opusEncoded: false,
                            fmt: "s16le",
                            encoderArgs: options.encoderArgs ?? this._activeFilters.length ? ["-af", AudioFilters.create(this._activeFilters)] : [],
                            seek: options.seek ? options.seek / 1000 : 0
                        })
                        .on("error", (err) => {
                            return err.message.toLowerCase().includes("premature close") ? null : this.player.emit("error", this, err);
                        });
                }
            } else {
                stream = ytdl(link, {
                    ...this.options.ytdlOptions,
                    // discord-ytdl-core
                    opusEncoded: false,
                    fmt: "s16le",
                    encoderArgs: options.encoderArgs ?? this._activeFilters.length ? ["-af", AudioFilters.create(this._activeFilters)] : [],
                    seek: options.seek ? options.seek / 1000 : 0
                }).on("error", (err) => {
                    return err.message.toLowerCase().includes("premature close") ? null : this.player.emit("error", this, err);
                });
            }
        } else {
            const tryArb = (customDownloader && (await this.onBeforeCreateStream?.(track, track.raw.source || track.raw.engine, this))) || null;
            const arbitrarySource = tryArb
                ? tryArb
                : track.raw.source === "soundcloud"
                ? await track.raw.engine.downloadProgressive()
                : typeof track.raw.engine === "function"
                ? await track.raw.engine()
                : track.raw.engine;
            stream = ytdl
                .arbitraryStream(arbitrarySource, {
                    opusEncoded: false,
                    fmt: "s16le",
                    encoderArgs: options.encoderArgs ?? this._activeFilters.length ? ["-af", AudioFilters.create(this._activeFilters)] : [],
                    seek: options.seek ? options.seek / 1000 : 0
                })
                .on("error", (err) => {
                    return err.message.toLowerCase().includes("premature close") ? null : this.player.emit("error", this, err);
                });
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const resource: AudioResource<Track> = this.connection.createStream(stream!, {
            type: StreamType.Raw,
            data: track,
            disableVolume: Boolean(this.options.disableVolume)
        });

        if (options.seek) this._streamTime = options.seek;
        this._filtersUpdate = options.filtersUpdate ?? false;

        const volumeTransformer = resource.volume as VolumeTransformer;
        if (volumeTransformer?.hasSmoothness && typeof this.options.volumeSmoothness === "number") {
            if (typeof volumeTransformer.setSmoothness === "function") volumeTransformer.setSmoothness(this.options.volumeSmoothness || 0);
        }

        this.setVolume(this.options.initialVolume ?? 100);

        setTimeout(() => {
            this.connection?.playStream(resource);
        }, this.#getBufferingTimeout()).unref();
    }

    /**
     * Private method to handle autoplay
     * @param {Track} track The source track to find its similar track for autoplay
     * @returns {Promise<void>}
     * @private
     */
    private async _handleAutoplay(track: Track): Promise<void> {
        if (this.#watchDestroyed()) return;
        if (!track || ![track.source, track.raw?.source].includes("youtube")) {
            if (this.options.leaveOnEnd) this.destroy();
            return void this.player.emit("queueEnd", this);
        }
        const info = await YouTube.getVideo(track.url)
            .then((x) => (x.videos ? x.videos[0] : undefined))
            .catch(Util.noop);
        if (!info) {
            if (this.options.leaveOnEnd) this.destroy();
            return void this.player.emit("queueEnd", this);
        }

        const nextTrack = new Track(this.player, {
            title: info.title ?? "",
            url: `https://www.youtube.com/watch?v=${info.id}`,
            duration: info.durationFormatted ? Util.buildTimeCode(Util.parseMS(info.duration * 1000)) : "0:00",
            description: "",
            thumbnail: typeof info.thumbnail === "string" ? info.thumbnail : info.thumbnail?.url ?? "",
            views: info.views,
            author: info.channel?.name ?? "",
            requestedBy: track.requestedBy,
            source: "youtube"
        });

        this.play(nextTrack, { immediate: true });
    }

    *[Symbol.iterator]() {
        if (this.#watchDestroyed()) return;
        yield* this.tracks;
    }

    /**
     * JSON representation of this queue
     * @returns {QueueJSON}
     */
    toJSON(): QueueJSON {
        if (this.#watchDestroyed()) return { id: this.id, guild: this.guild.id, options: this.options, tracks: [] };
        return {
            id: this.id,
            guild: this.guild.id,
            voiceChannel: this.connection?.channel?.id,
            options: this.options,
            tracks: this.tracks.map((m) => m.toJSON())
        };
    }

    /**
     * String representation of this queue
     * @returns {string} String representation or empty string if queue is destroyed
     */
    toString(): string {
        if (this.#watchDestroyed()) return "";
        if (!this.tracks.length) return "No songs available to display!";
        return `**Upcoming Songs:**\n${this.tracks.map((m, i) => `${i + 1}. **${m.title}**`).join("\n")}`;
    }

    #watchDestroyed(emit = true) {
        if (this.#destroyed) {
            if (emit) this.player.emit("error", this, new PlayerError("Cannot use destroyed queue", ErrorStatusCode.DESTROYED_QUEUE));
            return true;
        }

        return false;
    }

    #getBufferingTimeout() {
        const timeout = this.options.bufferingTimeout;

        if (!timeout || isNaN(timeout) || timeout < 0 || !Number.isFinite(timeout)) return 1000;
        return timeout;
    }
}
