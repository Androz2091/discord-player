const ytpl = require('ytpl')
const scraper = require('soundcloud-scraper')
const Discord = require('discord.js')

const youtubeVideoRegex = (/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
const spotifySongRegex = (/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/)

module.exports = class Util {
    constructor () {
        throw new Error(`The ${this.constructor.name} class may not be instantiated.`)
    }

    static isVoiceEmpty (channel) {
        return channel.members.filter((member) => !member.user.bot).size === 0
    }

    static isSoundcloudLink (query) {
        return scraper.validateURL(query)
    }

    static isSpotifyLink (query) {
        return spotifySongRegex.test(query)
    }

    static isYTPlaylistLink (query) {
        return ytpl.validateURL(query)
    }

    static isYTVideoLink (query) {
        return youtubeVideoRegex.test(query)
    }

    /**
     * Sends a selection embed in a channel and await for the member's answer
     * @param {Discord.User} user The user able to choose the song
     * @param {Discord.TextChannel} channel The channel in which the selection embed will be sent
     * @param {Tracks[]} tracks The tracks the selection embed should contain
     * @param {Object} options
     * @param {number} options.trackCount The number of tracks to show on the embed
     * @param {Function} options.formatTrack Function use to map songs in the selection embed
     * @param {String} options.embedColor Color of the selection embed
     * @param {String} options.embedFooter Text of the footer of the selection embed
     * @param {number} options.collectorTimeout Number of time before the bot cancels the selection and send the collectorTimeoutMessage message
     * @param {number} options.collectorTimeoutMessage Message sent when the selection time has expired
     * @param {Function} options.embedCallback Function called to allow users to edit the selection embed
     * @returns {Promise<Track>}
     */
    static async awaitSelection (user, channel, tracks, { trackCount, formatTrack, embedColor, embedFooter, collectorTimeout, collectorTimeoutMessage, embedCallback }) {
        if (trackCount) tracks.splice(trackCount)
        formatTrack = formatTrack || ((track, index) => `${++index} - ${track.name}`)
        const embed = new Discord.MessageEmbed()
            .setDescription(tracks.map(formatTrack))
            .setColor(embedColor || 'RED')
            .setFooter(embedFooter || 'Please send the number of the track you would like to listen.')
        await channel.send(embed)
        const collected = await channel.awaitMessages((message) => message.author.id === user.id && !isNaN(message.content) && parseInt(message.content) > 0 && parseInt(message.content) < tracks, {
            time: collectorTimeout,
            errors: ['time']
        }).catch((reason) => {
            channel.send(collectorTimeoutMessage)
            embedCallback(embed, null)
            return null
        })
        if (!collected) return null
        const index = parseInt(collected.first().content) - 1
        const track = tracks[index]
        embedCallback(embed, track)
        return track
    }
}
