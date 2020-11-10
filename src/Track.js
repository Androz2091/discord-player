const Discord = require('discord.js')
const Queue = require('./Queue')
const Player = require('./Player')

/**
 * Represents a track.
 */
class Track {
    /**
     * @param {Object} videoData The video data for this track
     * @param {Discord.User | null} user The user who requested the track
     * @param {Player} player
     */
    constructor (videoData, user, player) {
        /**
         * The player instantiating the track
         * @type {Player}
         */
        this.player = player
        /**
         * The track title
         * @type {string}
         */
        this.title = videoData.title
        /**
         * The Youtube URL of the track
         * @type {string}
         */
        this.url = videoData.url
        /**
         * The video duration (formatted).
         * @type {string}
         */
        this.duration = videoData.durationFormatted ||
        `${Math.floor(parseInt(videoData.lengthSeconds) / 60)}:${parseInt(videoData.lengthSeconds) % 60}`
        /**
         * The video description
         * @type {string}
         */
        this.description = videoData.description
        /**
         * The video thumbnail
         * @type {string}
         */
        this.thumbnail = typeof videoData.thumbnail === 'object'
            ? videoData.thumbnail.url
            : videoData.thumbnail
        /**
         * The video views
         * @type {?number}
         */
        this.views = parseInt(videoData.views)
        /**
         * The video channel
         * @type {string}
         */
        this.author = videoData.channel
            ? videoData.channel.name
            : videoData.author.name
        /**
         * The user who requested the track
         * @type {Discord.User?}
         */
        this.requestedBy = user
        /**
         * Whether the track was added from a playlist
         * @type {boolean}
         */
        this.fromPlaylist = videoData.fromPlaylist || false
    }

    /**
     * The queue in which the track is
     * @type {Queue}
     */
    get queue () {
        return this.player.queues.find((queue) => queue.tracks.includes(this))
    }

    /**
     * The track duration
     * @type {number}
     */
    get durationMS () {
        const args = this.duration.split(':')
        switch (args.length) {
        case 3: return parseInt(args[0]) * 60 * 60 * 1000 + parseInt(args[1]) * 60 * 1000 + parseInt(args[2]) * 1000
        case 2: return parseInt(args[0]) * 60 * 1000 + parseInt(args[1]) * 1000
        default: return parseInt(args[0]) * 1000
        }
    }
}

module.exports = Track
