import { PlayerOptions, QueryType } from '../types/types';
import { FFmpeg } from 'prism-media';
import YouTube from 'youtube-sr';
import { Track } from '../Structures/Track';
// @ts-ignore
import { validateURL as SoundcloudValidateURL } from 'soundcloud-scraper';

const spotifySongRegex = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/;
const spotifyPlaylistRegex = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:playlist\/|\?uri=spotify:playlist:)((\w|-){22})/;
const spotifyAlbumRegex = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:album\/|\?uri=spotify:album:)((\w|-){22})/;
const vimeoRegex = /(http|https)?:\/\/(www\.|player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|video\/|)(\d+)(?:|\/\?)/;
const facebookRegex = /(https?:\/\/)(www\.|m\.)?(facebook|fb).com\/.*\/videos\/.*/;
const reverbnationRegex = /https:\/\/(www.)?reverbnation.com\/(.+)\/song\/(.+)/;

export class Util {
    constructor() {
        throw new Error(`The ${this.constructor.name} class is static and cannot be instantiated!`);
    }

    static get DefaultPlayerOptions() {
        return {
            leaveOnEnd: true,
            leaveOnStop: true,
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 0,
            autoSelfDeaf: true,
            enableLive: false,
            ytdlDownloadOptions: {}
        } as PlayerOptions;
    }

    static checkFFmpeg(force?: boolean) {
        try {
            FFmpeg.getInfo(Boolean(force));

            return true;
        } catch {
            return false;
        }
    }

    static alertFFmpeg() {
        const hasFFmpeg = Util.checkFFmpeg();

        if (!hasFFmpeg)
            console.warn(
                '[Discord Player] FFmpeg/Avconv not found! Install via "npm install ffmpeg-static" or download from https://ffmpeg.org/download.html'
            );
    }

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

    static isURL(str: string) {
        const urlRegex =
            '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
        const url = new RegExp(urlRegex, 'i');
        return str.length < 2083 && url.test(str);
    }

    static getVimeoID(query: string) {
        return Util.getQueryType(query) === 'vimeo'
            ? query
                  .split('/')
                  .filter((x) => !!x)
                  .pop()
            : null;
    }

    static parseMS(milliseconds: number) {
        // taken from ms package :: https://github.com/sindresorhus/parse-ms/blob/main/index.js
        const roundTowardsZero = milliseconds > 0 ? Math.floor : Math.ceil;

        return {
            days: roundTowardsZero(milliseconds / 86400000),
            hours: roundTowardsZero(milliseconds / 3600000) % 24,
            minutes: roundTowardsZero(milliseconds / 60000) % 60,
            seconds: roundTowardsZero(milliseconds / 1000) % 60
        };
    }

    static durationString(durObj: object) {
        return Object.values(durObj)
            .map((m) => (isNaN(m) ? 0 : m))
            .join(':');
    }

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
                                    duration: r.durationFormatted,
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
}

export default Util;
