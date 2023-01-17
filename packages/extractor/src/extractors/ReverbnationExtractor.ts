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
import reverbnation from 'reverbnation-scraper';
import { downloadStream } from '../internal/downloader';

export class ReverbnationExtractor extends BaseExtractor {
    public static identifier = 'com.discord-player.reverbnationextractor' as const;

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        return ([QueryType.REVERBNATION] as SearchQueryType[]).some((r) => r === type);
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch (context.type) {
            case QueryType.REVERBNATION: {
                const trackInfo = await reverbnation.getInfo(query).catch(Util.noop);

                if (!trackInfo) return this.emptyResponse();

                const track = new Track(this.context.player, {
                    title: trackInfo.title,
                    url: trackInfo.url,
                    duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                    description: trackInfo.lyrics || `${trackInfo.title} by ${trackInfo.artist.name}`,
                    thumbnail: trackInfo.thumbnail,
                    views: 0,
                    author: trackInfo.artist.name,
                    requestedBy: context.requestedBy,
                    source: 'arbitrary',
                    engine: trackInfo.streamURL,
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

        const track = await reverbnation.getInfo(info.url).catch(Util.noop);
        if (!track || !track.streamURL) throw new Error('Could not extract stream from this source');

        info.raw.engine = {
            streamURL: track.streamURL
        };

        return downloadStream(track.streamURL);
    }
}
