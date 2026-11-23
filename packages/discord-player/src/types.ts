import type { RemediaNodeConfig } from '@remedia/client';
import type {
  GuildQueue,
  GuildQueueOptions,
  GuildQueueConnectionOptions,
  GuildQueuePlayResult,
} from './structures/guild-queue.js';
import type { SearchResult } from './structures/search-result.js';

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

export type { MediaResource, SearchOptions } from '@discord-player/plugin-host';
import type { MediaResource, SearchOptions } from '@discord-player/plugin-host';

/** Player-level playback orchestration options. */
export interface PlayerPlayOptions<Metadata = unknown, PlaybackMetadata = unknown> extends SearchOptions {
  /** Guild queue defaults used only when the queue is first created. */
  nodeOptions?: GuildQueueOptions<Metadata>;

  /** Connection/session overrides for this call, including volume and filterGraph on existing sessions. */
  connectionOptions?: GuildQueueConnectionOptions;

  /** Metadata for playback started by this call, independent of nodeOptions.metadata; not retained when only enqueuing. */
  customMetadata?: PlaybackMetadata;

  /** Cancel search, waiting, voice negotiation, preparation, or started playback; not retained when only enqueuing. */
  signal?: AbortSignal;

  /** Explicit guild identifier when the channel argument is only a channel ID. */
  guildId?: string;
}

/** Compatibility name for the v7-style initializer options. */
export type PlayerNodeInitializerOptions<Metadata = unknown, PlaybackMetadata = unknown> = PlayerPlayOptions<
  Metadata,
  PlaybackMetadata
>;

/** Result of Player-level orchestration. */
export interface PlayerNodeInitializationResult<
  Metadata = unknown,
  PlaybackMetadata = unknown,
> extends GuildQueuePlayResult<PlaybackMetadata> {
  /** The guild queue that received this playback request. */
  queue: GuildQueue<Metadata>;

  /** Original resource passed to `Player.play()`. */
  resource: MediaResource;

  /** Resolved tracks and optional playlist metadata. */
  searchResult: SearchResult;
}
