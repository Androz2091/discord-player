const Discord = require('discord.js')
const { EventEmitter } = require('events')
const Track = require('./Track')

/**
 * Represents a guild queue.
 */
class Queue extends EventEmitter {

    /**
     * @param {Discord.Snowflake} guildID ID of the guild this queue is for.
     */
    constructor(guildID){
        super();
        /**
         * ID of the guild this queue is for.
         * @type {Discord.Snowflake}
         */
        this.guildID = guildID;
        /**
         * The voice connection of this queue.
         * @type {Discord.VoiceConnection}
         */
        this.voiceConnection = null;
        /**
         * The tracks of this queue. The first one is currenlty playing and the others are going to be played.
         * @type {Track[]}
         */
        this.tracks = [];
        /**
         * Whether the stream is currently stopped.
         * @type {boolean}
         */
        this.stopped = false;
        /**
         * Whether the last track was skipped.
         * @type {boolean}
         */
        this.lastSkipped = false;
        /**
         * The stream volume of this queue. (0-100)
         * @type {number}
         */
        this.volume = 100;
        /**
         * Whether the stream is currently playing.
         * @type {boolean}
         */
        this.playing = true;
        /**
         * Whether the repeat mode is enabled.
         * @type {boolean}
         */
        this.repeatMode = false;
    }

};

module.exports = Queue;

/**
 * Emitted when the queue is empty.
 * @event Queue#end
 */

/**
 * Emitted when the voice channel is empty.
 * @event Queue#channelEmpty
 */

/**
 * Emitted when the track changes.
 * @event Queue#trackChanged
 * @param {Track} oldTrack The old track (playing before)
 * @param {Track} newTrack The new track (currently playing)
 * @param {Boolean} skipped Whether the change is due to the skip() function
 */
