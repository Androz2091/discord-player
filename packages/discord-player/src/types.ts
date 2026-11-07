import type { RemediaNodeConfig } from '@remedia/client';
import type {
  GuildQueue,
  GuildQueueOptions,
  GuildQueuePlayOptions,
  GuildQueuePlayResult,
} from './structures/guild-queue.js';
import type { Playlist } from './structures/playlist.js';
import type { SearchResult } from './structures/search-result.js';
import type { RequestOptions } from 'node:http';
import type { TrackRequester } from './structures/track.js';
import type { Track } from './structures/track.js';

/** A configured Remedia node snapshot/config type used by Player. */
export type DiscordPlayerNode = RemediaNodeConfig;

/** Structural voice-channel shape supported without a discord.js dependency. */
export interface PlayerChannelLike {
  /** Channel snowflake or stable channel ID. */
  id: string;

  /** Optional structural guild reference. */
  guild?: { id: string } | null;

  /** Optional direct guild ID for non-discord.js adapters. */
  guildId?: string;
}

/** Explicit identifiers accepted when no channel object is available. */
export interface PlayerChannelIds {
  /** Guild ID used to locate or create a queue. */
  guildId: string;

  /** Voice channel ID used for the Remedia session. */
  channelId: string;
}

/** Supported channel argument for `Player.play()`. */
export type PlayerChannelResolvable = string | PlayerChannelLike | PlayerChannelIds;

/** Media accepted by the public player orchestration API. Strings are dispatched to source plugins. */
export type MediaResource = string | Track | Track[] | Playlist | SearchResult;

/** Source search and compatibility options. */
export interface SearchOptions {
  /** Optional explicit plugin ID. */
  pluginId?: string;

  /** Legacy type hint or ext:identifier targeting. */
  searchEngine?: string;

  /** Structural requester. */
  requestedBy?: TrackRequester | null;

  /** Legacy local request options. */
  requestOptions?: RequestOptions;

  /** Caller cancellation. */
  signal?: AbortSignal;

  /** Additional disabled provider IDs. */
  blockExtractors?: readonly string[];

  /** Source query type hint. */
  source?: string;

  /** Maximum number of results requested from a source plugin. */
  limit?: number;
}

/** Options for Player-level search. */
export interface PlayerSearchOptions extends SearchOptions {
  /** Optional guild context for future source plugin policies. */
  guildId?: string;
}

/** Player-level playback orchestration options. */
export interface PlayerPlayOptions<Metadata = unknown> extends GuildQueuePlayOptions<Metadata> {
  /** Guild queue defaults used only when the queue is first created. */
  nodeOptions?: GuildQueueOptions<Metadata>;

  /** Alias for `nodeOptions`. */
  queueOptions?: GuildQueueOptions<Metadata>;

  /** Search options passed to `Player.search()`. */
  searchOptions?: PlayerSearchOptions;

  /** Explicit guild identifier when the channel argument is only a channel ID. */
  guildId?: string;
}

/** Compatibility name for the v7-style initializer options. */
export type PlayerNodeInitializationOptions<Metadata = unknown> = PlayerPlayOptions<Metadata>;

/** Result of Player-level orchestration. */
export interface PlayerNodeInitializationResult<Metadata = unknown> extends GuildQueuePlayResult<Metadata> {
  /** The guild queue that received this playback request. */
  queue: GuildQueue<Metadata>;

  /** Original resource passed to `Player.play()`. */
  resource: MediaResource;

  /** Resolved tracks and optional playlist metadata. */
  searchResult: SearchResult;
}
