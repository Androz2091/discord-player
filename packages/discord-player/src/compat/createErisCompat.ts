/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck

import { ChannelType, GatewayDispatchEvents } from 'discord-api-types/v10';
import { createCompatClient } from './common';
import { Util } from '../utils/Util';

import type { DiscordGatewayAdapterCreator } from 'discord-voip';
import {
  Client,
  GatewayVoiceServerUpdateDispatchData,
  GatewayVoiceStateUpdateDispatchData,
  VoiceState,
} from 'discord.js';
import type Eris from 'eris';

type ErisUserResolvable = Eris.User | string | Eris.Member;
type ErisGuildResolvable =
  | Eris.Guild
  | string
  | Eris.Member
  | Eris.GuildChannel
  | Eris.Role;
type ErisChannelResolvable = Eris.GuildChannel | string;

const DiscordPlayerClientSymbol = Symbol('DiscordPlayerClient');

export function isErisClient(client: any): client is Eris.Client {
  const { module, error } = Util.require('eris');

  if (error) return false;

  const eris = module as typeof import('eris');

  return client instanceof eris.Client;
}

function declareProperty(target: any, key: string, value: any) {
  Reflect.set(target, key, value);
}

function getProperty<T>(target: any, key: string): T {
  return Reflect.get(target, key);
}

/**
 * Allows Eris clients to be used with discord-player. When this method is called, discord-player creates a proxy object that intercepts certain methods and properties to make it compatible with discord-player.
 * @param client The Eris client to be used.
 * @returns The Eris client with discord-player compatibility.
 */
export function createErisCompat(client: Eris.Client): Client {
  const { module, error } = Util.require('eris');

  if (error) throw error;

  const eris = module as typeof import('eris');

  erisVoiceEventsHandler(client);

  const erisProxy = new Proxy(client, {
    get(target, p) {
      switch (p) {
        case 'users':
          return erisUsersProxy(target, eris);
        case 'guilds':
          return erisGuildsProxy(target, eris);
        case 'channels':
          return erisChannelsProxy(target, eris);
        case '__dp_voiceStateUpdate_proxy':
          return (handler: (a, b) => void) =>
            erisVoiceStateUpdateProxy(target, erisProxy, handler);
        case 'incrementMaxListeners':
          return () => {
            // @ts-expect-error patching
            client.setMaxListeners(client.getMaxListeners() + 1);
          };
        case 'decrementMaxListeners':
          return () => {
            // @ts-expect-error patching
            const listeners = client.getMaxListeners() - 1;

            // @ts-expect-error patching
            client.setMaxListeners(listeners < 0 ? 1 : listeners);
          };
        default:
          // @ts-expect-error patching
          return target[p];
      }
    },
  });

  Reflect.set(erisProxy, DiscordPlayerClientSymbol, 'Eris');

  return createCompatClient(erisProxy, 'Eris').client as unknown as Client;
}

function erisVoiceStateUpdateProxy(
  client: Eris.Client,
  proxy: Eris.Client,
  handler: (a, b) => void,
) {
  client.on('voiceStateUpdate', (member, oldState) => {
    try {
      const proxiedOldState = {
        channelId: oldState.channelID,
        serverMute: oldState.mute,
        suppress: oldState.suppress,
        guild: {
          id: oldState.guild.id,
        },
        member: {
          id: oldState.user.id,
        },
      } as VoiceState;

      const me = member.guild.members.get(client.user.id);
      const resolvedChannel = member.guild.channels.get(
        member.voiceState.channelID,
      );

      const proxiedNewState = {
        channelId: member.voiceState.channelID,
        serverMute: member.voiceState.mute,
        suppress: member.voiceState.suppress,
        channel: erisResolvedChannelProxy(resolvedChannel, client),
        member: {
          id: member.id,
        },
        guild: {
          id: member.guild.id,
          members: {
            me: {
              id: me?.id,
              voice: {
                async setRequestToSpeak(value: boolean) {
                  void value;
                  return me?.voiceState;
                  // if (me) {
                  //   return me.voice.setRequestToSpeak(value);
                  // }
                },
              },
            },
          },
        },
      } as VoiceState;

      return handler(proxiedNewState, proxiedOldState);
    } catch {
      /* noop */
    }
  });
}

function erisVoiceEventsHandler(client: Eris.Client) {
  let adapters = getProperty<Map<string, any>>(client, 'adapters');

  if (!adapters) {
    const collection = new Map<string, any>();
    adapters = collection;
    declareProperty(client, 'adapters', collection);
  }

  client.on('shardDisconnect', (_, shardId) => {
    for (const [guildId, adapter] of adapters.entries()) {
      if (client.guilds.get(guildId)?.shard.id === shardId) {
        adapter.destroy();
      }
    }
  });

  client.on('rawWS', (packet) => {
    switch (packet.t) {
      case GatewayDispatchEvents.VoiceServerUpdate: {
        const payload = packet.d as GatewayVoiceServerUpdateDispatchData;
        adapters.get(payload.guild_id)?.onVoiceServerUpdate(payload);
        return;
      }
      case GatewayDispatchEvents.VoiceStateUpdate: {
        const payload = packet.d as GatewayVoiceStateUpdateDispatchData;

        if (
          payload.guild_id &&
          payload.session_id &&
          payload.user_id === client.user.id
        ) {
          adapters.get(payload.guild_id)?.onVoiceStateUpdate(payload);
        }

        return;
      }
      default:
        break;
    }
  });
}

