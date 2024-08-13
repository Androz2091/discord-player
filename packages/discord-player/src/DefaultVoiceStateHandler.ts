import { ChannelType, GatewayVoiceState } from 'discord-api-types/v10';
import { Channel } from './clientadapter/IClientAdapter';
import { Player } from './Player';
import { GuildQueue, GuildQueueEvent } from './queue';
import { Util } from './utils/Util';

export async function defaultVoiceStateHandler(player: Player, queue: GuildQueue, oldState: GatewayVoiceState, newState: GatewayVoiceState) {
    if (!queue || !queue.connection || !queue.channel) return;

    const clientUserId = player.clientAdapter.getClientUserId();

    handleDisconnection(clientUserId, oldState, newState, queue, player);
    handlePauseOnEmptyState(queue);
    handleVoiceChannelUpdates(player, clientUserId, oldState, newState, queue);
    handleChannelPopulationAndDeletion(oldState, newState, queue, player);
}

function handleDisconnection(clientUserId: string, oldState: GatewayVoiceState, newState: GatewayVoiceState, queue: GuildQueue, player: Player) {
    if (oldState.channel_id && !newState.channel_id && newState.member?.user?.id === clientUserId) {
        try {
            queue.delete();
        } catch {
            Util.noop();
        }
        player.events.emit(GuildQueueEvent.disconnect, queue);
    }
}

function handlePauseOnEmptyState(queue: GuildQueue) {
    if (queue.options.pauseOnEmpty) {
        const isEmpty = Util.isVoiceEmpty(queue.channel!);
        const isPausedOnEmpty = Reflect.get(queue, '__pausedOnEmpty');

        if (isEmpty) {
            queue.node.setPaused(true);
            Reflect.set(queue, '__pausedOnEmpty', true);
            debugLog(queue, 'pausing');
        } else if (isPausedOnEmpty) {
            queue.node.setPaused(false);
            Reflect.set(queue, '__pausedOnEmpty', false);
            debugLog(queue, 'resuming');
        }
    }
}

function handleVoiceChannelUpdates(player: Player, clientUserId: string, oldState: GatewayVoiceState, newState: GatewayVoiceState, queue: GuildQueue) {
    const newStateChannel = player.clientAdapter.getChannel(newState.channel_id!);
    if (!newStateChannel) return;

    if (!oldState.channel_id && newState.channel_id && newState.member?.user?.id === clientUserId) {
        handleMuteAndSuppressChanges(oldState, newState, queue, newStateChannel);
    }
}

function handleMuteAndSuppressChanges(oldState: GatewayVoiceState, newState: GatewayVoiceState, queue: GuildQueue, newStateChannel: Channel) {
    if (newState.mute != null && oldState.mute !== newState.mute) {
        queue.node.setPaused(newState.mute);
    } else if (newStateChannel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
        queue.node.setPaused(newState.suppress);
        if (newState.suppress) {
            newStateChannel.clientUser.requestToSpeak().catch(Util.noop);
        }
    }
}

function handleChannelPopulationAndDeletion(oldState: GatewayVoiceState, newState: GatewayVoiceState, queue: GuildQueue, player: Player) {
    manageTimeoutsOnChannelChange(oldState, newState, queue, player);
}

function manageTimeoutsOnChannelChange(oldState: GatewayVoiceState, newState: GatewayVoiceState, queue: GuildQueue, player: Player) {
    const channelEmpty = Util.isVoiceEmpty(queue.channel!);

    if (!newState.channel_id && oldState.channel_id === queue.channel!.id && channelEmpty) {
        setEmptyTimeout(queue, oldState, player);
    } else if (newState.channel_id && newState.channel_id === queue.channel!.id) {
        clearEmptyTimeout(queue, oldState, player);
    }
}

function setEmptyTimeout(queue: GuildQueue, oldState: GatewayVoiceState, player: Player) {
    const timeout = setTimeout(() => {
        if (Util.isVoiceEmpty(queue.channel!) && player.nodes.has(queue.guild.id) && queue.options.leaveOnEmpty) {
            queue.delete();
            player.events.emit(GuildQueueEvent.emptyChannel, queue);
        }
    }, queue.options.leaveOnEmptyCooldown || 0).unref();
    const timeoutKey = `empty_${oldState.guild_id}`;
    queue.timeouts.set(timeoutKey, timeout);
}

function clearEmptyTimeout(queue: GuildQueue, oldState: GatewayVoiceState, player: Player) {
    const timeoutKey = `empty_${oldState.guild_id}`;
    const emptyTimeout = queue.timeouts.get(timeoutKey);
    if (emptyTimeout) {
        clearTimeout(emptyTimeout);
        queue.timeouts.delete(timeoutKey);
        player.events.emit(GuildQueueEvent.channelPopulate, queue);
    }
}

function debugLog(queue: GuildQueue, message: string) {
    if (queue.hasDebugger) {
        queue.debug(`Voice channel state change: ${message}`);
    }
}
