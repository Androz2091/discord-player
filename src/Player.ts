import { EventEmitter } from 'events';
import { Client, Collection, Snowflake, Collector, Message } from 'discord.js';
import {
    PlayerOptions as PlayerOptionsType,
} from './types/types';
import Util from './utils/Util';
import AudioFilters from './utils/AudioFilters';
import { Queue } from './Structures/Queue';
import { ExtractorModel } from './Structures/ExtractorModel';

/**
 * The Player class
 * @extends {EventEmitter}
 */
export class Player extends EventEmitter {
    public client: Client;
    public options: PlayerOptionsType;
    public filters: typeof AudioFilters;

    /**
     * The collection of queues in this player
     * @type {DiscordCollection<Queue>}
     */
    public queues = new Collection<Snowflake, Queue>();

    /**
     * The extractor model collection
     * @type {DiscordCollection<ExtractorModel>}
     */
    public Extractors = new Collection<string, ExtractorModel>();

    /**
     * Creates new Player instance
     * @param {DiscordClient} client The discord.js client
     * @param {PlayerOptions} options Player options
     */
    constructor(client: Client, options?: PlayerOptionsType) {
        super();

        /**
         * The discord client that instantiated this player
         * @name Player#client
         * @type {DiscordClient}
         * @readonly
         */
        Object.defineProperty(this, 'client', {
            value: client,
            enumerable: false
        });

        // check FFmpeg
        void Util.alertFFmpeg();
    }

    
}

export default Player;

/**
 * Emitted when a track starts
 * @event Player#trackStart
 * @param {DiscordMessage} message The message
 * @param {Track} track The track
 * @param {Queue} queue The queue
 */

/**
 * Emitted when a playlist is started
 * @event Player#queueCreate
 * @param {DiscordMessage} message The message
 * @param {Queue} queue The queue
 */

/**
 * Emitted when the bot is awaiting search results
 * @event Player#searchResults
 * @param {DiscordMessage} message The message
 * @param {String} query The query
 * @param {Track[]} tracks The tracks
 * @param {DiscordCollector} collector The collector
 */

/**
 * Emitted when the user has sent an invalid response for search results
 * @event Player#searchInvalidResponse
 * @param {DiscordMessage} message The message
 * @param {String} query The query
 * @param {Track[]} tracks The tracks
 * @param {String} invalidResponse The `invalidResponse` string
 * @param {DiscordCollector} collector The collector
 */

/**
 * Emitted when the bot has stopped awaiting search results (timeout)
 * @event Player#searchCancel
 * @param {DiscordMessage} message The message
 * @param {String} query The query
 * @param {Track[]} tracks The tracks
 */

/**
 * Emitted when the bot can't find related results to the query
 * @event Player#noResults
 * @param {DiscordMessage} message The message
 * @param {String} query The query
 */

/**
 * Emitted when the bot is disconnected from the channel
 * @event Player#botDisconnect
 * @param {DiscordMessage} message The message
 */

/**
 * Emitted when the channel of the bot is empty
 * @event Player#channelEmpty
 * @param {DiscordMessage} message The message
 * @param {Queue} queue The queue
 */

/**
 * Emitted when the queue of the server is ended
 * @event Player#queueEnd
 * @param {DiscordMessage} message The message
 * @param {Queue} queue The queue
 */

/**
 * Emitted when a track is added to the queue
 * @event Player#trackAdd
 * @param {DiscordMessage} message The message
 * @param {Queue} queue The queue
 * @param {Track} track The track
 */

/**
 * Emitted when a playlist is added to the queue
 * @event Player#playlistAdd
 * @param {DiscordMessage} message The message
 * @param {Queue} queue The queue
 * @param {Object} playlist The playlist
 */

/**
 * Emitted when an error is triggered
 * @event Player#error
 * @param {String} error It can be `NotConnected`, `UnableToJoin`, `NotPlaying`, `ParseError`, `LiveVideo` or `VideoUnavailable`.
 * @param {DiscordMessage} message The message
 */

/**
 * Emitted when discord-player attempts to parse playlist contents (mostly soundcloud playlists)
 * @event Player#playlistParseStart
 * @param {Object} playlist Raw playlist (unparsed)
 * @param {DiscordMessage} message The message
 */

/**
 * Emitted when discord-player finishes parsing playlist contents (mostly soundcloud playlists)
 * @event Player#playlistParseEnd
 * @param {Object} playlist The playlist data (parsed)
 * @param {DiscordMessage} message The message
 */

