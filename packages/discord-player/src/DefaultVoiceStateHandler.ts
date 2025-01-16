import { ChannelType, VoiceState } from 'discord.js';
import { GuildQueue, GuildQueueEvent } from './queue';
import { Player } from './Player';
import { Util } from './utils/Util';

function handleEmptyChannel(
  player: Player,
  queue: GuildQueue,
  guildId: string,
) {
  const timeout = setTimeout(() => {
    if (!Util.isVoiceEmpty(queue.channel!) || !player.nodes.has(queue.guild.id))
      return;
    if (queue.options.leaveOnEmpty) queue.delete();
    player.events.emit(GuildQueueEvent.EmptyChannel, queue);
  }, queue.options.leaveOnEmptyCooldown || 0).unref();
  queue.timeouts.set(`empty_${guildId}`, timeout);
}

function handleChannelPopulate(
  player: Player,
  queue: GuildQueue,
  guildId: string,
) {
  const emptyTimeout = queue.timeouts.get(`empty_${guildId}`);
  if (!Util.isVoiceEmpty(queue.channel!) && emptyTimeout) {
    clearTimeout(emptyTimeout);
    queue.timeouts.delete(`empty_${guildId}`);
    player.events.emit(GuildQueueEvent.ChannelPopulate, queue);
  }
}

function handlePauseOnEmpty(queue: GuildQueue) {
  const isEmpty = Util.isVoiceEmpty(queue.channel!);
  const wasPausedOnEmpty = Reflect.get(queue, '__pausedOnEmpty');

  if (isEmpty && !wasPausedOnEmpty) {
    queue.node.setPaused(true);
    Reflect.set(queue, '__pausedOnEmpty', true);
    if (queue.hasDebugger) {
      queue.debug(
        'Voice channel is empty and options#pauseOnEmpty is true, pausing...',
      );
    }
  } else if (!isEmpty && wasPausedOnEmpty) {
    queue.node.setPaused(false);
    Reflect.set(queue, '__pausedOnEmpty', false);
    if (queue.hasDebugger) {
      queue.debug(
        'Voice channel is not empty and options#pauseOnEmpty is true, resuming...',
      );
    }
  }
}

function handleBotVoiceStateUpdate(
  queue: GuildQueue,
  oldState: VoiceState,
  newState: VoiceState,
) {
  if (
    newState.serverMute != null &&
    oldState.serverMute !== newState.serverMute
  ) {
    queue.node.setPaused(newState.serverMute);
    return;
  }

  if (
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

export async function defaultVoiceStateHandler(
  player: Player,
  queue: GuildQueue,
  oldState: VoiceState,
  newState: VoiceState,
) {
  if (!queue?.connection || !queue.channel) return;

  const isBotState = newState.member?.id === newState.guild.members.me?.id;
  const guildId = oldState.guild.id;

  // Bot disconnected
  if (isBotState && oldState.channelId && !newState.channelId) {
    try {
      queue.delete();
    } catch {
      /* noop */
    }
    return void player.events.emit(GuildQueueEvent.Disconnect, queue);
  }

  if (queue.options.pauseOnEmpty) {
    handlePauseOnEmpty(queue);
  }

  // Bot joined channel or changed state
  if (
    isBotState &&
    newState.channelId &&
    (!oldState.channelId || oldState.channelId !== newState.channelId)
  ) {
    if (queue.connection) queue.channel = newState.channel!;
    handleBotVoiceStateUpdate(queue, oldState, newState);
  }

  // Handle channel empty/populate events
  if (!newState.channelId && oldState.channelId === queue.channel.id) {
    if (!Util.isVoiceEmpty(queue.channel)) return;
    handleEmptyChannel(player, queue, guildId);
  } else if (newState.channelId === queue.channel.id) {
    handleChannelPopulate(player, queue, guildId);
  } else if (oldState.channelId !== newState.channelId) {
    if (
      newState.channelId !== queue.channel.id &&
      !Util.isVoiceEmpty(queue.channel)
    )
      return;
    if (!queue.timeouts.has(`empty_${guildId}`)) {
      handleEmptyChannel(player, queue, guildId);
    }
  }
}
