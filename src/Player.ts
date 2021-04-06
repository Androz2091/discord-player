import YouTube from 'youtube-sr';
import { EventEmitter } from 'events';
import { Client, Collection, Snowflake, Collector, Message } from 'discord.js';
import { PlayerOptions } from './types/types';
import Util from './utils/Util';
import AudioFilters from './utils/AudioFilters';
import Queue from './Structures/Queue';
import Track from './Structures/Track';
import { PlayerErrorEventCodes, PlayerEvents } from './utils/Constants';
import PlayerError from "./utils/PlayerError";
import ytdl from "discord-ytdl-core";

// @ts-ignore
import spotify from 'spotify-url-info';
// @ts-ignore
import { Client as SoundCloudClient } from 'soundcloud-scraper';

const SoundCloud = new SoundCloudClient();

export default class Player extends EventEmitter {
    public client!: Client;
    public options: PlayerOptions;
    public filters: typeof AudioFilters;
    public queues: Collection<Snowflake, Queue>;
    private _resultsCollectors: Collection<string, Collector<Snowflake, Message>>;
    private _cooldownsTimeout: Collection<string, NodeJS.Timeout>;

    constructor(client: Client, options?: PlayerOptions) {
        super();

        /**
         * The discord client that instantiated this player
         */
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

        /**
         * Player queues
         */
        this.queues = new Collection();
    }

    static get AudioFilters() {
        return AudioFilters;
    }

