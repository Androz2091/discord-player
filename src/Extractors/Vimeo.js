const fetch = require('node-fetch').default
const { Readable } = require('stream')

class Vimeo {
    constructor () {
        throw new Error(`The ${this.constructor.name} class may not be instantiated!`)
    }

    /**
     * @typedef {Readable} Readable
     */

    /**
     * Downloads from vimeo
     * @param {number} id Vimeo video id
     * @returns {Promise<Readable>}
     */
    static download (id) {
        return new Promise(async (resolve) => {
            const info = await Vimeo.getInfo(id)
            if (!info) return null

            const downloader = info.stream.url.startsWith('https://') ? require('https') : require('http')

            downloader.get(info.stream.url, res => {
                resolve(res)
            })
        })
    }

    /**
     * Returns video info
     * @param {number} id Video id
     */
    static async getInfo (id) {
        if (!id) throw new Error('Invalid id')
        const url = `https://player.vimeo.com/video/${id}`

        try {
            const res = await fetch(url)
            const data = await res.text()
            const json = JSON.parse(data.split('<script> (function(document, player) { var config = ')[1].split(';')[0])

            const obj = {
                id: json.video.id,
                duration: json.video.duration,
                title: json.video.title,
                url: json.video.url,
                thumbnail: json.video.thumbs['1280'] || json.video.thumbs.base,
                width: json.video.width,
                height: json.video.height,
                stream: json.request.files.progressive[0],
                author: {
                    accountType: json.video.owner.account_type,
                    id: json.video.owner.id,
                    name: json.video.owner.name,
                    url: json.video.owner.url,
                    avatar: json.video.owner.img_2x || json.video.owner.img
                }
            }

            return obj
        } catch {
            return null
        }
    }
}

module.exports = Vimeo
