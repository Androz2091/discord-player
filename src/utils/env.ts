// @ts-ignore
import { Store, Client } from 'soundcloud-scraper';
import { YouTube } from 'youtube-sr';

export class Env {
    static get SoundcloudClient() {
        return Client;
    }

    static get SoundcloudStore() {
        const store = Store as Map<string, string>;
        const setAPIkey = (newKey: string) => store.set('SOUNDCLOUD_API_KEY', newKey);
        return { setAPIkey };
    }

    static get youtube() {
        return YouTube;
    }
}
