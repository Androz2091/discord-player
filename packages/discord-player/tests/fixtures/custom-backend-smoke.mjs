import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@remedia/node')) throw new Error('Custom backend attempted to load the native runtime');
    return nextResolve(specifier, context);
  },
});

const { DiscordPlayer, definePlugin } = await import('../../dist/index.js');
let initialized = false;
let destroyed = false;
let received;
const backend = {
  id: 'generic-smoke',
  capabilities: { sources: ['url'], crossfade: false, filters: false },
  async initialize({ clientId, signal, send }) {
    assert.equal(clientId, 'bot-user');
    assert.equal(signal.aborted, false);
    await send('guild', { op: 4, d: { guild_id: 'guild', channel_id: 'voice', self_mute: false, self_deaf: true } });
    initialized = true;
  },
  receive(packet) {
    received = packet;
  },
  createSession() {
    throw new Error('This initialization smoke fixture does not create sessions');
  },
  async destroy() {
    destroyed = true;
  },
};
let sends = 0;
const player = new DiscordPlayer({
  send() {
    sends++;
  },
  plugins: [
    definePlugin({
      id: 'custom',
      setup(ctx) {
        ctx.provide('playback.backend', backend);
      },
    })(),
  ],
});
await player.initialize('bot-user');
assert.equal(initialized, true);
assert.equal(sends, 1);
assert.equal(player.getBackend(), backend);
assert.equal(player.getRemedia(false), null);
const packet = { t: 'READY', s: 1, d: {} };
player.receive(packet);
assert.equal(received, packet);
await player.destroy();
assert.equal(destroyed, true);