    private _searchTracks(
        message: Message,
        query: string,
        firstResult?: boolean
    ): Promise<Track> {
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
                                duration: Util.durationString(Util.parseMS(data.duration / 1000)),
                                description: data.description,
                                thumbnail: data.thumbnail,
                                views: data.playCount,
                                author: data.author,
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
                                    player: this
                                });
                            }
                        }
                    }
                    break;
                default:
                    tracks = await Util.ytSearch(query, { user: message.author, player: this });
            }

            if (tracks.length < 1) return this.emit(PlayerEvents.NO_RESULTS, message, query);
            if (firstResult) return resolve(tracks[0]);

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

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    this.emit(PlayerEvents.SEARCH_CANCEL, message, query, tracks);
                }
            });
        });
    }

    async play(message: Message, query: string | Track, firstResult?: boolean) {
        if (!message) throw new PlayerError("Play function needs message");
        if (!query) throw new PlayerError("Play function needs search query as a string or Player.Track object");

        if (this._cooldownsTimeout.has(`end_${message.guild.id}`)) {
            clearTimeout(this._cooldownsTimeout.get(`end_${message.guild.id}`));
            this._cooldownsTimeout.delete(`end_${message.guild.id}`);
        }

        if (typeof query === "string") query = query.replace(/<(.+)>/g, '$1');
        let track;

        if (query instanceof Track) track = query;
        else {
            if (ytdl.validateURL(query)) {
                const info = await ytdl.getBasicInfo(query).catch(() => {});
                if (!info) return this.emit(PlayerEvents.NO_RESULTS, message, query);
                if (info.videoDetails.isLiveContent && !this.options.enableLive) return this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.LIVE_VIDEO, message, new PlayerError("Live video is not enabled!"));
                const lastThumbnail = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1];

                track = new Track(this, {
                    title: info.videoDetails.title,
                    description: info.videoDetails.description,
                    author: info.videoDetails.author.name,
                    url: info.videoDetails.video_url,
                    thumbnail: lastThumbnail.url,
                    duration: Util.durationString(Util.parseMS(parseInt(info.videoDetails.lengthSeconds) * 1000)),
                    views: parseInt(info.videoDetails.viewCount),
                    requestedBy: message.author,
                    fromPlaylist: false,
                    source: "youtube"
                });
            } else {
                track = await this._searchTracks(message, query, firstResult);
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

    isPlaying(message: Message) {
        return this.queues.some(g => g.guildID === message.guild.id);
    }

    getQueue(message: Message) {
        return this.queues.find(g => g.guildID === message.guild.id);
    }

    private _addTrackToQueue(message: Message, track: Track) {
        const queue = this.getQueue(message);
        if (!queue) this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_PLAYING, message, new PlayerError("Player is not available in this server"));
        if (!track || !(track instanceof Track)) throw new PlayerError('No track specified to add to the queue');
        queue.tracks.push(track);
        return queue;
    }

    private _createQueue(message: Message, track: Track): Promise<Queue> {
        return new Promise((resolve) => {
            const channel = message.member.voice ? message.member.voice.channel : null
            if (!channel) return this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.NOT_CONNECTED, message, new PlayerError("Voice connection is not available in this server!"));

            const queue = new Queue(this, message, this.filters);
            this.queues.set(message.guild.id, queue);

            channel.join().then((connection) => {
                this.emit(PlayerEvents.CONNECTION_CREATE, message, connection);

                queue.voiceConnection = connection;
                if (this.options.autoSelfDeaf) connection.voice.setSelfDeaf(true);
                queue.tracks.push(track);
                this.emit(PlayerEvents.QUEUE_CREATE, message, queue);
                resolve(queue);
                // this._playTrack(queue, true)
            }).catch((err) => {
                this.queues.delete(message.guild.id);
                this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.UNABLE_TO_JOIN, message, new PlayerError(err.message ?? err));
            });
        });
    }

    private async _playTrack(queue: Queue, firstPlay: boolean) {
        if (queue.stopped) return;

        if (queue.tracks.length === 1 && !queue.loopMode && !queue.repeatMode && !firstPlay) {
            if (this.options.leaveOnEnd && !queue.stopped) {
                this.queues.delete(queue.guildID)
                const timeout = setTimeout(() => {
                    queue.voiceConnection.channel.leave();
                }, this.options.leaveOnEndCooldown || 0);
                this._cooldownsTimeout.set(`end_${queue.guildID}`, timeout);
            }

            this.queues.delete(queue.guildID)

            if (queue.stopped) {
                return this.emit(PlayerEvents.MUSIC_STOP, queue.firstMessage);
            }

            return this.emit(PlayerEvents.QUEUE_END, queue.firstMessage, queue);
        }

        if (!queue.repeatMode && !firstPlay) {
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
            const ffmeg = Util.checkFFmpeg();
            if (!ffmeg) return;

            const seekTime = typeof seek === "number" ? seek : updateFilter ? queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime : undefined;
            const encoderArgsFilters: string[] = [];

            Object.keys(queue.filters).forEach((filterName) => {
                // @ts-ignore
                if (queue.filters[filterName]) {
                    // @ts-ignore
                    encoderArgsFilters.push(this.filters[filterName]);
                }
            });

            let encoderArgs: string[];
            if (encoderArgsFilters.length < 1) {
                encoderArgs = []
            } else {
                encoderArgs = ['-af', encoderArgsFilters.join(',')]
            }

            let newStream: any;
            if (queue.playing.raw.source === "youtube") {
                newStream = ytdl(queue.playing.url, {
                    filter: 'audioonly',
                    opusEncoded: true,
                    encoderArgs,
                    seek: seekTime / 1000,
                    highWaterMark: 1 << 25,
                    ...this.options.ytdlDownloadOptions
                });
            } else {
                newStream = ytdl.arbitraryStream(queue.playing.raw.source === "soundcloud" ? await queue.playing.raw.engine.downloadProgressive() : queue.playing.raw.engine, {
                    opusEncoded: true,
                    encoderArgs,
                    seek: seekTime / 1000
                });
            }

            setTimeout(() => {
                if (queue.stream) queue.stream.destroy();
                queue.stream = newStream;
                queue.voiceConnection.play(newStream, {
                    type: 'opus',
                    bitrate: 'auto'
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
                        this.emit(PlayerEvents.ERROR, PlayerErrorEventCodes.VIDEO_UNAVAILABLE, queue.firstMessage, queue.playing, error);
                        this._playTrack(queue, false);
                    } else {
                        this.emit(PlayerEvents.ERROR, error, queue.firstMessage, error);
                    }
                });
            }, 1000);
        });
    }

}
