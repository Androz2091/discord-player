// @ts-ignore
import { Store, Client } from 'soundcloud-scraper';
import { YouTube } from 'youtube-sr';

export class Env {

    /**
     * Utility env
     */
    constructor() {
        throw new Error(`Cannot instantiate the class ${this.constructor.name}`);
    }

    /**
     * The soundcloud client
     * @example const sc = new (require("discord-player")).Env.SoundcloudClient.Client();
     * sc.search("faded").then(console.log);
     * @type {Object}
     */
    static get SoundcloudClient() {
        return { Client };
    }

    /**
     * The soundcloud store utils
     * @example const store = require("discord-player").Env.SoundcloudStore.setAPIkey("soundcloud_api_key")
     * @type {Object}
     */
    static get SoundcloudStore() {
        const store = Store as Map<string, string>;
        const setAPIkey = (newKey: string) => store.set('SOUNDCLOUD_API_KEY', newKey);
        return { setAPIkey, store };
    }

    /**
     * The youtube search
     * @type {YouTube}
     */
    static get youtube() {
        return YouTube;
    }
}
