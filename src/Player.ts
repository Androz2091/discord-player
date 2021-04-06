import YouTube from 'youtube-sr';
import { EventEmitter } from 'events';
import { Client, Collection, Snowflake, Collector, Message } from 'discord.js';
import { PlayerOptions } from './types/types';
import Util from './utils/Util';
import AudioFilters from './utils/AudioFilters';
import Queue from './Structures/Queue';
import Track from './Structures/Track';
import { PlayerEvents } from './utils/Constants';

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
}
