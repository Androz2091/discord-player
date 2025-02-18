import { TypeUtil } from './TypeUtil';
import { InfoRequiredError, InvalidArgTypeError } from '../errors';
import { fetch } from 'undici';

// #region scary things below *sigh*
const spotifySongRegex =
  /^https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(intl-([a-z]|[A-Z])+\/)?(?:track\/|\?uri=spotify:track:)((\w|-){22})(\?si=.+)?$/;
const spotifyPlaylistRegex =
  /^https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(intl-([a-z]|[A-Z])+\/)?(?:playlist\/|\?uri=spotify:playlist:)((\w|-){22})(\?si=.+)?$/;
const spotifyAlbumRegex =
  /^https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(intl-([a-z]|[A-Z])+\/)?(?:album\/|\?uri=spotify:album:)((\w|-){22})(\?si=.+)?$/;
const vimeoRegex =
  /^(http|https)?:\/\/(www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|video\/|)(\d+)(?:|\/\?)$/;
const reverbnationRegex =
  /^https:\/\/(www.)?reverbnation.com\/(.+)\/song\/(.+)$/;
const attachmentRegex = /^https?:\/\/.+$/;
const appleMusicSongRegex =
  /^https?:\/\/music\.apple\.com\/.+?\/(song|album)\/.+?(\/.+?\?i=|\/)([0-9]+)$/;
const appleMusicPlaylistRegex =
  /^https?:\/\/music\.apple\.com\/.+?\/playlist\/.+\/pl\.(u-|pm-)?[a-zA-Z0-9]+$/;
const appleMusicAlbumRegex =
  /^https?:\/\/music\.apple\.com\/.+?\/album\/.+\/([0-9]+)$/;
const soundcloudTrackRegex =
  /^https?:\/\/(m.|www.)?soundcloud.com\/(\w|-)+\/(\w|-)+(.+)?$/;
const soundcloudPlaylistRegex =
  /^https?:\/\/(m.|www.)?soundcloud.com\/(\w|-)+\/sets\/(\w|-)+(.+)?$/;
const youtubePlaylistRegex =
  /^https?:\/\/(www.)?youtube.com\/playlist\?list=((PL|FL|UU|LL|RD|OL)[a-zA-Z0-9-_]{16,41})$/;
const youtubeVideoURLRegex =
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]+)(\S+)?$/;
const youtubeVideoIdRegex = /^[a-zA-Z0-9-_]{11}$/;
// discord-player://blob/uuid-v4
const discordPlayerBlobRegex = /^discord-player:\/\/blob\/\d+$/;
// #endregion scary things above *sigh*

const DomainsMap = {
  DiscordPlayer: ['discord-player'],
  YouTube: [
    'youtube.com',
    'youtu.be',
    'music.youtube.com',
    'gaming.youtube.com',
    'www.youtube.com',
    'm.youtube.com',
  ],
  Spotify: ['open.spotify.com', 'embed.spotify.com'],
  Vimeo: ['vimeo.com', 'player.vimeo.com'],
  ReverbNation: ['reverbnation.com'],
  SoundCloud: ['soundcloud.com'],
  AppleMusic: ['music.apple.com'],
};

// prettier-ignore
const redirectDomains = new Set([
    /^https?:\/\/spotify.link\/[A-Za-z0-9]+$/,
    /^https:\/\/on\.soundcloud\.com\/[a-zA-Z1-9]{0,17}$/
]);

/**
 * The search query type
 * This can be one of:
 * - AUTO
 * - YOUTUBE
 * - YOUTUBE_PLAYLIST
 * - SOUNDCLOUD_TRACK
 * - SOUNDCLOUD_PLAYLIST
 * - SOUNDCLOUD
 * - SPOTIFY_SONG
 * - SPOTIFY_ALBUM
 * - SPOTIFY_PLAYLIST
 * - SPOTIFY_SEARCH
 * - FACEBOOK
 * - VIMEO
 * - ARBITRARY
 * - REVERBNATION
 * - YOUTUBE_SEARCH
 * - YOUTUBE_VIDEO
 * - SOUNDCLOUD_SEARCH
 * - APPLE_MUSIC_SONG
 * - APPLE_MUSIC_ALBUM
 * - APPLE_MUSIC_PLAYLIST
 * - APPLE_MUSIC_SEARCH
 * - FILE
 * - AUTO_SEARCH
 * - DISCORD_PLAYER_BLOB
 * @typedef {string} QueryType
 */
export const QueryType = {
  AUTO: 'auto',
  YOUTUBE: 'youtube',
  YOUTUBE_PLAYLIST: 'youtubePlaylist',
  SOUNDCLOUD_TRACK: 'soundcloudTrack',
  SOUNDCLOUD_PLAYLIST: 'soundcloudPlaylist',
  SOUNDCLOUD: 'soundcloud',
  SPOTIFY_SONG: 'spotifySong',
  SPOTIFY_ALBUM: 'spotifyAlbum',
  SPOTIFY_PLAYLIST: 'spotifyPlaylist',
  SPOTIFY_SEARCH: 'spotifySearch',
  FACEBOOK: 'facebook',
  VIMEO: 'vimeo',
  ARBITRARY: 'arbitrary',
  REVERBNATION: 'reverbnation',
  YOUTUBE_SEARCH: 'youtubeSearch',
  YOUTUBE_VIDEO: 'youtubeVideo',
  SOUNDCLOUD_SEARCH: 'soundcloudSearch',
  APPLE_MUSIC_SONG: 'appleMusicSong',
  APPLE_MUSIC_ALBUM: 'appleMusicAlbum',
  APPLE_MUSIC_PLAYLIST: 'appleMusicPlaylist',
  APPLE_MUSIC_SEARCH: 'appleMusicSearch',
  FILE: 'file',
  AUTO_SEARCH: 'autoSearch',
  DISCORD_PLAYER_BLOB: 'discordPlayerBlob',
} as const;

