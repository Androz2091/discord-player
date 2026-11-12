import type { PlaybackSession } from '../../src/playback-backend.js';
import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import type { DiscordSessionOptions, RemediaClient, NodeSnapshot } from '@remedia/client';
import { FakeSession } from './remedia-session.js';

export { FakeSession } from './remedia-session.js';

/** Node snapshot whose capabilities are always reported. */
export type MockNode = NodeSnapshot & { capabilities: NonNullable<NodeSnapshot['capabilities']> };

/** Reusable backend fake. Casts only bridge Remedia's private class fields; public methods are checked above. */
export function createRemediaMock(nodeType: 'embedded' | 'remote' = 'embedded', crossfadeAvailable = false) {
  const sessions: FakeSession[] = [];
  const activeSessions = new Map<string, FakeSession>();
  const nodes: MockNode[] = [
    {
      id: 'fake-node',
      type: nodeType,
      status: 'healthy',
      nodeId: null,
      version: null,
      protocolVersion: null,
      statistics: null,
      capacity: 100,
      assignedGuilds: [],
      lastError: null,
      capabilities: {
        pluginOperations: { available: false as boolean, hosts: [] as string[], forwarding: false },
        crossfade: {
          available: crossfadeAvailable,
          configured: crossfadeAvailable,
          durationMs: 5000,
          prepareBeforeMs: 30000,
          curve: 'equalPower',
          curves: ['equalPower', 'adaptive'],
        },
      },
    },
  ];
  const client = Object.assign(new EventEmitter(), {
    nodes,
    close: vi.fn(async () => {}),
    getAssignment: vi.fn<RemediaClient['getAssignment']>(() => undefined),
    createDiscordSession: vi.fn((options: DiscordSessionOptions) => {
      if (activeSessions.has(options.guildId))
        throw new Error(`a Discord session already exists for guild ${options.guildId}`);

      const session = new FakeSession(options, nodeType, () => {
        if (activeSessions.get(options.guildId) === session) activeSessions.delete(options.guildId);
      });

      activeSessions.set(options.guildId, session);
      sessions.push(session);

      return session;
    }),
    receive: vi.fn<RemediaClient['receive']>(),
  });

  return {
    client,
    sessions,
    activeSessions,

    asClient: () => client as unknown as RemediaClient,

    asSession: (session: PlaybackSession) => session as unknown as FakeSession,
  };
}
