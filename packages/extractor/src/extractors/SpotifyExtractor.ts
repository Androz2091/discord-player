import {
  BaseExtractor,
  ExtractorInfo,
  ExtractorSearchContext,
  ExtractorStreamable,
  Playlist,
  QueryType,
  SearchQueryType,
  Track,
  Util,
} from 'discord-player';
import type { Readable } from 'stream';
import { fetch } from '../internal/helper';
import spotify, {
  Spotify,
  SpotifyAlbum,
  SpotifyPlaylist,
  SpotifySong,
} from 'spotify-url-info';
import { SpotifyAPI } from '../internal';
import { StreamFN } from '../types/common';

const re =
  /^(?:https:\/\/open\.spotify\.com\/(intl-([a-z]|[A-Z]){0,3}\/)?(?:user\/[A-Za-z0-9]+\/)?|spotify:)(album|playlist|track)(?:[/:])([A-Za-z0-9]+).*$/;

export interface SpotifyExtractorInit {
  clientId?: string | null;
  clientSecret?: string | null;
  createStream?: (
    ext: SpotifyExtractor,
    url: string,
  ) => Promise<Readable | string>;
}

export class SpotifyExtractor extends BaseExtractor<SpotifyExtractorInit> {
  public static identifier = 'com.discord-player.spotifyextractor' as const;
  private _stream!: StreamFN;
  private _lib!: Spotify;
  private _credentials = {
    clientId: this.options.clientId || process.env.DP_SPOTIFY_CLIENT_ID || null,
    clientSecret:
      this.options.clientSecret || process.env.DP_SPOTIFY_CLIENT_SECRET || null,
  };
  public internal = new SpotifyAPI(this._credentials);

  public async activate(): Promise<void> {
    this.protocols = ['spsearch', 'spotify'];
    this._lib = spotify(fetch);
    if (this.internal.isTokenExpired()) await this.internal.requestToken();

    const fn = this.options.createStream;
    if (typeof fn === 'function') {
      this._stream = (q: string) => {
        return fn(this, q);
      };
    }
  }

  public async deactivate() {
    this._stream = undefined as unknown as StreamFN;
    this._lib = undefined as unknown as Spotify;
    this.protocols = [];
  }

  public async validate(
    query: string,
    type?: SearchQueryType | null | undefined,
  ): Promise<boolean> {
    // prettier-ignore
    return (<SearchQueryType[]>[
            QueryType.SPOTIFY_ALBUM,
            QueryType.SPOTIFY_PLAYLIST,
            QueryType.SPOTIFY_SONG,
            QueryType.SPOTIFY_SEARCH,
            QueryType.AUTO,
            QueryType.AUTO_SEARCH
        ]).some((t) => t === type);
  }

  public async getRelatedTracks(track: Track) {
    return await this.handle(track.author || track.title, {
      type: QueryType.SPOTIFY_SEARCH,
      requestedBy: track.requestedBy,
    });
  }

