const ytdl = require('discord-ytdl-core')
const Discord = require('discord.js')
const ytsr = require('ytsr')
const ytpl = require('ytpl')
const spotify = require('spotify-url-info')
const Queue = require('./Queue')
const Track = require('./Track')
const Util = require('./Util')
const { EventEmitter } = require('events')

/**
 * @typedef Filters
 * @property {boolean} [bassboost=false] Whether the bassboost filter is enabled.
 * @property {boolean} [8D=false] Whether the 8D filter is enabled.
 * @property {boolean} [vaporwave=false] Whether the vaporwave filter is enabled.
 * @property {boolean} [nightcore=false] Whether the nightcore filter is enabled.
 * @property {boolean} [phaser=false] Whether the phaser filter is enabled.
 * @property {boolean} [tremolo=false] Whether the tremolo filter is enabled.
 * @property {boolean} [vibrato=false] Whether the vibrato filter is enabled.
 * @property {boolean} [reverse=false] Whether the reverse filter is enabled.
 * @property {boolean} [treble=false] Whether the treble filter is enabled.
 * @property {boolean} [normalizer=false] Whether the normalizer filter is enabled.
 * @property {boolean} [surrounding=false] Whether the surrounding filter is enabled.
 * @property {boolean} [pulsator=false] Whether the pulsator filter is enabled.
 * @property {boolean} [subboost=false] Whether the subboost filter is enabled.
 * @property {boolean} [karaoke=false] Whether the karaoke filter is enabled.
 * @property {boolean} [flanger=false] Whether the flanger filter is enabled.
 * @property {boolean} [gate=false] Whether the gate filter is enabled.
 * @property {boolean} [haas=false] Whether the haas filter is enabled.
 * @property {boolean} [mcompand=false] Whether the mcompand filter is enabled.
 */

const filters = {
    bassboost: 'bass=g=20,dynaudnorm=f=200',
    '8D': 'apulsator=hz=0.08',
    vaporwave: 'aresample=48000,asetrate=48000*0.8',
    nightcore: 'aresample=48000,asetrate=48000*1.25',
    phaser: 'aphaser=in_gain=0.4',
    tremolo: 'tremolo',
    vibrato: 'vibrato=f=6.5',
    reverse: 'areverse',
    treble: 'treble=g=5',
    normalizer: 'dynaudnorm=f=200',
    surrounding: 'surround',
    pulsator: 'apulsator=hz=1',
    subboost: 'asubboost',
    karaoke: 'stereotools=mlev=0.03',
    flanger: 'flanger',
    gate: 'agate',
    haas: 'haas',
    mcompand: 'mcompand'
}

/**
 * @typedef PlayerOptions
 * @property {boolean} [leaveOnEnd=true] Whether the bot should leave the current voice channel when the queue ends.
 * @property {boolean} [leaveOnStop=true] Whether the bot should leave the current voice channel when the stop() function is used.
 * @property {boolean} [leaveOnEmpty=true] Whether the bot should leave the voice channel if there is no more member in it.
 * @property {number} [leaveOnEmptyCooldown=0] Used when leaveOnEmpty is enabled, to let the time to users to come back in the voice channel.
 */

/**
 * Default options for the player
 * @ignore
 * @type {PlayerOptions}
 */
const defaultPlayerOptions = {
    leaveOnEnd: true,
    leaveOnStop: true,
    leaveOnEmpty: true
}

class Player extends EventEmitter {
    /**
     * @param {Discord.Client} client Discord.js client
     * @param {PlayerOptions} options Player options
     */
    constructor (client, options = {}) {
        if (!client) throw new SyntaxError('Invalid Discord client')
        super()

        /**
         * Utilities
         * @type {Util}
         */
        this.util = Util
        /**
         * Discord.js client instance
         * @type {Discord.Client}
         */
        this.client = client
        /**
         * Player queues
         * @type {Discord.Collection<Discord.Snowflake, Queue>}
         */
        this.queues = new Discord.Collection()
        /**
         * Player options
         * @type {PlayerOptions}
         */
        this.options = defaultPlayerOptions
        for (const prop in options) {
            this.options[prop] = options[prop]
        }
        /**
         * Default filters for the queues created with this player.
         * @type {Filters}
         */
        this.filters = filters

        // Listener to check if the channel is empty
        client.on('voiceStateUpdate', (oldState, newState) => this._handleVoiceStateUpdate(oldState, newState))
    }

