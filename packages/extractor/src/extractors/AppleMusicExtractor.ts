import {
  ExtractorInfo,
  ExtractorSearchContext,
  ExtractorStreamable,
  GuildQueueHistory,
  Playlist,
  QueryType,
  SearchQueryType,
  Track,
  Util,
  BaseExtractor,
} from 'discord-player';
import { AppleMusic } from '../internal';
import { Readable } from 'stream';
import { StreamFN } from '../types/common';

export interface AppleMusicExtractorInit {
  createStream?: (
    ext: AppleMusicExtractor,
    url: string,
    track: Track,
  ) => Promise<Readable | string>;
}

export class AppleMusicExtractor extends BaseExtractor<AppleMusicExtractorInit> {
  public static identifier = 'com.discord-player.applemusicextractor' as const;
  private _stream!: StreamFN;

  public async activate(): Promise<void> {
    this.protocols = ['amsearch', 'applemusic'];
    const fn = this.options.createStream;

    if (typeof fn === 'function') {
      this._stream = (q: string, t: Track) => {
        return fn(this, q, t);
      };
    }
  }

  public async deactivate() {
    this.protocols = [];
  }

  public async validate(
    query: string,
    type?: SearchQueryType | null | undefined,
  ): Promise<boolean> {
    // prettier-ignore
    return (<SearchQueryType[]>[
            QueryType.APPLE_MUSIC_ALBUM,
            QueryType.APPLE_MUSIC_PLAYLIST,
            QueryType.APPLE_MUSIC_SONG,
            QueryType.APPLE_MUSIC_SEARCH,
            QueryType.AUTO,
            QueryType.AUTO_SEARCH
        ]).some((t) => t === type);
  }

  public async getRelatedTracks(track: Track, history: GuildQueueHistory) {
    if (track.queryType === QueryType.APPLE_MUSIC_SONG) {
      const data = await this.handle(track.author || track.title, {
        type: QueryType.APPLE_MUSIC_SEARCH,
        requestedBy: track.requestedBy,
      });

      const unique = data.tracks.filter(
        (t) => !history.tracks.some((h) => h.url === t.url),
      );
      return unique.length > 0
        ? this.createResponse(null, unique)
        : this.createResponse();
    }

    return this.createResponse();
  }

  public async handle(
    query: string,
    context: ExtractorSearchContext,
  ): Promise<ExtractorInfo> {
    if (context.protocol === 'amsearch')
      context.type = QueryType.APPLE_MUSIC_SEARCH;

    switch (context.type) {
      case QueryType.AUTO:
      case QueryType.AUTO_SEARCH:
      case QueryType.APPLE_MUSIC_SEARCH: {
        const data = await AppleMusic.search(query);
        if (!data || !data.length) return this.createResponse();
        const tracks = data.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => {
            const track: Track = new Track(this.context.player, {
              author: m.artist.name,
              description: m.title,
              duration:
                typeof m.duration === 'number'
                  ? Util.buildTimeCode(Util.parseMS(m.duration))
                  : m.duration,
              thumbnail: m.thumbnail,
              title: m.title,
              url: m.url,
              views: 0,
              source: 'apple_music',
              requestedBy: context.requestedBy,
              queryType: 'appleMusicSong',
              metadata: {
                source: m,
                bridge: null,
              },
              requestMetadata: async () => {
                return {
                  source: m,
                  bridge: null,
                };
              },
            });

            track.extractor = this;

            return track;
          },
        );

        return this.createResponse(null, tracks);
      }
      case QueryType.APPLE_MUSIC_ALBUM: {
        const info = await AppleMusic.getAlbumInfo(query);
        if (!info) return this.createResponse();

        const playlist = new Playlist(this.context.player, {
          author: {
            name: info.artist.name,
            url: '',
          },
          description: info.title,
          id: info.id,
          source: 'apple_music',
          thumbnail: info.thumbnail,
          title: info.title,
          tracks: [],
          type: 'album',
          url: info.url,
          rawPlaylist: info,
        });

        playlist.tracks = info.tracks.map(
          (
            m: any, // eslint-disable-line
          ) => {
            const track: Track = new Track(this.context.player, {
              author: m.artist.name,
              description: m.title,
              duration:
                typeof m.duration === 'number'
                  ? Util.buildTimeCode(Util.parseMS(m.duration))
                  : m.duration,
              thumbnail: m.thumbnail,
              title: m.title,
              url: m.url,
              views: 0,
              source: 'apple_music',
              requestedBy: context.requestedBy,
              queryType: 'appleMusicSong',
              metadata: {
                source: info,
                bridge: null,
              },
              requestMetadata: async () => {
                return {
                  source: info,
                  bridge: null,
                };
              },
            });
            track.playlist = playlist;
            track.extractor = this;
            return track;
          },
        );

        return { playlist, tracks: playlist.tracks };
      }
      case QueryType.APPLE_MUSIC_PLAYLIST: {
        const info = await AppleMusic.getPlaylistInfo(query);
        if (!info) return this.createResponse();

        const playlist = new Playlist(this.context.player, {
          author: {
            name: info.artist.name,
            url: '',
          },
          description: info.title,
          id: info.id,
          source: 'apple_music',
          thumbnail: info.thumbnail,
          title: info.title,
          tracks: [],
          type: 'playlist',
          url: info.url,
          rawPlaylist: info,
        });

        playlist.tracks = info.tracks.map(
          (
            m: any, // eslint-disable-line
          ) => {
            const track: Track = new Track(this.context.player, {
              author: m.artist.name,
              description: m.title,
              duration:
                typeof m.duration === 'number'
                  ? Util.buildTimeCode(Util.parseMS(m.duration))
                  : m.duration,
              thumbnail: m.thumbnail,
              title: m.title,
              url: m.url,
              views: 0,
              source: 'apple_music',
              requestedBy: context.requestedBy,
              queryType: 'appleMusicSong',
              metadata: {
                source: m,
                bridge: null,
              },
              requestMetadata: async () => {
                return {
                  source: m,
                  bridge: null,
                };
              },
            });

            track.playlist = playlist;
            track.extractor = this;

            return track;
          },
        );

        return { playlist, tracks: playlist.tracks };
      }
      case QueryType.APPLE_MUSIC_SONG: {
        const info = await AppleMusic.getSongInfo(query);
        if (!info) return this.createResponse();

        const track: Track = new Track(this.context.player, {
          author: info.artist.name,
          description: info.title,
          duration:
            typeof info.duration === 'number'
              ? Util.buildTimeCode(Util.parseMS(info.duration))
              : info.duration,
          thumbnail: info.thumbnail,
          title: info.title,
          url: info.url,
          views: 0,
          source: 'apple_music',
          requestedBy: context.requestedBy,
          queryType: context.type,
          metadata: {
            source: info,
            bridge: null,
          },
          requestMetadata: async () => {
            return {
              source: info,
              bridge: null,
            };
          },
        });

        track.extractor = this;

        return { playlist: null, tracks: [track] };
      }
      default:
        return { playlist: null, tracks: [] };
    }
  }

  public async stream(info: Track): Promise<ExtractorStreamable> {
    if (this._stream) {
      const stream = await this._stream(info.url, info);
      if (typeof stream === 'string') return stream;
      return stream;
    }

    // new api
    const result = await this.context.requestBridge(info, this);

    if (!result?.result) throw new Error('Could not bridge this track');

    return result.result;
  }
}
