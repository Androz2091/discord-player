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

    get playing () {
        return this.tracks[0]
    }

    get calculatedVolume () {
        return this.filters.bassboost ? this.volume + 50 : this.volume
    }
}

module.exports = Queue
