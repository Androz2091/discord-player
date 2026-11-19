import { definePlugin, type SourcePluginRuntime } from '../src/index.js';

/** Standalone programs do not acquire a dependency on the full Player declarations. */
export const sourcePlugin = definePlugin({
  id: 'standalone.types',
  setup(ctx) {
    const partial: SourcePluginRuntime = ctx.player;
    partial.isPartial();
    // @ts-expect-error full Player nodes do not exist in standalone builds
    void ctx.player.nodes;
    ctx.on('track.stream', (_, context) => {
      const queue: null = context.queue;
      const guild: string | null = context.guildId;
      void [queue, guild, context.signal];
      return 'https://fixture.test/audio';
    });
  },
});
