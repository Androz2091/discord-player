const fetch = require('node-fetch')
const Discord = require('discord.js')
const Track = require('./Track')
const SimpleYouTubeAPI = require('simple-youtube-api')

/**
 * Utilities
 */
class Util {

    /**
     * @param {SimpleYouTubeAPI.YouTube} youtube The SimpleYouTubeAPI client instance
     */
    constructor(youtube){
        /**
         * The SimpleYouTubeAPI client instance
         * @type {SimpleYouTubeAPI.YouTube}
         */
        this.youtube = youtube;
    }

    /**
     * Get the first youtube results for your search
     * @param {string} query The name of the video or the video URL
     * @param {Discord.User?} user The user who requested the track
     * @returns {Promise<Track[]>}
     */
    search(query, user) {
        return new Promise(async (resolve, reject) => {
            query = query.replace(/<(.+)>/g, "$1");
            try {
                const videoData = SimpleYouTubeAPI.parseURL(query);
                if(videoData.video){
                    const video = await this.youtube.getVideoById(videoData.video);
                    if(video){
                        await video.fetch();
                        const track = new Track(video, user, null);
                        return resolve([ track ]);
                    }
                }
                const results = await this.youtube.searchVideos(query, 1);
                const tracks = [];
                for(let result of (results.filter((r) => r.type === "video"))){
                    // @ts-ignore
                    await result.fetch();
                    // @ts-ignore
                    const track = new Track(result, user, null);
                    tracks.push(track);
                }
                return resolve(tracks);
            } catch(e) {
                if(e.message && e.message === "Bad Request"){
                    reject("Looks like your YouTube Data v3 API key is not valid...");
                } else {
                    reject(e);
                }
            }
        });
    }

};

module.exports = Util;
