const Discord = require('discord.js')
const { EventEmitter } = require('events')
const Track = require('./Track')

/**
 * Represents a guild queue.
 */
class Queue extends EventEmitter {
    /**
     * @param {Discord.Snowflake} guildID ID of the guild this queue is for.
     */
    constructor (guildID) {
        super()
        /**
         * ID of the guild this queue is for.
         * @type {Discord.Snowflake}
         */
        this.guildID = guildID
        /**
         * The voice connection of this queue.
         * @type {Discord.VoiceConnection}
         */
        this.voiceConnection = null
        /**
         * The song currently played.
         * @type {Track}
         */
        this.playing = null
        /**
         * The tracks of this queue. The first one is currenlty playing and the others are going to be played.
         * @type {Track[]}
         */
        this.tracks = []
        /**
         * Whether the stream is currently stopped.
         * @type {boolean}
         */
        this.stopped = false
        /**
         * Whether the last track was skipped.
         * @type {boolean}
         */
        this.lastSkipped = false
        /**
         * The stream volume of this queue. (0-100)
         * @type {number}
         */
        this.volume = 100
        /**
         * Whether the stream is currently paused.
         * @type {boolean}
         */
        this.paused = true
        /**
         * Whether the repeat mode is enabled.
         * @type {boolean}
         */
        this.repeatMode = false
        /**
         * Filters status
         * @type {Filters}
         */
        this.filters = {}
        /**
         * Additional stream time
         * @type {Number}
         */
        this.additionalStreamTime = 0
    }

    get calculatedVolume () {
        return this.filters.bassboost ? this.volume + 50 : this.volume
    }
}

module.exports = Queue

/**
 * Emitted when the queue is empty.
 * @event Queue#end
 *
 * @example
 * client.on('message', (message) => {
 *
 *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
 *      const command = args.shift().toLowerCase();
 *
 *      if(command === 'play'){
 *
 *          let track = await client.player.play(message.member.voice.channel, args[0]);
 *
 *          track.queue.on('end', () => {
 *              message.channel.send('The queue is empty, please add new tracks!');
 *          });
 *
 *      }
 *
 * });
 */

/**
 * Emitted when the voice channel is empty.
 * @event Queue#channelEmpty
 */

/**
 * Emitted when the track changes.
 * @event Queue#trackChanged
 * @param {Track} oldTrack The old track (playing before)
 * @param {Track} newTrack The new track (currently playing)
 * @param {Boolean} skipped Whether the change is due to the skip() function
 *
 * @example
 * client.on('message', (message) => {
 *
 *      const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
 *      const command = args.shift().toLowerCase();
 *
 *      if(command === 'play'){
 *
 *          let track = await client.player.play(message.member.voice.channel, args[0]);
 *
 *          track.queue.on('trackChanged', (oldTrack, newTrack, skipped, repeatMode) => {
 *              if(repeatMode){
 *                  message.channel.send(`Playing ${newTrack} again...`);
 *              } else {
 *                  message.channel.send(`Now playing ${newTrack}...`);
 *              }
 *          });
 *
 *      }
 *
 * });
 */
