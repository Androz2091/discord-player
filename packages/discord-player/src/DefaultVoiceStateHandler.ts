import { ChannelType, VoiceState } from 'discord.js';
import { GuildQueue, GuildQueueEvent } from './queue';
import { Player } from './Player';
import { Util } from './utils/Util';

export async function defaultVoiceStateHandler(
  player: Player,
  queue: GuildQueue,
  oldState: VoiceState,
  newState: VoiceState,
) {
  if (!queue || !queue.connection || !queue.channel) return;

  if (oldState.channelId && !newState.channelId && newState.member?.id === newState.guild.members.me?.id) {
    try {
      queue.delete();
    } catch {
      /* noop */
    }
    return void player.events.emit(GuildQueueEvent.disconnect, queue);
  }

  if (queue.options.pauseOnEmpty) {
    const isEmpty = Util.isVoiceEmpty(queue.channel);

    if (isEmpty) {
      queue.node.setPaused(true);
      Reflect.set(queue, '__pausedOnEmpty', true);
      if (queue.hasDebugger) {
        queue.debug('Voice channel is empty and options#pauseOnEmpty is true, pausing...');
      }
    } else {
      if (Reflect.get(queue, '__pausedOnEmpty')) {
        queue.node.setPaused(false);
        Reflect.set(queue, '__pausedOnEmpty', false);
        if (queue.hasDebugger) {
          queue.debug('Voice channel is not empty and options#pauseOnEmpty is true, resuming...');
        }
      }
    }
  }

  if (!oldState.channelId && newState.channelId && newState.member?.id === newState.guild.members.me?.id) {
    if (newState.serverMute != null && oldState.serverMute !== newState.serverMute) {
      queue.node.setPaused(newState.serverMute);
    } else if (
      newState.channel?.type === ChannelType.GuildStageVoice &&
      newState.suppress != null &&
      oldState.suppress !== newState.suppress
    ) {
      queue.node.setPaused(newState.suppress);
      if (newState.suppress) {
        newState.guild.members.me?.voice.setRequestToSpeak(true).catch(Util.noop);
      }
    }
  }

  if (!newState.channelId && oldState.channelId === queue.channel.id) {
    if (!Util.isVoiceEmpty(queue.channel)) return;
    const timeout = setTimeout(() => {
      if (!Util.isVoiceEmpty(queue.channel!)) return;
      if (!player.nodes.has(queue.guild.id)) return;
      if (queue.options.leaveOnEmpty) queue.delete();
      player.events.emit(GuildQueueEvent.emptyChannel, queue);
    }, queue.options.leaveOnEmptyCooldown || 0).unref();
    queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
  }

  if (newState.channelId && newState.channelId === queue.channel.id) {
    const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
    const channelEmpty = Util.isVoiceEmpty(queue.channel);
    if (!channelEmpty && emptyTimeout) {
      clearTimeout(emptyTimeout);
      queue.timeouts.delete(`empty_${oldState.guild.id}`);
      player.events.emit(GuildQueueEvent.channelPopulate, queue);
    }
  }

  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    if (newState.member?.id === newState.guild.members.me?.id) {
      if (queue.connection && newState.member?.id === newState.guild.members.me?.id) queue.channel = newState.channel!;
      const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
      const channelEmpty = Util.isVoiceEmpty(queue.channel);
      if (!channelEmpty && emptyTimeout) {
        clearTimeout(emptyTimeout);
        queue.timeouts.delete(`empty_${oldState.guild.id}`);
        player.events.emit(GuildQueueEvent.channelPopulate, queue);
      } else {
        const timeout = setTimeout(() => {
          if (queue.connection && !Util.isVoiceEmpty(queue.channel!)) return;
          if (!player.nodes.has(queue.guild.id)) return;
          if (queue.options.leaveOnEmpty) queue.delete();
          player.events.emit(GuildQueueEvent.emptyChannel, queue);
        }, queue.options.leaveOnEmptyCooldown || 0).unref();
        queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
      }
    } else {
      if (newState.channelId !== queue.channel.id) {
        const channelEmpty = Util.isVoiceEmpty(queue.channel!);
        if (!channelEmpty) return;
        if (queue.timeouts.has(`empty_${oldState.guild.id}`)) return;
        const timeout = setTimeout(() => {
          if (!Util.isVoiceEmpty(queue.channel!)) return;
          if (!player.nodes.has(queue.guild.id)) return;
          if (queue.options.leaveOnEmpty) queue.delete();
          player.events.emit(GuildQueueEvent.emptyChannel, queue);
        }, queue.options.leaveOnEmptyCooldown || 0).unref();
        queue.timeouts.set(`empty_${oldState.guild.id}`, timeout);
      } else {
        const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild.id}`);
        const channelEmpty = Util.isVoiceEmpty(queue.channel!);
        if (!channelEmpty && emptyTimeout) {
          clearTimeout(emptyTimeout);
          queue.timeouts.delete(`empty_${oldState.guild.id}`);
          player.events.emit(GuildQueueEvent.channelPopulate, queue);
        }
      }
    }
  }
}
