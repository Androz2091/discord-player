// prettier-ignore
import {
    BaseExtractor,
    ExtractorInfo,
    ExtractorSearchContext,
    ExtractorStreamable,
    type GuildQueueHistory,
    Playlist,
    QueryType,
    SearchQueryType,
    Track,
    Util
} from 'discord-player';
import * as SoundCloud from 'soundcloud.ts';
import { filterSoundCloudPreviews } from '../internal/helper';

export interface SoundCloudExtractorInit {
  clientId?: string;
  oauthToken?: string;
  proxy?: string;
}

export class SoundCloudExtractor extends BaseExtractor<SoundCloudExtractorInit> {
  public static identifier = 'com.discord-player.soundcloudextractor' as const;
  public static instance: SoundCloudExtractor | null = null;

  public internal = new SoundCloud.default({
    clientId: this.options.clientId,
    oauthToken: this.options.oauthToken,
    proxy: this.options.proxy,
  });

  public async activate(): Promise<void> {
    this.protocols = ['scsearch', 'soundcloud'];
    SoundCloudExtractor.instance = this;
  }

  public async deactivate(): Promise<void> {
    this.protocols = [];
    SoundCloudExtractor.instance = null;
  }

  public async validate(
    query: string,
    type?: SearchQueryType | null | undefined,
  ): Promise<boolean> {
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

  public async getRelatedTracks(track: Track, history: GuildQueueHistory) {
    if (track.queryType === QueryType.SOUNDCLOUD_TRACK) {
      const data = await this.internal.tracks.relatedV2(track.url, 5);

      const unique = filterSoundCloudPreviews(data).filter(
        (t) => !history.tracks.some((h) => h.url === t.permalink_url),
      );

      return this.createResponse(
        null,
        (unique.length > 0 ? unique : data).map((trackInfo) => {
          const newTrack = new Track(this.context.player, {
            title: trackInfo.title,
            url: trackInfo.permalink_url,
            duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
            description: trackInfo.description ?? '',
            thumbnail: trackInfo.artwork_url,
            views: trackInfo.playback_count,
            author: trackInfo.user.username,
            requestedBy: track.requestedBy,
            source: 'soundcloud',
            engine: trackInfo,
            queryType: QueryType.SOUNDCLOUD_TRACK,
            metadata: trackInfo,
            requestMetadata: async () => {
              return trackInfo;
            },
            cleanTitle: trackInfo.title,
          });

          newTrack.extractor = this;

          return newTrack;
        }),
      );
    }

    return this.createResponse();
  }

  public async handle(
    query: string,
    context: ExtractorSearchContext,
  ): Promise<ExtractorInfo> {
    if (context.protocol === 'scsearch')
      context.type = QueryType.SOUNDCLOUD_SEARCH;
    switch (context.type) {
      case QueryType.SOUNDCLOUD_TRACK: {
        const trackInfo = await this.internal.tracks
          .getV2(query)
          .catch(Util.noop);

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
          },
          cleanTitle: trackInfo.title,
        });

        track.extractor = this;

        return { playlist: null, tracks: [track] };
      }
      case QueryType.SOUNDCLOUD_PLAYLIST: {
        const data = await this.internal.playlists
          .getV2(query)
          .catch(Util.noop);
        if (!data) return { playlist: null, tracks: [] };

        const res = new Playlist(this.context.player, {
          title: data.title,
          description: data.description ?? '',
          thumbnail: data.artwork_url ?? data.tracks[0].artwork_url,
          type: 'playlist',
          source: 'soundcloud',
          author: {
            name: data.user.username,
            url: data.user.permalink_url,
          },
          tracks: [],
          id: `${data.id}`,
          url: data.permalink_url,
          rawPlaylist: data,
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
            },
            cleanTitle: song.title,
          });
          track.extractor = this;
          track.playlist = res;
          res.tracks.push(track);
        }

        return { playlist: res, tracks: res.tracks };
      }
      default: {
        let tracks = await this.internal.tracks
          .searchV2({ q: query })
          .then((t) => t.collection)
          .catch(Util.noop);

        if (!tracks)
          tracks = await this.internal.tracks.searchAlt(query).catch(Util.noop);

        if (!tracks || !tracks.length) return this.emptyResponse();

        tracks = filterSoundCloudPreviews(tracks);

        const resolvedTracks: Track[] = [];

        for (const trackInfo of tracks) {
          if (!trackInfo.streamable) continue;
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
            },
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
    if (!url)
      throw new Error('Could not extract stream from this track source');

    return url;
  }

  public async bridge(
    track: Track,
    sourceExtractor: BaseExtractor | null,
  ): Promise<ExtractorStreamable | null> {
    if (sourceExtractor?.identifier === this.identifier) {
      return this.stream(track);
    }

    const query =
      sourceExtractor?.createBridgeQuery(track) ??
      `${track.author} - ${track.title}`;

    const info = await this.handle(query, {
      requestedBy: track.requestedBy,
      type: QueryType.SOUNDCLOUD_SEARCH,
    });

    if (!info.tracks.length) return null;

    const result = await this.stream(info.tracks[0]);

    if (result) {
      track.bridgedTrack = info.tracks[0];
      track.bridgedExtractor = this;
    }

    return result;
  }
}
