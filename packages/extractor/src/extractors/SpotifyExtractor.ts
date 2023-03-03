import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Playlist, QueryType, SearchQueryType, Track, Util } from 'discord-player';
import { Readable } from 'stream';
import { YoutubeExtractor } from './YoutubeExtractor';
import { StreamFN, getFetch, loadYtdl, makeYTSearch } from './common/helper';
import spotify, { Spotify, SpotifyAlbum, SpotifyPlaylist, SpotifySong } from 'spotify-url-info';

export class SpotifyExtractor extends BaseExtractor {
    public static identifier = 'com.discord-player.spotifyextractor' as const;
    private _stream!: StreamFN;
    private _lib!: Spotify;

    public async activate(): Promise<void> {
        const lib = await loadYtdl(this.context.player.options.ytdlOptions);
        this._stream = lib.stream;
        this._lib = spotify(getFetch);
    }

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        return (<SearchQueryType[]>[QueryType.SPOTIFY_ALBUM, QueryType.SPOTIFY_PLAYLIST, QueryType.SPOTIFY_SONG]).some((t) => t === type);
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch (context.type) {
            case QueryType.SPOTIFY_SONG: {
                const spotifyData: SpotifySong | void = await this._lib.getData(query, context.requestOptions as unknown as RequestInit).catch(Util.noop);
                if (!spotifyData) return { playlist: null, tracks: [] };
                const spotifyTrack = new Track(this.context.player, {
                    title: spotifyData.title,
                    description: `${spotifyData.name} by ${spotifyData.artists.map((m) => m.name).join(', ')}`,
                    author: spotifyData.artists[0]?.name ?? 'Unknown Artist',
                    url: spotifyData.id ? `https://open.spotify.com/track/${spotifyData.id}` : query,
                    thumbnail: spotifyData.coverArt?.sources?.[0]?.url || 'https://www.scdn.co/i/_global/twitter_card-default.jpg',
                    duration: Util.buildTimeCode(Util.parseMS(spotifyData.duration ?? spotifyData.maxDuration ?? 0)),
                    views: 0,
                    requestedBy: context.requestedBy,
                    source: 'spotify',
                    queryType: context.type
                });

                return { playlist: null, tracks: [spotifyTrack] };
            }
            case QueryType.SPOTIFY_PLAYLIST: {
                const spotifyPlaylist: SpotifyPlaylist | void = await this._lib.getData(query, context.requestOptions as unknown as RequestInit).catch(Util.noop);
                if (!spotifyPlaylist) return { playlist: null, tracks: [] };

                const playlist = new Playlist(this.context.player, {
                    title: spotifyPlaylist.name ?? spotifyPlaylist.title,
                    description: spotifyPlaylist.title ?? '',
                    thumbnail: spotifyPlaylist.coverArt?.sources?.[0]?.url ?? 'https://www.scdn.co/i/_global/twitter_card-default.jpg',
                    type: spotifyPlaylist.type,
                    source: 'spotify',
                    author: {
                        name: spotifyPlaylist.subtitle ?? 'Unknown Artist',
                        url: null as unknown as string
                    },
                    tracks: [],
                    id: spotifyPlaylist.id,
                    url: spotifyPlaylist.id ? `https://open.spotify.com/playlist/${spotifyPlaylist.id}` : query,
                    rawPlaylist: spotifyPlaylist
                });

                playlist.tracks = spotifyPlaylist.trackList.map((m) => {
                    const data = new Track(this.context.player, {
                        title: m.title ?? '',
                        description: m.title ?? '',
                        author: m.subtitle ?? 'Unknown Artist',
                        url: m.uid ? `https://open.spotify.com/tracks/${m.uid}` : query,
                        thumbnail: 'https://www.scdn.co/i/_global/twitter_card-default.jpg',
                        duration: Util.buildTimeCode(Util.parseMS(m.duration)),
                        views: 0,
                        requestedBy: context.requestedBy,
                        playlist,
                        source: 'spotify',
                        queryType: 'spotifySong'
                    });
                    return data;
                }) as Track[];

                return { playlist, tracks: playlist.tracks };
            }
            case QueryType.SPOTIFY_ALBUM: {
                const album: SpotifyAlbum | void = await this._lib.getData(query, context.requestOptions as unknown as RequestInit).catch(Util.noop);
                if (!album) return { playlist: null, tracks: [] };

                const playlist = new Playlist(this.context.player, {
                    title: album.name ?? album.title,
                    description: album.title ?? '',
                    thumbnail: album.coverArt?.sources?.[0]?.url ?? 'https://www.scdn.co/i/_global/twitter_card-default.jpg',
                    type: album.type,
                    source: 'spotify',
                    author: {
                        name: album.subtitle ?? 'Unknown Artist',
                        url: null as unknown as string
                    },
                    tracks: [],
                    id: album.id,
                    url: album.id ? `https://open.spotify.com/playlist/${album.id}` : query,
                    rawPlaylist: album
                });

                playlist.tracks = album.trackList.map((m) => {
                    const data = new Track(this.context.player, {
                        title: m.title ?? '',
                        description: m.title ?? '',
                        author: m.subtitle ?? 'Unknown Artist',
                        url: m.uid ? `https://open.spotify.com/tracks/${m.uid}` : query,
                        thumbnail: 'https://www.scdn.co/i/_global/twitter_card-default.jpg',
                        duration: Util.buildTimeCode(Util.parseMS(m.duration)),
                        views: 0,
                        requestedBy: context.requestedBy,
                        playlist,
                        source: 'spotify',
                        queryType: 'spotifySong'
                    });
                    return data;
                }) as Track[];

                return { playlist, tracks: playlist.tracks };
            }
            default:
                return { playlist: null, tracks: [] };
        }
    }

    public async stream(info: Track): Promise<string | Readable> {
        if (!this._stream) {
            throw new Error(`Could not find youtube streaming library.`);
        }

        let url = info.url;

        if (YoutubeExtractor.validateURL(info.raw.url)) url = info.raw.url;
        else {
            const _url = await makeYTSearch(`${info.title} ${info.author}`, 'video')
                .then((r) => r[0].url)
                .catch(Util.noop);
            if (!_url) throw new Error(`Could not extract stream for this track`);
            info.raw.url = url = _url;
        }

        return this._stream(url);
    }
}