function erisChannelsProxy(client: Eris.Client, eris: typeof import('eris')) {
  const handler = {
    client,
    get cache() {
      return {
        get(id: string) {
          return client.getChannel(id);
        },
        has(id: string) {
          return id in client.channelGuildMap;
        },
      };
    },
    resolve(resolvable: string | ErisChannelResolvable) {
      if (typeof resolvable === 'string') {
        return erisResolvedChannelProxy(
          this.client.getChannel(resolvable) as Eris.GuildChannel,
          client,
        );
      }

      if (resolvable instanceof eris.GuildChannel) {
        return erisResolvedChannelProxy(resolvable, client);
      }
    },
    resolveId(resolvable: ErisChannelResolvable) {
      const channel = this.resolve(resolvable);
      return channel?.id;
    },
  };

  return handler;
}

function erisResolvedChannelProxy(
  channel: Eris.GuildChannel | undefined,
  client: Eris.Client,
): Eris.GuildChannel | undefined {
  if (!channel) return;

  return new Proxy(channel, {
    get(target, p) {
      switch (p) {
        case 'guild':
          return erisVoiceAdapterProxy(target.guild, client);
        case 'members':
          return (target as Eris.VoiceChannel).voiceMembers;
        case 'isVoiceBased':
          return () =>
            target.type === ChannelType.GuildVoice ||
            target.type === ChannelType.GuildStageVoice;
        case 'isVoice':
          return () => target.type === ChannelType.GuildVoice;
        case 'isStage':
          return () => target.type === ChannelType.GuildStageVoice;
        default:
          // @ts-expect-error patching
          return target[p];
      }
    },
  });
}

function erisVoiceAdapterProxy(
  guild: Eris.Guild | undefined,
  client: Eris.Client,
): Eris.Guild | undefined {
  if (!guild) return;

  return new Proxy(guild, {
    get(target, p) {
      if (p === 'voiceAdapterCreator') {
        return erisVoiceAdapterCreator(target, client);
      }

      // @ts-expect-error patching
      return target[p];
    },
  });
}

function erisVoiceAdapterCreator(
  guild: Eris.Guild,
  client: Eris.Client,
): DiscordGatewayAdapterCreator {
  return (methods) => {
    let adapters = getProperty<Map<string, typeof methods>>(client, 'adapters');

    if (!adapters) {
      const collection = new Map<string, typeof methods>();
      adapters = collection;
      declareProperty(client, 'adapters', collection);
    }

    adapters.set(guild.id, methods);

    return {
      sendPayload(payload) {
        if (guild.shard.status !== 'ready') return false;
        guild.shard.sendWS(payload.op, payload.d);
        return true;
      },
      destroy() {
        adapters.delete(guild.id);
      },
    };
  };
}

function erisGuildsProxy(client: Eris.Client, eris: typeof import('eris')) {
  return new Proxy(client.guilds, {
    get(target, p) {
      if (p === 'cache') {
        return target;
      }

      if (p === 'resolve' || p === 'resolveId') {
        const resolver = function (resolvable: ErisGuildResolvable) {
          if (typeof resolvable === 'string') {
            return target.get(resolvable);
          }

          if (resolvable instanceof eris.Guild) {
            return resolvable;
          }

          if (
            resolvable instanceof eris.Member ||
            resolvable instanceof eris.Guild ||
            resolvable instanceof eris.GuildChannel ||
            resolvable instanceof eris.Role
          ) {
            return resolvable.guild;
          }
        };

        if (p === 'resolve') {
          return resolver;
        }

        return (resolvable: ErisGuildResolvable) => {
          const guild = resolver(resolvable);
          return guild?.id;
        };
      }

      // @ts-expect-error patching
      return target[p];
    },
  });
}

function erisUsersProxy(client: Eris.Client, eris: typeof import('eris')) {
  return new Proxy(client.users, {
    get(target, p) {
      if (p === 'cache') {
        return target;
      }

      if (p === 'resolve' || p === 'resolveId') {
        const resolver = function (resolvable: ErisUserResolvable) {
          if (typeof resolvable === 'string') {
            return target.get(resolvable);
          }

          if (resolvable instanceof eris.User) {
            return resolvable;
          }

          if (resolvable instanceof eris.Member) {
            return resolvable.user;
          }
        };

        if (p === 'resolve') {
          return resolver;
        }

        return (resolvable: ErisUserResolvable) => {
          const user = resolver(resolvable);
          return user?.id;
        };
      }

      // @ts-expect-error patching
      return target[p];
    },
  });
}
