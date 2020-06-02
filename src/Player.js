const ytdl = require('ytdl-core');
const SimpleYouTubeAPI = require('simple-youtube-api');
const Discord = require('discord.js');

const Queue = require('./Queue');
const Track = require('./Track');
const Util = require('./Util');

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
};

class Player {

    /**
     * @param {Discord.Client} client Discord.js client
     * @param {string} youtubeToken Youtube Data v3 API Key
     * @param {PlayerOptions} options Player options
     */
    constructor(client, youtubeToken, options = {}){
        if(!client) throw new SyntaxError('Invalid Discord client');
        if(!youtubeToken) throw new SyntaxError('Invalid Token: Token must be a String');

        /**
         * Discord.js client instance
         * @type {Discord.Client}
         */
        this.client = client;
        /**
         * YouTube API Key
         * @type {string}
         */
        this.youtubeToken = youtubeToken;
        /**
         * Simple YouTube API client instance
         * @type {SimpleYouTubeAPI.YouTube}
         */
        this.youtube = new SimpleYouTubeAPI.YouTube(this.youtubeToken);
        /**
         * Player queues
         * @type {Queue[]}
         */
        this.queues = [];
        /**
         * Player options
         * @type {PlayerOptions}
         */
        this.options = defaultPlayerOptions;
        for(const prop in options){
            this.options[prop] = options[prop];
        }
        /**
         * Utilities methods for the player
         * @type {Util}
         */
        this.util = new Util(this.youtube)

        // Listener to check if the channel is empty
        client.on('voiceStateUpdate', (oldState, newState) => this._handleVoiceStateUpdate.call(this, oldState, newState));
    }

    /**
     * Whether a guild is currently playing something
     * @param {Discord.Snowflake} guildID The guild ID to check
     * @returns {boolean} Whether the guild is currently playing tracks
     */
    isPlaying(guildID) {
        return this.queues.some((g) => g.guildID === guildID);
    }

    /**
     * Play a track in a voice channel
     * @param {Discord.VoiceChannel} voiceChannel The voice channel in which the track will be played
     * @param {Track|string} track The name of the track to play
     * @param {Discord.User?} user The user who requested the track
     * @returns {Promise<Track>} The played track
     */
    play(voiceChannel, track, user) {
        this.queues = this.queues.filter((g) => g.guildID !== voiceChannel.id);
        return new Promise(async (resolve, reject) => {
            if(!voiceChannel || typeof voiceChannel !== "object"){
                return reject(`voiceChannel must be type of VoiceChannel. value=${voiceChannel}`);
            }
            const connection = voiceChannel.client.voice.connections.find((c) => c.channel.id === voiceChannel.id) || await voiceChannel.join();
            if(typeof track !== "object"){
                const results = await this.util.search(track, user);
                track = results[0];
            }
            // Create a new guild with data
            let queue = new Queue(voiceChannel.guild.id);
            queue.voiceConnection = connection;
            // Add the track to the queue
            track.requestedBy = user;
            queue.tracks.push(track);
            // Add the queue to the list
            this.queues.push(queue);
            // Play the track
            this._playTrack(queue.guildID, true);
            // Resolve the track
            resolve(track);
        });
    }

