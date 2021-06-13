import { Client, Collection, Guild, Snowflake, User } from "discord.js";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { Queue } from "./Structures/Queue";
import { VoiceUtils } from "./VoiceInterface/VoiceUtils";
import { PlayerEvents, PlayerOptions, QueryType, SearchOptions } from "./types/types";
import Track from "./Structures/Track";
import { QueryResolver } from "./utils/QueryResolver";
import YouTube from "youtube-sr";
import { Util } from "./utils/Util";
// @ts-ignore
import { Client as SoundCloud } from "soundcloud-scraper";

const soundcloud = new SoundCloud();

class DiscordPlayer extends EventEmitter<PlayerEvents> {
    public readonly client: Client;
    public readonly queues = new Collection<Snowflake, Queue>();
    public readonly voiceUtils = new VoiceUtils();

    /**
     * Creates new Discord Player
     * @param {Discord.Client} client The Discord Client
     */
    constructor(client: Client) {
        super();

        /**
         * The discord.js client
         * @type {Discord.Client}
         */
        this.client = client;
    }

    /**
     * Creates a queue for a guild if not available, else returns existing queue
     * @param {Discord.Guild} guild The guild
     * @param {PlayerOptions} queueInitOptions Queue init options
     * @returns {Queue}
     */
    createQueue<T = unknown>(guild: Guild, queueInitOptions?: PlayerOptions & { metadata?: any }) {
        if (this.queues.has(guild.id)) return this.queues.get(guild.id) as Queue<T>;

        const _meta = queueInitOptions.metadata;
        delete queueInitOptions["metadata"];
        const queue = new Queue(this, guild, queueInitOptions);
        queue.metadata = _meta;
        this.queues.set(guild.id, queue);

        return queue as Queue<T>;
    }

    /**
     * Returns the queue if available
     * @param {Discord.Snowflake} guild The guild id
     * @returns {Queue}
     */
    getQueue<T = unknown>(guild: Snowflake) {
        return this.queues.get(guild) as Queue<T>;
    }

    /**
     * Deletes a queue and returns deleted queue object
     * @param {Discord.Snowflake} guild The guild id to remove
     * @returns {Queue}
     */
    deleteQueue<T = unknown>(guild: Snowflake) {
        const prev = this.getQueue<T>(guild);

        try {
            prev.destroy();
        } catch {}
        this.queues.delete(guild);

        return prev;
    }

    /**
     * Search tracks
     * @param {string|Track} query The search query
     * @param {Discord.User} requestedBy The person who requested track search
     * @returns {Promise<Track[]>}
     */
    async search(query: string | Track, options: SearchOptions) {
        if (query instanceof Track) return [query];
        if (!options) throw new Error("DiscordPlayer#search needs search options!");
        if (!("searchEngine" in options)) options.searchEngine = QueryType.AUTO;

        // @todo: add extractors
        const qt = options.searchEngine === QueryType.AUTO ? QueryResolver.resolve(query) : options.searchEngine;
        switch (qt) {
            case QueryType.YOUTUBE_SEARCH: {
                const videos = await YouTube.search(query, {
                    type: "video"
                });

                return videos.map((m) => {
                    (m as any).source = "youtube";
                    return new Track(this, {
                        title: m.title,
                        description: m.description,
                        author: m.channel?.name,
                        url: m.url,
                        requestedBy: options.requestedBy,
                        thumbnail: m.thumbnail?.displayThumbnailURL("maxresdefault"),
                        views: m.views,
                        fromPlaylist: false,
                        duration: m.durationFormatted,
                        raw: m
                    });
                });
            }
            case QueryType.SOUNDCLOUD_TRACK:
            case QueryType.SOUNDCLOUD_SEARCH: {
                const result: any[] = QueryResolver.resolve(query) === QueryType.SOUNDCLOUD_TRACK ? [{ url: query }] : await soundcloud.search(query, "track").catch(() => {});
                if (!result || !result.length) return [];
                const res: Track[] = [];

                for (const r of result) {
                    const trackInfo = await soundcloud.getSongInfo(r.url).catch(() => {});
                    if (!trackInfo) continue;

                    const track = new Track(this, {
                        title: trackInfo.title,
                        url: trackInfo.url,
                        duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                        description: trackInfo.description,
                        thumbnail: trackInfo.thumbnail,
                        views: trackInfo.playCount,
                        author: trackInfo.author.name,
                        requestedBy: options.requestedBy,
                        fromPlaylist: false,
                        source: "soundcloud",
                        engine: trackInfo
                    });

                    res.push(track);
                }

                return res;
            }
            default:
                return [];
        }
    }

    *[Symbol.iterator]() {
        yield* Array.from(this.queues.values());
    }
}

export { DiscordPlayer as Player };
