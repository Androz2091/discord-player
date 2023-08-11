import { BaseExtractor, Track } from 'discord-player';
import { SoundcloudTrackV2 } from 'soundcloud.ts';
import { Video } from 'youtube-sr';
import { SoundCloudExtractor } from '../SoundCloudExtractor';
import { YouTubeExtractor } from '../YoutubeExtractor';
import { pullSCMetadata, pullYTMetadata } from './helper';

export enum BridgeSource {
    SoundCloud = 'soundcloud',
    YouTube = 'youtube'
}

export type IBridgeSource = 'soundcloud' | 'youtube';

export class BridgeProvider {
    public bridgeSource: BridgeSource = BridgeSource.SoundCloud;

    public constructor(source: IBridgeSource) {
        this.setBridgeSource(source);
    }

    public setBridgeSource(source: BridgeSource | IBridgeSource) {
        switch (source) {
            case 'soundcloud':
            case BridgeSource.SoundCloud:
                this.bridgeSource = BridgeSource.SoundCloud;
                break;
            case 'youtube':
            case BridgeSource.YouTube:
                this.bridgeSource = BridgeSource.YouTube;
                break;
            default:
                throw new TypeError('invalid bridge source');
        }
    }

    public isSoundCloud() {
        return this.bridgeSource === BridgeSource.SoundCloud;
    }

    public isYouTube() {
        return this.bridgeSource === BridgeSource.YouTube;
    }

    public async resolve(ext: BaseExtractor, track: Track) {
        const isSoundcloud = this.isSoundCloud();
        const bridgefn = isSoundcloud ? pullSCMetadata : pullYTMetadata;

        // patch query
        const oldQc = ext.createBridgeQuery;
        if (isSoundcloud) ext.createBridgeQuery = (track) => `${track.author} ${track.title}`;
        const res = await bridgefn(ext, track);
        ext.createBridgeQuery = oldQc;

        return { source: isSoundcloud ? 'soundcloud' : 'youtube', data: res } as BridgedMetadata;
    }

    public async stream(meta: BridgedMetadata) {
        if (!meta.data) throw new Error('Could not find bridge metadata info.');

        if (meta.source === 'soundcloud') {
            if (!SoundCloudExtractor.instance) {
                throw new Error('Could not find soundcloud extractor, make sure SoundCloudExtractor is instantiated properly.');
            }

            if (isExtDisabled(SoundCloudExtractor.instance)) {
                throw new Error('Cannot stream, SoundCloudExtractor is disabled.');
            }

            return await SoundCloudExtractor.instance.internal.util.streamLink(meta.data as SoundcloudTrackV2, 'progressive');
        } else if (meta.source === 'youtube') {
            if (!YouTubeExtractor.instance) {
                throw new Error('Could not find youtube extractor, make sure YouTubeExtractor is instantiated properly.');
            }

            if (isExtDisabled(YouTubeExtractor.instance)) {
                throw new Error('Cannot stream, YouTubeExtractor is disabled.');
            }

            return YouTubeExtractor.instance._stream((meta.data as Video).url);
        } else {
            throw new TypeError('invalid bridge source');
        }
    }
}

function isExtDisabled(ext: BaseExtractor) {
    const streamBlocked = !!ext.context.player.options.blockStreamFrom?.some((x) => x === ext.identifier);
    // const extBlocked = !!ext.context.player.options.blockExtractors?.some((x) => x === ext.identifier);

    return streamBlocked;
}

interface BridgedMetadata {
    source: IBridgeSource;
    data: SoundcloudTrackV2 | Video | null;
}

export const defaultBridgeProvider = new BridgeProvider(BridgeSource.YouTube);
export const createBridgeProvider = (source: BridgeSource) => new BridgeProvider(source);
