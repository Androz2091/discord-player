// @ts-ignore
import { Store, Client } from 'soundcloud-scraper';
import { YouTube } from 'youtube-sr';

export class Env {

    /**
     * Utility env
     * <warn>This feature is Experimental</warn>
     */
    constructor() {
        throw new Error(`Cannot instantiate the class ${this.constructor.name}`);
    }

    /**
     * The soundcloud client
     * soundcloud.search("faded").then(console.log);
     * @type {Object}
     */
    static get SoundcloudClient() {
        return { Client };
    }

    /**
     * The soundcloud store utils
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
