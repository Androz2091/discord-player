// @ts-nocheck
import { YouTube } from 'youtube-sr';

// prettier-ignore
import {
    BaseExtractor,
    ExtractorInfo,
    ExtractorSearchContext,
    Playlist,
    QueryType,
    SearchQueryType,
    Track,
    Util
} from 'discord-player';

import spotify, { Spotify, SpotifyAlbum, SpotifyPlaylist, SpotifySong } from 'spotify-url-info';
import fetch from 'node-fetch';
import { AppleMusic } from '../internal/AppleMusic';

type StreamFN = (q: string) => Promise<import('stream').Readable | string>;

const YouTubeLibs = ['play-dl', 'ytdl-core'] as const;

// taken from ytdl-core
const validQueryDomains = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'gaming.youtube.com']);
const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts)\/)/;
const idRegex = /^[a-zA-Z0-9-_]{11}$/;

export class YoutubeExtractor extends BaseExtractor {
    public static identifier = 'com.discord-player.ysaextractor' as const;
    private _stream!: StreamFN;
    private _spotify!: Spotify;

    public async activate() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lib: any,
            isYtdl = false;

        for (const ytlib of YouTubeLibs) {
            // eslint-disable-next-line no-cond-assign
            if ((lib = Util.require(ytlib))) {
                isYtdl = ytlib === 'ytdl-core';
                break;
            }
        }

