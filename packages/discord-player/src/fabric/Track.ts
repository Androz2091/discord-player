import { Collection } from '@discord-player/utils';
import { Player, PlayerNodeInitializationResult, PlayerNodeInitializerOptions } from '../Player';
import { User } from '../clientadapter/IClientAdapter';
import { Exceptions } from '../errors';
import { BaseExtractor } from '../extractors/BaseExtractor';
import { GuildQueue } from '../queue/GuildQueue';
import { RawTrackData, SearchQueryType, TrackJSON } from '../types/types';
import { TypeUtil } from '../utils/TypeUtil';
import { escapeMarkdown, generateRandomId, Util } from '../utils/Util';
import { SerializedType, tryIntoThumbnailString } from '../utils/serde';
import { Playlist } from './Playlist';

export type TrackResolvable = Track | string | number;

export type WithMetadata<T extends object, M> = T & {
    metadata: M;
    requestMetadata(): Promise<M>;
};

export type SerializedTrack = ReturnType<Track['serialize']>;

export class Track<T = unknown> {
    public title: string;
    public description: string;
    public author: string;
    public url: string;
    public thumbnail: string;
    public duration: string;
    public views: number;
    public requestedBy: User | null = null;
    public playlist?: Playlist;
    public queryType: SearchQueryType | null | undefined = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public raw: any;
    public extractor: BaseExtractor | null = null;
    public readonly id = generateRandomId();
    private __metadata: T | null = null;
    private __reqMetadataFn: () => Promise<T | null>;
    public cleanTitle: string;
    public live: boolean = false;

    /**
     * Track constructor
     * @param player The player that instantiated this Track
     * @param data Track data
     */
    public constructor(public readonly player: Player, data: Partial<WithMetadata<RawTrackData, T>>) {
        this.title = escapeMarkdown(data.title ?? '');
        this.author = data.author ?? '';
        this.url = data.url ?? '';
        this.thumbnail = data.thumbnail ?? '';
        this.duration = data.duration ?? '';
        this.views = data.views ?? 0;
        this.queryType = data.queryType;
        this.requestedBy = data.requestedBy || null;
        this.playlist = data.playlist;
        this.description = `${this.title} by ${this.author}`;
        this.raw = Object.assign({}, { source: data.raw?.source ?? data.source }, data.raw ?? data);
        this.__metadata = data.metadata ?? null;
        this.__reqMetadataFn = data.requestMetadata || (() => Promise.resolve<T | null>(null));
        this.cleanTitle = data.cleanTitle ?? Util.cleanTitle(this.title, this.source);
        this.live = data.live ?? false;
    }

    /**
     * Request metadata for this track
     */
    public async requestMetadata() {
        const res = await this.__reqMetadataFn();

        this.setMetadata(res);

        return res;
    }

    /**
     * Set metadata for this track
     */
    public setMetadata(m: T | null) {
        this.__metadata = m;
    }

    /**
     * Metadata of this track
     */
    public get metadata() {
        return this.__metadata;
    }

    /**
     * If this track has metadata
     */
    public get hasMetadata() {
        return this.metadata != null;
    }

    /**
     * The queue in which this track is located
     */
    public get queue(): GuildQueue {
        return this.player.nodes.cache.find((q) => q.tracks.some((ab) => ab.id === this.id))!;
    }

    /**
     * The track duration in millisecond
     */
    public get durationMS(): number {
        const times = (n: number, t: number) => {
            let tn = 1;
            for (let i = 0; i < t; i++) tn *= n;
            return t <= 0 ? 1000 : tn * 1000;
        };

        return this.duration
            .split(':')
            .reverse()
            .map((m, i) => parseInt(m) * times(60, i))
            .reduce((a, c) => a + c, 0);
    }

    /**
     * Discord hyperlink representation of this track
     */
    public toHyperlink(): string /* not using `[${string}](${string})` yet */ {
        return `[${this.title}](${this.url})`;
    }

    /**
     * Returns source of this track
     */
    public get source() {
        return this.raw?.source ?? 'arbitrary';
    }

    /**
     * String representation of this track
     */
    public toString(): string {
        return `${this.title} by ${this.author}`;
    }

    /**
     * Raw JSON representation of this track
     */
    public toJSON(hidePlaylist?: boolean) {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            author: this.author,
            url: this.url,
            thumbnail: this.thumbnail,
            duration: this.duration,
            durationMS: this.durationMS,
            views: this.views,
            requestedBy: this.requestedBy?.id || null,
            playlist: hidePlaylist ? null : this.playlist?.toJSON() ?? null
        } as TrackJSON;
    }

    /**
     * Serialized track data that can be reconstructed
     */
    public serialize() {
        return {
            title: this.title,
            description: this.description,
            author: this.author,
            url: this.url,
            thumbnail: TypeUtil.isString(this.thumbnail) ? this.thumbnail : tryIntoThumbnailString(this.thumbnail),
            duration: this.duration,
            views: this.views ?? 0,
            requested_by: this.requestedBy,
            source: this.source,
            live: false,
            query_type: this.queryType,
            extractor: this.extractor?.identifier ?? null,
            metadata: this.metadata,
            $type: SerializedType.Track,
            $encoder_version: '[VI]{{inject}}[/VI]'
        };
    }

    /**
     * Construct a track from serialized data
     * @param player Player instance
     * @param data Serialized data
     */
    public static fromSerialized(player: Player, data: ReturnType<Track['serialize']>) {
        if (data.$type !== SerializedType.Track) throw Exceptions.ERR_INVALID_ARG_TYPE('data', 'SerializedTrack', 'malformed data');
        const track = new Track(player, {
            ...data,
            requestedBy: data.requested_by
                ? (() => {
                    const user = data.requested_by as User;
                    try {
                        const resolvedUser = player.clientAdapter.getUser(user.id);
                        return resolvedUser;
                    } catch {
                        return null;
                    }
                })()
                : null,
            queryType: data.query_type ?? undefined
        });

        track.setMetadata(data.metadata);

        return track;
    }

    /**
     * Get belonging queues of this track
     */
    public getBelongingQueues() {
        const nodes = this.player.nodes.cache.filter((node) => node.tracks.some((t) => t.id === this.id));

        return nodes as Collection<string, GuildQueue<unknown>>;
    }

    /**
     * Play this track to the given voice channel. If queue exists and another track is being played, this track will be added to the queue.
     * @param channel Voice channel on which this track shall be played
     * @param options Node initialization options
     */
    public async play<T = unknown>(channelId: string, options?: PlayerNodeInitializerOptions<T>): Promise<PlayerNodeInitializationResult<T>> {
        const fn = this.player.play.bind(this.player);

        return await fn(channelId, this, options);
    }
}
