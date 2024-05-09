import { BaseExtractor, Track } from 'discord-player';
import { YouTube } from 'youtube-sr';
import { SoundCloudExtractor } from '../SoundCloudExtractor';
import unfetch from 'isomorphic-unfetch';
import http from 'http';
import https from 'https';
import type * as SoundCloud from 'soundcloud.ts';

let factory: {
    name: string;
    stream: StreamFN;
    lib: string;
};

export const createImport = (lib: string) => import(lib).catch(() => null);
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.49';
export const fetch = unfetch;

export const YouTubeLibs = [
    'youtube-ext',
    'ytdl-core',
    '@distube/ytdl-core',
    'play-dl',
    'yt-stream'
    // add more to the list if you have any
];

const ERR_NO_YT_LIB = new Error(`Could not load youtube library. Install one of ${YouTubeLibs.map((lib) => `"${lib}"`).join(', ')}`);

// forced lib
const forcedLib = process.env.DP_FORCE_YTDL_MOD;
if (forcedLib) YouTubeLibs.unshift(...forcedLib.split(','));

export type StreamFN = (
    q: string,
    ext: BaseExtractor,
    demuxable?: boolean
) => Promise<
    | import('stream').Readable
    | string
    | {
          stream: import('stream').Readable;
          $fmt: string;
      }
>;

let httpAgent: http.Agent, httpsAgent: https.Agent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadYtdl(options?: any, force = false) {
    if (factory && !force) return factory;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lib: any, _ytLibName: string, _stream: StreamFN;

    for (const ytlib of YouTubeLibs) {
        lib = await import(ytlib).then(
            (m) => m,
            () => null
        );
        if (!lib) continue;
        lib = lib.default || lib;
        _ytLibName = ytlib;
        break;
    }

    if (lib) {
        const isYtdl = ['ytdl-core'].some((lib) => lib === _ytLibName);

        const hlsRegex = /\/manifest\/hls_(variant|playlist)\//;
        _stream = async (query, extractor, demuxable = false) => {
            const planner = extractor.context.player.routePlanner;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const applyPlannerConfig = (opt: any, applyAgents = false) => {
                if (planner) {
                    try {
                        const { ip, family } = planner.getIP();

                        if (!applyAgents) {
                            opt.requestOptions.localAddress = ip;
                            opt.requestOptions.family = family;
                        } else {
                            const options = opt?.requestOptions || {};

                            options.localAddress = ip;
                            options.family = family;

                            if (!httpAgent) httpAgent = new http.Agent(options);
                            if (!httpsAgent) httpsAgent = new https.Agent(options);

                            return Object.assign(opt, {
                                requestOptions: options,
                                httpAgent,
                                httpsAgent
                            });
                        }
                    } catch {
                        //
                    }
                }

                return opt;
            };

            if (_ytLibName === 'youtube-ext') {
                const dl = lib as typeof import('youtube-ext');
                const opt = applyPlannerConfig(
                    {
                        ...options,
                        requestOptions: options?.requestOptions || {}
                    },
                    true
                );

                const info = await dl.videoInfo(query, opt);
                const videoFormats = await dl.getFormats(info.stream, opt);

                if (demuxable) {
                    const demuxableFormat =
                        info.duration.lengthSec != '0'
                            ? videoFormats.find((fmt) => {
                                  return /audio\/webm; codecs="opus"/.test(fmt.mimeType || '') && fmt.audioSampleRate == '48000';
                              })
                            : null;

                    if (demuxableFormat) {
                        return {
                            stream: await dl.getReadableStream(demuxableFormat, opt),
                            $fmt: 'webm/opus'
                        };
                    }
                }

                const formats = videoFormats
                    .filter((format) => {
                        if (!format.url) return false;
                        if (info.isLive) return dl.utils.isHlsContentURL(format.url) && format.url.endsWith('.m3u8');
                        return typeof format.bitrate === 'number';
                    })
                    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate));

                const fmt = formats.find((format) => !format.qualityLabel) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                const url = fmt?.url;
                if (!url) throw new Error(`Failed to parse stream url for ${query}`);
                return url;
            } else if (isYtdl) {
                const dl = lib as typeof import('ytdl-core');
                const info = await dl.getInfo(query, applyPlannerConfig(options));

                if (demuxable) {
                    const filter = (format: import('ytdl-core').videoFormat) => {
                        return format.codecs === 'opus' && format.container === 'webm' && format.audioSampleRate == '48000';
                    };

                    const format = info.formats.find(filter);

                    if (format && info.videoDetails.lengthSeconds != '0') {
                        return {
                            stream: dl.downloadFromInfo(info, {
                                ...applyPlannerConfig(options),
                                filter
                            }),
                            $fmt: 'webm/opus'
                        };
                    }
                }

                const formats = info.formats
                    .filter((format) => {
                        return info.videoDetails.isLiveContent ? format.isHLS && format.hasAudio : format.hasAudio;
                    })
                    .sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate));

                const fmt = formats.find((format) => !format.hasVideo) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                const url = fmt?.url;
                if (!url) throw new Error(`Failed to parse stream url for ${query}`);
                return url;
                // return dl(query, this.context.player.options.ytdlOptions);
            } else if (_ytLibName === '@distube/ytdl-core') {
                const dl = lib as typeof import('@distube/ytdl-core');
                let opt: any; // eslint-disable-line @typescript-eslint/no-explicit-any

                if (planner) {
                    opt = {
                        localAddress: planner.getIP().ip,
                        autoSelectFamily: true
                    };
                }

                const cookie = options?.requestOptions?.headers?.cookie;

                const agent = dl.createAgent(Array.isArray(cookie) ? cookie : undefined, opt);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const reqOpt: any = {
                    agent
                };

                if (cookie && !Array.isArray(cookie)) {
                    reqOpt.requestOptions = {
                        headers: {
                            cookie
                        }
                    };
                }

                const info = await dl.getInfo(query, reqOpt);

                if (demuxable) {
                    const filter = (format: import('@distube/ytdl-core').videoFormat) => {
                        return format.codecs === 'opus' && format.container === 'webm' && format.audioSampleRate == '48000';
                    };

                    const format = info.formats.find(filter);

                    if (format && info.videoDetails.lengthSeconds != '0') {
                        return {
                            stream: dl.downloadFromInfo(info, {
                                ...applyPlannerConfig(options),
                                filter
                            }),
                            $fmt: 'webm/opus'
                        };
                    }
                }

                const formats = info.formats
                    .filter((format) => {
                        return info.videoDetails.isLiveContent ? format.isHLS && format.hasAudio : format.hasAudio;
                    })
                    .sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate));

                const fmt = formats.find((format) => !format.hasVideo) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                const url = fmt?.url;
                if (!url) throw new Error(`Failed to parse stream url for ${query}`);
                return url;
            } else if (_ytLibName === 'play-dl') {
                const dl = lib as typeof import('play-dl');

                if (typeof options?.requestOptions?.headers?.cookie === 'string') {
                    dl.setToken({
                        youtube: {
                            cookie: options.requestOptions.headers.cookie
                        }
                    });
                }
                const info = await dl.video_info(query);

                if (demuxable) {
                    try {
                        const stream = await dl.stream(query, {
                            discordPlayerCompatibility: false
                        });

                        return {
                            stream: stream.stream,
                            $fmt: stream.type as string
                        };
                    } catch {
                        //
                    }
                }

                const formats = info.format
                    .filter((format) => {
                        if (!format.url) return false;
                        if (info.video_details.live) return (hlsRegex.test(format.url) && typeof format.bitrate === 'number') || (hlsRegex.test(format.url) && format.url.endsWith('.m3u8'));
                        return typeof format.bitrate === 'number';
                    })
                    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate));

                const fmt = formats.find((format) => !format.qualityLabel) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                const url = fmt?.url;
                if (!url) throw new Error(`Failed to parse stream url for ${query}`);
                return url;
            } else if (_ytLibName === 'yt-stream') {
                const dl = lib as typeof import('yt-stream');

                const cookie = options?.requestOptions?.headers?.cookie;

                if(cookie && typeof cookie === "string") dl.cookie = cookie

                // @ts-ignore Default lib did not provide types for this function
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const decipher: any = await import('yt-stream/src/stream/decipher.js');

                const info = await dl.getInfo(query);

                info.formats = await decipher?.format_decipher(info.formats, info.html5player);

                // @ts-ignore The lib did not provide ts support
                const url = info.formats.filter((val) => val.mimeType.startsWith('audio') && val.audioQuality !== 'AUDIO_QUALITY_LOW').map((val) => val.url) as Array<string>;

                if (url.length !== 0) return url[0];

                // @ts-ignore The lib did not provide ts support
                return info.formats.filter((val) => val.mimeType.startsWith('audio')).map((val) => val.url)[0] as string;
            } else {
                throw ERR_NO_YT_LIB;
            }
        };
    } else {
        throw ERR_NO_YT_LIB;
    }

    factory = { name: _ytLibName!, stream: _stream, lib };
    return factory;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function makeYTSearch(query: string, opt: any) {
    const res = await YouTube.search(query, {
        type: 'video',
        safeSearch: opt?.safeSearch,
        requestOptions: opt
    }).catch(() => {
        //
    });

    return res || [];
}

