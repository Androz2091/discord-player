const ytdl = require('ytdl-core');
const SYA = require('simple-youtube-api');
const mergeOptions = require('merge-options');

const { VoiceChannel, version } = require("discord.js");
if(version.split('.')[0] !== '12') throw new Error("Only the master branch of discord.js library is supported for now. Install it using 'npm install discordjs/discord.js'.");
const Queue = require('./Queue');
const Util = require('./Util');
const Song = require('./Song');

/**
 * Player options.
 * @typedef {PlayerOptions}
 * 
 * @property {Boolean} leaveOnEnd Whether the bot should leave the current voice channel when the queue ends.
 * @property {Boolean} leaveOnStop Whether the bot should leave the current voice channel when the stop() function is used.
 * @property {Boolean} leaveOnEmpty Whether the bot should leave the voice channel if there is no more member in it.
 */ 
const PlayerOptions = {
    leaveOnEnd: true,
    leaveOnStop: true,
    leaveOnEmpty: true
};

class Player {

    /**
     * @param {Client} client Your Discord Client instance.
     * @param {string} youtubeToken Your Youtube Data v3 API key.
     * @param {PlayerOptions} options The PlayerOptions object.
     */
    constructor(client, youtubeToken, options = {}){
        if(!client) throw new SyntaxError('Invalid Discord client');
        if(!youtubeToken) throw new SyntaxError('Invalid Token: Token must be a String');
        /**
         * Your Discord Client instance.
         * @type {Client}
         */
        this.client = client;
        /**
         * Your Youtube Data v3 API key.
         * @type {string}
         */
        this.youtubeToken = youtubeToken;
        /**
         * The Simple Youtube API Client.
         * @type {Youtube}
         */
        this.SYA = new SYA(this.youtubeToken);
        /**
         * The guilds data.
         * @type {Queue[]}
         */
        this.queues = [];
        /**
         * Player options.
         * @type {PlayerOptions}
         */
        this.options = mergeOptions(PlayerOptions, options);

        // Listener to check if the channel is empty
        client.on('voiceStateUpdate', (oldState, newState) => {
            if(!this.options.leaveOnEmpty) return;
            // If the member leaves a voice channel
            if(!oldState.channelID || newState.channelID) return;
            // Search for a queue for this channel
            let queue = this.queues.find((g) => g.connection.channel.id === oldState.channelID);
            if(queue){
                // If the channel is not empty
                if(queue.connection.channel.members.size > 1) return;
                // Disconnect from the voice channel
                queue.connection.channel.leave();
                // Delete the queue
                this.queues = this.queues.filter((g) => g.guildID !== queue.guildID);
                // Emit end event
                queue.emit('channelEmpty');
            }
        });
    }

    /**
     * Whether a guild is currently playing songs
     * @param {string} guildID The guild ID to check
     * @returns {Boolean} Whether the guild is currently playing songs
     */
    isPlaying(guildID) {
        return this.queues.some((g) => g.guildID === guildID);
    }

    /**
     * Plays a song in a voice channel.
     * @param {voiceChannel} voiceChannel The voice channel in which the song will be played.
     * @param {string} songName The name of the song to play.
     * @param {User} requestedBy The user who requested the song.
     * @returns {Promise<Song>}
     */
    play(voiceChannel, songName, requestedBy) {
        this.queues = this.queues.filter((g) => g.guildID !== voiceChannel.id);
        return new Promise(async (resolve, reject) => {
            if(!voiceChannel || typeof voiceChannel !== "object") return reject("voiceChannel must be type of VoiceChannel. value="+voiceChannel);
            if(typeof songName !== "string") return reject("songName must be type of string. value="+songName);
            // Searches the song
            let video = await Util.getFirstYoutubeResult(songName, this.SYA);
            if(!video) return reject('Song not found');
            // Joins the voice channel
            let connection = await voiceChannel.join();
            // Creates a new guild with data
            let queue = new Queue(voiceChannel.guild.id);
            queue.connection = connection;
            let song = new Song(video, queue, requestedBy);
            queue.songs.push(song);
            // Add the queue to the list
            this.queues.push(queue);
            // Plays the song
            this._playSong(queue.guildID, true);
            // Resolves the song.
            resolve(song);
        });
    }

