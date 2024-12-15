import type { User, UserResolvable, VoiceState } from 'discord.js';
import type { GuildQueue } from '../queue';
import type { Track } from '../fabric/Track';
import type { Playlist } from '../fabric/Playlist';
import type { QueryCacheProvider } from '../utils/QueryCache';

// @ts-ignore
import type { BridgeProvider } from '@discord-player/extractor';

export type FiltersName = keyof QueueFilters;

export interface PlayerSearchResult {
  playlist: Playlist | null;
  tracks: Track[];
}

/**
 * Represents FFmpeg filters
 */
export interface QueueFilters {
  bassboost_low?: boolean;
  bassboost?: boolean;
  bassboost_high?: boolean;
  '8D'?: boolean;
  vaporwave?: boolean;
  nightcore?: boolean;
  phaser?: boolean;
  tremolo?: boolean;
  vibrato?: boolean;
  reverse?: boolean;
  treble?: boolean;
  normalizer?: boolean;
  normalizer2?: boolean;
  surrounding?: boolean;
  pulsator?: boolean;
  subboost?: boolean;
  karaoke?: boolean;
  flanger?: boolean;
  gate?: boolean;
  haas?: boolean;
  mcompand?: boolean;
  mono?: boolean;
  mstlr?: boolean;
  mstrr?: boolean;
  compressor?: boolean;
  expander?: boolean;
  softlimiter?: boolean;
  chorus?: boolean;
  chorus2d?: boolean;
  chorus3d?: boolean;
  fadein?: boolean;
  dim?: boolean;
  earrape?: boolean;
  lofi?: boolean;
  silenceremove?: boolean;
}

/**
 * The track source:
 * - soundcloud
 * - youtube
 * - spotify
 * - apple_music
 * - arbitrary
 */
export type TrackSource = 'soundcloud' | 'youtube' | 'spotify' | 'apple_music' | 'arbitrary';

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
   * The seralised title
   */
  cleanTitle?: string;
}

export interface TimeData {
  /**
   * Time in days
   */
  days: number;
  /**
   * Time in hours
   */
  hours: number;
  /**
   * Time in minutes
   */
  minutes: number;
  /**
   * Time in seconds
   */
  seconds: number;
}

export interface PlayerProgressbarOptions {
  /**
   * If it should render time codes
   */
  timecodes?: boolean;
  /**
   * If it should create progress bar for the whole queue
   */
  length?: number;
  /**
   * The bar length
   */
  leftChar?: string;
  /**
   * The elapsed time track
   */
  rightChar?: string;
  /**
   * The remaining time track
   */
  separator?: string;
  /**
   * The separation between timestamp and line
   */
  indicator?: string;
  /**
   * The indicator
   */
  queue?: boolean;
}

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
} as const;

export type SearchQueryType = keyof typeof QueryType | (typeof QueryType)[keyof typeof QueryType];

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PlayerEvents {
  debug: (message: string) => any;
  error: (error: Error) => any;
  voiceStateUpdate: (queue: GuildQueue, oldState: VoiceState, newState: VoiceState) => any;
}

export const PlayerEvent = {
  debug: 'debug',
  Debug: 'debug',
  error: 'error',
  Error: 'error',
  voiceStateUpdate: 'voiceStateUpdate',
  VoiceStateUpdate: 'voiceStateUpdate',
} as const;
export type PlayerEvent = (typeof PlayerEvent)[keyof typeof PlayerEvent];

/* eslint-enable @typescript-eslint/no-explicit-any */

export interface PlayOptions {
  /**
   * If this play was triggered for filters update
   */
  filtersUpdate?: boolean;
  /**
   * FFmpeg args passed to encoder
   */
  encoderArgs?: string[];
  /**
   * Time to seek to before playing
   */
  seek?: number;
  /**
   * If it should start playing the provided track immediately
   */
  immediate?: boolean;
}

