const Discord = require('discord.js')
const { EventEmitter } = require('events')
const Track = require('./Track')
const Player = require('./Player')
const { Stream } = require('stream')

/**
 * Represents a guild queue.
 */
class Queue extends EventEmitter {
    /**
     * @param {Discord.Snowflake} guildID ID of the guild this queue is for.
     * @param {Discord.Message} message Message that initialized the queue
     * @param {Filters} filters Filters the queue should be initialized with.
     */
    constructor (guildID, message, filters) {
        super()
        /**
         * ID of the guild this queue is for.
         * @type {Discord.Snowflake}
         */
        this.guildID = guildID
        /**
         * The voice connection of this queue.
         * @type {Discord.VoiceConnection}
         */
        this.voiceConnection = null
        /**
         * The ytdl stream.
         * @type {any}
         */
        this.stream = null
        /**
         * The tracks of this queue. The first one is currenlty playing and the others are going to be played.
         * @type {Track[]}
         */
        this.tracks = []
        /**
         * The previous tracks in this queue.
         * @type {Track[]}
         */
        this.previousTracks = []
        /**
         * Whether the stream is currently stopped.
         * @type {boolean}
         */
        this.stopped = false
        /**
         * Whether the last track was skipped.
         * @type {boolean}
         */
        this.lastSkipped = false
        /**
         * The stream volume of this queue. (0-100)
         * @type {number}
         */
        this.volume = 100
        /**
         * Whether the stream is currently paused.
         * @type {boolean}
         */
        this.paused = this.voiceConnection && this.voiceConnection.dispatcher && this.voiceConnection.dispatcher.paused
        /**
         * Whether the repeat mode is enabled.
         * @type {boolean}
         */
        this.repeatMode = false
        /**
         * Whether the loop mode is enabled.
         * @type {boolean}
         */
        this.loopMode = false
        /**
         * Filters status
         * @type {Filters}
         */
        this.filters = {}
        Object.keys(filters).forEach((f) => {
            this.filters[f] = false
        })
        /**
         * Additional stream time
         * @type {Number}
         */
        this.additionalStreamTime = 0
        /**
         * Message that initialized the queue
         * @type {Discord.Message}
         */
        this.firstMessage = message
    }

    /**
     * The current playing track
     * @type {Track}
     */
    get playing () {
        return this.tracks[0]
    }

    /**
     * The calculated volume of the queue
     * @type {number}
     */
    get calculatedVolume () {
        return this.filters.bassboost ? this.volume + 50 : this.volume
    }

    /**
     * Returns the total time of the queue in milliseconds
     * @type {number}
     */
    get totalTime () {
        return this.tracks.length > 0 ? this.tracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0
    }

    /**
     * The current stream time
     * @type {number}
     */
    get currentStreamTime () {
        return this.voiceConnection.dispatcher
            ? this.voiceConnection.dispatcher.streamTime + this.additionalStreamTime
            : 0
    }
}

module.exports = Queue
