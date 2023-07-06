import { BaseExtractor, Track } from 'discord-player';
import { SoundcloudTrackV2 } from 'soundcloud.ts';
import { Video } from 'youtube-sr';
import { SoundCloudExtractor } from '../SoundCloudExtractor';
import { loadYtdl, pullSCMetadata, pullYTMetadata } from './helper';

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
        if (meta.source === 'soundcloud') {
            if (!SoundCloudExtractor.soundcloud) {
                throw new Error('Could not find soundcloud client, make sure SoundCloudExtractor is instantiated properly.');
            }

            return await SoundCloudExtractor.soundcloud.util.streamLink(meta.data as SoundcloudTrackV2, 'progressive');
        } else {
            const ytdl = await loadYtdl();
            return ytdl.stream((meta.data as Video).url);
        }
    }
}

interface BridgedMetadata {
    source: IBridgeSource;
    data: SoundcloudTrackV2 | Video | null;
}
