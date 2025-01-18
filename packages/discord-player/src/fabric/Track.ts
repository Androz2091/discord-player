import {
  User,
  escapeMarkdown,
  SnowflakeUtil,
  GuildVoiceChannelResolvable,
  APIUser,
} from 'discord.js';
import {
  Player,
  PlayerNodeInitializationResult,
  PlayerNodeInitializerOptions,
} from '../Player';
import { Playlist, PlaylistJSON } from './Playlist';
import { GuildQueue } from '../queue/GuildQueue';
import { BaseExtractor } from '../extractors/BaseExtractor';
import { Collection } from '@discord-player/utils';
import { TypeUtil } from '../utils/TypeUtil';
import { SerializedType, tryIntoThumbnailString } from '../utils/serde';
import { InvalidArgTypeError } from '../errors';
import { Util } from '../utils/Util';
import { SearchQueryType } from '../utils/QueryResolver';
import { AudioResource } from 'discord-voip';
import { SeekEvent } from '@discord-player/equalizer';

export type TrackResolvable = Track | string | number;

export type WithMetadata<T extends object, M> = T & {
  metadata: M;
  requestMetadata(): Promise<M>;
};

export type SerializedTrack = ReturnType<Track['serialize']>;

/**
 * The track source:
 * - soundcloud
 * - youtube
 * - spotify
 * - apple_music
 * - arbitrary
 */
export type TrackSource =
  | 'soundcloud'
  | 'youtube'
  | 'spotify'
  | 'apple_music'
  | 'arbitrary';

export interface RawTrackData {
  /**
   * The title
   */
  title: string;
  /**
   * The description
   */
  description: string;
  /**
   * The author
   */
  author: string;
  /**
   * The url
   */
  url: string;
  /**
   * The thumbnail
   */
  thumbnail: string;
  /**
   * The duration
   */
  duration: string;
  /**
   * The duration in ms
   */
  views: number;
  /**
   * The user who requested this track
   */
  requestedBy?: User | null;
  /**
   * The playlist
   */
  playlist?: Playlist;
  /**
   * The source
   */
  source?: TrackSource;
  /**
   * The engine
   */
  engine?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * If this track is live
   */
  live?: boolean;
  /**
   * The raw data
   */
  raw?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * The query type
   */
  queryType?: SearchQueryType;
  /**
   * The serialized title
   */
  cleanTitle?: string;
}

export interface TrackJSON {
  /**
   * The track id
   */
  id: string;
  /**
   * The track title
   */
  title: string;
  /**
   * The track description
   */
  description: string;
  /**
   * The track author
   */
  author: string;
  /**
   * The track url
   */
  url: string;
  /**
   * The track thumbnail
   */
  thumbnail: string;
  /**
   * The track duration
   */
  duration: string;
  /**
   * The track duration in ms
   */
  durationMS: number;
  /**
   * The track views
   */
  views: number;
  /**
   * The user id who requested this track
   */
  requestedBy: string;
  /**
   * The playlist info (if any)
   */
  playlist?: PlaylistJSON;
}

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
  public readonly id = SnowflakeUtil.generate().toString();
  private __metadata: T | null = null;
  private __reqMetadataFn: () => Promise<T | null>;
  public cleanTitle: string;
  public live: boolean = false;
  public bridgedExtractor: BaseExtractor | null = null;
  public bridgedTrack: Track | null = null;

  #onSeek: ((event: SeekEvent) => Awaited<void>) | null = null;
  #resource: AudioResource<Track> | null = null;

  /**
   * Track constructor
   * @param player The player that instantiated this Track
   * @param data Track data
   */
  public constructor(
    public readonly player: Player,
    data: Partial<WithMetadata<RawTrackData, T>>,
  ) {
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
    this.raw = Object.assign(
      {},
      { source: data.raw?.source ?? data.source },
      data.raw ?? data,
    );
    this.__metadata = data.metadata ?? null;
    this.__reqMetadataFn =
      data.requestMetadata || (() => Promise.resolve<T | null>(null));
    this.cleanTitle =
      data.cleanTitle ?? Util.cleanTitle(this.title, this.source);
    this.live = data.live ?? false;
  }

  /**
   * Whether this track can be seeked
   */
  public get seekable() {
    return this.#onSeek !== null;
  }

  /**
   * Set the onSeek event
   * @param fn The onSeek event
   */
  public handleSeek(fn: (event: SeekEvent) => Awaited<void>) {
    this.#onSeek = fn;
  }

  /**
   * Request seek
   * @param event The seek event
   */
  public async seek(event: SeekEvent) {
    if (this.#onSeek) return this.#onSeek(event);
  }

  /**
   * Sets audio resource for this track. This is not useful outside of the library.
   * @param resource Audio resource
   */
  public setResource(resource: AudioResource<Track> | null) {
    this.#resource = resource;
  }

  /**
   * Gets audio resource for this track
   */
  public get resource() {
    return this.#resource;
  }

  /**
   * Whether this track has an audio resource
   */
  public get hasResource() {
    return this.#resource != null;
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
    return this.player.nodes.cache.find((q) =>
      q.tracks.some((ab) => ab.id === this.id),
    )!;
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
      playlist: hidePlaylist ? null : this.playlist?.toJSON() ?? null,
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
      thumbnail: TypeUtil.isString(this.thumbnail)
        ? this.thumbnail
        : tryIntoThumbnailString(this.thumbnail),
      duration: this.duration,
      views: this.views ?? 0,
      requested_by: this.requestedBy?.toJSON() ?? null,
      source: this.source,
      live: false,
      query_type: this.queryType,
      extractor: this.extractor?.identifier ?? null,
      metadata: this.metadata,
      $type: SerializedType.Track,
      $encoder_version: this.player.version,
    };
  }

  /**
   * Construct a track from serialized data
   * @param player Player instance
   * @param data Serialized data
   */
  public static fromSerialized(
    player: Player,
    data: ReturnType<Track['serialize']>,
  ) {
    if (data.$type !== SerializedType.Track)
      throw new InvalidArgTypeError(
        'data',
        'SerializedTrack',
        'malformed data',
      );
    const track = new Track(player, {
      ...data,
      requestedBy: data.requested_by
        ? (() => {
            const res = data.requested_by as APIUser;
            try {
              const resolved = player.client.users.resolve(res.id);
              if (resolved) return resolved;
              if (player.client.users.cache.has(res.id))
                return player.client.users.cache.get(res.id)!;
              // @ts-expect-error
              const user = new User(player.client, res);
              return user;
            } catch {
              return null;
            }
          })()
        : null,
      queryType: data.query_type ?? undefined,
    });

    track.setMetadata(data.metadata);

    return track;
  }

  /**
   * Get belonging queues of this track
   */
  public getBelongingQueues() {
    const nodes = this.player.nodes.cache.filter((node) =>
      node.tracks.some((t) => t.id === this.id),
    );

    return nodes as Collection<string, GuildQueue<unknown>>;
  }

  /**
   * Play this track to the given voice channel. If queue exists and another track is being played, this track will be added to the queue.
   * @param channel Voice channel on which this track shall be played
   * @param options Node initialization options
   */
  public async play<T = unknown>(
    channel: GuildVoiceChannelResolvable,
    options?: PlayerNodeInitializerOptions<T>,
  ): Promise<PlayerNodeInitializationResult<T>> {
    const fn = this.player.play.bind(this.player);

    return await fn(channel, this, options);
  }
}