export type QueryType = (typeof QueryType)[keyof typeof QueryType];

export type SearchQueryType = keyof typeof QueryType | QueryType;

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
      youtubePlaylistRegex,
      discordPlayerBlobRegex,
    };
  }

  /**
   * Pre-resolve redirect urls
   */
  static async preResolve(query: string, maxDepth = 5): Promise<string> {
    if (!TypeUtil.isString(query))
      throw new InvalidArgTypeError(query, 'string', typeof query);

    for (const domain of redirectDomains) {
      if (domain.test(query)) {
        try {
          const res = await fetch(query, {
            method: 'GET',
            redirect: 'follow',
          });

          if (!res.ok) break;

          // spotify does not "redirect", it returns a page with js that redirects
          if (/^https?:\/\/spotify.app.link\/(.+)$/.test(res.url)) {
            const body = await res.text();
            const target = body
              .split('https://open.spotify.com/track/')[1]
              .split('?si=')[0];

            if (!target) break;

            return `https://open.spotify.com/track/${target}`;
          }
          return maxDepth < 1
            ? res.url
            : this.preResolve(res.url, maxDepth - 1);
        } catch {
          break;
        }
      }
    }

    return query;
  }

  /**
   * Resolves the given search query
   * @param {string} query The query
   */
  static resolve(
    query: string,
    fallbackSearchEngine: (typeof QueryType)[keyof typeof QueryType] = QueryType.AUTO_SEARCH,
  ): ResolvedQuery {
    if (!TypeUtil.isString(query))
      throw new InvalidArgTypeError(query, 'string', typeof query);
    if (!query.length) throw new InfoRequiredError('query', String(query));

    const resolver = (type: typeof fallbackSearchEngine, query: string) => ({
      type,
      query,
    });

    if (discordPlayerBlobRegex.test(query))
      return resolver(QueryType.DISCORD_PLAYER_BLOB, query);

    try {
      const url = new URL(query);

      if (DomainsMap.YouTube.includes(url.host)) {
        query = query.replace(/(m(usic)?|gaming)\./, '').trim();
        const playlistId = url.searchParams.get('list');
        if (playlistId)
          return resolver(
            QueryType.YOUTUBE_PLAYLIST,
            `https://www.youtube.com/${url.searchParams.size === 1 ? "playlist" : "watch"}${url.search}`,
          );
        if (QueryResolver.validateId(query) || QueryResolver.validateURL(query))
          return resolver(QueryType.YOUTUBE_VIDEO, query);
        return resolver(fallbackSearchEngine, query);
      } else if (DomainsMap.Spotify.includes(url.host)) {
        query = query.replace(/intl-([a-zA-Z]+)\//, '');
        if (spotifyPlaylistRegex.test(query))
          return resolver(QueryType.SPOTIFY_PLAYLIST, query);
        if (spotifyAlbumRegex.test(query))
          return resolver(QueryType.SPOTIFY_ALBUM, query);
        if (spotifySongRegex.test(query))
          return resolver(QueryType.SPOTIFY_SONG, query);
        return resolver(fallbackSearchEngine, query);
      } else if (DomainsMap.Vimeo.includes(url.host)) {
        if (vimeoRegex.test(query)) return resolver(QueryType.VIMEO, query);
        return resolver(fallbackSearchEngine, query);
      } else if (DomainsMap.ReverbNation.includes(url.host)) {
        if (reverbnationRegex.test(query))
          return resolver(QueryType.REVERBNATION, query);
        return resolver(fallbackSearchEngine, query);
      } else if (DomainsMap.SoundCloud.includes(url.host)) {
        if (soundcloudPlaylistRegex.test(query))
          return resolver(QueryType.SOUNDCLOUD_PLAYLIST, query);
        if (soundcloudTrackRegex.test(query))
          return resolver(QueryType.SOUNDCLOUD_TRACK, query);
        return resolver(fallbackSearchEngine, query);
      } else if (DomainsMap.AppleMusic.includes(url.host)) {
        if (appleMusicAlbumRegex.test(query))
          return resolver(QueryType.APPLE_MUSIC_ALBUM, query);
        if (appleMusicPlaylistRegex.test(query))
          return resolver(QueryType.APPLE_MUSIC_PLAYLIST, query);
        if (appleMusicSongRegex.test(query))
          return resolver(QueryType.APPLE_MUSIC_SONG, query);
        return resolver(fallbackSearchEngine, query);
      } else {
        return resolver(QueryType.ARBITRARY, query);
      }
    } catch {
      return resolver(fallbackSearchEngine, query);
    }
  }

  /**
   * Parses vimeo id from url
   * @param {string} query The query
   * @returns {string}
   */
  static getVimeoID(query: string): string | null | undefined {
    return QueryResolver.resolve(query).type === QueryType.VIMEO
      ? query.split('/').filter(Boolean).pop()
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
