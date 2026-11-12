import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { DiscordPlayer, definePlugin } from '../dist/index.js';

// Run after pnpm build: pnpm --filter discord-player exec node tests/capabilities.bench.mjs
// Report measurements without a timing assertion that would depend on machine load.
for (const unrelated of [0, 1000]) {
  for (const subscribers of [0, 1, 10]) {
    const player = new DiscordPlayer({ nodes: [], send() {} });
    let calls = 0;
    for (let index = 0; index < unrelated; index++) {
      await player.plugins.register(
        definePlugin({
          id: `unrelated-${index}`,
          setup(ctx) {
            ctx.on('lyrics.search', () => []);
          },
        })(),
      );
    }
    for (let index = 0; index < subscribers; index++) {
      await player.plugins.register(
        definePlugin({
          id: `subscribed-${index}`,
          setup(ctx) {
            ctx.on('queue.beforeAdd', () => {
              calls++;
            });
          },
        })(),
      );
    }
    const input = { guildId: 'guild', tracks: [], index: null };
    for (let index = 0; index < 10000; index++) player.plugins.executeSync('queue.beforeAdd', input);
    calls = 0;
    const start = performance.now();
    for (let index = 0; index < 100000; index++) player.plugins.executeSync('queue.beforeAdd', input);
    const elapsed = performance.now() - start;
    assert.equal(calls, 100000 * subscribers);
    console.log(JSON.stringify({ unrelated, subscribers, iterations: 100000, elapsedMs: elapsed }));
    await player.destroy();
  }
}
