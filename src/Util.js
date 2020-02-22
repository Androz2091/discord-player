const fetch = require('node-fetch');

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

};

module.exports = Util;