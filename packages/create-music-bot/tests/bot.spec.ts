import { EventEmitter } from 'node:events';
import { Events } from 'discord.js';
import { RemediaClient } from '@remedia/client';
import { Track } from 'discord-player';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEMPLATES } from '../src/scaffold.js';
import type * as BotModule from '../templates/ts/src/bot.ts';
import type * as ConfigModule from '../templates/ts/src/config.ts';
import type * as MediaSourceModule from '../templates/ts/src/media-source.ts';

/** Loads one source file of a template. The JavaScript template exports the same names as the TypeScript one. */
async function load<T>(template: (typeof TEMPLATES)[number], name: string): Promise<T> {
  return (await import(`../templates/${template}/src/${name}.${template}`)) as T;
}

/** A Remedia client that can probe media and nothing else. */
function createFakeRemedia(probe = vi.fn()) {
  return Object.assign(new EventEmitter(), {
    nodes: [{ id: 'local', type: 'embedded', status: 'healthy' }],
    probe,
    close: vi.fn(async () => {}),
    receive: vi.fn(),
  });
}

describe.each(TEMPLATES)('generated %s bot', (template) => {
  const hosts = ['media.test'];

  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('configuration', () => {
    it('requires a token', async () => {
      const { loadConfig } = await load<typeof ConfigModule>(template, 'config');

      expect(() => loadConfig({})).toThrow('DISCORD_TOKEN is not set');
      expect(() => loadConfig({ DISCORD_TOKEN: '   ' })).toThrow('DISCORD_TOKEN is not set');
    });

    it('reads the token and normalizes the allowed hosts', async () => {
      const { loadConfig } = await load<typeof ConfigModule>(template, 'config');

      expect(loadConfig({ DISCORD_TOKEN: ' token ', ALLOWED_MEDIA_HOSTS: ' Media.Test, cdn.example.org ,, ' })).toEqual(
        {
          token: 'token',
          allowedMediaHosts: ['media.test', 'cdn.example.org'],
        },
      );
      expect(loadConfig({ DISCORD_TOKEN: 'token' }).allowedMediaHosts).toEqual([]);
    });

    it.each(['https://media.test', 'media.test/path', '*.example.org', 'media.test:8080', '-bad'])(
      'rejects %j as an allowed host',
      async (host) => {
        const { loadConfig } = await load<typeof ConfigModule>(template, 'config');

        expect(() => loadConfig({ DISCORD_TOKEN: 'token', ALLOWED_MEDIA_HOSTS: host })).toThrow('bare hostnames');
      },
    );
  });

  describe('media URL policy', () => {
    it('accepts http(s) links to allowed hosts only', async () => {
      const { checkMediaUrl } = await load<typeof MediaSourceModule>(template, 'media-source');

      expect(checkMediaUrl('https://media.test/a.mp3', hosts)).toMatchObject({
        url: { href: 'https://media.test/a.mp3' },
      });
      expect(checkMediaUrl(' http://MEDIA.test/a.mp3 ', hosts)).toMatchObject({ url: { hostname: 'media.test' } });
    });

    it.each([
      ['not a url', 'direct http(s) link'],
      ['file:///etc/passwd', 'Only http(s)'],
      ['ftp://media.test/a.mp3', 'Only http(s)'],
      ['https://user:pass@media.test/a.mp3', 'credentials'],
      ['https://evil.test/a.mp3', 'not in ALLOWED_MEDIA_HOSTS'],
      ['https://media.test.evil.test/a.mp3', 'not in ALLOWED_MEDIA_HOSTS'],
      ['https://evil.test/media.test', 'not in ALLOWED_MEDIA_HOSTS'],
      ['http://127.0.0.1/a.mp3', 'not in ALLOWED_MEDIA_HOSTS'],
    ])('rejects %j', async (query, message) => {
      const { checkMediaUrl } = await load<typeof MediaSourceModule>(template, 'media-source');
      const result = checkMediaUrl(query, hosts);

      expect(result).toEqual({ error: expect.stringContaining(message) });
    });

    it('allows nothing when no host is configured', async () => {
      const { checkMediaUrl } = await load<typeof MediaSourceModule>(template, 'media-source');

      expect(checkMediaUrl('https://media.test/a.mp3', [])).toHaveProperty('error');
    });
  });

  describe('source plugin through a real Player', () => {
    async function createInitializedBot(probe = vi.fn()) {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const remedia = createFakeRemedia(probe);

      vi.spyOn(RemediaClient, 'create').mockResolvedValue(remedia as unknown as RemediaClient);

      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });

      await bot.player.initialize('bot-id');

      return { ...bot, remedia };
    }

    it('resolves an allowed link into a track using the file tags', async () => {
      const probe = vi.fn().mockResolvedValue({ durationMs: 61_000, metadata: { title: 'Song', artist: 'Artist' } });
      const { player, stop } = await createInitializedBot(probe);
      const result = await player.search('https://media.test/dir/song.mp3', { requestedBy: 'user-1' });
      const [track] = result.tracks;

      expect(result.tracks).toHaveLength(1);
      expect(track).toMatchObject({ title: 'Song', author: 'Artist', url: 'https://media.test/dir/song.mp3' });
      expect(track?.durationMS).toBe(61_000);
      expect(probe).toHaveBeenCalledWith(
        { url: 'https://media.test/dir/song.mp3' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );

      await stop();
    });

    it('falls back to the file name and host when the file has no tags', async () => {
      const probe = vi.fn().mockResolvedValue({ durationMs: null, metadata: {} });
      const { player, stop } = await createInitializedBot(probe);
      const [track] = (await player.search('https://media.test/dir/song.mp3')).tracks;

      expect(track).toMatchObject({ title: 'song.mp3', author: 'media.test' });

      await stop();
    });

    it('does not claim links on other hosts, other protocols, or plain text', async () => {
      const probe = vi.fn();
      const { player, stop } = await createInitializedBot(probe);

      for (const query of ['https://evil.test/a.mp3', 'file:///tmp/a.mp3', 'some song name']) {
        expect((await player.search(query)).isEmpty(), query).toBe(true);
      }

      expect(probe).not.toHaveBeenCalled();

      await stop();
    });

    it('rejects the search when the media cannot be read', async () => {
      const probe = vi.fn().mockRejectedValue(new Error('invalid data'));
      const { player, stop } = await createInitializedBot(probe);

      await expect(player.search('https://media.test/broken.mp3')).rejects.toThrow('invalid data');

      await stop();
    });

    it('returns the stream URL for a track on an allowed host', async () => {
      const probe = vi.fn().mockResolvedValue({ durationMs: 1000, metadata: {} });
      const { player, stop } = await createInitializedBot(probe);
      const [track] = (await player.search('https://media.test/a.mp3')).tracks;

      await expect(
        player.plugins.resolveStream(track as Track, { signal: new AbortController().signal }),
      ).resolves.toEqual({
        url: 'https://media.test/a.mp3',
      });

      await stop();
    });

    it('refuses to stream a track whose URL points to a host that is not allowed', async () => {
      const probe = vi.fn().mockResolvedValue({ durationMs: 1000, metadata: {} });
      const { player, stop } = await createInitializedBot(probe);
      const [track] = (await player.search('https://media.test/a.mp3')).tracks;

      track!.url = 'https://evil.test/a.mp3';

      await expect(
        player.plugins.resolveStream(track as Track, { signal: new AbortController().signal }),
      ).rejects.toThrow('not in ALLOWED_MEDIA_HOSTS');

      await stop();
    });
  });

  describe('lifecycle', () => {
    it('starts the Player and registers every command only after the client is ready', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const remedia = createFakeRemedia();
      const create = vi.spyOn(RemediaClient, 'create').mockResolvedValue(remedia as unknown as RemediaClient);
      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const set = vi.fn().mockResolvedValue(undefined);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(create).not.toHaveBeenCalled();

      bot.client.emit(Events.ClientReady, {
        user: { id: 'bot-id', tag: 'Bot#0001' },
        application: { commands: { set } },
      } as never);

      await vi.waitFor(() => expect(set).toHaveBeenCalledOnce());

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ botUserId: 'bot-id' }));
      expect(bot.player.getClientId()).toBe('bot-id');
      expect(set.mock.calls[0]?.[0].map((command: { name: string }) => command.name)).toEqual([
        'play',
        'pause',
        'resume',
        'skip',
        'stop',
        'queue',
      ]);
      expect(log).toHaveBeenCalledWith('Ready as Bot#0001');

      await bot.stop();
    });

    it('stops with a failure and an FFmpeg hint when the audio engine cannot start', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');

      vi.spyOn(RemediaClient, 'create').mockRejectedValue(new Error('libavcodec.so.63 not found'));

      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const set = vi.fn();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const destroy = vi.spyOn(bot.client, 'destroy').mockResolvedValue(undefined);

      bot.client.emit(Events.ClientReady, {
        user: { id: 'bot-id', tag: 'Bot#0001' },
        application: { commands: { set } },
      } as never);

      await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());

      expect(set).not.toHaveBeenCalled();
      expect(error.mock.calls[0]?.[0]).toContain('FFmpeg 9 shared libraries');
      expect(process.exitCode).toBe(1);
    });

    it('forwards raw gateway packets to the Player', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const receive = vi.spyOn(bot.player, 'receive').mockImplementation(() => {});
      const packet = { t: 'VOICE_STATE_UPDATE', d: { guild_id: '1' } };

      bot.client.emit(Events.Raw, packet as never);

      expect(receive).toHaveBeenCalledWith(packet);

      await bot.stop();
    });

    it('shuts down once: queues and plugins first, then the Discord connection', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const order: string[] = [];

      vi.spyOn(bot.player, 'destroy').mockImplementation(async () => void order.push('player'));
      vi.spyOn(bot.client, 'destroy').mockImplementation(async () => void order.push('client'));

      await Promise.all([bot.stop(), bot.stop()]);
      await bot.stop();

      expect(order).toEqual(['player', 'client']);
      expect(process.exitCode).toBeUndefined();
    });

    it('still closes the Discord connection and reports failure when the Player cannot shut down', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const destroy = vi.spyOn(bot.client, 'destroy').mockResolvedValue(undefined);

      vi.spyOn(bot.player, 'destroy').mockRejectedValue(new Error('cleanup failed'));

      await bot.stop();

      expect(destroy).toHaveBeenCalledOnce();
      expect(error).toHaveBeenCalledWith('Could not shut down cleanly:', expect.any(Error));
      expect(process.exitCode).toBe(1);
    });

    it('logs in with the configured token', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const bot = createBot({ token: 'secret-token', allowedMediaHosts: hosts });
      const login = vi.spyOn(bot.client, 'login').mockResolvedValue('secret-token');

      await bot.start();

      expect(login).toHaveBeenCalledWith('secret-token');

      await bot.stop();
    });

    it('answers a command that throws without crashing the bot', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const [play] = bot.commands;

      vi.spyOn(play!, 'run').mockRejectedValue(new Error('boom'));

      const reply = vi.fn().mockResolvedValue(undefined);
      const followUp = vi.fn().mockResolvedValue(undefined);
      const interaction = (state: { deferred: boolean; replied: boolean }) => ({
        ...state,
        commandName: 'play',
        isChatInputCommand: () => true,
        inCachedGuild: () => true,
        reply,
        followUp,
      });

      bot.client.emit(Events.InteractionCreate, interaction({ deferred: false, replied: false }) as never);
      await vi.waitFor(() => expect(reply).toHaveBeenCalledOnce());
      bot.client.emit(Events.InteractionCreate, interaction({ deferred: true, replied: false }) as never);
      await vi.waitFor(() => expect(followUp).toHaveBeenCalledOnce());

      expect(reply).toHaveBeenCalledWith({ content: 'Something went wrong.', flags: expect.any(Number) });
      expect(error).toHaveBeenCalledWith('/play failed:', expect.any(Error));

      await bot.stop();
    });

    it('ignores interactions that are not guild slash commands', async () => {
      const { createBot } = await load<typeof BotModule>(template, 'bot');
      const bot = createBot({ token: 'token', allowedMediaHosts: hosts });
      const run = vi.spyOn(bot.commands[0]!, 'run');

      bot.client.emit(Events.InteractionCreate, { isChatInputCommand: () => false } as never);
      bot.client.emit(Events.InteractionCreate, {
        isChatInputCommand: () => true,
        inCachedGuild: () => false,
      } as never);
      bot.client.emit(Events.InteractionCreate, {
        isChatInputCommand: () => true,
        inCachedGuild: () => true,
        commandName: 'unknown',
      } as never);

      expect(run).not.toHaveBeenCalled();

      await bot.stop();
    });
  });

  describe('playback events', () => {
    function setup() {
      const send = vi.fn().mockResolvedValue(undefined);
      const queue = {
        guildId: 'guild-1',
        metadata: { channel: { send } },
        removeTrack: vi.fn(),
        playNext: vi.fn().mockResolvedValue(null),
      };

      return { send, queue };
    }

    async function createPlayer() {
      const { createBot } = await load<typeof BotModule>(template, 'bot');

      return createBot({ token: 'token', allowedMediaHosts: hosts });
    }

    it('announces playback with escaped titles and no mentions', async () => {
      const bot = await createPlayer();
      const { send, queue } = setup();
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const track = new Track({ title: '@everyone *bold*', url: 'https://media.test/a.mp3' });

      bot.player.events.emit('playerStart', queue as never, track, undefined as never);
      bot.player.events.emit('emptyQueue', queue as never);

      expect(send).toHaveBeenNthCalledWith(1, {
        content: 'Now playing **@everyone \\*bold\\***',
        allowedMentions: { parse: [] },
      });
      expect(send).toHaveBeenNthCalledWith(2, {
        content: 'The queue is empty. Add more with `/play`.',
        allowedMentions: { parse: [] },
      });
      expect(log).toHaveBeenCalledWith('Now playing @everyone *bold* in guild guild-1');

      await bot.stop();
    });

    it('skips a track that failed to play and continues with the next one', async () => {
      const bot = await createPlayer();
      const { send, queue } = setup();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const track = new Track({ title: 'Broken', url: 'https://media.test/broken.mp3' });

      bot.player.events.emit('playerError', queue as never, new Error('decode failed'), track, undefined);

      expect(queue.removeTrack).not.toHaveBeenCalled();

      await vi.waitFor(() => expect(queue.playNext).toHaveBeenCalledOnce());

      expect(queue.removeTrack).toHaveBeenCalledWith(track);
      expect(send).toHaveBeenCalledWith({
        content: 'Could not play **Broken**. Skipping it.',
        allowedMentions: { parse: [] },
      });
      expect(error).toHaveBeenCalledWith('Could not play https://media.test/broken.mp3:', expect.any(Error));

      await bot.stop();
    });

    it('logs instead of throwing when continuing after an error fails', async () => {
      const bot = await createPlayer();
      const { queue } = setup();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      queue.playNext.mockRejectedValue(new Error('queue destroyed'));

      bot.player.events.emit(
        'playerError',
        queue as never,
        new Error('x'),
        new Track({ title: 'T', url: 'https://media.test/t.mp3' }),
        undefined,
      );

      await vi.waitFor(() =>
        expect(error).toHaveBeenCalledWith('Could not continue after a playback error:', expect.any(Error)),
      );

      await bot.stop();
    });

    it('logs failed announcements, queue errors, and player errors', async () => {
      const bot = await createPlayer();
      const { send, queue } = setup();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      send.mockRejectedValue(new Error('Missing Access'));
      bot.player.events.emit('emptyQueue', queue as never);
      bot.player.events.emit('error', queue as never, new Error('voice failed'));
      bot.player.emit('error', new Error('node failed'));

      await vi.waitFor(() =>
        expect(error).toHaveBeenCalledWith('Could not send a playback update:', expect.any(Error)),
      );

      expect(error).toHaveBeenCalledWith('Queue guild-1 failed:', expect.any(Error));
      expect(error).toHaveBeenCalledWith('Player error:', expect.any(Error));

      await bot.stop();
    });

    it('does not announce when the queue has no text channel', async () => {
      const bot = await createPlayer();
      const { queue } = setup();

      queue.metadata.channel = null as never;

      expect(() => bot.player.events.emit('emptyQueue', queue as never)).not.toThrow();

      await bot.stop();
    });
  });
});
