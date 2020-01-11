/**
 * Represents a song.
 */
class Song {
    /**
     * @param {Video} video The Youtube video
     * @param {Queue} queue The queue in which the song is
     */
    constructor(video, queue) {
        /**
         * Song name.
         * @type {string}
         */
        this.name = video.title;
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
         * The queue in which the song is
         * @type {Queue}
         */
        this.queue = queue;
    }
};

module.exports = Song;