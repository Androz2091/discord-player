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
import * as SoundCloud from 'soundcloud.ts';

export interface SoundCloudExtractorInit {
    clientId?: string;
    oauthToken?: string;
    proxy?: string;
}

export class SoundCloudExtractor extends BaseExtractor<SoundCloudExtractorInit> {
    public static identifier = 'com.discord-player.soundcloudextractor' as const;

    public internal = new SoundCloud.default({
        clientId: this.options.clientId,
        oauthToken: this.options.oauthToken,
        proxy: this.options.proxy
    });

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        // prettier-ignore
        return ([
            QueryType.SOUNDCLOUD,
            QueryType.SOUNDCLOUD_PLAYLIST,
            QueryType.SOUNDCLOUD_SEARCH,
            QueryType.SOUNDCLOUD_TRACK,
            QueryType.AUTO,
            QueryType.AUTO_SEARCH
        ] as SearchQueryType[]).some((r) => r === type);
    }

    public async getRelatedTracks(track: Track) {
        if (track.queryType === QueryType.SOUNDCLOUD_TRACK)
            return this.handle(track.author || track.title, {
                requestedBy: track.requestedBy,
                type: QueryType.SOUNDCLOUD_SEARCH
            });

        return this.createResponse();
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch (context.type) {
            case QueryType.SOUNDCLOUD_TRACK: {
                const trackInfo = await this.internal.tracks.getV2(query).catch(Util.noop);

                if (!trackInfo) return this.emptyResponse();

                const track = new Track(this.context.player, {
                    title: trackInfo.title,
                    url: trackInfo.permalink_url,
                    duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                    description: trackInfo.description ?? '',
                    thumbnail: trackInfo.artwork_url,
                    views: trackInfo.playback_count,
                    author: trackInfo.user.username,
                    requestedBy: context.requestedBy,
                    source: 'soundcloud',
                    engine: trackInfo,
                    queryType: context.type,
                    metadata: trackInfo,
                    requestMetadata: async () => {
                        return trackInfo;
                    }
                });

                track.extractor = this;

                return { playlist: null, tracks: [track] };
            }
            case QueryType.SOUNDCLOUD_PLAYLIST: {
                const data = await this.internal.playlists.getV2(query).catch(Util.noop);
                if (!data) return { playlist: null, tracks: [] };

                const res = new Playlist(this.context.player, {
                    title: data.title,
                    description: data.description ?? '',
                    thumbnail: data.artwork_url ?? data.tracks[0].artwork_url,
                    type: 'playlist',
                    source: 'soundcloud',
                    author: {
                        name: data.user.username,
                        url: data.user.permalink_url
                    },
                    tracks: [],
                    id: `${data.id}`,
                    url: data.permalink_url,
                    rawPlaylist: data
                });

                for (const song of data.tracks) {
                    const track = new Track(this.context.player, {
                        title: song.title,
                        description: song.description ?? '',
                        author: song.user.username,
                        url: song.permalink_url,
                        thumbnail: song.artwork_url,
                        duration: Util.buildTimeCode(Util.parseMS(song.duration)),
                        views: song.playback_count,
                        requestedBy: context.requestedBy,
                        playlist: res,
                        source: 'soundcloud',
                        engine: song,
                        queryType: context.type,
                        metadata: song,
                        requestMetadata: async () => {
                            return song;
                        }
                    });
                    track.extractor = this;
                    track.playlist = res;
                    res.tracks.push(track);
                }

                return { playlist: res, tracks: res.tracks };
            }
            default: {
                const tracks = await this.internal.tracks.searchV2({ q: query }).catch(Util.noop);
                if (!tracks || !tracks.collection.length) return this.emptyResponse();

                const resolvedTracks: Track[] = [];

                for (const trackInfo of tracks.collection) {
                    const track = new Track(this.context.player, {
                        title: trackInfo.title,
                        url: trackInfo.permalink_url,
                        duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                        description: trackInfo.description ?? '',
                        thumbnail: trackInfo.artwork_url,
                        views: trackInfo.playback_count,
                        author: trackInfo.user.username,
                        requestedBy: context.requestedBy,
                        source: 'soundcloud',
                        engine: trackInfo,
                        queryType: 'soundcloudTrack',
                        metadata: trackInfo,
                        requestMetadata: async () => {
                            return trackInfo;
                        }
                    });

                    track.extractor = this;

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
        const url = await this.internal.util.streamLink(info.url).catch(Util.noop);
        if (!url) throw new Error('Could not extract stream from this track source');

        return url;
    }
}