  public async handle(
    query: string,
    context: ExtractorSearchContext,
  ): Promise<ExtractorInfo> {
    if (context.protocol === 'spsearch')
      context.type = QueryType.SPOTIFY_SEARCH;
    switch (context.type) {
      case QueryType.AUTO:
      case QueryType.AUTO_SEARCH:
      case QueryType.SPOTIFY_SEARCH: {
        const data = await this.internal.search(query);
        if (!data) return this.createResponse();

        return this.createResponse(
          null,
          data.map((spotifyData) => {
            const track: Track = new Track(this.context.player, {
              title: spotifyData.title,
              description: `${spotifyData.title} by ${spotifyData.artist}`,
              author: spotifyData.artist ?? 'Unknown Artist',
              url: spotifyData.url,
              thumbnail:
                spotifyData.thumbnail ||
                'https://www.scdn.co/i/_global/twitter_card-default.jpg',
              duration: Util.buildTimeCode(
                Util.parseMS(spotifyData.duration ?? 0),
              ),
              views: 0,
              requestedBy: context.requestedBy,
              source: 'spotify',
              queryType: QueryType.SPOTIFY_SONG,
              metadata: {
                source: spotifyData,
                bridge: null,
              },
              requestMetadata: async () => {
                return {
                  source: spotifyData,
                  bridge: null,
                };
              },
            });

            track.extractor = this;

            return track;
          }),
        );
      }
      case QueryType.SPOTIFY_SONG: {
        const spotifyData: SpotifySong | void = await this._lib
          .getData(query, context.requestOptions as unknown as RequestInit)
          .catch(Util.noop);
        if (!spotifyData) return { playlist: null, tracks: [] };
        const spotifyTrack: Track = new Track(this.context.player, {
          title: spotifyData.title,
          description: `${spotifyData.name} by ${spotifyData.artists
            .map((m) => m.name)
            .join(', ')}`,
          author: spotifyData.artists[0]?.name ?? 'Unknown Artist',
          url: spotifyData.id
            ? `https://open.spotify.com/track/${spotifyData.id}`
            : query,
          thumbnail:
            spotifyData.coverArt?.sources?.[0]?.url ||
            'https://www.scdn.co/i/_global/twitter_card-default.jpg',
          duration: Util.buildTimeCode(
            Util.parseMS(spotifyData.duration ?? spotifyData.maxDuration ?? 0),
          ),
          views: 0,
          requestedBy: context.requestedBy,
          source: 'spotify',
          queryType: context.type,
          metadata: {
            source: spotifyData,
            bridge: null,
          },
          requestMetadata: async () => {
            return {
              source: spotifyData,
              bridge: null,
            };
          },
        });

        spotifyTrack.extractor = this;

        return { playlist: null, tracks: [spotifyTrack] };
      }
      case QueryType.SPOTIFY_PLAYLIST: {
        try {
          const { queryType, id } = this.parse(query);
          if (queryType !== 'playlist') throw 'err';

          const spotifyPlaylist = await this.internal.getPlaylist(id);
          if (!spotifyPlaylist) throw 'err';

          const playlist = new Playlist(this.context.player, {
            title: spotifyPlaylist.name,
            description: spotifyPlaylist.name ?? '',
            thumbnail:
              spotifyPlaylist.thumbnail ??
              'https://www.scdn.co/i/_global/twitter_card-default.jpg',
            type: 'playlist',
            source: 'spotify',
            author: {
              name: spotifyPlaylist.author ?? 'Unknown Artist',
              url: null as unknown as string,
            },
            tracks: [],
            id: spotifyPlaylist.id,
            url: spotifyPlaylist.url || query,
            rawPlaylist: spotifyPlaylist,
          });

          playlist.tracks = spotifyPlaylist.tracks.map((spotifyData) => {
            const data: Track = new Track(this.context.player, {
              title: spotifyData.title,
              description: `${spotifyData.title} by ${spotifyData.artist}`,
              author: spotifyData.artist ?? 'Unknown Artist',
              url: spotifyData.url,
              thumbnail:
                spotifyData.thumbnail ||
                'https://www.scdn.co/i/_global/twitter_card-default.jpg',
              duration: Util.buildTimeCode(
                Util.parseMS(spotifyData.duration ?? 0),
              ),
              views: 0,
              requestedBy: context.requestedBy,
              source: 'spotify',
              queryType: QueryType.SPOTIFY_SONG,
              metadata: {
                source: spotifyData,
                bridge: null,
              },
              requestMetadata: async () => {
                return {
                  source: spotifyData,
                  bridge: null,
                };
              },
            });
            data.extractor = this;
            data.playlist = playlist;
            return data;
          }) as Track[];

          return { playlist, tracks: playlist.tracks };
        } catch {
          const spotifyPlaylist: SpotifyPlaylist | void = await this._lib
            .getData(query, context.requestOptions as unknown as RequestInit)
            .catch(Util.noop);
          if (!spotifyPlaylist) return { playlist: null, tracks: [] };

          const playlist = new Playlist(this.context.player, {
            title: spotifyPlaylist.name ?? spotifyPlaylist.title,
            description: spotifyPlaylist.title ?? '',
            thumbnail:
              spotifyPlaylist.coverArt?.sources?.[0]?.url ??
              'https://www.scdn.co/i/_global/twitter_card-default.jpg',
            type: spotifyPlaylist.type,
            source: 'spotify',
            author: {
              name: spotifyPlaylist.subtitle ?? 'Unknown Artist',
              url: null as unknown as string,
            },
            tracks: [],
            id: spotifyPlaylist.id,
            url: spotifyPlaylist.id
              ? `https://open.spotify.com/playlist/${spotifyPlaylist.id}`
              : query,
            rawPlaylist: spotifyPlaylist,
          });

          playlist.tracks = spotifyPlaylist.trackList.map((m) => {
            const data: Track = new Track(this.context.player, {
              title: m.title ?? '',
              description: m.title ?? '',
              author: m.subtitle ?? 'Unknown Artist',
              url: m.uid ? `https://open.spotify.com/tracks/${m.uid}` : query,
              thumbnail:
                'https://www.scdn.co/i/_global/twitter_card-default.jpg',
              duration: Util.buildTimeCode(Util.parseMS(m.duration)),
              views: 0,
              requestedBy: context.requestedBy,
              playlist,
              source: 'spotify',
              queryType: 'spotifySong',
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
            data.extractor = this;
            data.playlist = playlist;
            return data;
          }) as Track[];

          return { playlist, tracks: playlist.tracks };
        }
      }
      case QueryType.SPOTIFY_ALBUM: {
        try {
          const { queryType, id } = this.parse(query);
          if (queryType !== 'album') throw 'err';

          const spotifyAlbum = await this.internal.getAlbum(id);
          if (!spotifyAlbum) throw 'err';

          const playlist = new Playlist(this.context.player, {
            title: spotifyAlbum.name,
            description: spotifyAlbum.name ?? '',
            thumbnail:
              spotifyAlbum.thumbnail ??
              'https://www.scdn.co/i/_global/twitter_card-default.jpg',
            type: 'album',
            source: 'spotify',
            author: {
              name: spotifyAlbum.author ?? 'Unknown Artist',
              url: null as unknown as string,
            },
            tracks: [],
            id: spotifyAlbum.id,
            url: spotifyAlbum.url || query,
            rawPlaylist: spotifyAlbum,
          });

          playlist.tracks = spotifyAlbum.tracks.map((spotifyData) => {
            const data: Track = new Track(this.context.player, {
              title: spotifyData.title,
              description: `${spotifyData.title} by ${spotifyData.artist}`,
              author: spotifyData.artist ?? 'Unknown Artist',
              url: spotifyData.url,
              thumbnail:
                spotifyData.thumbnail ||
                'https://www.scdn.co/i/_global/twitter_card-default.jpg',
              duration: Util.buildTimeCode(
                Util.parseMS(spotifyData.duration ?? 0),
              ),
              views: 0,
              requestedBy: context.requestedBy,
              source: 'spotify',
              queryType: QueryType.SPOTIFY_SONG,
              metadata: {
                source: spotifyData,
                bridge: null,
              },
              requestMetadata: async () => {
                return {
                  source: spotifyData,
                  bridge: null,
                };
              },
            });
            data.extractor = this;
            data.playlist = playlist;
            return data;
          }) as Track[];

          return { playlist, tracks: playlist.tracks };
        } catch {
          const album: SpotifyAlbum | void = await this._lib
            .getData(query, context.requestOptions as unknown as RequestInit)
            .catch(Util.noop);
          if (!album) return { playlist: null, tracks: [] };

          const playlist = new Playlist(this.context.player, {
            title: album.name ?? album.title,
            description: album.title ?? '',
            thumbnail:
              album.coverArt?.sources?.[0]?.url ??
              'https://www.scdn.co/i/_global/twitter_card-default.jpg',
            type: album.type,
            source: 'spotify',
            author: {
              name: album.subtitle ?? 'Unknown Artist',
              url: null as unknown as string,
            },
            tracks: [],
            id: album.id,
            url: album.id
              ? `https://open.spotify.com/playlist/${album.id}`
              : query,
            rawPlaylist: album,
          });

          playlist.tracks = album.trackList.map((m) => {
            const data: Track = new Track(this.context.player, {
              title: m.title ?? '',
              description: m.title ?? '',
              author: m.subtitle ?? 'Unknown Artist',
              url: m.uid ? `https://open.spotify.com/tracks/${m.uid}` : query,
              thumbnail:
                'https://www.scdn.co/i/_global/twitter_card-default.jpg',
              duration: Util.buildTimeCode(Util.parseMS(m.duration)),
              views: 0,
              requestedBy: context.requestedBy,
              playlist,
              source: 'spotify',
              queryType: 'spotifySong',
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
            data.extractor = this;
            data.playlist = playlist;
            return data;
          }) as Track[];

          return { playlist, tracks: playlist.tracks };
        }
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

  public parse(q: string) {
    const [, , , queryType, id] = re.exec(q) || [];

    return { queryType, id };
  }
}