/**
 * @typedef {Object} PlayerOptions
 * @property {Boolean} [leaveOnEnd=false] If it should leave on queue end
 * @property {Number} [leaveOnEndCooldown=0] Time in ms to wait before executing `leaveOnEnd`
 * @property {Boolean} [leaveOnStop=false] If it should leave on stop command
 * @property {Boolean} [leaveOnEmpty=false] If it should leave on empty voice channel
 * @property {Number} [leaveOnEmptyCooldown=0] Time in ms to wait before executing `leaveOnEmpty`
 * @property {Boolean} [autoSelfDeaf=false] If it should set the client to `self deaf` mode on joining
 * @property {Boolean} [enableLive=false] If it should enable live videos support
 * @property {YTDLDownloadOptions} [ytdlDownloadOptions={}] The download options passed to `ytdl-core`
 * @property {Boolean} [useSafeSearch=false] If it should use `safe search` method for youtube searches
 * @property {Boolean} [disableAutoRegister=false] If it should disable auto-registeration of `@discord-player/extractor`
 */

/**
 * The type of Track source, either:
 * * `soundcloud` - a stream from SoundCloud
 * * `youtube` - a stream from YouTube
 * * `arbitrary` - arbitrary stream
 * @typedef {String} TrackSource
 */

/**
 * @typedef {Object} TrackData
 * @property {String} title The title
 * @property {String} description The description
 * @property {String} author The author
 * @property {String} url The url
 * @property {String} duration The duration
 * @property {Number} views The view count
 * @property {DiscordUser} requestedBy The user who requested this track
 * @property {Boolean} fromPlaylist If this track came from a playlist
 * @property {TrackSource} [source] The track source
 * @property {string|Readable} [engine] The stream engine
 * @property {Boolean} [live=false] If this track is livestream instance
 */

/**
 * @typedef {Object} QueueFilters
 * The FFmpeg Filters
 */

/**
 * The query type, either:
 * * `soundcloud_track` - a SoundCloud Track
 * * `soundcloud_playlist` - a SoundCloud Playlist
 * * `spotify_song` - a Spotify Song
 * * `spotify_album` - a Spotify album
 * * `spotify_playlist` - a Spotify playlist
 * * `youtube_video` - a YouTube video
 * * `youtube_playlist` - a YouTube playlist
 * * `vimeo` - a Vimeo link
 * * `facebook` - a Facebook link
 * * `reverbnation` - a Reverbnation link
 * * `attachment` - an attachment link
 * * `youtube_search` - a YouTube search keyword
 * @typedef {String} QueryType The query type
 */

/**
 * @typedef {Object} ExtractorModelData
 * @property {String} title The title
 * @property {Number} duration The duration in ms
 * @property {String} thumbnail The thumbnail url
 * @property {string|Readable} engine The audio engine
 * @property {Number} views The views count of this stream
 * @property {String} author The author
 * @property {String} description The description
 * @property {String} url The url
 * @property {String} [version='0.0.0'] The extractor version
 * @property {Boolean} [important=false] Mark as important
 */

/**
 * @typedef {Object} PlayerProgressbarOptions
 * @property {Boolean} [timecodes] If it should return progres bar with time codes
 * @property {Boolean} [queue] if it should return the progress bar of the whole queue
 * @property {Number} [length] The length of progress bar to build
 */

/**
 * @typedef {Object} LyricsData
 * @property {String} title The title of the lyrics
 * @property {Number} id The song id
 * @property {String} thumbnail The thumbnail
 * @property {String} image The image
 * @property {String} url The url
 * @property {Object} artist The artust info
 * @property {String} [artist.name] The name of the artist
 * @property {Number} [artist.id] The ID of the artist
 * @property {String} [artist.url] The profile link of the artist
 * @property {String} [artist.image] The artist image url
 * @property {String?} lyrics The lyrics
 */

/**
 * @typedef {Object} PlayerStats
 * @property {Number} uptime The uptime in ms
 * @property {Number} connections The number of connections
 * @property {Number} users The number of users
 * @property {Number} queues The number of queues
 * @property {Number} extractors The number of custom extractors registered
 * @property {Object} versions The versions metadata
 * @property {String} [versions.ffmpeg] The ffmpeg version
 * @property {String} [versions.node] The node version
 * @property {String} [versions.v8] The v8 JavaScript engine version
 * @property {Object} system The system data
 * @property {String} [system.arch] The system arch
 * @property {String} [system.platform] The system platform
 * @property {Number} [system.cpu] The cpu count
 * @property {Object} [system.memory] The memory info
 * @property {String} [system.memory.total] The total memory
 * @property {String} [system.memory.usage] The memory usage
 * @property {String} [system.memory.rss] The memory usage in RSS
 * @property {String} [system.memory.arrayBuffers] The memory usage in ArrayBuffers
 * @property {Number} [system.uptime] The system uptime
 */

/**
 * @typedef {Object} TimeData
 * @property {Number} days The time in days
 * @property {Number} hours The time in hours
 * @property {Number} minutes The time in minutes
 * @property {Number} seconds The time in seconds
 */