        if (lib) {
            this._stream = async (query) => {
                if (isYtdl) {
                    const dl = lib as typeof import('ytdl-core');
                    const info = await dl.getInfo(query, this.context.player.options.ytdlOptions);

                    const formats = info.formats
                        .filter((format) => {
                            return info.videoDetails.isLiveContent ? format.isHLS && format.hasAudio : format.hasAudio;
                        })
                        .sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate));

                    const fmt = formats.find((format) => !format.hasVideo) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                    return fmt.url;
                    // return dl(query, this.context.player.options.ytdlOptions);
                } else {
                    const dl = lib as typeof import('play-dl');

                    const info = await dl.video_info(query);
                    const formats = info.format
                        .filter((format) => {
                            const re = /\/manifest\/hls_(variant|playlist)\//;
                            if (!format.url) return false;
                            if (info.video_details.live) return re.test(format.url) && typeof format.bitrate === 'number';
                            return typeof format.bitrate === 'number';
                        })
                        .sort((a, b) => Number(b.bitrate) - Number(a.bitrate));

                    const fmt = formats.find((format) => !format.qualityLabel) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                    return fmt.url!;
                    // return (await dl.stream(query, { discordPlayerCompatibility: true })).stream;
                }
            };
        }

        this._spotify = spotify(fetch);
    }

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        return (
            [
                QueryType.YOUTUBE,
                QueryType.YOUTUBE_PLAYLIST,
                QueryType.YOUTUBE_SEARCH,
                QueryType.YOUTUBE_VIDEO,
                QueryType.SPOTIFY_ALBUM,
                QueryType.SPOTIFY_PLAYLIST,
                QueryType.SPOTIFY_SONG,
                QueryType.APPLE_MUSIC_ALBUM,
                QueryType.APPLE_MUSIC_PLAYLIST,
                QueryType.APPLE_MUSIC_SONG,
                QueryType.AUTO
            ] as SearchQueryType[]
        ).some((r) => r === type);
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        if (YoutubeExtractor.validateURL(query)) context.type = QueryType.YOUTUBE_VIDEO;

        switch (context.type) {
            case QueryType.YOUTUBE_PLAYLIST: {
                const ytpl = await YouTube.getPlaylist(query, {
                    fetchAll: true
                }).catch(Util.noop);
                if (!ytpl) return this.emptyResponse();

                const playlist = new Playlist(this.context.player, {
                    title: ytpl.title!,
                    thumbnail: ytpl.thumbnail as unknown as string,
                    description: ytpl.title || '',
                    type: 'playlist',
                    source: 'youtube',
                    author: {
                        name: ytpl.channel!.name as string,
                        url: ytpl.channel!.url as string
                    },
                    tracks: [],
                    id: ytpl.id as string,
                    url: ytpl.url as string,
                    rawPlaylist: ytpl
                });

                playlist.tracks = ytpl.videos.map(
                    (video) =>
                        new Track(this.context.player, {
                            title: video.title as string,
                            description: video.description as string,
                            author: video.channel?.name as string,
                            url: video.url,
                            requestedBy: context.requestedBy,
                            thumbnail: video.thumbnail!.url as string,
                            views: video.views,
                            duration: video.durationFormatted,
                            raw: video,
                            playlist: playlist,
                            source: 'youtube',
                            queryType: 'youtubeVideo'
                        })
                );

                return { playlist, tracks: playlist.tracks };
            }
            case QueryType.YOUTUBE_VIDEO: {
                const id = /[a-zA-Z0-9-_]{11}/.exec(query);
                if (!id?.[0]) return this.emptyResponse();
                const video = await YouTube.getVideo(`https://www.youtube.com/watch?v=${id}`).catch(Util.noop);
                if (!video) return this.emptyResponse();

                // @ts-expect-error
                video.source = 'youtube';

                return {
                    playlist: null,
                    tracks: [
                        new Track(this.context.player, {
                            title: video.title!,
                            description: video.description!,
                            author: video.channel?.name as string,
                            url: video.url,
                            requestedBy: context.requestedBy,
                            thumbnail: video.thumbnail?.displayThumbnailURL('maxresdefault') as string,
                            views: video.views,
                            duration: video.durationFormatted,
                            source: 'youtube',
                            raw: video,
                            queryType: context.type
                        })
                    ]
                };
            }
            case QueryType.SPOTIFY_SONG: {
                const spotifyData: SpotifySong | void = await this._spotify.getData(query).catch(Util.noop);
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
                const spotifyPlaylist: SpotifyPlaylist | void = await this._spotify.getData(query).catch(Util.noop);
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
                const album: SpotifyAlbum | void = await this._spotify.getData(query).catch(Util.noop);
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
            case QueryType.APPLE_MUSIC_ALBUM: {
                const info = await AppleMusic.getAlbumInfo(query);
                if (!info) return this.emptyResponse();

                const playlist = new Playlist(this.context.player, {
                    author: {
                        name: info.artist.name,
                        url: ''
                    },
                    description: info.title,
                    id: info.id,
                    source: 'apple_music',
                    thumbnail: info.thumbnail,
                    title: info.title,
                    tracks: [],
                    type: 'album',
                    url: info.url,
                    rawPlaylist: info
                });

                playlist.tracks = info.tracks.map(
                    (
                        m: any // eslint-disable-line
                    ) =>
                        new Track(this.context.player, {
                            author: m.artist.name,
                            description: m.title,
                            duration: typeof m.duration === 'number' ? Util.buildTimeCode(Util.parseMS(m.duration)) : m.duration,
                            thumbnail: m.thumbnail,
                            title: m.title,
                            url: m.url,
                            views: 0,
                            source: 'apple_music',
                            requestedBy: context.requestedBy,
                            queryType: 'appleMusicSong'
                        })
                );

                return { playlist, tracks: playlist.tracks };
            }
            case QueryType.APPLE_MUSIC_PLAYLIST: {
                const info = await AppleMusic.getPlaylistInfo(query);
                if (!info) return this.emptyResponse();

                const playlist = new Playlist(this.context.player, {
                    author: {
                        name: info.artist.name,
                        url: ''
                    },
                    description: info.title,
                    id: info.id,
                    source: 'apple_music',
                    thumbnail: info.thumbnail,
                    title: info.title,
                    tracks: [],
                    type: 'playlist',
                    url: info.url,
                    rawPlaylist: info
                });

                playlist.tracks = info.tracks.map(
                    (
                        m: any // eslint-disable-line
                    ) =>
                        new Track(this.context.player, {
                            author: m.artist.name,
                            description: m.title,
                            duration: typeof m.duration === 'number' ? Util.buildTimeCode(Util.parseMS(m.duration)) : m.duration,
                            thumbnail: m.thumbnail,
                            title: m.title,
                            url: m.url,
                            views: 0,
                            source: 'apple_music',
                            requestedBy: context.requestedBy,
                            queryType: 'appleMusicSong'
                        })
                );

                return { playlist, tracks: playlist.tracks };
            }
            case QueryType.APPLE_MUSIC_SONG: {
                const info = await AppleMusic.getSongInfo(query);
                if (!info) return this.emptyResponse();

                const track = new Track(this.context.player, {
                    author: info.artist.name,
                    description: info.title,
                    duration: typeof info.duration === 'number' ? Util.buildTimeCode(Util.parseMS(info.duration)) : info.duration,
                    thumbnail: info.thumbnail,
                    title: info.title,
                    url: info.url,
                    views: 0,
                    source: 'apple_music',
                    requestedBy: context.requestedBy,
                    queryType: context.type
                });

                return { playlist: null, tracks: [track] };
            }
            default: {
                const tracks = await this._makeYTSearch(query, context);
                return { playlist: null, tracks };
            }
        }
    }

    private async _makeYTSearch(query: string, context: ExtractorSearchContext) {
        const res = await YouTube.search(query, {
            type: 'video'
        }).catch(Util.noop);

        if (!res || !res.length) return [];

        return res.map((video) => {
            // @ts-expect-error
            video.source = 'youtube';

            return new Track(this.context.player, {
                title: video.title!,
                description: video.description!,
                author: video.channel?.name as string,
                url: video.url,
                requestedBy: context.requestedBy,
                thumbnail: video.thumbnail?.displayThumbnailURL('maxresdefault') as string,
                views: video.views,
                duration: video.durationFormatted,
                source: 'youtube',
                raw: video,
                queryType: context.type!
            });
        });
    }

    public emptyResponse(): ExtractorInfo {
        return { playlist: null, tracks: [] };
    }

    public async stream(info: Track) {
        if (!this._stream) {
            throw new Error(`Could not find youtube streaming library. Install one of ${YouTubeLibs.join(', ')}`);
        }

        let url = info.url;

        if (info.queryType === 'spotifySong' || info.queryType === 'appleMusicSong') {
            if (YoutubeExtractor.validateURL(info.raw.url)) url = info.raw.url;
            else {
                const _url = await YouTube.searchOne(`${info.title} ${info.author}`, 'video')
                    .then((r) => r.url)
                    .catch(Util.noop);
                if (!_url) throw new Error(`Could not extract stream for this track`);
                info.raw.url = url = _url;
            }
        }

        return this._stream(url);
    }

    public static validateURL(link: string) {
        try {
            YoutubeExtractor.parseURL(link);
            return true;
        } catch {
            return false;
        }
    }

    public static validateId(id: string) {
        return idRegex.test(id.trim());
    }

    public static parseURL(link: string) {
        const parsed = new URL(link.trim());
        let id = parsed.searchParams.get('v');
        if (validPathDomains.test(link.trim()) && !id) {
            const paths = parsed.pathname.split('/');
            id = parsed.host === 'youtu.be' ? paths[1] : paths[2];
        } else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
            throw Error('Not a YouTube domain');
        }
        if (!id) {
            throw Error(`No video id found: "${link}"`);
        }
        id = id.substring(0, 11);
        if (!exports.validateID(id)) {
            throw TypeError(`Video id (${id}) does not match expected ` + `format (${idRegex.toString()})`);
        }
        return id;
    }
}

export { YoutubeExtractor as YouTubeExtractor };
