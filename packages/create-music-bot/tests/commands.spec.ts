import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { Player } from 'discord-player';
import { Track } from 'discord-player';
import { describe, expect, it, vi } from 'vitest';
import { TEMPLATES } from '../src/scaffold.js';
import type * as CommandsModule from '../templates/ts/src/commands.ts';

type Command = ReturnType<(typeof CommandsModule)['createCommands']>[number];
type Interaction = Parameters<Command['run']>[0];

const hosts = ['media.test'];
const ephemeral = MessageFlags.Ephemeral;

/** Builds an interaction fake that records how the command replied. */
function createInteraction(
  options: {
    url?: string;
    voiceChannelId?: string | null;
    permissions?: boolean;
  } = {},
) {
  const { voiceChannelId = 'voice-1', permissions = true } = options;
  const channel = voiceChannelId
    ? { id: voiceChannelId, permissionsFor: vi.fn(() => ({ has: vi.fn(() => permissions) })) }
    : null;
  const interaction = {
    guildId: 'guild-1',
    user: { id: 'user-1' },
    channel: { id: 'text-1', send: vi.fn() },
    client: { user: { id: 'bot-id' } },
    guild: { members: { me: { id: 'bot-id' } } },
    member: { voice: { channel, channelId: voiceChannelId } },
    options: { getString: vi.fn(() => options.url ?? 'https://media.test/a.mp3') },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };

  return { interaction, channel, run: (command: Command) => command.run(interaction as unknown as Interaction) };
}

