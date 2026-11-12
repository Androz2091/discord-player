import { describe, expect, it, vi } from 'vitest';
import type { NodeSnapshot } from '@remedia/client';
import { setup } from './mocks/queue.js';
import type { MockNode } from './mocks/remedia.js';

type Fixture = Awaited<ReturnType<typeof setup>>;

/** Add a node to the mocked pool, cloned from the default node. */
function addNode(fixture: Fixture, id: string, overrides: Partial<MockNode> = {}) {
  const base = fixture.backend.client.nodes[0]!;
  const node = {
    ...base,
    id,
    capabilities: {
      ...base.capabilities,
      crossfade: { ...base.capabilities.crossfade },
    },
    ...overrides,
  };

  fixture.backend.client.nodes.push(node);

  return node;
}

/** Create a second guild queue whose session has not been created yet. */
async function pending(fixture: Fixture, options: Parameters<Fixture['player']['createQueue']>[1] = {}) {
  const queue = await fixture.player.createQueue('guild-two', options);

  fixture.backend.client.createDiscordSession.mockClear();

  return queue;
}

describe('Remedia node placement', () => {
  it('leaves placement to Remedia when a queue has no selector', async () => {
    const fixture = await setup();

    addNode(fixture, 'second');

    const queue = await pending(fixture);

    await queue.connect({ channelId: 'voice-two' });

    const options = fixture.backend.client.createDiscordSession.mock.calls[0]![0];

    expect(options).not.toHaveProperty('nodeId');
    expect(options.crossfade).toBeUndefined();
  });

  it('leaves placement to Remedia for crossfade when every eligible node supports it', async () => {
    const fixture = await setup({ queueOptions: { crossfade: { enabled: true } } });

    addNode(fixture, 'second');

    const queue = await pending(fixture, { crossfade: { enabled: true } });

    await queue.connect({ channelId: 'voice-two' });

    const options = fixture.backend.client.createDiscordSession.mock.calls[0]![0];

    expect(options).not.toHaveProperty('nodeId');
    expect(options.crossfade).toMatchObject({ enabled: true });
  });

  it('plays without crossfade when automatic placement may choose an unsupported node', async () => {
    const fixture = await setup({ nodeType: 'remote', crossfadeAvailable: true, queueOptions: { crossfade: false } });
    const second = addNode(fixture, 'second');

    second.capabilities.crossfade.available = false;

    const debug = vi.fn();

    fixture.player.on('debug', debug);

    const queue = await pending(fixture, { crossfade: { enabled: true } });

    await queue.connect({ channelId: 'voice-two' });

    const options = fixture.backend.client.createDiscordSession.mock.calls[0]![0];

    expect(options).not.toHaveProperty('nodeId');
    expect(options.crossfade).toBe(false);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('automatic placement may choose'));
  });

  it('offers a selector only eligible nodes and pins its choice', async () => {
    const fixture = await setup();
    const full = addNode(fixture, 'full', { capacity: 1, assignedGuilds: ['other'] });
    const degraded = addNode(fixture, 'degraded');
    const down = addNode(fixture, 'down', { status: 'disconnected' });
    const open = addNode(fixture, 'open');
    const selectNode = vi.fn((nodes: readonly NodeSnapshot[], _context: { guildId: string }) => nodes.at(-1)!.id);

    degraded.statistics = { transportHealth: 'degraded' } as NodeSnapshot['statistics'];

    const queue = await pending(fixture, { selectNode });

    await queue.connect({ channelId: 'voice-two' });

    expect([full, down].map((node) => node.id)).toEqual(['full', 'down']);
    expect(selectNode).toHaveBeenCalledOnce();
    expect(selectNode.mock.calls[0]![0].map((node) => node.id)).toEqual(['fake-node', open.id]);
    expect(selectNode.mock.calls[0]![1]).toEqual({ guildId: 'guild-two' });
    expect(fixture.backend.client.createDiscordSession.mock.calls[0]![0].nodeId).toBe('open');
  });

  it('does not consult a selector for a pinned node or an existing assignment', async () => {
    const fixture = await setup();

    addNode(fixture, 'second');

    const selectNode = vi.fn(() => 'fake-node');
    const queue = await pending(fixture, { selectNode });

    await queue.node.createSession({ channelId: 'voice-two', nodeId: 'second' });

    expect(fixture.backend.client.createDiscordSession.mock.calls[0]![0].nodeId).toBe('second');

    fixture.backend.client.getAssignment.mockReturnValue({
      guildId: 'guild-two',
      nodeId: 'fake-node',
      nodeType: 'embedded',
      status: 'assigned',
    });

    await queue.node.createSession({ channelId: 'voice-two' });

    expect(fixture.backend.client.createDiscordSession.mock.calls[1]![0].nodeId).toBe('fake-node');
    expect(selectNode).not.toHaveBeenCalled();
  });

  it('applies a selector before ordinary playback and keeps crossfade on the chosen node', async () => {
    const fixture = await setup({ nodeType: 'remote', crossfadeAvailable: true, queueOptions: { crossfade: false } });
    const second = addNode(fixture, 'second');

    second.capabilities.crossfade.available = false;

    const supported = vi.fn(() => 'fake-node');
    const unsupported = vi.fn(() => 'second');
    const first = await pending(fixture, { selectNode: supported, crossfade: { enabled: true } });

    await first.node.createSession({ channelId: 'voice-two' });

    expect(fixture.backend.client.createDiscordSession.mock.calls[0]![0]).toMatchObject({
      nodeId: 'fake-node',
      crossfade: { enabled: true },
    });

    await first.destroy();

    const second_queue = await fixture.player.createQueue('guild-three', {
      selectNode: unsupported,
      crossfade: { enabled: true },
    });

    await second_queue.node.createSession({ channelId: 'voice-three' });

    expect(fixture.backend.client.createDiscordSession.mock.lastCall![0]).toMatchObject({
      nodeId: 'second',
      crossfade: false,
    });
  });

  it('leaves an empty candidate pool to Remedia instead of calling the selector', async () => {
    const fixture = await setup();

    fixture.backend.client.nodes[0]!.status = 'disconnected';

    const selectNode = vi.fn(() => 'fake-node');
    const queue = await pending(fixture, { selectNode });

    await queue.node.createSession({ channelId: 'voice-two' });

    expect(selectNode).not.toHaveBeenCalled();
    expect(fixture.backend.client.createDiscordSession.mock.calls[0]![0]).not.toHaveProperty('nodeId');
  });
});
