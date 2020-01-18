const { EventEmitter } = require('events');

/**
 * Represents a guild queue.
 */
class Queue extends EventEmitter {

    /**
     * Represents a guild queue.
     * @param {string} guildID 
     */
    constructor(guildID){
        super();
        /**
         * The guild ID.
         * @type {Snowflake}
         */
        this.guildID = guildID;
        /**
         * The stream dispatcher.
         * @type {StreamDispatcher}
         */
        this.dispatcher = null;
        /**
         * The voice connection.
         * @type {VoiceConnection}
         */
        this.connection = null;
        /**
         * Songs. The first one is currently playing and the rest is going to be played.
         * @type {Song[]}
         */
        this.songs = [];
        /**
         * Whether the stream is currently stopped.
         * @type {Boolean}
         */
        this.stopped = false;
        /**
         * Whether the last song was skipped.
         * @type {Boolean}
         */
        this.skipped = false;
        /**
         * The stream volume.
         * @type {Number}
         */
        this.volume = 100;
        /**
         * Whether the stream is currently playing.
         * @type {Boolean}
         */
        this.playing = true;
        /**
         * Whether the repeat mode is enabled.
         * @type {Boolean}
         */
        this.repeatMode = false;
    }

};

/**
 * Emitted when the queue is empty.
 * @event Queue#end
 */

/**
 * Emitted when the voice channel is empty.
 * @event Queue#channelEmpty
 */

/**
 * Emitted when the song changes.
 * @event Queue#songChanged
 * @param {Song} oldSong The old song (playing before)
 * @param {Song} newSong The new song (currently playing)
 * @param {Boolean} skipped Whether the change is due to the skip() function
 */

module.exports = Queue;