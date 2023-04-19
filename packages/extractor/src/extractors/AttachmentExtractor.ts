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
import type { IncomingMessage } from 'http';
import { createReadStream, existsSync } from 'fs';
import { downloadStream } from '../internal/downloader';
import * as fileType from 'file-type';
import path from 'path';
import { stat } from 'fs/promises';

export class AttachmentExtractor extends BaseExtractor {
    public static identifier = 'com.discord-player.attachmentextractor' as const;

    public async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        return ([QueryType.ARBITRARY, QueryType.FILE] as SearchQueryType[]).some((r) => r === type);
    }

    public async getRelatedTracks(track: Track) {
        void track;
        return this.createResponse();
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch (context.type) {
            case QueryType.ARBITRARY: {
                const data = (await downloadStream(query, context.requestOptions)) as IncomingMessage;
                if (!['audio/', 'video/'].some((r) => !!data.headers['content-type']?.startsWith(r))) return this.emptyResponse();
                const trackInfo = {
                    title: (
                        query
                            .split('/')
                            .filter((x) => x.length)
                            .pop() ?? 'Attachment'
                    )
                        .split('?')[0]
                        .trim(),
                    duration: 0,
                    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png',
                    engine: query,
                    // eslint-disable-next-line
                    author: ((data as any).client?.servername as string) || 'Attachment',
                    // eslint-disable-next-line
                    description: ((data as any).client?.servername as string) || 'Attachment',
                    url: data.url || query
                };

                const track = new Track(this.context.player, {
                    title: trackInfo.title,
                    url: trackInfo.url,
                    duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                    description: trackInfo.description,
                    thumbnail: trackInfo.thumbnail,
                    views: 0,
                    author: trackInfo.author,
                    requestedBy: context.requestedBy,
                    source: 'arbitrary',
                    engine: trackInfo.url,
                    queryType: context.type
                });

                track.extractor = this;

                // @ts-expect-error
                track.raw.isFile = false;

                return { playlist: null, tracks: [track] };
            }
            case QueryType.FILE: {
                if (!existsSync(query)) return this.emptyResponse();
                const fstat = await stat(query);
                if (!fstat.isFile()) return this.emptyResponse();
                const mime = await fileType.fromFile(query).catch(() => null);
                if (!mime || !['audio/', 'video/'].some((r) => !!mime.mime.startsWith(r))) return this.emptyResponse();
                const trackInfo = {
                    title: path.basename(query) || 'Attachment',
                    duration: 0,
                    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png',
                    engine: query,
                    author: 'Attachment',
                    description: 'Attachment',
                    url: query
                };

                const track = new Track(this.context.player, {
                    title: trackInfo.title,
                    url: trackInfo.url,
                    duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
                    description: trackInfo.description,
                    thumbnail: trackInfo.thumbnail,
                    views: 0,
                    author: trackInfo.author,
                    requestedBy: context.requestedBy,
                    source: 'arbitrary',
                    engine: trackInfo.url,
                    queryType: context.type
                });

                track.extractor = this;

                // @ts-expect-error
                track.raw.isFile = true;

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
        // @ts-expect-error
        const isFile = info.raw.isFile as boolean;

        if (!engine) throw new Error('Could not find stream source');

        if (!isFile) {
            return engine;
            // return await downloadStream(engine);
        }

        return createReadStream(engine);
    }
}
