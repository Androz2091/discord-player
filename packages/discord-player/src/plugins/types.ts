export { definePlugin } from '@discord-player/plugin-host';
export type {
  ProviderReference,
  SourceStream,
  DispatchPolicy,
  Operation,
  SourceQuery,
  SourceMatch,
  SourceTrackRequest,
  SourceRelatedRequest,
  SourceBridgeRequest,
  SourceStreamTransform,
  OperationMap,
  OperationName,
  OperationInput,
  OperationOutput,
  OperationResult,
  OperationContext,
  OperationHandler,
  HandlerOptions,
  PluginContext,
  PluginDefinition,
  PluginRegistration,
  PluginFactory,
} from '@discord-player/plugin-host';

import type { DiscordPlayer } from '../player.js';
import type { GuildQueue } from '../structures/guild-queue.js';

declare module '@discord-player/plugin-host' {
  interface PluginRuntimeMap {
    /** Full Player available for locally registered plugins. */
    player: DiscordPlayer;
  }

  interface PluginQueueMap {
    /** Actual queue owned by a full Player. */
    queue: GuildQueue;
  }
}

export type {
  PluginRuntimeMap,
  PluginPlayer,
  PluginQueueMap,
  PluginQueue,
  SynchronousOperationMap,
} from '@discord-player/plugin-host';
