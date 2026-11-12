// root
export * from './player.js';
export * from './types.js';
export * from './errors.js';
export * from './context.js';
export * from './lyrics.js';

// managers
export * from './managers/guild-queue.manager.js';
export * from './managers/guild-queue-history.manager.js';

// structures
export * from './structures/common/guild-queue-events.js';
export * from './structures/guild-queue.js';
export * from './structures/guild-queue-player-node.js';
export * from './structures/track.js';
export * from './structures/playlist.js';
export * from './structures/search-result.js';
export * from './structures/common/queue.js';
export * from './structures/common/stack.js';
export * from './utils/serde.js';

export * from './plugins/types.js';
export * from './plugins/registry.js';
export * from './compat/extractors.js';
export * from './compat/utils.js';

export * from './structures/guild-queue-player-audio-filters.js';
export * from './structures/audio-filter-presets.js';

export type { LegacyPlayerContext } from '@discord-player/plugin-host';

export type { RemotePluginHostOptions } from '@discord-player/plugin-host';

/** Native payload contracts appended to forwarded lifecycle events. */
export type { DiscordSessionEvents, RemediaClientEvents } from '@remedia/client';

export type { GatewayVoiceState } from './voice-state.js';

export { onBeforeCreateStream, onAfterCreateStream, onStreamExtracted } from './hooks.js';
export type {
  StreamHooks,
  OnBeforeCreateStreamHandler,
  OnAfterCreateStreamHandler,
  OnStreamExtractedHandler,
  PostProcessedResult,
} from './hooks.js';

export * from './structures/synced-lyrics.js';
