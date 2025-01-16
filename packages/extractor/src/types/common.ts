import type { Track } from 'discord-player';
import type { Readable } from 'node:stream';

export type StreamFN = (
  url: string,
  track: Track,
) => Promise<Readable | string>;
