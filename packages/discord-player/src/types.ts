import type { PlayOptions, RemediaNodeConfig } from '@remedia/client';
import type { GuildQueue, GuildQueueOptions } from './structures/guild-queue.js';
import type { Track } from './structures/track.js';
import type { PlayRawResult } from './structures/guild-queue-player-node.js';
import type { Playlist } from './structures/playlist.js';
import type { SearchResult } from './structures/search-result.js';

/**
 * The type representing a remedia node configuration used by the DiscordPlayer.
 */
export type DiscordPlayerNode = RemediaNodeConfig;

export interface PlayerNodeInitializationOptions<T = any> {
  /**
   * The guild queue options to use when initializing the node for this guild queue.
   * This is only used when the GuildQueue is created for the first time and will be ignored in other situations.
   */
  nodeOptions: GuildQueueOptions<T>;
  /**
   * The id of the guild for which the node is being initialized.
   */
  guildId: string;
  /**
   * The voice channel id to which the bot should connect for this guild queue.
   */
  channelId: string;
  /**
   * The id of the remedia node to be used for this session. If not specified, the default node selection strategy will be used to select a node.
   */
  nodeId?: string;
  /**
   * The audio player node options to be used when initializing the node for this guild queue. This is only used when the GuildQueue is created for the first time and will be ignored in other situations.
   */
  audioPlayerOptions?: PlayOptions;
  /**
   * The search options to use.
   */
  searchOptions?: SearchOptions;
}

export interface SearchOptions {}

/**
 * The type representing a media resource that can be played by the DiscordPlayer.
 */
export type MediaResource = string | Track | Playlist | SearchResult;

export interface PlayerNodeInitializationResult<T> {
  /**
   * The guild queue instance that was created or retrieved for the specified guild ID.
   */
  queue: GuildQueue<T>;
  /**
   * The source media resource that was played.
   */
  resource: MediaResource;
  /**
   * The result of the play operation, containing the audio stream information and the DiscordSession instance used to play the resource.
   */
  playerResult: PlayRawResult | null;
  /**
   * The result of the search operation
   */
  searchResult: SearchResult;
}
