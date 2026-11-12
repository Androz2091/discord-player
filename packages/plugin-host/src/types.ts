import type { Playlist } from './structures/playlist.js';
import type { SearchResult } from './structures/search-result.js';
import type { Track, TrackRequester } from './structures/track.js';
import type { RequestOptions } from 'node:http';

/** Media accepted by the public player orchestration API. Strings are dispatched to source plugins. */
export type MediaResource = string | Track | Track[] | Playlist | SearchResult;

/** Source search and compatibility options. */
export interface SearchOptions {
  /** Explicit standalone deployment ID; interpreted by DiscordPlayer, never a local provider ID. */
  hostId?: string;

  /** Legacy type hint or ext:identifier targeting. */
  searchEngine?: string;

  /** Resolve registered custom prefixes before dispatch; defaults to true. */
  resolveCustomProtocols?: boolean;

  /** Structural requester. */
  requestedBy?: TrackRequester | null;

  /** Legacy local request options. */
  requestOptions?: RequestOptions;

  /** Caller cancellation. */
  signal?: AbortSignal;

  /** Additional disabled provider IDs. */
  blockExtractors?: readonly string[];

  /** Maximum number of results requested from a source plugin. */
  limit?: number;
}
