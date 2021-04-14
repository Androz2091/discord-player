import { EventEmitter } from 'events';
import { Client, Collection, Snowflake, Collector, Message, VoiceChannel, VoiceState } from 'discord.js';
import { LyricsData, PlayerOptions, PlayerProgressbarOptions, QueueFilters } from './types/types';
import Util from './utils/Util';
import AudioFilters from './utils/AudioFilters';
import { Queue } from './Structures/Queue';
import { Track } from './Structures/Track';
import { PlayerErrorEventCodes, PlayerEvents } from './utils/Constants';
import PlayerError from './utils/PlayerError';
import ytdl from 'discord-ytdl-core';
import { ExtractorModel } from './Structures/ExtractorModel';

// @ts-ignore
import spotify from 'spotify-url-info';
// @ts-ignore
import { Client as SoundCloudClient } from 'soundcloud-scraper';
import YouTube from 'youtube-sr';

// @ts-ignore
import * as DP_EXTRACTORS from '@discord-player/extractor';

const SoundCloud = new SoundCloudClient();

export class Player extends EventEmitter {
    /**
     * The discord client that instantiated this player
     */
    public client!: Client;
    public options: PlayerOptions;
    public filters: typeof AudioFilters;

    /**
     * The collection of queues in this player
     */
    public queues = new Collection<Snowflake, Queue>();
    private _resultsCollectors = new Collection<string, Collector<Snowflake, Message>>();
    private _cooldownsTimeout = new Collection<string, NodeJS.Timeout>();

    /**
     * The extractor model collection
     */
    public Extractors = new Collection<string, ExtractorModel>();

    /**
     * Creates new Player instance
     * @param client The discord.js client
     * @param options Player options
     */
    constructor(client: Client, options?: PlayerOptions) {
        super();

        Object.defineProperty(this, 'client', {
            value: client,
            enumerable: false
        });

        /**
         * The player options
         */
        this.options = Object.assign({}, Util.DefaultPlayerOptions, options ?? {});

        // check FFmpeg
        void Util.alertFFmpeg();

        /**
         * The audio filters
         */
        this.filters = AudioFilters;

        this.client.on('voiceStateUpdate', (o, n) => void this._handleVoiceStateUpdate(o, n));

        ['Attachment', 'Facebook', 'Reverbnation', 'Vimeo'].forEach((ext) => void this.use(ext, DP_EXTRACTORS[ext]));
    }

    static get AudioFilters() {
        return AudioFilters;
    }

    /**
     * Define custom extractor in this player
     * @param extractorName The extractor name
     * @param extractor The extractor itself
     */
    use(extractorName: string, extractor: any) {
        if (!extractorName) throw new PlayerError('Missing extractor name!', 'PlayerExtractorError');

        const methods = ['validate', 'getInfo'];

        for (const method of methods) {
            if (typeof extractor[method] !== 'function')
                throw new PlayerError('Invalid extractor supplied!', 'PlayerExtractorError');
        }

        this.Extractors.set(extractorName, new ExtractorModel(extractorName, extractor));

        return this;
    }

    /**
     * Remove existing extractor from this player
     * @param extractorName The extractor name
     */
    unuse(extractorName: string) {
        if (!extractorName) throw new PlayerError('Missing extractor name!', 'PlayerExtractorError');

        return this.Extractors.delete(extractorName);
    }

