import { EventEmitter } from 'events';
import { Client, Collection, Snowflake, Message, Collector } from 'discord.js';
import Util from './utils/Util';
import Queue from './Structures/Queue';
import Track from './Structures/Track';
import PlayerError from './utils/PlayerError';
import { ExtractorModel } from './Structures/ExtractorModel';
import ytdl from 'discord-ytdl-core';
import { PlayerEvents, PlayerErrorEventCodes } from './utils/Constants';

export class Player extends EventEmitter {
    public client: Client;
    public queues = new Collection<Snowflake, Queue>();
    public Extractors = new Collection<string, ExtractorModel>();
    private _cooldownsTimeout = new Collection<string, NodeJS.Timeout>();
    private _resultsCollectors = new Collection<string, Collector<Snowflake, Message>>();

    constructor(client: Client) {
        super();

        Object.defineProperty(this, 'client', {
            value: client,
            enumerable: false
        });

        Util.alertFFmpeg();
    }

    public createQueue(message: Message) {
        return new Promise<Queue>((resolve) => {
            if (this.queues.has(message.guild.id)) return this.queues.get(message.guild.id);
            const channel = message.member.voice?.channel;
            if (!channel) return void this.emit(
                PlayerEvents.ERROR,
                new PlayerError('Voice connection is not available in this server!', PlayerErrorEventCodes.NOT_CONNECTED, message)
            );

            const queue = new Queue(this, message.guild);
            void this.queues.set(message.guild.id, queue);

            channel
                .join()
                .then((connection) => {
                    this.emit(PlayerEvents.CONNECTION_CREATE, message, connection);

                    queue.voiceConnection = connection;
                    if (queue.options.setSelfDeaf) connection.voice.setSelfDeaf(true);
                    this.emit(PlayerEvents.QUEUE_CREATE, message, queue);
                    resolve(queue);
                })
                .catch((err) => {
                    this.queues.delete(message.guild.id);
                    this.emit(
                        PlayerEvents.ERROR,
                        new PlayerError(err.message ?? err, PlayerErrorEventCodes.UNABLE_TO_JOIN, message)
                    );
                });

            return queue;
        })
    }

    public getQueue(message: Message) {
        return this.queues.get(message.guild.id) ?? null;
    }

    async play(message: Message, query: string | Track, firstResult?: boolean): Promise<void> {
        if (!message) throw new PlayerError('Play function needs message');
        if (!query) throw new PlayerError('Play function needs search query as a string or Player.Track object');

        if (this._cooldownsTimeout.has(`end_${message.guild.id}`)) {
            clearTimeout(this._cooldownsTimeout.get(`end_${message.guild.id}`));
            this._cooldownsTimeout.delete(`end_${message.guild.id}`);
        }

        if (typeof query === 'string') query = query.replace(/<(.+)>/g, '$1');
        let track;

        const queue = this.getQueue(message);

        if (query instanceof Track) track = query;
        else {
            if (ytdl.validateURL(query)) {
                const info = await ytdl.getBasicInfo(query).catch(() => { });
                if (!info) return void this.emit(PlayerEvents.NO_RESULTS, message, query);
                if (info.videoDetails.isLiveContent && !queue.options.enableLive)
                    return void this.emit(
                        PlayerEvents.ERROR,
                        new PlayerError('Live video is not enabled!', PlayerErrorEventCodes.LIVE_VIDEO, message)
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

                if (!track) track = await this.searchTracks(message, query, firstResult);
            }
        }

        if (track) {
            if (queue) {
                const q = queue.addTrack(track);
                this.emit(PlayerEvents.TRACK_ADD, message, q, q.tracks[q.tracks.length - 1]);
            } else {
                const q = queue.addTrack(track);
                if (q) this.emit(PlayerEvents.TRACK_START, message, q.tracks[0], q);

                // todo: start playing
            }
        }
    }

    private searchTracks(message: Message, query: string, firstResult?: boolean): Promise<Track> {
        return new Promise(async (resolve) => {
            let tracks: Track[] = [];
            const queryType = Util.getQueryType(query);

            switch (queryType) {
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
}

export default Player;