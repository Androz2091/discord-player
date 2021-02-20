const fetch = require('node-fetch').default
const { JSDOM } = require('jsdom')
const { Readable } = require('stream')
class Facebook {
    constructor () {
        throw new Error(`The ${this.constructor.name} class may not be instantiated!`)
    }

    /**
     * Validates facebook url
     * @param {string} url URL to validate
     */
    static validateURL (url) {
        const REGEX = /(https?:\/\/)(www\.|m\.)?(facebook|fb).com\/.*\/videos\/.*/
        if (!url || typeof url !== 'string') return false
        return REGEX.test(url)
    }

    /**
     * @typedef {Readable} Readable
     */

    /**
     * Downloads facebook video
     * @param {string} url Video url to download
     * @returns {Promise<Readable>}
     */
    static download (url) {
        return new Promise(async (resolve, reject) => {
            if (!Facebook.validateURL(url)) reject(new Error('Invalid url.'))
            const info = await Facebook.getInfo(url)
            if (!info || !info.streamURL) return reject(new Error('video not found'))
            const link = info.streamURL
            let req = require('https')

            if (link.startsWith('http://')) req = require('http')

            req.get(link, res => {
                resolve(res)
            })
        })
    }

    /**
     * Fetches facebook video info
     * @param {string} url Facebook video url
     */
    static async getInfo (url) {
        if (!Facebook.validateURL(url)) throw new Error('Invalid url.')
        try {
            const html = await Facebook._parseHTML(url)
            const document = new JSDOM(html).window.document
            const rawdata = document.querySelector('script[type="application/ld+json"]').innerHTML
            const json = JSON.parse(rawdata)

            const obj = {
                name: json.name,
                title: document.querySelector('meta[property="og:title"]').attributes.item(1).value,
                description: json.description,
                rawVideo: json.contentUrl,
                thumbnail: json.thumbnailUrl,
                uploadedAt: new Date(json.uploadDate),
                duration: Facebook.parseTime(json.duration),
                interactionCount: json.interactionCount,
                streamURL: json.url,
                publishedAt: new Date(json.datePublished),
                width: json.width,
                height: json.height,
                live: !!json.publication[0].isLiveBroadcast,
                nsfw: !json.isFamilyFriendly,
                genre: json.genre,
                keywords: json.keywords ? json.keywords.split(', ') : [],
                comments: json.commentCount,
                size: json.contentSize,
                quality: json.videoQuality,
                author: {
                    type: json.author['@type'],
                    name: json.author.name,
                    url: json.author.url
                },
                publisher: {
                    type: json.publisher['@type'],
                    name: json.publisher.name,
                    url: json.publisher.url,
                    avatar: json.publisher.logo.url
                },
                url: html.split('",page_uri:"')[1].split('",')[0],
                shares: html.split(',share_count:{')[1].split('},')[0].split(':')[1],
                views: html.split(',video_view_count:')[1].split(',')[0]
            }

            return obj
        } catch {
            return null
        }
    }

    /**
     * Parses time in ms
     * @param {string} duration Raw duration to parse
     * @returns {string}
     */
    static parseTime (duration) {
        if (typeof duration !== 'string') return duration
        let a = duration.match(/\d+/g)

        if (duration.indexOf('M') >= 0 && duration.indexOf('H') === -1 && duration.indexOf('S') === -1) {
            a = [0, a[0], 0]
        }

        if (duration.indexOf('H') >= 0 && duration.indexOf('M') === -1) {
            a = [a[0], 0, a[1]]
        }
        if (duration.indexOf('H') >= 0 && duration.indexOf('M') === -1 && duration.indexOf('S') === -1) {
            a = [a[0], 0, 0]
        }

        duration = 0

        if (a.length === 3) {
            duration = duration + parseInt(a[0]) * 3600
            duration = duration + parseInt(a[1]) * 60
            duration = duration + parseInt(a[2])
        }

        if (a.length === 2) {
            duration = duration + parseInt(a[0]) * 60
            duration = duration + parseInt(a[1])
        }

        if (a.length === 1) {
            duration = duration + parseInt(a[0])
        }

        return duration
    }

    /**
     * @ignore
     * @param {string} url website url to parse html
     */
    static async _parseHTML (url) {
        const res = await fetch(url.replace('/m.', '/'))
        return await res.text()
    }
}

module.exports = Facebook
