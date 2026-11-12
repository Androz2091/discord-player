import { expect, vi } from 'vitest';
import type {
  ChatInputCommand,
  ChatInputCommandContext,
  AutocompleteCommand,
  AutocompleteCommandContext,
} from 'commandkit';
import type { GuildQueue } from 'discord-player';
import type { EmbedBuilder } from 'discord.js';

export type OptionValues = Record<string, string | number | boolean>;

type Reply = { content?: string; embeds: EmbedBuilder[] };

type PartialFixture<T> = {
  [K in keyof T]?: unknown extends T[K]
    ? T[K]
    : T[K] extends (...args: never[]) => unknown
      ? T[K]
      : NonNullable<T[K]> extends object
        ? PartialFixture<NonNullable<T[K]>> | Extract<T[K], null | undefined>
        : T[K];
};

/** Structural queue fixtures keep the nominal class cast in one place. */
export function queueFixture(value: PartialFixture<GuildQueue>): GuildQueue {
  return value as GuildQueue;
}

/** Minimal interaction surface consumed by the example commands. */
export function interaction(commandName: string, values: OptionValues = {}) {
  const replies: Reply[] = [];
  const announcements: Reply[] = [];

  return {
    commandName,
    guildId: 'guild',

    inCachedGuild: () => true,

    member: { voice: { channel: { id: 'voice', joinable: true } as { id: string; joinable: boolean } | null } },
    channel: {
      isSendable: () => true,

      send: async (message: Reply) => {
        announcements.push(message);
      },
    },
    user: { id: 'requester', displayName: 'Listener', displayAvatarURL: () => 'https://example.test/avatar.png' },
    client: { ws: { ping: 25 } },
    options: {
      getString: (key: string) => (typeof values[key] === 'string' ? values[key] : null),

      getNumber: (key: string) => (typeof values[key] === 'number' ? values[key] : null),

      getInteger: (key: string) => (typeof values[key] === 'number' ? values[key] : null),

      getBoolean: (key: string) => (typeof values[key] === 'boolean' ? values[key] : null),

      getSubcommand: () => (typeof values.action === 'string' ? values.action : 'list'),
    },

    deferReply: async (options: { flags: number }) => {
      expect(options.flags).toBe(64);
    },

    reply: async (reply: Reply) => {
      replies.push(reply);
    },

    editReply: async (reply: Reply) => {
      replies.push(reply);
    },

    replies,
    announcements,
  };
}

/** Adapt the exercised interaction surface to CommandKit's nominal context. */
export function runChatInput(handler: ChatInputCommand, request: ReturnType<typeof interaction>) {
  return handler({ interaction: request } as unknown as ChatInputCommandContext);
}

/** Adapt a focused autocomplete interaction to CommandKit's nominal context. */
export function runAutocomplete(handler: AutocompleteCommand, request: ReturnType<typeof autocompleteInteraction>) {
  return handler({ interaction: request } as unknown as AutocompleteCommandContext);
}

/** Validate and inspect a command's embed response. */
export function embed(reply: Reply | undefined) {
  expect(reply, 'command should produce a response').toBeDefined();
  expect(reply!.content, 'responses must use embeds').toBeUndefined();
  expect(reply!.embeds).toHaveLength(1);

  const data = reply!.embeds[0]!.toJSON();

  expect(data.title).toBeTruthy();
  expect(data.description).toBeTruthy();
  expect(data.color).toBeTruthy();
  expect(data.timestamp).toBeTruthy();

  return data;
}

/** Structural session identity for announcement-only tests. */
export function sessionFixture(value: PartialFixture<NonNullable<GuildQueue['node']['session']>>) {
  return value as NonNullable<GuildQueue['node']['session']>;
}

/** A focused autocomplete interaction with a typed Vitest response spy. */
export function autocompleteInteraction(query: string | null = null) {
  return {
    user: { id: 'requester' },
    options: { getString: vi.fn((_name: string, _required?: boolean) => query) },
    respond: vi.fn<(choices: Array<{ name: string; value: string }>) => Promise<void>>().mockResolvedValue(undefined),
  };
}
