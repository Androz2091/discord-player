const ytsr = require('youtube-sr')
const soundcloud = require('soundcloud-scraper')

const spotifySongRegex = (/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/)

module.exports = class Util {
    constructor () {
        throw new Error(`The ${this.constructor.name} class may not be instantiated.`)
    }

    static isVoiceEmpty (channel) {
        return channel.members.filter((member) => !member.user.bot).size === 0
    }

    static isSoundcloudLink (query) {
        return soundcloud.validateURL(query)
    }

    static isSpotifyLink (query) {
        return spotifySongRegex.test(query)
    }

    static isYTPlaylistLink (query) {
        return ytsr.validate(query, 'PLAYLIST')
    }

    static isYTVideoLink (query) {
        return ytsr.validate(query, 'VIDEO')
    }
}
