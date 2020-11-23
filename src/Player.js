const ytdl = require('discord-ytdl-core')
const Discord = require('discord.js')
const ytsr = require('youtube-sr')
const spotify = require('spotify-url-info')
const soundcloud = require('soundcloud-scraper')
const moment = require('moment')
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

    /**
     * @ignore
     * @param {String} query
     */
    resolveQueryType (query) {
        if (this.util.isSpotifyLink(query)) {
            return 'spotify-song'
        } else if (this.util.isYTPlaylistLink(query)) {
            return 'youtube-playlist'
        } else if (this.util.isYTVideoLink(query)) {
            return 'youtube-video'
        } else if (this.util.isSoundcloudLink(query)) {
            return 'soundcloud-song'
        } else {
            return 'youtube-video-keywords'
        }
    }

    /**
     * Search tracks
     * @ignore
     * @param {Discord.Message} message
     * @param {string} query
     * @returns {Promise<Track>}
     */
    _searchTracks (message, query) {
        return new Promise(async (resolve) => {
            let tracks = []
            let updatedQuery = null

            let queryType = this.resolveQueryType(query)

            if (queryType === 'spotify-song') {
                const matchSpotifyURL = query.match(/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/)
                if (matchSpotifyURL) {
                    const spotifyData = await spotify.getPreview(query).catch(() => {})
                    if (spotifyData) {
                        updatedQuery = `${spotifyData.artist} - ${spotifyData.title}`
                        queryType = 'youtube-video-keywords'
                    }
                }
            } else if (queryType === 'soundcloud-song') {
                const soundcloudData = await soundcloud.getSongInfo(query).catch(() => {})
                if (soundcloudData) {
                    updatedQuery = `${soundcloudData.author.name} - ${soundcloudData.title}`
                    queryType = 'youtube-video-keywords'
                }
            }

            if (queryType === 'youtube-video-keywords') {
                await ytsr.search(updatedQuery || query, { type: 'video' }).then((results) => {
                    if (results.length !== 0) {
                        tracks = results.map((r) => new Track(r, message.author, this))
                    }
                }).catch(() => {})
            }

            if (tracks.length === 0) return this.emit('noResults', message, query)

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
                    this.emit('searchInvalidResponse', message, query, tracks, content, collector)
                }
            })
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    this.emit('searchCancel', message, query, tracks)
                }
            })
        })
    }

    /**
     * Change the filters.
     * @param {Discord.Message} message
     * @param {Partial<Filters>} newFilters The filters to update and their new status.
     * @example
     * client.player.setFilters(message, {
     *  bassboost: true
     * });
     */
    setFilters (message, newFilters) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === message.guild.id)
            if (!queue) return reject(new Error('Not playing'))
            Object.keys(newFilters).forEach((filterName) => {
                queue.filters[filterName] = newFilters[filterName]
            })
            this._playYTDLStream(queue, true).then(() => {
                resolve()
            })
        })
    }

    /**
     * Check whether there is a music played in the server
     * @param {Discord.Message} message
     */
    isPlaying (message) {
        return this.queues.some((g) => g.guildID === message.guild.id)
    }

    /**
     * Add a track to the queue
     * @ignore
     * @param {Discord.Message} message
     * @param {Track} track
     * @returns {Queue}
     */
    _addTrackToQueue (message, track) {
        const queue = this.getQueue(message)
        if (!queue) throw new Error('NotPlaying')
        if (!track || !(track instanceof Track)) throw new Error('No track to add to the queue specified')
        queue.tracks.push(track)
        return queue
    }

    /**
     * Add multiple tracks to the queue
     * @ignore
     * @param {Discord.Message} message
     * @param {Track[]} tracks
     * @returns {Queue}
     */
    _addTracksToQueue (message, tracks) {
        const queue = this.getQueue(message)
        if (!queue) throw new Error('Cannot add tracks to queue because no song is currently played on the server.')
        queue.tracks.push(...tracks)
        return queue
    }

    /**
     * Create a new queue and play the first track
     * @ignore
     * @param {Discord.Message} message
     * @param {Track} track
     * @returns {Promise<Queue>}
     */
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

    /**
     * Handle playlist by fetching the tracks and adding them to the queue
     * @ignore
     * @param {Discord.Message} message
     * @param {String} query
     */
    async _handlePlaylist (message, query) {
        const playlist = await ytsr.getPlaylist(query)
        if (!playlist) return this.emit('noResults', message, query)
        playlist.tracks = playlist.videos.map((item) => new Track(item, message.author))
        playlist.duration = playlist.tracks.reduce((prev, next) => prev + next.duration, 0)
        playlist.thumbnail = playlist.tracks[0].thumbnail
        playlist.requestedBy = message.author
        if (this.isPlaying(message)) {
            const queue = this._addTracksToQueue(message, playlist.tracks)
            this.emit('playlistAdd', message, queue, playlist)
        } else {
            const track = playlist.tracks.shift()
            const queue = await this._createQueue(message, track).catch((e) => this.emit('error', e, message))
            this.emit('trackStart', message, queue.tracks[0])
            this._addTracksToQueue(message, playlist.tracks)
        }
    }

    /**
     * Play a track in the server. Supported query types are `keywords`, `YouTube video links`, `YouTube playlists links`, `Spotify track link` or `SoundCloud song link`.
     * @param {Discord.Message} message Discord `message`
     * @param {String|Track} query Search query or a valid `Track` object.
     * @returns {Promise<void>}
     *
     * @example
     * client.player.play(message, "Despacito");
     */
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
            trackToPlay = new Track({
                title: videoData.videoDetails.title,
                url: videoData.videoDetails.video_url,
                views: videoData.videoDetails.viewCount,
                thumbnail: videoData.videoDetails.thumbnail.thumbnails[0],
                lengthSeconds: videoData.videoDetails.lengthSeconds,
                description: videoData.videoDetails.shortDescription,
                author: {
                    name: videoData.videoDetails.author.name
                }
            }, message.author, this)
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

    /**
     * Pause the music in the server.
     * @param {Discord.Message} message
     * @example
     * client.player.pause(message);
     */
    pause (message) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Pause the dispatcher
        queue.voiceConnection.dispatcher.pause()
        queue.paused = true
    }

    /**
     * Resume the music in the server.
     * @param {Discord.Message} message
     * @example
     * client.player.resume(message);
     */
    resume (message) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Pause the dispatcher
        queue.voiceConnection.dispatcher.resume()
        queue.paused = false
    }

    /**
     * Stop the music in the server.
     * @param {Discord.Message} message
     * @example
     * client.player.stop(message);
     */
    stop (message) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Stop the dispatcher
        queue.stopped = true
        queue.tracks = []
        if (queue.stream) queue.stream.destroy()
        queue.voiceConnection.dispatcher.end()
        if (this.options.leaveOnStop) queue.voiceConnection.channel.leave()
        this.queues.delete(message.guild.id)
    }

    /**
     * Change the server volume.
     * @param {Discord.Message} message
     * @param {number} percent
     * @example
     * client.player.setVolume(message, 90);
     */
    setVolume (message, percent) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Update volume
        queue.volume = percent
        queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200)
    }

    /**
     * Get the server queue.
     * @param {Discord.Message} message
     * @returns {Queue}
     */
    getQueue (message) {
        // Gets guild queue
        const queue = this.queues.get(message.guild.id)
        return queue
    }

    /**
     * Clears the server queue.
     * @param {Discord.Message} message
     */
    clearQueue (message) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Clear queue
        queue.tracks = []
    }

    /**
     * Skips to the next song.
     * @param {Discord.Message} message
     * @returns {Queue}
     */
    skip (message) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        const currentTrack = queue.playing
        // End the dispatcher
        queue.voiceConnection.dispatcher.end()
        queue.lastSkipped = true
        // Return the queue
        return queue
    }

    /**
     * Get the played song in the server.
     * @param {Discord.Message} message
     * @returns {Track}
     */
    nowPlaying (message) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        const currentTrack = queue.tracks[0]
        // Return the current track
        return currentTrack
    }

    /**
     * Enable or disable repeat mode in the server.
     * @param {Discord.Message} message
     * @param {boolean} enabled
     * @returns {boolean} whether the repeat mode is now enabled.
     */
    setRepeatMode (message, enabled) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Enable/Disable repeat mode
        queue.repeatMode = enabled
        // Return the repeat mode
        return queue.repeatMode
    }

    /**
     * Shuffle the queue of the server.
     * @param {Discord.Message} message
     * @returns {Queue}
     */
    shuffle (message) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
        // Shuffle the queue (except the first track)
        const currentTrack = queue.tracks.shift()
        queue.tracks = queue.tracks.sort(() => Math.random() - 0.5)
        queue.tracks.unshift(currentTrack)
        // Return the queue
        return queue
    }

    /**
     * Remove a track from the queue of the server
     * @param {Discord.Message} message
     * @param {Track|number} track
     * @returns {Track} the removed track
     */
    remove (message, track) {
        // Get guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return this.emit('error', 'NotPlaying', message)
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
        return trackFound
    }

    /**
     * Create a progress bar for the queue of the server.
     * @param {Discord.Message} message
     * @param {Object} options
     * @param {boolean} options.timecodes
     * @returns {string}
     */
    createProgressBar (message, options) {
        // Gets guild queue
        const queue = this.queues.get(message.guild.id)
        if (!queue) return
        const timecodes = options && typeof options === 'object' ? options.timecodes : false
        // Stream time of the dispatcher
        const currentStreamTime = queue.voiceConnection.dispatcher
            ? queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime
            : 0
        // Total stream time
        const totalTime = queue.playing.durationMS
        // Stream progress
        const index = Math.round((currentStreamTime / totalTime) * 15)
        // conditions
        if ((index >= 1) && (index <= 15)) {
            const bar = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬'.split('')
            bar.splice(index, 0, '🔘')
            if (timecodes) {
                const currentTimecode = (currentStreamTime >= 3600000 ? moment(currentStreamTime).format('H:mm:ss') : moment(currentStreamTime).format('m:ss'))
                return `${currentTimecode} ┃ ${bar.join('')} ┃ ${queue.playing.duration}`
            } else {
                return `${bar.join('')}`
            }
        } else {
            if (timecodes) {
                const currentTimecode = (currentStreamTime >= 3600000 ? moment(currentStreamTime).format('H:mm:ss') : moment(currentStreamTime).format('m:ss'))
                return `${currentTimecode} ┃ 🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ┃ ${queue.playing.duration}`
            } else {
                return '🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬'
            }
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
            this.emit('botDisconnect', queue.firstMessage)
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
        }, this.options.leaveOnEmptyCooldown || 0)
    }

    _playYTDLStream (queue, updateFilter) {
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
            const newStream = ytdl(queue.playing.url, {
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
        if (queue.stopped) return
        // If there isn't next music in the queue
        if (queue.tracks.length === 1 && !queue.repeatMode && !firstPlay) {
            // Leave the voice channel
            if (this.options.leaveOnEnd && !queue.stopped) queue.voiceConnection.channel.leave()
            // Remove the guild from the guilds list
            this.queues.delete(queue.guildID)
            // Emit stop event
            if (queue.stopped) {
                return queue.emit('musicStop')
            }
            // Emit end event
            return queue.emit('queueEnd', queue.firstMessage, queue)
        }
        // if the track needs to be the next one
        if (!queue.repeatMode && !firstPlay) queue.tracks.shift()
        const track = queue.playing
        // Reset lastSkipped state
        queue.lastSkipped = false
        this._playYTDLStream(queue, false).then(() => {
            if (!firstPlay) this.emit('trackStart', queue.firstMessage, track, queue)
        })
    }
};

module.exports = Player

/**
 * Emitted when a track starts
 * @event Player#trackStart
 * @param {Discord.Message} message
 * @param {Queue} queue
 * @param {Track} track
 */

/**
 * Emitted when a playlist is started
 * @event Player#queueCreate
 * @param {Discord.Message} message
 * @param {Queue} queue
 */

/**
 * Emitted when the bot is awaiting search results
 * @event Player#searchResults
 * @param {Discord.Message} message
 * @param {string} query
 * @param {Track[]} tracks
 */

/**
 * Emitted when the user has sent an invalid response for search results
 * @event Player#searchInvalidResponse
 * @param {Discord.Message} message
 * @param {string} query
 * @param {Track[]} tracks
 * @param {string} invalidResponse
 * @param {Discord.MessageCollector} collector
 */

/**
 * Emitted when the bot has stopped awaiting search results (timeout)
 * @event Player#searchCancel
 * @param {Discord.Message} message
 * @param {string} query
 * @param {Track[]} tracks
 */

/**
 * Emitted when the bot can't find related results to the query
 * @event Player#noResults
 * @param {Discord.Message} message
 * @param {string} query
 */

/**
 * Emitted when the bot is disconnected from the channel
 * @event Player#botDisconnect
 * @param {Discord.Message} message
 */

/**
 * Emitted when the channel of the bot is empty
 * @event Player#channelEmpty
 * @param {Discord.Message} message
 * @param {Queue} queue
 */

/**
 * Emitted when the queue of the server is ended
 * @event Player#queueEnd
 * @param {Discord.Message} message
 * @param {Queue} queue
 */

/**
 * Emitted when a track is added to the queue
 * @event Player#trackAdd
 * @param {Discord.Message} message
 * @param {Queue} queue
 * @param {Track} track
 */

/**
 * Emitted when a playlist is added to the queue
 * @event Player#playlistAdd
 * @param {Discord.Message} message
 * @param {Queue} queue
 * @param {Object} playlist
 */

/**
 * Emitted when an error is triggered
 * @event Player#error
 * @param {Discord.Message} message
 * @param {string} error It can be `NotConnected`, `UnableToJoin` or `NotPlaying`.
 */
