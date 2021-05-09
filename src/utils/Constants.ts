import { PlayerOptions as DP_OPTIONS } from '../types/types';

export enum PlayerEvents {
    BOT_DISCONNECT = 'botDisconnect',
    CHANNEL_EMPTY = 'channelEmpty',
    CONNECTION_CREATE = 'connectionCreate',
    ERROR = 'error',
    MUSIC_STOP = 'musicStop',
    NO_RESULTS = 'noResults',
    PLAYLIST_ADD = 'playlistAdd',
    PLAYLIST_PARSE_END = 'playlistParseEnd',
    PLAYLIST_PARSE_START = 'playlistParseStart',
    QUEUE_CREATE = 'queueCreate',
    QUEUE_END = 'queueEnd',
    SEARCH_CANCEL = 'searchCancel',
    SEARCH_INVALID_RESPONSE = 'searchInvalidResponse',
    SEARCH_RESULTS = 'searchResults',
    TRACK_ADD = 'trackAdd',
    TRACK_START = 'trackStart'
};

export enum PlayerErrorEventCodes {
    LIVE_VIDEO = 'LiveVideo',
    NOT_CONNECTED = 'NotConnected',
    UNABLE_TO_JOIN = 'UnableToJoin',
    NOT_PLAYING = 'NotPlaying',
    PARSE_ERROR = 'ParseError',
    VIDEO_UNAVAILABLE = 'VideoUnavailable',
    MUSIC_STARTING = 'MusicStarting'
};

export const PlayerOptions: DP_OPTIONS = {
    leaveOnEnd: true,
    leaveOnStop: true,
    leaveOnEmpty: true,
    leaveOnEmptyCooldown: 0,
    setSelfDeaf: true,
    enableLive: false,
    ytdlDownloadOptions: {}
};