export async function makeSCSearch(query: string) {
    const { instance } = SoundCloudExtractor;
    if (!instance?.internal) return [];

    let data: SoundCloud.SoundcloudTrackV2[];

    try {
        const info = await instance.internal.tracks.searchV2({
            q: query,
            limit: 5
        });

        data = info.collection;
    } catch {
        // fallback
        const info = await instance.internal.tracks.searchAlt(query);

        data = info;
    }

    return filterSoundCloudPreviews(data);
}

export async function pullYTMetadata(ext: BaseExtractor, info: Track) {
    const meta = await makeYTSearch(ext.createBridgeQuery(info), 'video')
        .then((r) => r[0])
        .catch(() => null);

    return meta;
}

export async function pullSCMetadata(ext: BaseExtractor, info: Track) {
    const meta = await makeSCSearch(ext.createBridgeQuery(info))
        .then((r) => r[0])
        .catch(() => null);

    return meta;
}

export function filterSoundCloudPreviews(tracks: SoundCloud.SoundcloudTrackV2[]): SoundCloud.SoundcloudTrackV2[] {
    const filtered = tracks.filter((t) => {
        if (typeof t.policy === 'string') return t.policy.toUpperCase() === 'ALLOW';
        return !(t.duration === 30_000 && t.full_duration > 30_000);
    });

    const result = filtered.length > 0 ? filtered : tracks;

    return result;
}
