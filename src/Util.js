const fetch = require('node-fetch');

/**
 * Utilities.
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
            let video = await SYA.getVideo(search).catch(() => {});
            if(video){
                video = await video.fetch()
                resolve(video);
            }
            // Try with song name
            let results = await SYA.searchVideos(search, 1);
            if(results.length < 1) reject('Not found');
            let fetched = await results.shift().fetch();
            results.push(fetched)
            resolve(results.pop());
        });
    }

};

module.exports = Util;