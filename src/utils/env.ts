// @ts-ignore
import { Store, Client } from 'soundcloud-scraper';
import { YouTube } from 'youtube-sr';

/**
 * Utility env
 */
export class Env {

    /**
     * The soundcloud client
     */
    static get SoundcloudClient() {
        return Client;
    }

    /**
     * The soundcloud store utils
     */
    static get SoundcloudStore() {
        const store = Store as Map<string, string>;
        const setAPIkey = (newKey: string) => store.set('SOUNDCLOUD_API_KEY', newKey);
        return { setAPIkey };
    }

    /**
     * The youtube search
     */
    static get youtube() {
        return YouTube;
    }
}
