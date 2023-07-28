import { QueryType } from '../types/types';
import { TypeUtil } from './TypeUtil';
import { Exceptions } from '../errors';

// #region scary things below *sigh*
const spotifySongRegex = /^https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(intl-([a-z]|[A-Z])+\/)?(?:track\/|\?uri=spotify:track:)((\w|-){22})(\?si=.+)?$/;
const spotifyPlaylistRegex = /^https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(intl-([a-z]|[A-Z])+\/)?(?:playlist\/|\?uri=spotify:playlist:)((\w|-){22})(\?si=.+)?$/;
const spotifyAlbumRegex = /^https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(intl-([a-z]|[A-Z])+\/)?(?:album\/|\?uri=spotify:album:)((\w|-){22})(\?si=.+)?$/;
const vimeoRegex = /^(http|https)?:\/\/(www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|video\/|)(\d+)(?:|\/\?)$/;
const reverbnationRegex = /^https:\/\/(www.)?reverbnation.com\/(.+)\/song\/(.+)$/;
const attachmentRegex = /^https?:\/\/.+$/;
const appleMusicSongRegex = /^https?:\/\/music\.apple\.com\/.+?\/(song|album)\/.+?(\/.+?\?i=|\/)([0-9]+)$/;
const appleMusicPlaylistRegex = /^https?:\/\/music\.apple\.com\/.+?\/playlist\/.+\/pl\.(u-)?[a-zA-Z0-9]+$/;
const appleMusicAlbumRegex = /^https?:\/\/music\.apple\.com\/.+?\/album\/.+\/([0-9]+)$/;
const soundcloudTrackRegex = /^https?:\/\/(m.|www.)?soundcloud.com\/(\w|-)+\/(\w|-)+(.+)?$/;
const soundcloudPlaylistRegex = /^https?:\/\/(m.|www.)?soundcloud.com\/(\w|-)+\/sets\/(\w|-)+(.+)?$/;
const youtubePlaylistRegex = /^https?:\/\/(www.)?youtube.com\/playlist\?list=((PL|FL|UU|LL|RD|OL)[a-zA-Z0-9-_]{16,41})$/;
const youtubeVideoURLRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]+)(\S+)?$/;
const youtubeVideoIdRegex = /^[a-zA-Z0-9-_]{11}$/;
// #endregion scary things above *sigh*

export interface ResolvedQuery {
    type: (typeof QueryType)[keyof typeof QueryType];
    query: string;
}

class QueryResolver {
    /**
     * Query resolver
     */
    private constructor() {} // eslint-disable-line @typescript-eslint/no-empty-function

    static get regex() {
        return {
            spotifyAlbumRegex,
            spotifyPlaylistRegex,
            spotifySongRegex,
            vimeoRegex,
            reverbnationRegex,
            attachmentRegex,
            appleMusicAlbumRegex,
            appleMusicPlaylistRegex,
            appleMusicSongRegex,
            soundcloudTrackRegex,
            soundcloudPlaylistRegex,
            youtubePlaylistRegex
        };
    }

    /**
     * Resolves the given search query
     * @param {string} query The query
     */
    static resolve(query: string, fallbackSearchEngine: (typeof QueryType)[keyof typeof QueryType] = QueryType.AUTO_SEARCH): ResolvedQuery {
        if (!TypeUtil.isString(query)) throw Exceptions.ERR_INVALID_ARG_TYPE(query, 'string', typeof query);
        if (!query.length) throw Exceptions.ERR_INFO_REQUIRED('query', String(query));

        // sanitize query
        if (query.includes('youtube.com')) query = query.replace(/(m(usic)?|gaming)\./, '').trim();
        if (query.includes('spotify.com')) query = query.replace(/intl-([a-zA-Z]+)\//, '');

        const resolver = (type: typeof fallbackSearchEngine) => ({ type, query });

        if (soundcloudPlaylistRegex.test(query)) return resolver(QueryType.SOUNDCLOUD_PLAYLIST);
        if (soundcloudTrackRegex.test(query)) return resolver(QueryType.SOUNDCLOUD_TRACK);
        if (spotifyPlaylistRegex.test(query)) return resolver(QueryType.SPOTIFY_PLAYLIST);
        if (spotifyAlbumRegex.test(query)) return resolver(QueryType.SPOTIFY_ALBUM);
        if (spotifySongRegex.test(query)) return resolver(QueryType.SPOTIFY_SONG);
        if (youtubePlaylistRegex.test(query)) return resolver(QueryType.YOUTUBE_PLAYLIST);
        if (QueryResolver.validateId(query) || QueryResolver.validateURL(query)) return resolver(QueryType.YOUTUBE_VIDEO);
        if (vimeoRegex.test(query)) return resolver(QueryType.VIMEO);
        if (reverbnationRegex.test(query)) return resolver(QueryType.REVERBNATION);
        if (appleMusicAlbumRegex.test(query)) return resolver(QueryType.APPLE_MUSIC_ALBUM);
        if (appleMusicPlaylistRegex.test(query)) return resolver(QueryType.APPLE_MUSIC_PLAYLIST);
        if (appleMusicSongRegex.test(query)) return resolver(QueryType.APPLE_MUSIC_SONG);
        if (attachmentRegex.test(query)) return resolver(QueryType.ARBITRARY);

        return resolver(fallbackSearchEngine);
    }

    /**
     * Parses vimeo id from url
     * @param {string} query The query
     * @returns {string}
     */
    static getVimeoID(query: string): string | null | undefined {
        return QueryResolver.resolve(query).type === QueryType.VIMEO
            ? query
                  .split('/')
                  .filter((x) => !!x)
                  .pop()
            : null;
    }

    static validateId(q: string) {
        return youtubeVideoIdRegex.test(q);
    }

    static validateURL(q: string) {
        return youtubeVideoURLRegex.test(q);
    }
}

export { QueryResolver };
