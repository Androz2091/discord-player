import {
    AppleMusicExtractor,
    AttachmentExtractor,
    ReverbnationExtractor,
    SoundCloudExtractor,
    SpotifyExtractor,
    VimeoExtractor,
} from './extractors';

export const DefaultExtractors = [
    SoundCloudExtractor,
    AttachmentExtractor,
    VimeoExtractor,
    ReverbnationExtractor,
    AppleMusicExtractor,
    SpotifyExtractor,
];

export * from './extractors';
export * as Internal from './internal';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
