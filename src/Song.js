/**
 * Represents a song.
 */
class Song {
    /**
     * @param {Video} video The Youtube video
     * @param {Queue} queue The queue in which the song is
     */
    constructor(video, queue, requestedBy) {
        /**
         * Song name.
         * @type {string}
         */
        this.name = video.title;
        /**
         * Song duration.
         * @type {Number}
         */
        this.duration = ((video.duration.hours*3600)+(video.duration.minutes*60)+(video.duration.seconds)) * 100;
        /**
         * Raw video object from Simple Youtube API
         * @type {Video}
         */
        this.rawVideo = video;
        /**
         * Raw informations about the song.
         * @type {Object}
         */
        this.raw = video.raw;
        /**
         * Author channel of the song.
         * @type {string}
         */
        this.author = video.raw.snippet.channelTitle;
        /**
         * Youtube video URL.
         * @type {string}
         */
        this.url = `https://www.youtube.com/watch?v=${video.id}`;
        /**
         * Youtube video thumbnail.
         * @type {string}
         */
        this.thumbnail = video.raw.snippet.thumbnails.default.url;
        /**
         * The queue in which the song is.
         * @type {Queue}
         */
        this.queue = queue;
        /**
         * The user who requested that song.
         * @type {User}
         */
        this.requestedBy = requestedBy;
    }
};

module.exports = Song;