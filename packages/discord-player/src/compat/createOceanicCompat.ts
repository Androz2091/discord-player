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
import type Oceanic from 'oceanic.js';

type OceanicUserResolvable = Oceanic.User | string | Oceanic.Member;
type OceanicGuildResolvable =
  | Oceanic.Guild
  | string
  | Oceanic.Member
  | Oceanic.GuildChannel
  | Oceanic.Role;
type OceanicChannelResolvable = Oceanic.GuildChannel | string;

const DiscordPlayerClientSymbol = Symbol('DiscordPlayerClient');

export function isOceanicClient(client: any): client is Oceanic.Client {
  const { module, error } = Util.require('oceanic.js');

  if (error) return false;

  const oceanic = module as typeof import('oceanic.js');

  return client instanceof oceanic.Client;
}

function declareProperty(target: any, key: string, value: any): T {
  Reflect.set(target, key, value);
}

function getProperty<T>(target: any, key: string): T {
  return Reflect.get(target, key);
}

/**
 * Allows Oceanic.js clients to be used with discord-player. When this method is called, discord-player creates a proxy object that intercepts certain methods and properties to make it compatible with discord-player.
 * @param client The Oceanic.js client to be used.
 * @returns The Oceanic.js client with discord-player compatibility.
 */
export function createOceanicCompat(client: Oceanic.Client): Client {
  const { module, error } = Util.require('oceanic.js');

  if (error) throw error;

  const oceanic = module as typeof import('oceanic.js');

  oceanicVoiceEventsHandler(client);

  const oceanicProxy = new Proxy(client, {
    get(target, p) {
      switch (p) {
        case 'users':
          return oceanicUsersProxy(target, oceanic);
        case 'guilds':
          return oceanicGuildsProxy(target, oceanic);
        case 'channels':
          return oceanicChannelsProxy(target, oceanic);
        case '__dp_voiceStateUpdate_proxy':
          return (handler: (a, b) => void) =>
            oceanicVoiceStateUpdateProxy(target, oceanicProxy, handler);
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

  Reflect.set(oceanicProxy, DiscordPlayerClientSymbol, 'Oceanic');

  return createCompatClient(oceanicProxy, 'Oceanic')
    .client as unknown as Client;
}

function oceanicVoiceStateUpdateProxy(
  client: Oceanic.Client,
  proxy: Oceanic.Client,
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
        channel: oceanicResolvedChannelProxy(resolvedChannel, client),
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

function oceanicVoiceEventsHandler(client: Oceanic.Client) {
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

  client.on('packet', (packet) => {
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

function oceanicChannelsProxy(
  client: Oceanic.Client,
  oceanic: typeof import('oceanic.js'),
) {
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
    resolve(resolvable: string | OceanicChannelResolvable) {
      if (typeof resolvable === 'string') {
        return oceanicResolvedChannelProxy(
          this.client.getChannel(resolvable) as Oceanic.GuildChannel,
          client,
        );
      }

      if (resolvable instanceof oceanic.GuildChannel) {
        return oceanicResolvedChannelProxy(resolvable, client);
      }
    },
    resolveId(resolvable: OceanicChannelResolvable) {
      const channel = this.resolve(resolvable);
      return channel?.id;
    },
  };

  return handler;
}

function oceanicResolvedChannelProxy(
  channel: Oceanic.GuildChannel | undefined,
  client: Oceanic.Client,
): Oceanic.GuildChannel | undefined {
  if (!channel) return;

  return new Proxy(channel, {
    get(target, p) {
      switch (p) {
        case 'guild':
          return oceanicVoiceAdapterProxy(target.guild, client);
        case 'members':
          return (target as Oceanic.VoiceChannel).voiceMembers;
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

function oceanicVoiceAdapterProxy(
  guild: Oceanic.Guild | undefined,
  client: Oceanic.Client,
): Oceanic.Guild | undefined {
  if (!guild) return;

  return new Proxy(guild, {
    get(target, p) {
      if (p === 'voiceAdapterCreator') {
        return oceanicVoiceAdapterCreator(target, client);
      }

      // @ts-expect-error patching
      return target[p];
    },
  });
}

function oceanicVoiceAdapterCreator(
  guild: Oceanic.Guild,
  client: Oceanic.Client,
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
        guild.shard.send(payload.op, payload.d);
        return true;
      },
      destroy() {
        adapters.delete(guild.id);
      },
    };
  };
}

function oceanicGuildsProxy(
  client: Oceanic.Client,
  oceanic: typeof import('oceanic.js'),
) {
  return new Proxy(client.guilds, {
    get(target, p) {
      if (p === 'cache') {
        return target;
      }

      if (p === 'resolve' || p === 'resolveId') {
        const resolver = function (resolvable: OceanicGuildResolvable) {
          if (typeof resolvable === 'string') {
            return target.get(resolvable);
          }

          if (resolvable instanceof oceanic.Guild) {
            return resolvable;
          }

          if (
            resolvable instanceof oceanic.Member ||
            resolvable instanceof oceanic.Guild ||
            resolvable instanceof oceanic.GuildChannel ||
            resolvable instanceof oceanic.Role
          ) {
            return resolvable.guild;
          }
        };

        if (p === 'resolve') {
          return resolver;
        }

        return (resolvable: OceanicGuildResolvable) => {
          const guild = resolver(resolvable);
          return guild?.id;
        };
      }

      // @ts-expect-error patching
      return target[p];
    },
  });
}

function oceanicUsersProxy(
  client: Oceanic.Client,
  oceanic: typeof import('oceanic.js'),
) {
  return new Proxy(client.users, {
    get(target, p) {
      if (p === 'cache') {
        return target;
      }

      if (p === 'resolve' || p === 'resolveId') {
        const resolver = function (resolvable: OceanicUserResolvable) {
          if (typeof resolvable === 'string') {
            return target.get(resolvable);
          }

          if (resolvable instanceof oceanic.User) {
            return resolvable;
          }

          if (resolvable instanceof oceanic.Member) {
            return resolvable.user;
          }
        };

        if (p === 'resolve') {
          return resolver;
        }

        return (resolvable: OceanicUserResolvable) => {
          const user = resolver(resolvable);
          return user?.id;
        };
      }

      // @ts-expect-error patching
      return target[p];
    },
  });
}
