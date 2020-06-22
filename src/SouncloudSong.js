const Song = require('./Song')

class SoundcloudSong extends Song {

    constructor(trackInfo, queue, requestedBy) {
        this.name = trackInfo.title
        this.duration = trackInfo.duration
        this.author = trackInfo.user.username
        this.url = trackInfo.media.transcodings[0].url
        this.thumbnail = trackInfo.artwork_url
        this.queue = queue
        this.requestedBy = requestedBy
    }
}