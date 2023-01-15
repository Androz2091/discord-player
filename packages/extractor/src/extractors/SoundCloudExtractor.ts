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
import { Client, Song } from 'soundcloud-scraper';
import { downloadStream } from '../internal/downloader';

const soundcloud = new Client(undefined, {
    fetchAPIKey: true
});

export class SoundCloudExtractor extends BaseExtractor {
    public static identifier = 'com.discord-player.scextractor' as const;

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        return ([QueryType.SOUNDCLOUD, QueryType.SOUNDCLOUD_PLAYLIST, QueryType.SOUNDCLOUD_SEARCH, QueryType.SOUNDCLOUD_TRACK] as SearchQueryType[]).some((r) => r === type);
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch (context.type) {
            case QueryType.SOUNDCLOUD_TRACK: {
                const trackInfo = await soundcloud
                    .getSongInfo(query, {
                        fetchComments: false,
                        fetchEmbed: false,
                        fetchStreamURL: true
                    })
                    .catch(Util.noop);

                if (!trackInfo) return this.emptyResponse();

                const track = new Track(this.context.player, {
                    title: trackInfo.title,
                    url: trackInfo.url,
                    duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                    description: trackInfo.description,
                    thumbnail: trackInfo.thumbnail,
                    views: trackInfo.playCount,
                    author: trackInfo.author.name,
                    requestedBy: context.requestedBy,
                    source: 'soundcloud',
                    engine: trackInfo,
                    queryType: context.type
                });

                return { playlist: null, tracks: [track] };
            }
            case QueryType.SOUNDCLOUD_PLAYLIST: {
                const data = await soundcloud
                    .getPlaylist(query, {
                        fetchEmbed: false
                    })
                    .catch(Util.noop);
                if (!data) return { playlist: null, tracks: [] };

                const res = new Playlist(this.context.player, {
                    title: data.title,
                    description: data.description ?? '',
                    thumbnail: data.thumbnail ?? 'https://soundcloud.com/pwa-icon-192.png',
                    type: 'playlist',
                    source: 'soundcloud',
                    author: {
                        name: data.author?.name ?? data.author?.username ?? 'Unknown Artist',
                        url: data.author?.profile
                    },
                    tracks: [],
                    id: `${data.id}`,
                    url: data.url,
                    rawPlaylist: data
                });

                for (const song of data.tracks) {
                    const track = new Track(this.context.player, {
                        title: song.title,
                        description: song.description ?? '',
                        author: song.author?.username ?? song.author?.name ?? 'Unknown Artist',
                        url: song.url,
                        thumbnail: song.thumbnail,
                        duration: Util.buildTimeCode(Util.parseMS(song.duration)),
                        views: song.playCount ?? 0,
                        requestedBy: context.requestedBy,
                        playlist: res,
                        source: 'soundcloud',
                        engine: song,
                        queryType: context.type
                    });
                    res.tracks.push(track);
                }

                return { playlist: res, tracks: res.tracks };
            }
            default: {
                const tracks = await soundcloud.search(query, 'track').catch(Util.noop);
                if (!tracks || !tracks.length) return this.emptyResponse();

                const resolvedTracks: Track[] = [];

                for (const searchedTrack of tracks) {
                    const trackInfo = await soundcloud
                        .getSongInfo(searchedTrack.url, {
                            fetchStreamURL: true,
                            fetchComments: false,
                            fetchEmbed: false
                        })
                        .catch(Util.noop);
                    if (!trackInfo) continue;

                    const track = new Track(this.context.player, {
                        title: trackInfo.title,
                        url: trackInfo.url,
                        duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                        description: trackInfo.description,
                        thumbnail: trackInfo.thumbnail,
                        views: trackInfo.playCount,
                        author: trackInfo.author.name,
                        requestedBy: context.requestedBy,
                        source: 'soundcloud',
                        engine: trackInfo,
                        queryType: 'soundcloudTrack'
                    });

                    resolvedTracks.push(track);
                }

                return { playlist: null, tracks: resolvedTracks };
            }
        }
    }

    public emptyResponse(): ExtractorInfo {
        return { playlist: null, tracks: [] };
    }

    public async stream(info: Track) {
        const engine = info.raw.engine as Song;
        if (engine && engine.streamURL) {
            return await engine.downloadProgressive();
        }

        const url = await soundcloud.fetchStreamURL(info.url).catch(Util.noop);
        if (!url) throw new Error('Could not extract stream from this source');

        if (engine) {
            engine.streamURL = url;
        } else {
            info.raw.engine = {
                streamURL: url
            };
        }

        return downloadStream(url);
    }
}
