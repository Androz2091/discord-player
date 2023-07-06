import { BaseExtractor, Track } from 'discord-player';
import { YouTube } from 'youtube-sr';
import { SoundCloudExtractor } from '../SoundCloudExtractor';

let factory: {
    name: string;
    stream: StreamFN;
    lib: string;
};

export const createImport = (lib: string) => import(lib).catch(() => null);
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.49';

export const YouTubeLibs = [
    'ytdl-core',
    '@distube/ytdl-core',
    'play-dl',
    'yt-stream'
    // add more to the list if you have any
];

const ERR_NO_YT_LIB = new Error(`Could not load youtube library. Install one of ${YouTubeLibs.map((lib) => `"${lib}"`).join(', ')}`);

// forced lib
const forcedLib = process.env.DP_FORCE_YTDL_MOD;
if (forcedLib) YouTubeLibs.unshift(forcedLib);

export const getFetch =
    typeof fetch !== 'undefined'
        ? fetch
        : async (info: RequestInfo, init?: RequestInit): Promise<Response> => {
              // eslint-disable-next-line
              let dy: any;

              /* eslint-disable no-cond-assign */
              if ((dy = await createImport('undici'))) {
                  return (dy.fetch || dy.default.fetch)(info, init);
              } else if ((dy = await createImport('node-fetch'))) {
                  return (dy.fetch || dy.default)(info, init);
              } else {
                  throw new Error('No fetch lib found');
              }

              /* eslint-enable no-cond-assign */
          };

export type StreamFN = (q: string) => Promise<import('stream').Readable | string>;

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
        const isYtdl = ['ytdl-core', '@distube/ytdl-core'].some((lib) => lib === _ytLibName);

        _stream = async (query) => {
            if (isYtdl) {
                const dl = lib as typeof import('ytdl-core');
                const info = await dl.getInfo(query, options);

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
            } else if (_ytLibName === 'play-dl') {
                const dl = lib as typeof import('play-dl');

                const info = await dl.video_info(query);
                const formats = info.format
                    .filter((format) => {
                        const re = /\/manifest\/hls_(variant|playlist)\//;
                        if (!format.url) return false;
                        if (info.video_details.live) return re.test(format.url) && typeof format.bitrate === 'number';
                        return typeof format.bitrate === 'number';
                    })
                    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate));

                const fmt = formats.find((format) => !format.qualityLabel) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                const url = fmt?.url;
                if (!url) throw new Error(`Failed to parse stream url for ${query}`);
                return url;
                // return (await dl.stream(query, { discordPlayerCompatibility: true })).stream;
            } else if (_ytLibName === 'yt-stream') {
                const dl = lib as typeof import('yt-stream');

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
        requestOptions: opt
    }).catch(() => {
        //
    });

    return res || [];
}

export async function makeSCSearch(query: string) {
    const { soundcloud } = SoundCloudExtractor;
    if (!soundcloud) return [];

    try {
        const info = await soundcloud.tracks.searchV2({
            q: query
        });

        return info.collection;
    } catch {
        // fallback
        const info = await soundcloud.tracks.searchAlt(query);

        return info;
    }
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
