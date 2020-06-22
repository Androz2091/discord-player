const fetch = require('node-fetch');
const URL = require('url').URL
const scdl = require('soundcloud-downloader')

/**
 * Utilities.
 * @ignore
 */
class Util {

    constructor(){}
    
    /**
     * Gets the first youtube results for your search.
     * @param {string} search The name of the video or the video URL.
     * @param {Youtube} SYA The Simple Youtube API Client.
     * @returns {Promise<Video>}
     */
    static getFirstYoutubeResult(search, SYA){
        return new Promise(async (resolve, reject) => {
            search = search.replace(/<(.+)>/g, "$1");
            // Try with URL
            SYA.getVideo(search).then(async (video) => {
                video = await video.fetch();
                resolve(video);
            }).catch(async (err) => {
                if(err.message === "Bad Request"){
                    reject('Invalid Youtube Data v3 API key.');
                } else {
                    try {
                        // Try with song name
                        let results = await SYA.searchVideos(search, 1);
                        if(results.length < 1) return reject('Not found');
                        let fetched = await results.shift().fetch();
                        results.push(fetched);
                        resolve(results.pop());
                    } catch(err){
                        if(err.message === "Bad Request"){
                            reject('Invalid Youtube Data v3 API key.');
                        } else {
                            reject(err);
                        }
                    }
                }
            });
        });
    }

    /**
     * Checks if the given input string is a Soundcloud URL
     * @param {string} input The url of the soundcloud track
     */
    static isSoundcloudURL(input){
        try {
            const url = new URL(input); // Throws a TypeError if the input is invalid
            if (url.hostname !== 'soundcloud.com') return false;
            if (url.pathname === '/') return false;
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * 
     * @param {string} url The url of the soundcloud track
     * @param {string} clientID A Soundcloud client ID
     * @returns {Promise<SoundcloudSong>} An object with a similar interface to the YouTube video object
     * so it can be used interchangeably.
     */
    static async getSoundcloudTrackInfo(url, clientID){
        return await scdl.getInfo(url, clientID);
    }

};

module.exports = Util;