const ytsr = require('youtube-sr').default
const soundcloud = require('soundcloud-scraper')
const chalk = require('chalk')

const spotifySongRegex = (/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/)
const spotifyPlaylistRegex = (/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:playlist\/|\?uri=spotify:playlist:)((\w|-){22})/)
const spotifyAlbumRegex = (/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:album\/|\?uri=spotify:album:)((\w|-){22})/)
const vimeoRegex = (/(http|https)?:\/\/(www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|video\/|)(\d+)(?:|\/\?)/)
const facebookRegex = (/(https?:\/\/)(www\.|m\.)?(facebook|fb).com\/.*\/videos\/.*/)

module.exports = class Util {
    constructor () {
        throw new Error(`The ${this.constructor.name} class may not be instantiated.`)
    }

    static checkFFMPEG () {
        try {
            const prism = require('prism-media')
            prism.FFmpeg.getInfo()
            return true
        } catch {
            Util.alertFFMPEG()
            return false
        }
    }

    static alertFFMPEG () {
        console.log(chalk.red('ERROR:'), 'FFMPEG is not installed. Install with "npm install ffmpeg-static" or download it here: https://ffmpeg.org/download.html.')
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

    static isSpotifyPLLink (query) {
        return spotifyPlaylistRegex.test(query)
    }

    static isSpotifyAlbumLink (query) {
        return spotifyAlbumRegex.test(query)
    }

    static isYTPlaylistLink (query) {
        return ytsr.validate(query, 'PLAYLIST_ID')
    }

    static isYTVideoLink (query) {
        return ytsr.validate(query, 'VIDEO')
    }

    static isSoundcloudPlaylist (query) {
        return Util.isSoundcloudLink(query) && query.includes('/sets/')
    }

    static isVimeoLink (query) {
        return vimeoRegex.test(query)
    }

    static getVimeoID (query) {
        return Util.isVimeoLink(query) ? query.split('/').filter(x => !!x).pop() : null
    }

    static isFacebookLink (query) {
        return facebookRegex.test(query)
    }

    static isReverbnationLink (query) {
        return /https:\/\/(www.)?reverbnation.com\/(.+)\/song\/(.+)/.test(query)
    }

    static isDiscordAttachment (query) {
        return /https:\/\/cdn.discordapp.com\/attachments\/(\d{17,19})\/(\d{17,19})\/(.+)/.test(query)
    }

    static buildTimecode (data) {
        const items = Object.keys(data)
        const required = ['days', 'hours', 'minutes', 'seconds']

        const parsed = items.filter(x => required.includes(x)).map(m => data[m] > 0 ? data[m] : '')
        const final = parsed.filter(x => !!x).map((x) => x.toString().padStart(2, '0')).join(':')
        return final.length <= 3 ? `0:${final.padStart(2, '0') || 0}` : final
    }
}