    private _searchTracks(message: Message, query: string, firstResult?: boolean): Promise<Track> {
        return new Promise(async (resolve) => {
            let tracks: Track[] = [];
            const queryType = Util.getQueryType(query);

            switch (queryType) {
                case 'soundcloud_track':
                    {
                        const data = await SoundCloud.getSongInfo(query).catch(() => {});
                        if (data) {
                            const track = new Track(this, {
                                title: data.title,
                                url: data.url,
                                duration: Util.buildTimeCode(Util.parseMS(data.duration / 1000)),
                                description: data.description,
                                thumbnail: data.thumbnail,
                                views: data.playCount,
                                author: data.author.name,
                                requestedBy: message.author,
                                fromPlaylist: false,
                                source: 'soundcloud',
                                engine: data
                            });

                            tracks.push(track);
                        }
                    }
                    break;
                case 'spotify_song':
                    {
                        const matchSpotifyURL = query.match(
                            /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/
                        );
                        if (matchSpotifyURL) {
                            const spotifyData = await spotify.getPreview(query).catch(() => {});
                            if (spotifyData) {
                                tracks = await Util.ytSearch(`${spotifyData.artist} - ${spotifyData.title}`, {
                                    user: message.author,
                                    player: this,
                                    limit: 1
                                });
                            }
                        }
                    }
                    break;

                // todo: make spotify playlist/album load faster
                case 'spotify_album':
                case 'spotify_playlist': {
                    this.emit(PlayerEvents.PLAYLIST_PARSE_START, null, message);
                    const playlist = await spotify.getData(query);
                    if (!playlist) return void this.emit(PlayerEvents.NO_RESULTS, message, query);

                    // tslint:disable:no-shadowed-variable
                    const tracks = [];

                    for (const item of playlist.tracks.items) {
                        const sq =
                            queryType === 'spotify_album'
                                ? `${item.artists[0].name} - ${item.name}`
                                : `${item.track.artists[0].name} - ${item.name}`;
                        const data = await Util.ytSearch(sq, {
                            limit: 1,
                            player: this,
                            user: message.author,
                            pl: true
                        });

                        if (data[0]) tracks.push(data[0]);
                    }

                    if (!tracks.length) return void this.emit(PlayerEvents.NO_RESULTS, message, query);

                    const pl = {
                        ...playlist,
                        tracks,
                        duration: tracks.reduce((a, c) => a + c.durationMS, 0),
                        thumbnail: playlist.images[0]?.url ?? tracks[0].thumbnail
                    };

                    this.emit(PlayerEvents.PLAYLIST_PARSE_END, pl, message);

                    if (this.isPlaying(message)) {
                        const queue = this._addTracksToQueue(message, tracks);
                        this.emit(PlayerEvents.PLAYLIST_ADD, message, queue, pl);
                    } else {
                        const track = tracks.shift();
                        const queue = (await this._createQueue(message, track).catch(
                            (e) => void this.emit(PlayerEvents.ERROR, e, message)
                        )) as Queue;
                        this.emit(PlayerEvents.TRACK_START, message, queue.tracks[0], queue);
                        this._addTracksToQueue(message, tracks);
                    }

                    return;
                }
                case 'youtube_playlist': {
                    this.emit(PlayerEvents.PLAYLIST_PARSE_START, null, message);
                    const playlist = await YouTube.getPlaylist(query);
                    if (!playlist) return void this.emit(PlayerEvents.NO_RESULTS, message, query);

                    // @ts-ignore
                    playlist.videos = playlist.videos.map(
                        (data) =>
                            new Track(this, {
                                title: data.title,
                                url: data.url,
                                duration: Util.buildTimeCode(Util.parseMS(data.duration)),
                                description: data.description,
                                thumbnail: data.thumbnail?.displayThumbnailURL(),
                                views: data.views,
                                author: data.channel.name,
                                requestedBy: message.author,
                                fromPlaylist: true,
                                source: 'youtube'
                            })
                    );

                    // @ts-ignore
                    playlist.duration = playlist.videos.reduce((a, c) => a + c.durationMS, 0);

                    // @ts-ignore
                    playlist.thumbnail = playlist.thumbnail?.url ?? playlist.videos[0].thumbnail;

                    // @ts-ignore
                    playlist.requestedBy = message.author;

                    this.emit(PlayerEvents.PLAYLIST_PARSE_END, playlist, message);

                    // @ts-ignore
                    const tracks = playlist.videos as Track[];

                    if (this.isPlaying(message)) {
                        const queue = this._addTracksToQueue(message, tracks);
                        this.emit(PlayerEvents.PLAYLIST_ADD, message, queue, playlist);
                    } else {
                        const track = tracks.shift();
                        const queue = (await this._createQueue(message, track).catch(
                            (e) => void this.emit(PlayerEvents.ERROR, e, message)
                        )) as Queue;
                        this.emit(PlayerEvents.TRACK_START, message, queue.tracks[0], queue);
                        this._addTracksToQueue(message, tracks);
                    }

                    return;
                }
                case 'soundcloud_playlist': {
                    this.emit(PlayerEvents.PLAYLIST_PARSE_START, null, message);

                    const data = await SoundCloud.getPlaylist(query).catch(() => {});
                    if (!data) return void this.emit(PlayerEvents.NO_RESULTS, message, query);

                    const res = {
                        id: data.id,
                        title: data.title,
                        tracks: [] as Track[],
                        author: data.author,
                        duration: 0,
                        thumbnail: data.thumbnail,
                        requestedBy: message.author
                    };

                    for (const song of data.tracks) {
                        const r = new Track(this, {
                            title: song.title,
                            url: song.url,
                            duration: Util.buildTimeCode(Util.parseMS(song.duration / 1000)),
                            description: song.description,
                            thumbnail: song.thumbnail ?? 'https://soundcloud.com/pwa-icon-192.png',
                            views: song.playCount ?? 0,
                            author: song.author ?? data.author,
                            requestedBy: message.author,
                            fromPlaylist: true,
                            source: 'soundcloud',
                            engine: song
                        });

                        res.tracks.push(r);
                    }

                    if (!res.tracks.length)
                        return this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.PARSE_ERROR, message);
                    res.duration = res.tracks.reduce((a, c) => a + c.durationMS, 0);

                    this.emit(PlayerEvents.PLAYLIST_PARSE_END, res, message);

                    if (this.isPlaying(message)) {
                        const queue = this._addTracksToQueue(message, res.tracks);
                        this.emit(PlayerEvents.PLAYLIST_ADD, message, queue, res);
                    } else {
                        const track = res.tracks.shift();
                        const queue = (await this._createQueue(message, track).catch(
                            (e) => void this.emit(PlayerEvents.ERROR, e, message)
                        )) as Queue;
                        this.emit(PlayerEvents.TRACK_START, message, queue.tracks[0], queue);
                        this._addTracksToQueue(message, res.tracks);
                    }

                    return;
                }
                default:
                    tracks = await Util.ytSearch(query, { user: message.author, player: this });
            }

            if (tracks.length < 1) return void this.emit(PlayerEvents.NO_RESULTS, message, query);
            if (firstResult || tracks.length === 1) return resolve(tracks[0]);

            const collectorString = `${message.author.id}-${message.channel.id}`;
            const currentCollector = this._resultsCollectors.get(collectorString);
            if (currentCollector) currentCollector.stop();

            const collector = message.channel.createMessageCollector((m) => m.author.id === message.author.id, {
                time: 60000
            });

            this._resultsCollectors.set(collectorString, collector);

            this.emit(PlayerEvents.SEARCH_RESULTS, message, query, tracks, collector);

            collector.on('collect', ({ content }) => {
                if (content === 'cancel') {
                    collector.stop();
                    return this.emit(PlayerEvents.SEARCH_CANCEL, message, query, tracks);
                }

                if (!isNaN(content) && parseInt(content) >= 1 && parseInt(content) <= tracks.length) {
                    const index = parseInt(content, 10);
                    const track = tracks[index - 1];
                    collector.stop();
                    resolve(track);
                } else {
                    this.emit(PlayerEvents.SEARCH_INVALID_RESPONSE, message, query, tracks, content, collector);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    this.emit(PlayerEvents.SEARCH_CANCEL, message, query, tracks);
                }
            });
        });
    }

    /**
     * Play a song
     * @param message The discord.js message object
     * @param query Search query, can be `Player.Track` instance
     * @param firstResult If it should play the first result
     * @example await player.play(message, "never gonna give you up", true)
     */
    async play(message: Message, query: string | Track, firstResult?: boolean): Promise<void> {
        if (!message) throw new PlayerError('Play function needs message');
        if (!query) throw new PlayerError('Play function needs search query as a string or Player.Track object');

        if (this._cooldownsTimeout.has(`end_${message.guild.id}`)) {
            clearTimeout(this._cooldownsTimeout.get(`end_${message.guild.id}`));
            this._cooldownsTimeout.delete(`end_${message.guild.id}`);
        }

        if (typeof query === 'string') query = query.replace(/<(.+)>/g, '$1');
        let track;

        if (query instanceof Track) track = query;
        else {
            if (ytdl.validateURL(query)) {
                const info = await ytdl.getBasicInfo(query).catch(() => {});
                if (!info) return void this.emit(PlayerEvents.NO_RESULTS, message, query);
                if (info.videoDetails.isLiveContent && !this.options.enableLive)
                    return void this.emit(
                        PlayerEvents.ERROR,
                        PlayerErrorEventCodes.LIVE_VIDEO,
                        message,
                        new PlayerError('Live video is not enabled!')
                    );
                const lastThumbnail = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1];

                track = new Track(this, {
                    title: info.videoDetails.title,
                    description: info.videoDetails.description,
                    author: info.videoDetails.author.name,
                    url: info.videoDetails.video_url,
                    thumbnail: lastThumbnail.url,
                    duration: Util.buildTimeCode(Util.parseMS(parseInt(info.videoDetails.lengthSeconds) * 1000)),
                    views: parseInt(info.videoDetails.viewCount),
                    requestedBy: message.author,
                    fromPlaylist: false,
                    source: 'youtube',
                    live: Boolean(info.videoDetails.isLiveContent)
                });
            } else {
                for (const [_, extractor] of this.Extractors) {
                    if (extractor.validate(query)) {
                        const data = await extractor.handle(query);
                        if (data) {
                            track = new Track(this, {
                                title: data.title,
                                description: data.description,
                                duration: Util.buildTimeCode(Util.parseMS(data.duration)),
                                thumbnail: data.thumbnail,
                                author: data.author,
                                views: data.views,
                                engine: data.engine,
                                source: 'arbitrary',
                                fromPlaylist: false,
                                requestedBy: message.author,
                                url: data.url
                            });

                            if (extractor.important) break;
                        }
                    }
                }

                if (!track) track = await this._searchTracks(message, query, firstResult);
            }
        }

        if (track) {
            if (this.isPlaying(message)) {
                const queue = this._addTrackToQueue(message, track);
                this.emit(PlayerEvents.TRACK_ADD, message, queue, queue.tracks[queue.tracks.length - 1]);
            } else {
                const queue = await this._createQueue(message, track);
                if (queue) this.emit(PlayerEvents.TRACK_START, message, queue.tracks[0], queue);
            }
        }
    }

    /**
     * Checks if this player is playing in a server
     * @param message The message object
     */
    isPlaying(message: Message) {
        return this.queues.some((g) => g.guildID === message.guild.id);
    }

    /**
     * Returns guild queue object
     * @param message The message object
     */
    getQueue(message: Message) {
        return this.queues.find((g) => g.guildID === message.guild.id);
    }

    /**
     * Sets audio filters in this player
     * @param message The message object
     * @param newFilters Audio filters object
     */
    setFilters(message: Message, newFilters: QueueFilters): Promise<void> {
        return new Promise((resolve) => {
            const queue = this.queues.find((g) => g.guildID === message.guild.id);
            if (!queue)
                this.emit(
                    PlayerEvents.ERROR,
                    PlayerErrorEventCodes.NOT_PLAYING,
                    message,
                    new PlayerError('Not playing')
                );

            Object.keys(newFilters).forEach((filterName) => {
                // @ts-ignore
                queue.filters[filterName] = newFilters[filterName];
            });

            this._playStream(queue, true).then(() => {
                resolve();
            });
        });
    }

    /**
     * Sets track position
     * @param message The message object
     * @param time Time in ms to set
     * @alias seek
     */
    setPosition(message: Message, time: number): Promise<void> {
        return new Promise((resolve) => {
            const queue = this.queues.find((g) => g.guildID === message.guild.id);
            if (!queue) return this.emit('error', 'NotPlaying', message);

            if (typeof time !== 'number' && !isNaN(time)) time = parseInt(time);
            if (queue.playing.durationMS >= time) return this.skip(message);
            if (
                queue.voiceConnection.dispatcher.streamTime === time ||
                queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime === time
            )
                return resolve();
            if (time < 0) this._playStream(queue, false).then(() => resolve());

            this._playStream(queue, false, time).then(() => resolve());
        });
    }

    /**
     * Sets track position
     * @param message The message object
     * @param time Time in ms to set
     * @alias setPosition
     */
    seek(message: Message, time: number) {
        return this.setPosition(message, time);
    }

    /**
     * Skips current track
     * @param message The message object
     */
    skip(message: Message): boolean {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }

        queue.voiceConnection.dispatcher.end();
        queue.lastSkipped = true;

        return true;
    }

    /**
     * Moves to a new voice channel
     * @param message The message object
     * @param channel New voice channel to move to
     */
    moveTo(message: Message, channel?: VoiceChannel) {
        if (!channel || channel.type !== 'voice') return;
        const queue = this.queues.find((g) => g.guildID === message.guild.id);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }
        if (queue.voiceConnection.channel.id === channel.id) return;

        queue.voiceConnection.dispatcher.pause();
        channel
            .join()
            .then(() => queue.voiceConnection.dispatcher.resume())
            .catch(() => this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.UNABLE_TO_JOIN, message));

        return true;
    }

    /**
     * Pause the playback
     * @param message The message object
     */
    pause(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }

        queue.voiceConnection.dispatcher.pause();
        queue.paused = true;
        return true;
    }

    /**
     * Resume the playback
     * @param message The message object
     */
    resume(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }

        queue.voiceConnection.dispatcher.resume();
        queue.paused = false;
        return true;
    }

    /**
     * Stops the player
     * @param message The message object
     */
    stop(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }

        queue.stopped = true;
        queue.tracks = [];
        if (queue.stream) queue.stream.destroy();
        queue.voiceConnection.dispatcher.end();
        if (this.options.leaveOnStop) queue.voiceConnection.channel.leave();
        this.queues.delete(message.guild.id);
        return true;
    }

    /**
     * Sets music volume
     * @param message The message object
     * @param percent The volume percentage/amount to set
     */
    setVolume(message: Message, percent: number) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }

        queue.volume = percent;
        queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200);

        return true;
    }

    /**
     * Clears the queue
     * @param message The message object
     */
    clearQueue(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }

        queue.tracks = queue.playing ? [queue.playing] : [];

        return true;
    }

    /**
     * Plays previous track
     * @param message The message object
     */
    back(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return false;
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.MUSIC_STARTING, message);
            return false;
        }

        queue.tracks.splice(1, 0, queue.previousTracks.shift());
        queue.voiceConnection.dispatcher.end();
        queue.lastSkipped = true;

        return true;
    }

    /**
     * Sets repeat mode
     * @param message The message object
     * @param enabled If it should enable the repeat mode
     */
    setRepeatMode(message: Message, enabled: boolean) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return;
        }

        queue.repeatMode = Boolean(enabled);

        return queue.repeatMode;
    }

    /**
     * Sets loop mode
     * @param message The message object
     * @param enabled If it should enable the loop mode
     */
    setLoopMode(message: Message, enabled: boolean) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return;
        }

        queue.loopMode = Boolean(enabled);

        return queue.loopMode;
    }

    /**
     * Returns currently playing track
     * @param message The message object
     */
    nowPlaying(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return;
        }

        return queue.tracks[0];
    }

    /**
     * Shuffles the queue
     * @param message The message object
     */
    shuffle(message: Message) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return;
        }

        const currentTrack = queue.tracks.shift();

        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }

        queue.tracks.unshift(currentTrack);

        return queue;
    }

    /**
     * Removes specified track
     * @param message The message object
     * @param track The track object/id to remove
     */
    remove(message: Message, track: Track | number) {
        const queue = this.getQueue(message);
        if (!queue) {
            this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);
            return;
        }

        let trackFound: Track = null;
        if (typeof track === 'number') {
            trackFound = queue.tracks[track];
            if (trackFound) {
                queue.tracks = queue.tracks.filter((t) => t !== trackFound);
            }
        } else {
            trackFound = queue.tracks.find((s) => s === track);
            if (trackFound) {
                queue.tracks = queue.tracks.filter((s) => s !== trackFound);
            }
        }

        return trackFound;
    }

    /**
     * Returns time code of currently playing song
     * @param message The message object
     * @param queueTime If it should make the time code of the whole queue
     */
    getTimeCode(message: Message, queueTime?: boolean) {
        const queue = this.getQueue(message);
        if (!queue) return;

        const previousTracksTime =
            queue.previousTracks.length > 0 ? queue.previousTracks.reduce((p, c) => p + c.durationMS, 0) : 0;
        const currentStreamTime = queueTime ? previousTracksTime + queue.currentStreamTime : queue.currentStreamTime;
        const totalTracksTime = queue.totalTime;
        const totalTime = queueTime ? previousTracksTime + totalTracksTime : queue.playing.durationMS;

        const currentTimecode = Util.buildTimeCode(Util.parseMS(currentStreamTime));
        const endTimecode = Util.buildTimeCode(Util.parseMS(totalTime));

        return {
            current: currentTimecode,
            end: endTimecode
        };
    }

    /**
     * Creates progressbar
     * @param message The message object
     * @param options Progressbar options
     */
    createProgressBar(message: Message, options?: PlayerProgressbarOptions) {
        const queue = this.getQueue(message);
        if (!queue) return;

        const previousTracksTime =
            queue.previousTracks.length > 0 ? queue.previousTracks.reduce((p, c) => p + c.durationMS, 0) : 0;
        const currentStreamTime = options?.queue
            ? previousTracksTime + queue.currentStreamTime
            : queue.currentStreamTime;
        const totalTracksTime = queue.totalTime;
        const totalTime = options?.queue ? previousTracksTime + totalTracksTime : queue.playing.durationMS;
        const length =
            typeof options?.length === 'number'
                ? options?.length <= 0 || options?.length === Infinity
                    ? 15
                    : options?.length
                : 15;

        const index = Math.round((currentStreamTime / totalTime) * length);
        const indicator = '🔘';
        const line = '▬';

        if (index >= 1 && index <= length) {
            const bar = line.repeat(length - 1).split('');
            bar.splice(index, 0, indicator);
            if (Boolean(options?.timecodes)) {
                const currentTimecode = Util.buildTimeCode(Util.parseMS(currentStreamTime));
                const endTimecode = Util.buildTimeCode(Util.parseMS(totalTime));
                return `${currentTimecode} ┃ ${bar.join('')} ┃ ${endTimecode}`;
            } else {
                return `${bar.join('')}`;
            }
        } else {
            if (Boolean(options?.timecodes)) {
                const currentTimecode = Util.buildTimeCode(Util.parseMS(currentStreamTime));
                const endTimecode = Util.buildTimeCode(Util.parseMS(totalTime));
                return `${currentTimecode} ┃ ${indicator}${line.repeat(length - 1)} ┃ ${endTimecode}`;
            } else {
                return `${indicator}${line.repeat(length - 1)}`;
            }
        }
    }

    /**
     * Gets lyrics of a song
     * @param query Search query
     * @example const lyrics = await player.lyrics("alan walker faded")
     * message.channel.send(lyrics.lyrics);
     */
    async lyrics(query: string) {
        const data = await DP_EXTRACTORS.Lyrics(query);
        if (Array.isArray(data)) return null;

        return data as LyricsData;
    }

    /**
     * Toggle autoplay for youtube streams
     * @param message The message object
     * @param enable Enable/Disable autoplay
     */
    setAutoplay(message: Message, enable: boolean): void {
        const queue = this.getQueue(message);
        if (!queue) return void this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message);

        queue.autoPlay = Boolean(enable);
    }

    private _handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const queue = this.queues.find((g) => g.guildID === oldState.guild.id);
        if (!queue) return;

        if (newState.member.id === this.client.user.id && !newState.channelID) {
            queue.stream.destroy();
            this.queues.delete(newState.guild.id);
            this.emit(PlayerEvents.BOT_DISCONNECT, queue.firstMessage);
        }

        if (!queue.voiceConnection || !queue.voiceConnection.channel) return;
        if (!this.options.leaveOnEmpty) return;

        if (!oldState.channelID || newState.channelID) {
            const emptyTimeout = this._cooldownsTimeout.get(`empty_${oldState.guild.id}`);
            const channelEmpty = Util.isVoiceEmpty(queue.voiceConnection.channel);
            if (!channelEmpty && emptyTimeout) {
                clearTimeout(emptyTimeout);
                this._cooldownsTimeout.delete(`empty_${oldState.guild.id}`);
            }
        } else {
            if (!Util.isVoiceEmpty(queue.voiceConnection.channel)) return;
            const timeout = setTimeout(() => {
                if (!Util.isVoiceEmpty(queue.voiceConnection.channel)) return;
                if (!this.queues.has(queue.guildID)) return;
                queue.voiceConnection.channel.leave();
                this.queues.delete(queue.guildID);
                this.emit(PlayerEvents.CHANNEL_EMPTY, queue.firstMessage, queue);
            }, this.options.leaveOnEmptyCooldown || 0);
            this._cooldownsTimeout.set(`empty_${oldState.guild.id}`, timeout);
        }
    }

    private _addTrackToQueue(message: Message, track: Track) {
        const queue = this.getQueue(message);
        if (!queue)
            this.emit(
                PlayerEvents.ERROR,
                PlayerErrorEventCodes.NOT_PLAYING,
                message,
                new PlayerError('Player is not available in this server')
            );
        if (!track || !(track instanceof Track)) throw new PlayerError('No track specified to add to the queue');
        queue.tracks.push(track);
        return queue;
    }

    private _addTracksToQueue(message: Message, tracks: Track[]) {
        const queue = this.getQueue(message);
        if (!queue)
            throw new PlayerError(
                'Cannot add tracks to queue because no song is currently being played on the server.'
            );
        queue.tracks.push(...tracks);
        return queue;
    }

    private _createQueue(message: Message, track: Track): Promise<Queue> {
        return new Promise((resolve) => {
            const channel = message.member.voice ? message.member.voice.channel : null;
            if (!channel)
                return void this.emit(
                    PlayerEvents.ERROR,
                    PlayerErrorEventCodes.NOT_CONNECTED,
                    message,
                    new PlayerError('Voice connection is not available in this server!')
                );

            const queue = new Queue(this, message);
            this.queues.set(message.guild.id, queue);

            channel
                .join()
                .then((connection) => {
                    this.emit(PlayerEvents.CONNECTION_CREATE, message, connection);

                    queue.voiceConnection = connection;
                    if (this.options.autoSelfDeaf) connection.voice.setSelfDeaf(true);
                    queue.tracks.push(track);
                    this.emit(PlayerEvents.QUEUE_CREATE, message, queue);
                    resolve(queue);
                    this._playTrack(queue, true);
                })
                .catch((err) => {
                    this.queues.delete(message.guild.id);
                    this.emit(
                        PlayerEvents.ERROR,
                        PlayerErrorEventCodes.UNABLE_TO_JOIN,
                        message,
                        new PlayerError(err.message ?? err)
                    );
                });
        });
    }

    private async _playTrack(queue: Queue, firstPlay: boolean): Promise<void> {
        if (queue.stopped) return;

        if (!queue.autoPlay && queue.tracks.length === 1 && !queue.loopMode && !queue.repeatMode && !firstPlay) {
            if (this.options.leaveOnEnd && !queue.stopped) {
                this.queues.delete(queue.guildID);
                const timeout = setTimeout(() => {
                    queue.voiceConnection.channel.leave();
                }, this.options.leaveOnEndCooldown || 0);
                this._cooldownsTimeout.set(`end_${queue.guildID}`, timeout);
            }

            this.queues.delete(queue.guildID);

            if (queue.stopped) {
                return void this.emit(PlayerEvents.MUSIC_STOP, queue.firstMessage);
            }

            return void this.emit(PlayerEvents.QUEUE_END, queue.firstMessage, queue);
        }

        if (queue.autoPlay && !queue.repeatMode && !firstPlay) {
            const oldTrack = queue.tracks.shift();

            const info = oldTrack.raw.source === 'youtube' ? await ytdl.getInfo(oldTrack.url).catch((e) => {}) : null;
            if (info) {
                const res = await Util.ytSearch(info.related_videos[0].title, {
                    player: this,
                    limit: 1,
                    user: oldTrack.requestedBy
                })
                    .then((v) => v[0])
                    .catch((e) => {});

                if (res) {
                    queue.tracks.push(res);
                    if (queue.loopMode) queue.tracks.push(oldTrack);
                    queue.previousTracks.push(oldTrack);
                }
            }
        } else if (!queue.autoPlay && !queue.repeatMode && !firstPlay) {
            const oldTrack = queue.tracks.shift();
            if (queue.loopMode) queue.tracks.push(oldTrack);
            queue.previousTracks.push(oldTrack);
        }

        const track = queue.playing;

        queue.lastSkipped = false;
        this._playStream(queue, false).then(() => {
            if (!firstPlay) this.emit(PlayerEvents.TRACK_START, queue.firstMessage, track, queue);
        });
    }

    private _playStream(queue: Queue, updateFilter: boolean, seek?: number): Promise<void> {
        return new Promise(async (resolve) => {
            const ffmpeg = Util.checkFFmpeg();
            if (!ffmpeg) return;

            const seekTime =
                typeof seek === 'number'
                    ? seek
                    : updateFilter
                    ? queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime
                    : undefined;
            const encoderArgsFilters: string[] = [];

            Object.keys(queue.filters).forEach((filterName) => {
                // @ts-ignore
                if (queue.filters[filterName]) {
                    // @ts-ignore
                    encoderArgsFilters.push(this.filters[filterName]);
                }
            });

            let encoderArgs: string[] = [];
            if (encoderArgsFilters.length < 1) {
                encoderArgs = [];
            } else {
                encoderArgs = ['-af', encoderArgsFilters.join(',')];
            }

            let newStream: any;
            if (queue.playing.raw.source === 'youtube') {
                newStream = ytdl(queue.playing.url, {
                    filter: queue.playing.raw.live ? undefined : 'audioonly',
                    opusEncoded: true,
                    encoderArgs: queue.playing.raw.live ? [] : encoderArgs,
                    seek: seekTime / 1000,
                    // tslint:disable-next-line:no-bitwise
                    highWaterMark: 1 << 25,
                    ...this.options.ytdlDownloadOptions
                });
            } else {
                newStream = ytdl.arbitraryStream(
                    queue.playing.raw.source === 'soundcloud'
                        ? await queue.playing.raw.engine.downloadProgressive()
                        : queue.playing.raw.engine,
                    {
                        opusEncoded: true,
                        encoderArgs,
                        seek: seekTime / 1000
                    }
                );
            }

            setTimeout(() => {
                if (queue.stream) queue.stream.destroy();
                queue.stream = newStream;
                queue.voiceConnection.play(newStream, {
                    type: 'opus',
                    bitrate: 'auto',
                    volume: Util.isRepl() ? false : undefined
                });

                if (seekTime) {
                    queue.additionalStreamTime = seekTime;
                }
                queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200);
                queue.voiceConnection.dispatcher.on('start', () => {
                    resolve();
                });

                queue.voiceConnection.dispatcher.on('finish', () => {
                    queue.additionalStreamTime = 0;
                    return this._playTrack(queue, false);
                });

                newStream.on('error', (error: Error) => {
                    if (error.message.toLowerCase().includes('video unavailable')) {
                        this.emit(
                            PlayerEvents.ERROR,
                            PlayerErrorEventCodes.VIDEO_UNAVAILABLE,
                            queue.firstMessage,
                            queue.playing,
                            error
                        );
                        this._playTrack(queue, false);
                    } else {
                        this.emit(PlayerEvents.ERROR, error, queue.firstMessage, error);
                    }
                });
            }, 1000);
        });
    }
}

export default Player;