export type QueryExtractorSearch = `ext:${string}`;

export interface SearchOptions {
  /**
   * The user who requested this search
   */
  requestedBy?: UserResolvable;
  /**
   * The query search engine, can be extractor name to target specific one (custom)
   */
  searchEngine?: SearchQueryType | QueryExtractorSearch;
  /**
   * List of the extractors to block
   */
  blockExtractors?: string[];
  /**
   * If it should ignore query cache lookup
   */
  ignoreCache?: boolean;
  /**
   * Fallback search engine to use
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestOptions?: any;
  /**
   * Fallback search engine to use
   */
  fallbackSearchEngine?: (typeof QueryType)[keyof typeof QueryType];
}

/**
 * The queue repeat mode. This can be one of:
 * - OFF
 * - TRACK
 * - QUEUE
 * - AUTOPLAY
 */
export enum QueueRepeatMode {
  /**
   * Disable repeat mode.
   */
  OFF = 0,
  /**
   * Repeat the current track.
   */
  TRACK = 1,
  /**
   * Repeat the entire queue.
   */
  QUEUE = 2,
  /**
   * When last track ends, play similar tracks in the future if queue is empty.
   */
  AUTOPLAY = 3,
}

export interface PlaylistInitData {
  /**
   * The tracks of this playlist
   */
  tracks: Track[];
  /**
   * The playlist title
   */
  title: string;
  /**
   * The description
   */
  description: string;
  /**
   * The thumbnail
   */
  thumbnail: string;
  /**
   * The playlist type: `album` | `playlist`
   */
  type: 'album' | 'playlist';
  /**
   * The playlist source
   */
  source: TrackSource;
  /**
   * The playlist author
   */
  author: {
    /**
     * The author name
     */
    name: string;
    /**
     * The author url
     */
    url: string;
  };
  /**
   * The playlist id
   */
  id: string;
  /**
   * The playlist url
   */
  url: string;
  /**
   * The raw playlist data
   */
  rawPlaylist?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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

export interface PlaylistJSON {
  /**
   * The playlist id
   */
  id: string;
  /**
   * The playlist url
   */
  url: string;
  /**
   * The playlist title
   */
  title: string;
  /**
   * The playlist description
   */
  description: string;
  /**
   * The thumbnail
   */
  thumbnail: string;
  /**
   * The playlist type: `album` | `playlist`
   */
  type: 'album' | 'playlist';
  /**
   * The track source
   */
  source: TrackSource;
  /**
   * The playlist author
   */
  author: {
    /**
     * The author name
     */
    name: string;
    /**
     * The author url
     */
    url: string;
  };
  /**
   * The tracks data (if any)
   */
  tracks: TrackJSON[];
}

export interface PlayerInitOptions {
  /**
   * The voice connection timeout
   */
  connectionTimeout?: number;
  /**
   * Time in ms to re-monitor event loop lag
   */
  lagMonitor?: number;
  /**
   * Prevent voice state handler from being overridden
   */
  lockVoiceStateHandler?: boolean;
  /**
   * List of extractors to disable querying metadata from
   */
  blockExtractors?: string[];
  /**
   * List of extractors to disable streaming from
   */
  blockStreamFrom?: string[];
  /**
   * Query cache provider
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryCache?: QueryCacheProvider<any> | null;
  /**
   * Use legacy version of ffmpeg
   */
  useLegacyFFmpeg?: boolean;
  /**
   * Set bridge provider
   */
  bridgeProvider?: BridgeProvider;
  /**
   * Skip ffmpeg process when possible
   */
  skipFFmpeg?: boolean;
  /**
   * The probe timeout in milliseconds. Defaults to 5000.
   */
  probeTimeout?: number;
  /**
   * Configure ffmpeg path
   */
  ffmpegPath?: string;
  /**
   * Whether to override the fallback context. Defaults to `true`.
   */
  overrideFallbackContext?: boolean;
}
