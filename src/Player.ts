import { Client, Collection, Guild, Snowflake, User } from "discord.js";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { Queue } from "./Structures/Queue";
import { VoiceUtils } from "./VoiceInterface/VoiceUtils";
import { PlayerEvents, PlayerOptions, QueryType } from "./types/types";
import Track from "./Structures/Track";
import { QueryResolver } from "./utils/QueryResolver";
import YouTube from "youtube-sr";

class DiscordPlayer extends EventEmitter<PlayerEvents> {
    public readonly client: Client;
    public readonly queues = new Collection<Snowflake, Queue>();
    public readonly voiceUtils = new VoiceUtils();

    constructor(client: Client) {
        super();
        this.client = client;
    }

    createQueue<T = unknown>(guild: Guild, queueInitOptions?: PlayerOptions & { metadata?: any }) {
        if (this.queues.has(guild.id)) return this.queues.get(guild.id) as Queue<T>;

        const queue = new Queue(this, guild, queueInitOptions);
        queue.metadata = queueInitOptions.metadata;
        this.queues.set(guild.id, queue);

        return queue as Queue<T>;
    }

    getQueue<T = unknown>(guild: Snowflake) {
        return this.queues.get(guild) as Queue<T>;
    }

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
     * @param {User} requestedBy The person who requested track search
     * @returns {Promise<Track[]>}
     */
    async search(query: string | Track, requestedBy: User) {
        if (query instanceof Track) return [query];

        // @todo: add extractors
        const qt = QueryResolver.resolve(query);
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
                        requestedBy: requestedBy,
                        thumbnail: m.thumbnail?.displayThumbnailURL("maxresdefault"),
                        views: m.views,
                        fromPlaylist: false,
                        duration: m.durationFormatted,
                        raw: m
                    });
                });
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