    /**
     * Pauses the current song.
     * @param {string} guildID
     * @returns {Promise<Song>}
     */
    pause(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Pauses the dispatcher
            queue.dispatcher.pause();
            queue.playing = false;
            // Resolves the guild queue
            resolve(queue.songs[0]);
        });
    }

    /**
     * Resumes the current song.
     * @param {string} guildID
     * @returns {Promise<Song>}
     */
    resume(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Pauses the dispatcher
            queue.dispatcher.resume();
            queue.playing = true;
            // Resolves the guild queue
            resolve(queue.songs[0]);
        });
    }

    /**
     * Stops playing music.
     * @param {string} guildID
     * @returns {Promise<void>}
     */
    stop(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Stops the dispatcher
            queue.stopped = true;
            queue.songs = [];
            queue.dispatcher.end();
            // Resolves
            resolve();
        });
    }

    /**
     * Updates the volume.
     * @param {string} guildID 
     * @param {number} percent 
     * @returns {Promise<void>}
     */
    setVolume(guildID, percent) {
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Updates volume
            queue.dispatcher.setVolumeLogarithmic(percent / 200);
            // Resolves guild queue
            resolve(queue);
        });
    }

    /**
     * Gets the guild queue.
     * @param {string} guildID
     * @returns {?Queue}
     */
    getQueue(guildID) {
        // Gets guild queue
        let queue = this.queues.find((g) => g.guildID === guildID);
        return queue;
    }

    /**
     * Adds a song to the guild queue.
     * @param {string} guildID
     * @param {string} songName The name of the song to add to the queue.
     * @param {User} requestedBy The user who requested the song.
     * @returns {Promise<Song>}
     */
    addToQueue(guildID, songName, requestedBy){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Searches the song
            let video = await Util.getFirstYoutubeResult(songName, this.SYA).catch(() => {});
            if(!video) return reject('Song not found');
            let song = new Song(video, queue, requestedBy);
            // Updates queue
            queue.songs.push(song);
            // Resolves the song
            resolve(song);
        });
    }

    /**
     * Sets the queue for a guild.
     * @param {string} guildID
     * @param {Array<Song>} songs The songs list
     * @returns {Promise<Queue>}
     */
    setQueue(guildID, songs){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Updates queue
            queue.songs = songs;
            // Resolves the queue
            resolve(queue);
        });
    }

    /**
     * Clears the guild queue, but not the current song.
     * @param {string} guildID
     * @returns {Promise<Queue>}
     */
    clearQueue(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Clears queue
            let currentlyPlaying = queue.songs.shift();
            queue.songs = [ currentlyPlaying ];
            // Resolves guild queue
            resolve(queue);
        });
    }

    /**
     * Skips a song.
     * @param {string} guildID
     * @returns {Promise<Song>}
     */
    skip(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            let currentSong = queue.songs[0];
            // Ends the dispatcher
            queue.dispatcher.end();
            queue.skipped = true;
            // Resolves the current song
            resolve(currentSong);
        });
    }

    /**
     * Gets the currently playing song.
     * @param {string} guildID
     * @returns {Promise<Song>}
     */
    nowPlaying(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            let currentSong = queue.songs[0];
            // Resolves the current song
            resolve(currentSong);
        });
    }

    /**
     * Enable or disable the repeat mode
     * @param {string} guildID
     * @param {Boolean} enabled Whether the repeat mode should be enabled
     * @returns {Promise<Void>}
     */
    setRepeatMode(guildID, enabled) {
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Enable/Disable repeat mode
            queue.repeatMode = enabled;
            // Resolve
            resolve();
        });
    }

    /**
     * Shuffles the guild queue.
     * @param {string} guildID 
     * @returns {Promise<Void>}
     */
    shuffle(guildID){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Shuffle the queue (except the first song)
            let currentSong = queue.songs.shift();
            queue.songs = queue.songs.sort(() => Math.random() - 0.5);
            queue.songs.unshift(currentSong);
            // Resolve
            resolve();
        });
    }

    /**
     * Removes a song from the queue
     * @param {string} guildID 
     * @param {number|Song} song The index of the song to remove or the song to remove object.
     * @returns {Promise<Song|null>}
     */
    remove(guildID, song){
        return new Promise(async(resolve, reject) => {
            // Gets guild queue
            let queue = this.queues.find((g) => g.guildID === guildID);
            if(!queue) return reject('Not playing');
            // Remove the song from the queue
            let songFound = null;
            if(typeof song === "number"){
                songFound = queue.songs[song];
                if(songFound){
                    queue.songs = queue.songs.filter((s) => s !== songFound);
                }
            } else {
                songFound = queue.songs.find((s) => s === song);
                if(songFound){
                    queue.songs = queue.songs.filter((s) => s !== songFound);
                }
            }
            // Resolve
            resolve(songFound);
        });
    }

    /**
     * Start playing songs in a guild.
     * @ignore
     * @param {string} guildID
     * @param {Boolean} firstPlay Whether the function was called from the play() one
     */
    async _playSong(guildID, firstPlay) {
        // Gets guild queue
        let queue = this.queues.find((g) => g.guildID === guildID);
        // If there isn't any music in the queue
        if(queue.songs.length < 2 && !firstPlay && !queue.repeatMode){
            // Leaves the voice channel
            if(this.options.leaveOnEnd && !queue.stopped) queue.connection.channel.leave();
            // Remoces the guild from the guilds list
            this.queues = this.queues.filter((g) => g.guildID !== guildID);
            // Emits stop event
            if(queue.stopped){
                if(this.options.leaveOnStop) queue.connection.channel.leave();
                return queue.emit('stop');
            }
            // Emits end event 
            return queue.emit('end');
        }
        // Emit songChanged event
        if(!firstPlay) queue.emit('songChanged', (!queue.repeatMode ? queue.songs.shift() : queue.songs[0]), queue.songs[0], queue.skipped, queue.repeatMode);
        queue.skipped = false;
        let song = queue.songs[0];
        // Download the song
        let dispatcher = queue.connection.play(ytdl(song.url, { filter: "audioonly" }));
        queue.dispatcher = dispatcher;
        // Set volume
        dispatcher.setVolumeLogarithmic(queue.volume / 200);
        // When the song ends
        dispatcher.on('finish', () => {
            // Play the next song
            return this._playSong(guildID, false);
        });
    }

};

module.exports = Player;