/** Builds a queue fake. By default the bot is playing one track in voice channel `voice-1`. */
function createQueue(overrides: Record<string, unknown> = {}) {
  const track = new Track({ title: 'Current *song*', url: 'https://media.test/current.mp3' });

  return {
    size: 0,
    currentTrack: track,
    tracks: { toArray: () => [] as Track[] },
    node: {
      session: { channelId: 'voice-1' },
      isPaused: vi.fn(() => false),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    },
    skip: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createPlayerFake(queue: ReturnType<typeof createQueue> | null = null) {
  return {
    getQueue: vi.fn(() => queue),
    search: vi.fn(),
    play: vi.fn(),
  };
}

async function build(
  template: (typeof TEMPLATES)[number],
  player: ReturnType<typeof createPlayerFake>,
  allowed = hosts,
) {
  const source = (await import(`../templates/${template}/src/commands.${template}`)) as typeof CommandsModule;
  const commands = source.createCommands(player as unknown as Player, { token: 'token', allowedMediaHosts: allowed });
  const byName = (name: string) => commands.find((command) => command.data.name === name) as Command;

  return { commands, byName };
}

describe.each(TEMPLATES)('generated %s commands', (template) => {
  it('defines the six commands for servers only', async () => {
    const { commands } = await build(template, createPlayerFake());

    expect(commands.map((command) => command.data.name)).toEqual(['play', 'pause', 'resume', 'skip', 'stop', 'queue']);

    for (const command of commands) expect(command.data.contexts).toEqual([0]);

    expect(commands[0]?.data).toMatchObject({
      options: [{ name: 'url', required: true }],
    });
  });

  describe('/play', () => {
    it('is disabled until an allowed host is configured', async () => {
      const player = createPlayerFake();
      const { byName } = await build(template, player, []);
      const { interaction, run } = createInteraction();

      await run(byName('play'));

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('ALLOWED_MEDIA_HOSTS'),
        flags: ephemeral,
      });
      expect(player.search).not.toHaveBeenCalled();
    });

    it.each([
      ['not a url', 'direct http(s) link'],
      ['https://evil.test/a.mp3', 'not in ALLOWED_MEDIA_HOSTS'],
    ])('rejects %j before touching the Player', async (url, message) => {
      const player = createPlayerFake();
      const { byName } = await build(template, player);
      const { interaction, run } = createInteraction({ url });

      await run(byName('play'));

      expect(interaction.reply).toHaveBeenCalledWith({ content: expect.stringContaining(message), flags: ephemeral });
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(player.search).not.toHaveBeenCalled();
    });

    it('asks the member to join a voice channel', async () => {
      const player = createPlayerFake();
      const { byName } = await build(template, player);
      const { interaction, run } = createInteraction({ voiceChannelId: null });

      await run(byName('play'));

      expect(interaction.reply).toHaveBeenCalledWith({ content: 'Join a voice channel first.', flags: ephemeral });
      expect(player.search).not.toHaveBeenCalled();
    });

    it('checks that the bot can view, join, and speak in the channel', async () => {
      const player = createPlayerFake();
      const { byName } = await build(template, player);
      const { interaction, channel, run } = createInteraction({ permissions: false });

      await run(byName('play'));

      const permissions = channel?.permissionsFor.mock.results[0]?.value;

      expect(channel?.permissionsFor).toHaveBeenCalledWith(interaction.guild.members.me);
      expect(permissions.has).toHaveBeenCalledWith([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ]);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('permission to view, connect to, and speak'),
        flags: ephemeral,
      });
      expect(player.search).not.toHaveBeenCalled();
    });

    it('does not move a bot that is playing in another channel', async () => {
      const player = createPlayerFake(createQueue({ node: { session: { channelId: 'voice-2' } } }));
      const { byName } = await build(template, player);
      const { interaction, run } = createInteraction();

      await run(byName('play'));

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'I am already playing in <#voice-2>.',
        flags: ephemeral,
      });
      expect(player.search).not.toHaveBeenCalled();
    });

    it('searches, queues the result, and reports the queue length', async () => {
      const queue = createQueue({ size: 2 });
      const player = createPlayerFake(null);
      const track = new Track({ title: '@everyone *loud*', url: 'https://media.test/a.mp3' });
      const result = { isEmpty: () => false, tracks: [track] };

      player.search.mockResolvedValue(result);
      player.play.mockResolvedValue({ track, queue });

      const { byName } = await build(template, player);
      const { interaction, channel, run } = createInteraction();

      await run(byName('play'));

      expect(interaction.deferReply).toHaveBeenCalledOnce();
      expect(player.search).toHaveBeenCalledWith('https://media.test/a.mp3', { requestedBy: 'user-1' });
      expect(player.play).toHaveBeenCalledWith(channel, result, {
        nodeOptions: { metadata: { channel: interaction.channel }, leaveOnEnd: true, leaveOnEndCooldown: 30_000 },
      });
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: 'Added **@everyone \\*loud\\*** (2 waiting in the queue).',
        allowedMentions: { parse: [] },
      });
    });

    it('reports media that cannot be read, whether the search fails or finds nothing', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      for (const search of [
        vi.fn().mockRejectedValue(new Error('invalid data')),
        vi.fn().mockResolvedValue({ isEmpty: () => true }),
      ]) {
        const player = createPlayerFake();

        player.search = search;

        const { byName } = await build(template, player);
        const { interaction, run } = createInteraction();

        await run(byName('play'));

        expect(interaction.editReply).toHaveBeenCalledWith('I could not read audio from that link.');
        expect(player.play).not.toHaveBeenCalled();
      }

      expect(error).toHaveBeenCalledWith('Could not read https://media.test/a.mp3:', expect.any(Error));
    });

    it('reports a result the Player could not queue', async () => {
      const player = createPlayerFake();

      player.search.mockResolvedValue({ isEmpty: () => false });
      player.play.mockResolvedValue({ track: null, queue: createQueue() });

      const { byName } = await build(template, player);
      const { interaction, run } = createInteraction();

      await run(byName('play'));

      expect(interaction.editReply).toHaveBeenCalledWith('I could not read audio from that link.');
    });
  });

  describe.each(['pause', 'resume', 'skip', 'stop'])('/%s', (name) => {
    it('needs a queue', async () => {
      const { byName } = await build(template, createPlayerFake(null));
      const { interaction, run } = createInteraction();

      await run(byName(name));

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Nothing is queued. Start with `/play`.',
        flags: ephemeral,
      });
    });

    it.each([
      ['another channel', 'voice-2'],
      ['no channel', null],
    ])('is refused for a member in %s', async (_label, voiceChannelId) => {
      const queue = createQueue();
      const { byName } = await build(template, createPlayerFake(queue));
      const { interaction, run } = createInteraction({ voiceChannelId });

      await run(byName(name));

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Join the voice channel the bot is in to control playback.',
        flags: ephemeral,
      });
      expect(queue.node.pause).not.toHaveBeenCalled();
      expect(queue.node.resume).not.toHaveBeenCalled();
      expect(queue.skip).not.toHaveBeenCalled();
      expect(queue.delete).not.toHaveBeenCalled();
    });
  });

  describe('playback controls', () => {
    it('pauses and resumes', async () => {
      const queue = createQueue();
      const { byName } = await build(template, createPlayerFake(queue));

      const first = createInteraction();

      await first.run(byName('pause'));

      expect(queue.node.pause).toHaveBeenCalledOnce();
      expect(first.interaction.reply).toHaveBeenCalledWith({ content: 'Paused.', allowedMentions: { parse: [] } });

      queue.node.isPaused.mockReturnValue(true);

      const second = createInteraction();

      await second.run(byName('pause'));
      await second.run(byName('resume'));

      expect(queue.node.pause).toHaveBeenCalledOnce();
      expect(second.interaction.reply).toHaveBeenNthCalledWith(1, {
        content: 'Playback is already paused.',
        flags: ephemeral,
      });
      expect(queue.node.resume).toHaveBeenCalledOnce();
      expect(second.interaction.reply).toHaveBeenNthCalledWith(2, {
        content: 'Resumed.',
        allowedMentions: { parse: [] },
      });
    });

    it('does not resume playback that is not paused', async () => {
      const queue = createQueue();
      const { byName } = await build(template, createPlayerFake(queue));
      const { interaction, run } = createInteraction();

      await run(byName('resume'));

      expect(queue.node.resume).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({ content: 'Playback is not paused.', flags: ephemeral });
    });

    it('skips to the next track, or reports an empty queue', async () => {
      const queue = createQueue();
      const next = new Track({ title: 'Next', url: 'https://media.test/next.mp3' });
      const { byName } = await build(template, createPlayerFake(queue));

      queue.skip.mockResolvedValueOnce(next);

      const first = createInteraction();

      await first.run(byName('skip'));

      expect(first.interaction.deferReply).toHaveBeenCalledOnce();
      expect(first.interaction.editReply).toHaveBeenCalledWith({
        content: 'Skipped. Now playing **Next**.',
        allowedMentions: { parse: [] },
      });

      const second = createInteraction();

      await second.run(byName('skip'));

      expect(second.interaction.editReply).toHaveBeenCalledWith({
        content: 'Skipped. The queue is empty.',
        allowedMentions: { parse: [] },
      });
    });

    it('does not skip when nothing is playing', async () => {
      const queue = createQueue({ currentTrack: null });
      const { byName } = await build(template, createPlayerFake(queue));
      const { interaction, run } = createInteraction();

      await run(byName('skip'));

      expect(queue.skip).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({ content: 'Nothing is playing.', flags: ephemeral });
    });

    it('stops by deleting the queue, which clears it and leaves the voice channel', async () => {
      const queue = createQueue();
      const { byName } = await build(template, createPlayerFake(queue));
      const { interaction, run } = createInteraction();

      await run(byName('stop'));

      expect(queue.delete).toHaveBeenCalledOnce();
      expect(interaction.editReply).toHaveBeenCalledWith(
        'Stopped playback, cleared the queue, and left the voice channel.',
      );
    });
  });

  describe('/queue', () => {
    it('is empty without a queue or a current track', async () => {
      for (const queue of [null, createQueue({ currentTrack: null })]) {
        const { byName } = await build(template, createPlayerFake(queue));
        const { interaction, run } = createInteraction();

        await run(byName('queue'));

        expect(interaction.reply).toHaveBeenCalledWith({ content: 'The queue is empty.', flags: ephemeral });
      }
    });

    it('lists the current track and the first ten upcoming tracks', async () => {
      const upcoming = Array.from(
        { length: 13 },
        (_, index) => new Track({ title: `Song ${index + 1}`, url: `https://media.test/${index}.mp3` }),
      );
      const queue = createQueue({ tracks: { toArray: () => upcoming } });
      const { byName } = await build(template, createPlayerFake(queue));
      const { interaction, run } = createInteraction();

      await run(byName('queue'));

      const [{ content, allowedMentions }] = interaction.reply.mock.calls[0] as [
        { content: string; allowedMentions: unknown },
      ];

      expect(allowedMentions).toEqual({ parse: [] });
      expect(content.split('\n')).toEqual([
        'Now playing: **Current \\*song\\***',
        ...upcoming.slice(0, 10).map((track, index) => `${index + 1}. **${track.title}**`),
        '…and 3 more',
      ]);
    });

    it('lets anyone in the server look at the queue', async () => {
      const queue = createQueue();
      const { byName } = await build(template, createPlayerFake(queue));
      const { interaction, run } = createInteraction({ voiceChannelId: null });

      await run(byName('queue'));

      expect(interaction.reply).toHaveBeenCalledWith({
        content: 'Now playing: **Current \\*song\\***',
        allowedMentions: { parse: [] },
      });
    });
  });
});
