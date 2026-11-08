import { vi } from 'vitest';
import type { DiscordSession, DiscordSessionOptions, RemediaClient, NodeSnapshot } from '@remedia/client';
import { FakeSession } from './remedia-session.js';

export { FakeSession } from './remedia-session.js';

/** Reusable backend fake. Casts only bridge Remedia's private class fields; public methods are checked above. */
export function createRemediaMock(nodeType: 'embedded' | 'remote' = 'embedded', crossfadeAvailable = false) {
  const sessions: FakeSession[] = [];
  const nodes = [
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
        crossfade: {
          available: crossfadeAvailable,
          configured: crossfadeAvailable,
          durationMs: 5000,
          prepareBeforeMs: 30000,
          curve: 'equalPower',
        },
      },
    },
  ] satisfies NodeSnapshot[];
  const client = {
    nodes,
    getAssignment: vi.fn(() => undefined),
    createDiscordSession: vi.fn((options: DiscordSessionOptions) => {
      const session = new FakeSession(options, nodeType);
      sessions.push(session);
      return session;
    }),
    receive: vi.fn<RemediaClient['receive']>(),
  };
  return {
    client,
    sessions,
    asClient: () => client as unknown as RemediaClient,
    asSession: (session: DiscordSession) => session as unknown as FakeSession,
  };
}
