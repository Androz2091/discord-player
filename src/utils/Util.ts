import { QueryType, TimeData } from '../types/types';
import { FFmpeg } from 'prism-media';
import YouTube from 'youtube-sr';
import { Track } from '../Structures/Track';
// @ts-ignore
import { validateURL as SoundcloudValidateURL } from 'soundcloud-scraper';
import { VoiceChannel } from 'discord.js';

const spotifySongRegex = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/;
const spotifyPlaylistRegex =
    /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:playlist\/|\?uri=spotify:playlist:)((\w|-){22})/;
const spotifyAlbumRegex = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:album\/|\?uri=spotify:album:)((\w|-){22})/;
const vimeoRegex =
    /(http|https)?:\/\/(www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|video\/|)(\d+)(?:|\/\?)/;
const facebookRegex = /(https?:\/\/)(www\.|m\.)?(facebook|fb).com\/.*\/videos\/.*/;
const reverbnationRegex = /https:\/\/(www.)?reverbnation.com\/(.+)\/song\/(.+)/;
const attachmentRegex =
    /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/;

export class Util {
    /**
     * Static Player Util class
     */
    constructor() {
        throw new Error(`The ${this.constructor.name} class is static and cannot be instantiated!`);
    }

    /**
     * Checks FFmpeg Version
     * @param {Boolean} [force] If it should forcefully get the version
     * @returns {String}
     */
    static getFFmpegVersion(force?: boolean): string {
        try {
            const info = FFmpeg.getInfo(Boolean(force));

            return info.version;
        } catch {
            return null;
        }
    }

    /**
     * Checks FFmpeg
     * @param {Boolean} [force] If it should forcefully get the version
     * @returns {Boolean}
     */
    static checkFFmpeg(force?: boolean): boolean {
        const version = Util.getFFmpegVersion(force);
        return version === null ? false : true;
    }

    /**
     * Alerts if FFmpeg is not available
     */
    static alertFFmpeg(): void {
        const hasFFmpeg = Util.checkFFmpeg();

        if (!hasFFmpeg)
            console.warn(
                '[Discord Player] FFmpeg/Avconv not found! Install via "npm install ffmpeg-static" or download from https://ffmpeg.org/download.html'
            );
    }

    /**
     * Resolves query type
     * @param {String} query The query
     * @returns {QueryType}
     */
    static getQueryType(query: string): QueryType {
        if (SoundcloudValidateURL(query) && !query.includes('/sets/')) return 'soundcloud_track';
        if (SoundcloudValidateURL(query) && query.includes('/sets/')) return 'soundcloud_playlist';
        if (spotifySongRegex.test(query)) return 'spotify_song';
        if (spotifyAlbumRegex.test(query)) return 'spotify_album';
        if (spotifyPlaylistRegex.test(query)) return 'spotify_playlist';
        if (YouTube.validate(query, 'PLAYLIST')) return 'youtube_playlist';
        if (YouTube.validate(query, 'VIDEO')) return 'youtube_video';
        if (vimeoRegex.test(query)) return 'vimeo';
        if (facebookRegex.test(query)) return 'facebook';
        if (reverbnationRegex.test(query)) return 'reverbnation';
        if (Util.isURL(query)) return 'attachment';

        return 'youtube_search';
    }

    /**
     * Checks if the given string is url
     * @param {String} str URL to check
     * @returns {Boolean}
     */
    static isURL(str: string): boolean {
        return str.length < 2083 && attachmentRegex.test(str);
    }

    /**
     * Returns Vimeo ID
     * @param {String} query Vimeo link
     * @returns {String}
     */
    static getVimeoID(query: string): string {
        return Util.getQueryType(query) === 'vimeo'
            ? query
                  .split('/')
                  .filter((x) => !!x)
                  .pop()
            : null;
    }

    /**
     * Parses ms time
     * @param {Number} milliseconds Time to parse
     * @returns {TimeData}
     */
    static parseMS(milliseconds: number): TimeData {
        const roundTowardsZero = milliseconds > 0 ? Math.floor : Math.ceil;

        return {
            days: roundTowardsZero(milliseconds / 86400000),
            hours: roundTowardsZero(milliseconds / 3600000) % 24,
            minutes: roundTowardsZero(milliseconds / 60000) % 60,
            seconds: roundTowardsZero(milliseconds / 1000) % 60
        };
    }

    /**
     * Creates simple duration string
     * @param {object} durObj Duration object
     * @returns {String}
     */
    static durationString(durObj: object): string {
        return Object.values(durObj)
            .map((m) => (isNaN(m) ? 0 : m))
            .join(':');
    }

    /**
     * Makes youtube searches
     * @param {String} query The query
     * @param {any} options Options
     * @returns {Promise<Track[]>}
     */
    static ytSearch(query: string, options?: any): Promise<Track[]> {
        return new Promise(async (resolve) => {
            await YouTube.search(query, {
                type: 'video',
                safeSearch: Boolean(options?.player.options.useSafeSearch),
                limit: options.limit ?? 10
            })
                .then((results) => {
                    resolve(
                        results.map(
                            (r) =>
                                new Track(options?.player, {
                                    title: r.title,
                                    description: r.description,
                                    author: r.channel.name,
                                    url: r.url,
                                    thumbnail: r.thumbnail.displayThumbnailURL(),
                                    duration: Util.buildTimeCode(Util.parseMS(r.duration)),
                                    views: r.views,
                                    requestedBy: options?.user,
                                    fromPlaylist: Boolean(options?.pl),
                                    source: 'youtube'
                                })
                        )
                    );
                })
                .catch(() => resolve([]));
        });
    }

    /**
     * Checks if this system is running in replit.com
     * @returns {Boolean}
     */
    static isRepl(): boolean {
        if ('DP_REPL_NOCHECK' in process.env) return false;

        const REPL_IT_PROPS = [
            'REPL_SLUG',
            'REPL_OWNER',
            'REPL_IMAGE',
            'REPL_PUBKEYS',
            'REPL_ID',
            'REPL_LANGUAGE',
            'REPLIT_DB_URL'
        ];

        for (const prop of REPL_IT_PROPS) if (prop in process.env) return true;

        return false;
    }

    /**
     * Checks if the given voice channel is empty
     * @param {DiscordVoiceChannel} channel The voice channel
     * @returns {Boolean}
     */
    static isVoiceEmpty(channel: VoiceChannel): boolean {
        return channel.members.filter((member) => !member.user.bot).size === 0;
    }

    /**
     * Builds time code
     * @param {object} data The data to build time code from
     * @returns {String}
     */
    static buildTimeCode(data: any): string {
        const items = Object.keys(data);
        const required = ['days', 'hours', 'minutes', 'seconds'];

        const parsed = items.filter((x) => required.includes(x)).map((m) => (data[m] > 0 ? data[m] : ''));
        const final = parsed
            .filter((x) => !!x)
            .map((x) => x.toString().padStart(2, '0'))
            .join(':');
        return final.length <= 3 ? `0:${final.padStart(2, '0') || 0}` : final;
    }

    /**
     * Manage CJS require
     * @param {String} id id to require
     * @returns {any}
     */
    static require(id: string): any {
        try {
            return require(id);
        } catch {
            return null;
        }
    }
}

export default Util;
