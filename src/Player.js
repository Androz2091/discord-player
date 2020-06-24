const ytdl = require('discord-ytdl-core')
const Discord = require('discord.js')
const ytsr = require('ytsr')

const Queue = require('./Queue')
const Track = require('./Track')

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
 */

const filters = {
    bassboost: 'bass=g=20,dynaudnorm=f=200',
    '8D': 'apulsator=hz=0.128',
    vaporwave: 'asetrate=44100*0.8,aresample=44100,atempo=1.1',
    nightcore: 'asetrate=44100*1.25',
    phaser: 'aphaser=in_gain=0.4',
    tremolo: 'tremolo',
    vibrato: 'vibrato=f=6.5',
    reverse: 'areverse',
    treble: 'treble=g=5',
    normalizer: 'dynaudnorm=f=150',
    surrounding: 'surround',
    pulsator: 'apulsator=hz=1',
    subboost: 'asubboost'
}

/**
 * @typedef PlayerOptions
 * @property {boolean} [leaveOnEnd=true] Whether the bot should leave the current voice channel when the queue ends.
 * @property {boolean} [leaveOnStop=true] Whether the bot should leave the current voice channel when the stop() function is used.
 * @property {boolean} [leaveOnEmpty=true] Whether the bot should leave the voice channel if there is no more member in it.
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

class Player {
    /**
     * @param {Discord.Client} client Discord.js client
     * @param {PlayerOptions} options Player options
     */
    constructor (client, options = {}) {
        if (!client) throw new SyntaxError('Invalid Discord client')

        /**
         * Discord.js client instance
         * @type {Discord.Client}
         */
        this.client = client
        /**
         * Player queues
         * @type {Queue[]}
         */
        this.queues = []
        /**
         * Player options
         * @type {PlayerOptions}
         */
        this.options = defaultPlayerOptions
        for (const prop in options) {
            this.options[prop] = options[prop]
        }

        // Listener to check if the channel is empty
        client.on('voiceStateUpdate', (oldState, newState) => this._handleVoiceStateUpdate(oldState, newState))
    }

    /**
     * Set the filters enabled for the guild. [Full list of the filters](https://discord-player.js.org/global.html#Filters)
     * @param {Discord.Snowflake} guildID
     * @param {Filters} newFilters
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'bassboost'){
     *          const bassboostEnabled = client.player.getQueue(message.guild.id);
     *          if(!bassboostEnabled){
     *              client.player.updateFilters(message.guild.id, {
     *                  bassboost: true
     *              });
     *              message.channel.send("Bassboost effect has been enabled!");
     *          } else {
     *              client.player.updateFilters(message.guild.id, {
     *                  bassboost: false
     *              });
     *              message.channel.send("Bassboost effect has been disabled!");
     *          }
     *      }
     *
     * });
     */
    setFilters (guildID, newFilters) {
        return new Promise((resolve, reject) => {
            // Gets guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            Object.keys(newFilters).forEach((filterName) => {
                queue.filters[filterName] = newFilters[filterName]
            })
            this._playYTDLStream(queue, true, false)
        })
    }

    /**
     * Searchs tracks on YouTube
     * @param {string} query The query
     * @returns {Promise<Track[]>}
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'play'){
     *          // Search for tracks
     *          let tracks = await client.player.searchTracks(args[0]);
     *          // Sends an embed with the 10 first songs
     *          if(tracks.length > 10) tracks = tracks.substr(0, 10);
     *          const embed = new Discord.MessageEmbed()
     *          .setDescription(tracks.map((t, i) => `**${i+1} -** ${t.name}`).join("\n"))
     *          .setFooter("Send the number of the track you want to play!");
     *          message.channel.send(embed);
     *          // Wait for user answer
     *          await message.channel.awaitMessages((m) => m.content > 0 && m.content < 10, { max: 1, time: 20000, errors: ["time"] }).then(async (answers) => {
     *              let index = parseInt(answers.first().content, 10);
     *              track = track[index-1];
     *              // Then play the song
     *              client.player.play(message.member.voice.channel, track);
     *          });
     *      }
     *
     * });
     */
    searchTracks (query) {
        return new Promise(async (resolve, reject) => {
            // eslint-disable-next-line no-useless-escape
            const matchURL = query.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
            if (matchURL) {
                query = matchURL[1]
            }
            ytsr(query, (err, results) => {
                if (err) return []
                const resultsVideo = results.items.filter((i) => i.type === 'video')
                resolve(resultsVideo.map((r) => new Track(r, null, null)))
            })
        })
    }

    /**
     * Whether a guild is currently playing something
     * @param {Discord.Snowflake} guildID The guild ID to check
     * @returns {boolean} Whether the guild is currently playing tracks
     */
    isPlaying (guildID) {
        return this.queues.some((g) => g.guildID === guildID)
    }

    /**
     * Play a track in a voice channel
     * @param {Discord.VoiceChannel} voiceChannel The voice channel in which the track will be played
     * @param {Track|string} track The name of the track to play
     * @param {Discord.User?} user The user who requested the track
     * @returns {Promise<Track>} The played track
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      // !play Despacito
     *      // will play "Despacito" in the member voice channel
     *
     *      if(command === 'play'){
     *          let track = await client.player.play(message.member.voice.channel, args[0], message.member.user.tag);
     *          message.channel.send(`Currently playing ${track.name}! - Requested by ${track.requestedBy}`);
     *      }
     *
     * });
     */
    play (voiceChannel, track, user) {
        this.queues = this.queues.filter((g) => g.guildID !== voiceChannel.id)
        return new Promise(async (resolve, reject) => {
            if (!voiceChannel || typeof voiceChannel !== 'object') {
                return reject(new Error(`voiceChannel must be type of VoiceChannel. value=${voiceChannel}`))
            }
            const connection = voiceChannel.client.voice.connections.find((c) => c.channel.id === voiceChannel.id) || await voiceChannel.join()
            if (typeof track !== 'object') {
                const results = await this.searchTracks(track)
                track = results[0]
            }
            // Create a new guild with data
            const queue = new Queue(voiceChannel.guild.id)
            queue.voiceConnection = connection
            queue.filters = {}
            Object.keys(filters).forEach((f) => {
                queue.filters[f] = false
            })
            // Add the track to the queue
            track.requestedBy = user
            queue.tracks.push(track)
            // Add the queue to the list
            this.queues.push(queue)
            // Play the track
            this._playTrack(queue.guildID, true)
            // Resolve the track
            resolve(track)
        })
    }

    /**
     * Pause the current track
     * @param {Discord.Snowflake} guildID The ID of the guild where the current track should be paused
     * @returns {Promise<Track>} The paused track
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'pause'){
     *          let track = await client.player.pause(message.guild.id);
     *          message.channel.send(`${track.name} paused!`);
     *      }
     *
     * });
     */
    pause (guildID) {
        return new Promise((resolve, reject) => {
            // Gets guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Pauses the dispatcher
            queue.voiceConnection.dispatcher.pause()
            queue.paused = true
            // Resolves the guild queue
            resolve(queue.playing)
        })
    }

    /**
     * Resume the current track
     * @param {Discord.Snowflake} guildID The ID of the guild where the current track should be resumed
     * @returns {Promise<Track>} The resumed track
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'resume'){
     *          let track = await client.player.resume(message.guild.id);
     *          message.channel.send(`${track.name} resumed!`);
     *      }
     *
     * });
     */
    resume (guildID) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Pause the dispatcher
            queue.voiceConnection.dispatcher.resume()
            queue.paused = false
            // Resolve the guild queue
            resolve(queue.playing)
        })
    }

    /**
     * Stops playing music.
     * @param {Discord.Snowflake} guildID The ID of the guild where the music should be stopped
     * @returns {Promise<void>}
     *
     * @example
     * client.on('message', (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'stop'){
     *          client.player.stop(message.guild.id);
     *          message.channel.send('Music stopped!');
     *      }
     *
     * });
     */
    stop (guildID) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Stop the dispatcher
            queue.stopped = true
            queue.tracks = []
            queue.voiceConnection.dispatcher.end()
            // Resolve
            resolve()
        })
    }

    /**
     * Update the volume
     * @param {Discord.Snowflake} guildID The ID of the guild where the music should be modified
     * @param {number} percent The new volume (0-100)
     * @returns {Promise<void>}
     *
     * @example
     * client.on('message', (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'setvolume'){
     *          client.player.setVolume(message.guild.id, parseInt(args[0]));
     *          message.channel.send(`Volume set to ${args[0]} !`);
     *      }
     *
     * });
     */
    setVolume (guildID, percent) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Updates volume
            queue.voiceConnection.dispatcher.setVolumeLogarithmic(percent / 200)
            queue.volume = percent
            // Resolves guild queue
            resolve()
        })
    }

    /**
     * Get a guild queue
     * @param {Discord.Snowflake} guildID
     * @returns {?Queue}
     *
     * @example
     * client.on('message', (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'queue'){
     *          let queue = await client.player.getQueue(message.guild.id);
     *          message.channel.send('Server queue:\n'+(queue.tracks.map((track, i) => {
     *              return `${i === 0 ? 'Current' : `#${i+1}`} - ${track.name} | ${track.author}`;
     *          }).join('\n')));
     *      }
     *
     *      // Output:
     *
     *      // Server queue:
     *      // Current - Despacito | Luis Fonsi
     *      // #2 - Memories | Maroon 5
     *      // #3 - Dance Monkey | Tones And I
     *      // #4 - Circles | Post Malone
     * });
     */
    getQueue (guildID) {
        // Gets guild queue
        const queue = this.queues.find((g) => g.guildID === guildID)
        return queue
    }

    /**
     * Add a track to the guild queue
     * @param {Discord.Snowflake} guildID The ID of the guild where the track should be added
     * @param {Track|string} trackName The name of the track to add to the queue
     * @param {Discord.User?} requestedBy The user who requested the track
     * @returns {Promise<Track>} The added track
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'play'){
     *          let trackPlaying = client.player.isPlaying(message.guild.id);
     *          // If there's already a track being played
     *          if(trackPlaying){
     *              // Add the track to the queue
     *              let track = await client.player.addToQueue(message.guild.id, args[0]);
     *              message.channel.send(`${track.name} added to queue!`);
     *          } else {
     *              // Else, play the track
     *              let track = await client.player.play(message.member.voice.channel, args[0]);
     *              message.channel.send(`Currently playing ${track.name}!`);
     *          }
     *      }
     *
     * });
     */
    addToQueue (guildID, track, requestedBy) {
        return new Promise(async (resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Search the track
            if (typeof track !== 'object') {
                const results = await this.searchTracks(track)
                track = results[0]
            }
            track.requestedBy = requestedBy
            // Update queue
            queue.tracks.push(track)
            // Resolve the track
            resolve(track)
        })
    }

    /**
     * Clear the guild queue, except the current track
     * @param {Discord.Snowflake} guildID The ID of the guild where the queue should be cleared
     * @returns {Promise<Queue>} The updated queue
     *
     * @example
     * client.on('message', (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'clear-queue'){
     *          client.player.clearQueue(message.guild.id);
     *          message.channel.send('Queue cleared!');
     *      }
     *
     * });
     */
    clearQueue (guildID) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Clear queue
            const currentlyPlaying = queue.tracks.shift()
            queue.tracks = [currentlyPlaying]
            // Resolve guild queue
            resolve(queue)
        })
    }

    /**
     * Skip a track
     * @param {Discord.Snowflake} guildID The ID of the guild where the track should be skipped
     * @returns {Promise<Track>}
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'skip'){
     *          let track = await client.player.skip(message.guild.id);
     *          message.channel.send(`${track.name} skipped!`);
     *      }
     *
     * });
     */
    skip (guildID) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            const currentTrack = queue.tracks[0]
            // End the dispatcher
            queue.voiceConnection.dispatcher.end()
            queue.lastSkipped = true
            // Resolve the current track
            resolve(currentTrack)
        })
    }

    /**
     * Get the currently playing track
     * @param {Discord.Snowflake} guildID
     * @returns {Promise<Track>} The track which is currently played
     *
     * @example
     * client.on('message', async (message) => {
     *
     *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *      const command = args.shift().toLowerCase();
     *
     *      if(command === 'now-playing'){
     *          let track = await client.player.nowPlaying(message.guild.id);
     *          message.channel.send(`Currently playing ${track.name}...`);
     *      }
     *
     * });
     */
    nowPlaying (guildID) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            const currentTrack = queue.tracks[0]
            // Resolve the current track
            resolve(currentTrack)
        })
    }

    /**
     * Enable or disable the repeat mode
     * @param {Discord.Snowflake} guildID
     * @param {Boolean} enabled Whether the repeat mode should be enabled
     * @returns {Promise<Void>}
     *
     * @example
     * client.on('message', async (message) => {
     *
     *     const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *     const command = args.shift().toLowerCase();
     *
     *     if(command === 'repeat-mode'){
     *         const repeatModeEnabled = client.player.getQueue(message.guild.id).repeatMode;
     *         if(repeatModeEnabled){
     *              // if the repeat mode is currently enabled, disable it
     *              client.player.setRepeatMode(message.guild.id, false);
     *              message.channel.send("Repeat mode disabled! The current song will no longer be played again and again...");
     *         } else {
     *              // if the repeat mode is currently disabled, enable it
     *              client.player.setRepeatMode(message.guild.id, true);
     *              message.channel.send("Repeat mode enabled! The current song will be played again and again until you run the command again!");
     *         }
     *     }
     *
     * });
     */
    setRepeatMode (guildID, enabled) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Enable/Disable repeat mode
            queue.repeatMode = enabled
            // Resolve
            resolve()
        })
    }

    /**
     * Shuffle the guild queue (except the first track)
     * @param {Discord.Snowflake} guildID The ID of the guild where the queue should be shuffled
     * @returns {Promise<Queue>} The updated queue
     *
     * @example
     * client.on('message', async (message) => {
     *
     *     const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *     const command = args.shift().toLowerCase();
     *
     *     if(command === 'shuffle'){
     *         // Shuffle the server queue
     *         client.player.shuffle(message.guild.id).then(() => {
     *              message.channel.send('Queue shuffled!');
     *         });
     *      }
     *
     * });
     */
    shuffle (guildID) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
            if (!queue) return reject(new Error('Not playing'))
            // Shuffle the queue (except the first track)
            const currentTrack = queue.tracks.shift()
            queue.tracks = queue.tracks.sort(() => Math.random() - 0.5)
            queue.tracks.unshift(currentTrack)
            // Resolve
            resolve(queue)
        })
    }

    /**
     * Remove a track from the queue
     * @param {Discord.Snowflake} guildID The ID of the guild where the track should be removed
     * @param {number|Track} track The index of the track to remove or the track to remove object
     * @returns {Promise<Track|null>}
     *
     * @example
     * client.on('message', async (message) => {
     *
     *     const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
     *     const command = args.shift().toLowerCase();
     *
     *     if(command === 'remove'){
     *         // Removes a track from the queue
     *         client.player.remove(message.guild.id, args[0]).then(() => {
     *              message.channel.send('Removed track!');
     *         });
     *      }
     *
     * });
     */
    remove (guildID, track) {
        return new Promise((resolve, reject) => {
            // Gets guild queue
            const queue = this.queues.find((g) => g.guildID === guildID)
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

    /**
     * Handle the voice state update event
     * @ignore
     * @private
     * @param {Discord.VoiceState} oldState
     * @param {Discord.VoiceState} newState
     */
    _handleVoiceStateUpdate (oldState, newState) {
        if (!this.options.leaveOnEmpty) return
        // If the member leaves a voice channel
        if (!oldState.channelID || newState.channelID) return
        // Search for a queue for this channel
        const queue = this.queues.find((g) => g.voiceConnection.channel.id === oldState.channelID)
        if (queue) {
            // If the channel is not empty
            if (queue.voiceConnection.channel.members.size > 1) return
            // Disconnect from the voice channel
            queue.voiceConnection.channel.leave()
            // Delete the queue
            this.queues = this.queues.filter((g) => g.guildID !== queue.guildID)
            // Emit end event
            queue.emit('channelEmpty')
        }
    }
    
    /**
      * Creates progress bar of the current song
      * @param {Queue} queue Queue of the current server
      * @returns {String}
      */
    createProgressBar(queue) {
        // stream time of the dispatcher
        const currentStreamTime = queue.voiceConnection.dispatcher.streamTime
        // total stream length
        const totalLength = queue.tracks[0].durationMS
        // stream progress
        let index = Math.round((currentStreamTime / totalLength) * 15)
        // conditions
        if ((index >= 1) && (index <= 15)) {
            let bar = `▬▬▬▬▬▬▬▬▬▬▬▬▬▬`.split("")
            return bar.splice(index, 0, "🔘").join("")
        } else {
            return `🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬`
        }
    }

    /**
     * Play a stream in a channel
     * @ignore
     * @private
     * @param {Queue} queue The queue to play
     * @param {*} updateFilter Whether this method is called to update some ffmpeg filters
     * @returns {Promise<void>}
     */
    _playYTDLStream (queue, updateFilter) {
        return new Promise((resolve) => {
            const currentStreamTime = updateFilter ? queue.voiceConnection.dispatcher.streamTime / 1000 : undefined
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
                seek: currentStreamTime
            })
            setTimeout(() => {
                queue.voiceConnection.play(newStream, {
                    type: 'opus'
                })
                queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.volume / 200)
                // When the track starts
                queue.voiceConnection.dispatcher.on('start', () => {
                    resolve()
                })
                // When the track ends
                queue.voiceConnection.dispatcher.on('finish', () => {
                    // Play the next track
                    return this._playTrack(queue.guildID, false)
                })
            }, 1000)
        })
    }

    /**
     * Start playing a track in a guild
     * @ignore
     * @private
     * @param {Discord.Snowflake} guildID
     * @param {Boolean} firstPlay Whether the function was called from the play() one
     */
    async _playTrack (guildID, firstPlay) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === guildID)
        // If there isn't any music in the queue
        if (queue.tracks.length < 2 && !firstPlay && !queue.repeatMode) {
            // Leave the voice channel
            if (this.options.leaveOnEnd && !queue.stopped) queue.voiceConnection.channel.leave()
            // Remove the guild from the guilds list
            this.queues = this.queues.filter((g) => g.guildID !== guildID)
            // Emit stop event
            if (queue.stopped) {
                if (this.options.leaveOnStop) queue.voiceConnection.channel.leave()
                return queue.emit('stop')
            }
            // Emit end event
            return queue.emit('end')
        }
        const wasPlaying = queue.playing
        const nowPlaying = queue.playing = queue.repeatMode ? wasPlaying : queue.tracks.shift()
        // Reset lastSkipped state
        queue.lastSkipped = false
        this._playYTDLStream(queue, false).then(() => {
            // Emit trackChanged event
            if (!firstPlay) {
                queue.emit('trackChanged', nowPlaying, wasPlaying, queue.lastSkipped, queue.repeatMode)
            }
        })
    }
};

module.exports = Player
