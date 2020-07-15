const Discord = require('discord.js')
const Queue = require('./Queue')

/**
 * Represents a track.
 */
class Track {
    /**
     * @param {Object} videoData The video data for this track
     * @param {Discord.User?} user The user who requested the track
     * @param {Queue?} queue The queue in which is the track is
     */
    constructor (videoData, user, queue) {
        /**
         * The track name
         * @type {string}
         */
        this.name = videoData.title
        /**
         * The Youtube URL of the track
         * @type {string}
         */
        this.url = videoData.link
        /**
         * The video duration (formatted).
         * @type {string}
         */
        this.duration = videoData.duration
        /**
         * The video description
         * @type {string}
         */
        this.description = videoData.description
        /**
         * The video thumbnail
         * @type {string}
         */
        this.thumbnail = videoData.thumbnail
        /**
         * The video views
         * @type {?number}
         */
        this.views = videoData.views
        /**
         * The video channel
         * @type {string}
         */
        this.author = videoData.author.name
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
        /**
         * The queue in which the track is
         * @type {Queue}
         */
        this.queue = queue
    }

    /**
     * The track duration
     * @type {number}
     */
    get durationMS () {
        const args = this.duration.split(':')
        if (args.length === 3) {
            return parseInt(args[0]) * 60 * 60 * 1000 +
            parseInt(args[1]) * 60 * 1000 +
            parseInt(args[2]) * 1000
        } else if (args.length === 2) {
            return parseInt(args[0]) * 60 * 1000 +
            parseInt(args[1]) * 1000
        } else {
            return parseInt(args[0]) * 1000
        }
    }
}

module.exports = Track