    resolveQueryType (query) {
        if (this.util.isSpotifyLink(query)) {
            return 'spotify-song'
        } else if (this.util.isYTPlaylistLink(query)) {
            return 'youtube-playlist'
        } else if (this.util.isYTVideoLink(query)) {
            return 'youtube-video'
        } else {
            return 'youtube-video-keywords'
        }
    }

    /**
     *
     * @param {Discord.Message} message
     * @param {string} query
     */
    _searchTracks (message, query) {
        return new Promise(async (resolve) => {
            const tracks = []

            const queryType = this.resolveQueryType(query)

            if (queryType === 'spotify-song') {
                const matchSpotifyURL = query.match(/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/)
                if (matchSpotifyURL) {
                    const spotifyData = await spotify.getPreview(query).catch(() => {})
                    if (spotifyData) {
                        const YTQuery = `${spotifyData.artist} - ${spotifyData.track}`
                        const results = await ytsr(YTQuery)

                        if (results.items.length !== 0) {
                            const resultsVideo = results.items.filter((i) => i.type === 'video')
                            tracks.push(...resultsVideo.map((r) => new Track(r, message.author, null)))
                        }
                    }
                }
            } else if (queryType === 'youtube-video-keywords') {
                await ytsr(query).then((results) => {
                    if (results.items.length !== 0) {
                        const resultsVideo = results.items.filter((i) => i.type === 'video')
                        tracks.push(...resultsVideo.map((r) => new Track(r, message.author, null)))
                    }
                }).catch(() => {})
            }

            if (tracks.length === 0) throw new Error('No tracks found for the specified query.')

            this.emit('searchResults', message, query, tracks)

            const collector = message.channel.createMessageCollector((m) => m.author.id === message.author.id, {
                time: 60000,
                errors: ['time']
            })
            collector.on('collect', ({ content }) => {
                if (!isNaN(content) && parseInt(content) >= 1 && parseInt(content) <= tracks.length) {
                    const index = parseInt(content, 10)
                    const track = tracks[index - 1]
                    collector.stop()
                    resolve(track)
                } else {
                    this.emit('searchInvalidResponse', message, query, tracks, content)
                }
            })
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    this.emit('searchCancel', message, query, tracks)
                }
            })
        })
    }

    setFilters (message, newFilters) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            Object.keys(newFilters).forEach((filterName) => {
                queue.filters[filterName] = newFilters[filterName]
            })
            this._playYTDLStream(queue, true, false)
        })
    }

    isPlaying (message) {
        return this.queues.some((g) => g.guildID === message.guild.id)
    }

    _addTrackToQueue (message, track) {
        const queue = this.getQueue(message)
        if (!queue) throw new Error('NotPlaying')
        if (!track || !(track instanceof Track)) throw new Error('No track to add to the queue specified')
        queue.tracks.push(track)
        return queue
    }

    _addTracksToQueue (message, tracks) {
        const queue = this.getQueue(message)
        if (!queue) throw new Error('Cannot add tracks to queue because no song is currently played on the server.')
        queue.tracks.push(...tracks)
        return queue
    }

    _createQueue (message, track) {
        return new Promise((resolve, reject) => {
            const channel = message.member.voice ? message.member.voice.channel : null
            if (!channel) reject(new Error('NotConnected'))
            const queue = new Queue(message.guild.id, message, this.filters)
            this.queues.set(message.guild.id, queue)
            channel.join().then((connection) => {
                queue.voiceConnection = connection
                queue.tracks.push(track)
                this.emit('queueCreate', message, queue)
                resolve(queue)
                this._playTrack(queue, true)
            }).catch((err) => {
                console.error(err)
                this.queues.delete(message.guild.id)
                reject(new Error('UnableToJoin'))
            })
        })
    }

    async _handlePlaylist (message, query) {
        const playlist = await ytpl(query).catch(() => {})
        if (!playlist) return this.emit('noResults', message, query)
        playlist.tracks = playlist.items.map((item) => new Track(item, message.author))
        playlist.duration = playlist.tracks.reduce((prev, next) => prev + next.duration, 0)
        playlist.thumbnail = playlist.tracks[0].thumbnail
        playlist.requestedBy = message.author
        if (this.isPlaying(message)) {
            const queue = this._addTracksToQueue(message, playlist.tracks)
            this.emit('playlistAdd', message, queue, playlist)
        } else {
            const track = new Track(playlist.tracks.shift(), message.author)
            const queue = await this._createQueue(message, track).catch((e) => this.emit('error', message, e))
            this._addTracksToQueue(message, playlist.tracks)
            this.emit('playlistStart', message, queue, playlist, queue.tracks[0])
        }
    }

    async _resolveSong (message, query) {

    }

    async _handleSong (message, query) {

    }

    async play (message, query) {
        const isPlaying = this.isPlaying(message)
        if (this.util.isYTPlaylistLink(query)) {
            return this._handlePlaylist(message, query)
        }
        let trackToPlay
        if (query instanceof Track) {
            trackToPlay = query
        } else if (this.util.isYTVideoLink(query)) {
            const videoData = await ytdl.getBasicInfo(query)
            trackToPlay = new Track(videoData, message.author)
        } else {
            trackToPlay = await this._searchTracks(message, query)
        }
        if (trackToPlay) {
            if (this.isPlaying(message)) {
                const queue = this._addTrackToQueue(message, trackToPlay)
                this.emit('trackAdd', message, queue, queue.tracks[queue.tracks.length - 1])
            } else {
                const queue = await this._createQueue(message, trackToPlay)
                this.emit('trackStart', message, queue.tracks[0])
            }
        }
    }

    pause (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Pause the dispatcher
            queue.voiceConnection.dispatcher.pause()
            queue.paused = true
            // Resolve the guild queue
            resolve(queue.playing)
        })
    }

    resume (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Pause the dispatcher
            queue.voiceConnection.dispatcher.resume()
            queue.paused = false
            // Resolve the guild queue
            resolve(queue.playing)
        })
    }

    stop (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Stop the dispatcher
            queue.stopped = true
            queue.tracks = []
            if (queue.stream) queue.stream.destroy()
            queue.voiceConnection.dispatcher.end()
            if (this.options.leaveOnStop) queue.voiceConnection.channel.leave()
            this.queues.delete(message.guild.id)
            // Resolve
            resolve()
        })
    }

    setVolume (message, percent) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Update volume
            queue.volume = percent
            queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200)
            // Resolve guild queue
            resolve()
        })
    }

    getQueue (message) {
        // Gets guild queue
        const queue = this.queues.get(message.guild.id)
        return queue
    }

    clearQueue (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Clear queue
            queue.tracks = []
            // Resolve guild queue
            resolve(queue)
        })
    }

    skip (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            const currentTrack = queue.playing
            // End the dispatcher
            queue.voiceConnection.dispatcher.end()
            queue.lastSkipped = true
            // Resolve the current track
            resolve(currentTrack)
        })
    }

    nowPlaying (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            const currentTrack = queue.tracks[0]
            // Resolve the current track
            resolve(currentTrack)
        })
    }

    setRepeatMode (message, enabled) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Enable/Disable repeat mode
            queue.repeatMode = enabled
            // Resolve
            resolve()
        })
    }

    shuffle (message) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Shuffle the queue (except the first track)
            const currentTrack = queue.tracks.shift()
            queue.tracks = queue.tracks.sort(() => Math.random() - 0.5)
            queue.tracks.unshift(currentTrack)
            // Resolve
            resolve(queue)
        })
    }

    remove (message, track) {
        return new Promise((resolve, reject) => {
            // Gets guild queue
            const queue = this.queues.get(message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            // Remove the track from the queue
            let trackFound = null
            if (typeof track === 'number') {
                trackFound = queue.tracks[track]
                if (trackFound) {
                    queue.tracks = queue.tracks.filter((t) => t !== trackFound)
                }
            } else {
                trackFound = queue.tracks.find((s) => s === track)
                if (trackFound) {
                    queue.tracks = queue.tracks.filter((s) => s !== trackFound)
                }
            }
            // Resolve
            resolve(trackFound)
        })
    }

    createProgressBar (message) {
        // Gets guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return
        // Stream time of the dispatcher
        const currentStreamTime = queue.voiceConnection.dispatcher
            ? queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime
            : 0
        // Total stream time
        const totalTime = queue.tracks[0].durationMS
        // Stream progress
        const index = Math.round((currentStreamTime / totalTime) * 15)
        // conditions
        if ((index >= 1) && (index <= 15)) {
            const bar = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬'.split('')
            bar.splice(index, 0, '🔘')
            return bar.join('')
        } else {
            return '🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬'
        }
    }

    /**
     * Handle voiceStateUpdate event.
     * @param {Discord.VoiceState} oldState
     * @param {Discord.VoiceState} newState
     */
    _handleVoiceStateUpdate (oldState, newState) {
        // Search for a queue for this channel
        const queue = this.queues.find((g) => g.guildID === oldState.guild.id)
        if (!queue) return

        // if the bot has been kicked from the channel, destroy ytdl stream and remove the queue
        if (newState.member.id === this.client.user.id && !newState.channelID) {
            queue.stream.destroy()
            this.queues.delete(newState.guild.id)
            this.emit('botDisconnect')
        }

        // process leaveOnEmpty checks
        if (!this.options.leaveOnEmpty) return
        // If the member leaves a voice channel
        if (!oldState.channelID || newState.channelID) return

        // If the channel is not empty
        if (!this.util.isVoiceEmpty(queue.voiceConnection.channel)) return
        setTimeout(() => {
            if (!this.util.isVoiceEmpty(queue.voiceConnection.channel)) return
            if (!this.queues.has(queue.guildID)) return
            // Disconnect from the voice channel
            queue.voiceConnection.channel.leave()
            // Delete the queue
            this.queues.delete(queue.guildID)
            // Emit end event
            queue.emit('channelEmpty', queue.firstMessage, queue)
        }, this.options.leaveOnEmptyCooldown ?? 0)
    }

    _playYTDLStream (track, queue, updateFilter) {
        return new Promise((resolve) => {
            const seekTime = updateFilter ? queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime : undefined
            const encoderArgsFilters = []
            Object.keys(queue.filters).forEach((filterName) => {
                if (queue.filters[filterName]) {
                    encoderArgsFilters.push(filters[filterName])
                }
            })
            let encoderArgs
            if (encoderArgsFilters.length < 1) {
                encoderArgs = []
            } else {
                encoderArgs = ['-af', encoderArgsFilters.join(',')]
            }
            const newStream = ytdl(track.url, {
                filter: 'audioonly',
                opusEncoded: true,
                encoderArgs,
                seek: seekTime / 1000,
                highWaterMark: 1 << 25
            })
            setTimeout(() => {
                if (queue.stream) queue.stream.destroy()
                queue.stream = newStream
                queue.voiceConnection.play(newStream, {
                    type: 'opus',
                    bitrate: 'auto'
                })
                if (seekTime) {
                    queue.additionalStreamTime = seekTime
                }
                queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200)
                // When the track starts
                queue.voiceConnection.dispatcher.on('start', () => {
                    resolve()
                })
                // When the track ends
                queue.voiceConnection.dispatcher.on('finish', () => {
                    // Reset streamTime
                    queue.additionalStreamTime = 0
                    // Play the next track
                    return this._playTrack(queue, false)
                })
            }, 1000)
        })
    }

    /**
     *
     * @param {Queue} queue The queue to play.
     * @param {*} firstPlay
     */
    async _playTrack (queue, firstPlay) {
        if (this.options.leaveOnEmpty && this.util.isVoiceEmpty(queue.voiceConnection.channel)) {

        }
        if (queue.stopped) return
        // If there isn't next music in the queue
        if (queue.tracks.length === 1 && !queue.repeatMode && !firstPlay) {
            // Leave the voice channel
            if (this.options.leaveOnEnd && !queue.stopped) queue.voiceConnection.channel.leave()
            // Remove the guild from the guilds list
            this.queues.delete(queue.guildID)
            // Emit stop event
            if (queue.stopped) {
                return queue.emit('musicStopp')
            }
            // Emit end event
            return queue.emit('queueEnd')
        }
        // if the track needs to be the next one
        if (!queue.repeatMode && !firstPlay) queue.tracks.shift()
        const track = queue.playing
        // Reset lastSkipped state
        queue.lastSkipped = false
        this._playYTDLStream(track, queue, false).then(() => {
            if (!firstPlay) this.emit('trackStart', queue.firstMessage, track, queue)
        })
    }
};

module.exports = Player
