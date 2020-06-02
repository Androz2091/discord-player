const Discord = require('discord.js')
const Queue = require('./Queue')
const SimpleYouTubeAPI = require('simple-youtube-api')

/**
 * Represents a track.
 */
class Track {

    /**
     * @param {SimpleYouTubeAPI.Video} video The video for this track
     * @param {Discord.User?} user The user who requested the track
     * @param {Queue?} queue The queue in which is the track is
     */
    constructor(video, user, queue) {
        /**
         * The track name
         * @type {string}
         */
        this.name = video.title;
        /**
         * The full video object
         * @type {SimpleYouTubeAPI.Video}
         */
        this.data = video;
        /**
         * The Youtube URL of the track
         * @type {string}
         */
        this.url = `https://www.youtube.com/watch?v=${video.id}`;
        /**
         * The user who requested the track
         * @type {Discord.User?}
         */
        this.requestedBy = user;
        /**
         * The queue in which the track is
         * @type {Queue}
         */
        this.queue = queue;
    }

    /**
     * The name of the channel which is the author of the video on Youtube
     * @type {string}
     */
    get author() {
        return this.data.raw.snippet.channelTitle;
    }

    /**
     * The Youtube video thumbnail
     * @type {string}
     */
    get thumbnail() {
        return this.data.raw.snippet.thumbnails.default.url;
    }

    /**
     * The track duration
     * @type {number}
     */
    get duration() {
        return typeof this.data.duration === "object"
            ? ((this.data.duration.hours*3600)+(this.data.duration.minutes*60)+(this.data.duration.seconds)) * 1000
            : parseInt(this.data.duration)
    }

};

module.exports = Track;