    /**
     * Pause the current track
     * @param {Discord.Snowflake} guildID The ID of the guild where the current track should be paused
     * @returns {Promise<Track>} The paused track
     */
    pause (guildID) {
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Pauses the dispatcher
            queue.voiceConnection.dispatcher.pause();
            queue.playing = false;
            // Resolves the guild queue
            resolve(queue.tracks[0]);
        });
    }

    /**
     * Resume the current track
     * @param {Discord.Snowflake} guildID The ID of the guild where the current track should be resumed
     * @returns {Promise<Track>} The resumed track
     */
    resume (guildID) {
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Pause the dispatcher
            queue.voiceConnection.dispatcher.resume();
            queue.playing = true;
            // Resolve the guild queue
            resolve(queue.tracks[0]);
        });
    }

    /**
     * Stops playing music.
     * @param {Discord.Snowflake} guildID The ID of the guild where the music should be stopped
     * @returns {Promise<void>}
     */
    stop(guildID){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Stop the dispatcher
            queue.stopped = true;
            queue.tracks = [];
            queue.voiceConnection.dispatcher.end();
            // Resolve
            resolve();
        });
    }

    /**
     * Update the volume
     * @param {Discord.Snowflake} guildID The ID of the guild where the music should be modified 
     * @param {number} percent The new volume (0-100)
     * @returns {Promise<void>}
     */
    setVolume(guildID, percent) {
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Updates volume
            queue.voiceConnection.dispatcher.setVolumeLogarithmic(percent / 200);
            queue.volume = percent;
            // Resolves guild queue
            resolve();
        });
    }

    /**
     * Get a guild queue
     * @param {Discord.Snowflake} guildID
     * @returns {?Queue}
     */
    getQueue(guildID) {
        // Gets guild queue
        let queue = this.queues.find((g) => g.guildID === guildID);
        return queue;
    }

    /**
     * Add a track to the guild queue
     * @param {Discord.Snowflake} guildID The ID of the guild where the track should be added
     * @param {string} trackName The name of the track to add to the queue
     * @param {Discord.User?} requestedBy The user who requested the track
     * @returns {Promise<Track>} The added track
     */
    addToQueue(guildID, trackName, requestedBy){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Search the track
            let track = await this.util.search(trackName, requestedBy).catch(() => {});
            if(!track[0]) return reject('Track not found');
            // Update queue
            queue.tracks.push(track[0]);
            // Resolve the track
            resolve(track[0]);
        });
    }

    /**
     * Set the queue for a guild.
     * @param {Discord.Snowflake} guildID The ID of the guild where the queue should be set
     * @param {Track[]} tracks The tracks list
     * @returns {Promise<Queue>} The new queue
     */
    setQueue(guildID, tracks){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Update queue
            queue.tracks = tracks;
            // Resolve the queue
            resolve(queue);
        });
    }

    /**
     * Clear the guild queue, but not the current track
     * @param {Discord.Snowflake} guildID The ID of the guild where the queue should be cleared
     * @returns {Promise<Queue>} The updated queue
     */
    clearQueue(guildID){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Clear queue
            let currentlyPlaying = queue.tracks.shift();
            queue.tracks = [ currentlyPlaying ];
            // Resolve guild queue
            resolve(queue);
        });
    }

    /**
     * Skip a track
     * @param {Discord.Snowflake} guildID The ID of the guild where the track should be skipped
     * @returns {Promise<Track>}
     */
    skip(guildID){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            let currentTrack = queue.tracks[0];
            // End the dispatcher
            queue.voiceConnection.dispatcher.end();
            queue.lastSkipped = true;
            // Resolve the current track
            resolve(currentTrack);
        });
    }

    /**
     * Get the currently playing track
     * @param {Discord.Snowflake} guildID
     * @returns {Promise<Track>} The track which is currently played
     */
    nowPlaying(guildID){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            let currentTrack = queue.tracks[0];
            // Resolve the current track
            resolve(currentTrack);
        });
    }

    /**
     * Enable or disable the repeat mode
     * @param {Discord.Snowflake} guildID
     * @param {Boolean} enabled Whether the repeat mode should be enabled
     * @returns {Promise<Void>}
     */
    setRepeatMode(guildID, enabled) {
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Enable/Disable repeat mode
            queue.repeatMode = enabled;
            // Resolve
            resolve();
        });
    }

    /**
     * Shuffle the guild queue (except the first track)
     * @param {Discord.Snowflake} guildID The ID of the guild where the queue should be shuffled
     * @returns {Promise<Queue>} The updated queue
     */
    shuffle(guildID){
        return new Promise(async(resolve, reject) => {
            // Get guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Shuffle the queue (except the first track)
            let currentTrack = queue.tracks.shift();
            queue.tracks = queue.tracks.sort(() => Math.random() - 0.5);
            queue.tracks.unshift(currentTrack);
            // Resolve
            resolve(queue);
        });
    }

    /**
     * Remove a track from the queue
     * @param {Discord.Snowflake} guildID The ID of the guild where the track should be removed
     * @param {number|Track} track The index of the track to remove or the track to remove object
     * @returns {Promise<Track|null>}
     */
    remove(guildID, track){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Remove the track from the queue
            let trackFound = null;
            if(typeof track === "number"){
                trackFound = queue.tracks[track];
                if(trackFound){
                    queue.tracks = queue.tracks.filter((s) => s !== trackFound);
                }
            } else {
                trackFound = queue.tracks.find((s) => s === track);
                if(trackFound){
                    queue.tracks = queue.tracks.filter((s) => s !== trackFound);
                }
            }
            // Resolve
            resolve(trackFound);
        });
    }

    /**
     * Handle the voice state update event
     * @ignore
     * @private
     * @param {Discord.VoiceState} oldState
     * @param {Discord.VoiceState} newState
     */
    _handleVoiceStateUpdate(oldState, newState) {
        if(!this.options.leaveOnEmpty) return;
        // If the member leaves a voice channel
        if(!oldState.channelID || newState.channelID) return;
        // Search for a queue for this channel
        let queue = this.queues.find((g) => g.voiceConnection.channel.id === oldState.channelID);
        if(queue){
            // If the channel is not empty
            if(queue.voiceConnection.channel.members.size > 1) return;
            // Disconnect from the voice channel
            queue.voiceConnection.channel.leave();
            // Delete the queue
            this.queues = this.queues.filter((g) => g.guildID !== queue.guildID);
            // Emit end event
            queue.emit('channelEmpty');
        }
    }

    /**
     * Start playing a track in a guild
     * @ignore
     * @private
     * @param {Discord.Snowflake} guildID
     * @param {Boolean} firstPlay Whether the function was called from the play() one
     */
    async _playTrack(guildID, firstPlay) {
        // Gets guild queue
        let queue = this.queues.find((g) => g.guildID === guildID);
        // If there isn't any music in the queue
        if(queue.tracks.length < 2 && !firstPlay && !queue.repeatMode){
            // Leaves the voice channel
            if(this.options.leaveOnEnd && !queue.stopped) queue.voiceConnection.channel.leave();
            // Remoces the guild from the guilds list
            this.queues = this.queues.filter((g) => g.guildID !== guildID);
            // Emits stop event
            if(queue.stopped){
                if(this.options.leaveOnStop) queue.voiceConnection.channel.leave();
                return queue.emit('stop');
            }
            // Emits end event 
            return queue.emit('end');
        }
        // Emit trackChanged event
        if(!firstPlay) queue.emit('trackChanged', (!queue.repeatMode ? queue.tracks.shift() : queue.tracks[0]), queue.tracks[0], queue.lastSkipped, queue.repeatMode);
        queue.lastSkipped = false;
        let track = queue.tracks[0];
        // Download the track
        queue.voiceConnection.play(ytdl(track.url, {
            filter: "audioonly"
        }));
        // Set volume
        queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.volume / 200);
        // When the track ends
        queue.voiceConnection.dispatcher.on('finish', () => {
            // Play the next track
            return this._playTrack(guildID, false);
        });
    }

};

module.exports = Player;