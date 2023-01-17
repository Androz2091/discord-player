// @ts-nocheck
// prettier-ignore
import {
    BaseExtractor,
    ExtractorInfo,
    ExtractorSearchContext,
    QueryType,
    SearchQueryType,
    Track,
    Util
} from 'discord-player';
import { downloadStream } from '../internal/downloader';
import { Vimeo } from '../internal/Vimeo';

export class VimeoExtractor extends BaseExtractor {
    public static identifier = 'com.discord-player.vimeoextractor' as const;

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        return ([QueryType.VIMEO] as SearchQueryType[]).some((r) => r === type);
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch (context.type) {
            case QueryType.VIMEO: {
                const trackInfo = await Vimeo.getInfo(
                    query
                        .split('/')
                        .filter((x) => !!x)
                        .pop()!
                ).catch(Util.noop);

                if (!trackInfo) return this.emptyResponse();

                const track = new Track(this.context.player, {
                    title: trackInfo.title,
                    url: trackInfo.url,
                    duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration || 0)),
                    description: `${trackInfo.title} by ${trackInfo.author.name}`,
                    thumbnail: trackInfo.thumbnail,
                    views: 0,
                    author: trackInfo.author.name,
                    requestedBy: context.requestedBy,
                    source: 'arbitrary',
                    engine: trackInfo.stream,
                    queryType: context.type
                });

                return { playlist: null, tracks: [track] };
            }
            default:
                return this.emptyResponse();
        }
    }

    public emptyResponse(): ExtractorInfo {
        return { playlist: null, tracks: [] };
    }

    public async stream(info: Track) {
        const engine = info.raw.engine as string;
        if (engine) {
            return await downloadStream(engine);
        }

        const track = await Vimeo.getInfo(info.url).catch(Util.noop);
        if (!track || !track.stream) throw new Error('Could not extract stream from this source');

        info.raw.engine = {
            streamURL: track.stream
        };

        return await downloadStream(track.stream);
    }
}
