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

export { version } from './version';
