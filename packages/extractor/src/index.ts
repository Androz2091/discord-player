import { Attachment } from './internal/Attachment';
import { Facebook } from './internal/Facebook';
import { Vimeo } from './internal/Vimeo';

export const internal = { Attachment, Facebook, Vimeo };
export * as Attachment from './Attachment';
export * as Facebook from './Facebook';
export * as Reverbnation from './Reverbnation';
export * as Vimeo from './Vimeo';
export * as Lyrics from './ext/Lyrics';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
