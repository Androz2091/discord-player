import { vi } from 'vitest';
import type { MediaSource } from '@remedia/client';
import { DiscordPlayer, Track, definePlugin, type GuildQueueOptions } from '../../src/index.js';
import { createRemediaMock } from './remedia.js';

/** Track fixture with a deterministic Remedia source. */
export class TestTrack extends Track {
  /** Optional source preparation function. */
  public resolver: (signal?: AbortSignal) => Promise<MediaSource>;

  /** Create one controlled Track fixture. */
  public constructor(title: string, resolver?: (signal?: AbortSignal) => Promise<MediaSource>) {
    super({
      sourceReference: { pluginId: 'fixture', data: null },
      title,
      author: 'fixture',
      duration: '1:00',
      url: `https://example.test/${title}`,
    });
    this.resolver = resolver ?? (async () => ({ url: this.url }));
  }
}

/** Create a Player, mocked Remedia client, connected queue, and fake session. */
export async function setup(
  options: {
    nodeType?: 'embedded' | 'remote';
    maxSize?: number;
    maxHistorySize?: number;
    queueOptions?: Partial<GuildQueueOptions>;
  } = {},
) {
  const player = new DiscordPlayer({ nodes: [], send: vi.fn() });
  await player.plugins.register(
    definePlugin({
      id: 'fixture',
      kind: 'source',
      setup(ctx) {
        ctx.on('track.stream', ({ track }, { signal }) => (track as TestTrack).resolver(signal));
      },
    })(),
  );
  player.getClientId = () => 'bot-user';
  const backend = createRemediaMock(options.nodeType);
  const { sessions } = backend;
  player.remedia = backend.asClient();
  const queue = await player.queues.create('guild-one', {
    maxSize: options.maxSize,
    maxHistorySize: options.maxHistorySize,
    ...options.queueOptions,
  });
  const session = backend.asSession(await queue.connect({ channelId: 'voice-one' }));
  return { player, queue, session, sessions, backend };
}
