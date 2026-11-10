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

/** Legacy history class name mapped to the managed v8 history facade. */
export { GuildQueueHistoryManager as GuildQueueHistory } from './managers/guild-queue-history.manager.js';

export * from './structures/guild-queue-player-audio-filters.js';
export * from './structures/audio-filter-presets.js';

export { SourcePluginRuntime } from '@discord-player/plugin-host';
export type { LegacyPlayerContext, SourceRuntimeEvents, SourcePluginRuntimeOptions } from '@discord-player/plugin-host';

export type { RemoteSourceHostOptions } from './remote-source-hosts.js';
