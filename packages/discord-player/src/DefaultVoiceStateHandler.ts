import { GuildQueue, GuildQueueEvent } from './queue';
import { Player } from './Player';
import { Util } from './utils/Util';
import { GatewayVoiceState } from 'discord-api-types/v9';
import { VoiceBasedChannel } from './clientadapter/IClientAdapter';
import { ChannelType } from 'discord-api-types/v10';

export async function defaultVoiceStateHandler(player: Player, queue: GuildQueue, oldState: GatewayVoiceState, newState: GatewayVoiceState) {
    if (!queue || !queue.connection || !queue.channel) return;

    const clientUserId = player.clientAdapter.getClientUserId();

    if (oldState.channel_id && !newState.channel_id && newState.member?.user?.id === clientUserId) {
        try {
            queue.delete();
        } catch {
            Util.noop();
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

    const newStateChannel = player.clientAdapter.getChannel(newState.channel_id!);
    if (!oldState.channel_id && newState.channel_id && newState.member?.user?.id === clientUserId) {
        if (newState.mute != null && oldState.mute !== newState.mute) {
            queue.node.setPaused(newState.mute);
        } else if (newStateChannel?.type === ChannelType.GuildStageVoice && newState.suppress != null && oldState.suppress !== newState.suppress) {
            queue.node.setPaused(newState.suppress);
            if (newState.suppress) {
                newStateChannel.clientUser.requestToSpeak().catch(Util.noop);
            }
        }
    }

    if (!newState.channel_id && oldState.channel_id === queue.channel.id) {
        if (!Util.isVoiceEmpty(queue.channel)) return;
        const timeout = setTimeout(() => {
            if (!Util.isVoiceEmpty(queue.channel!)) return;
            if (!player.nodes.has(queue.guild.id)) return;
            if (queue.options.leaveOnEmpty) queue.delete();
            player.events.emit(GuildQueueEvent.emptyChannel, queue);
        }, queue.options.leaveOnEmptyCooldown || 0).unref();
        queue.timeouts.set(`empty_${oldState.guild_id}`, timeout);
    }

    if (newState.channel_id && newState.channel_id === queue.channel.id) {
        const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild_id}`);
        const channelEmpty = Util.isVoiceEmpty(queue.channel);
        if (!channelEmpty && emptyTimeout) {
            clearTimeout(emptyTimeout);
            queue.timeouts.delete(`empty_${oldState.guild_id}`);
            player.events.emit(GuildQueueEvent.channelPopulate, queue);
        }
    }

    if (oldState.channel_id && newState.channel_id && oldState.channel_id !== newState.channel_id) {
        if (newState.member?.user?.id === clientUserId) {
            if (queue.connection && newState.member?.user?.id === clientUserId) {
                const newQueueChannel = player.clientAdapter.getChannel(newState.channel_id);
                queue.channel! = newQueueChannel as VoiceBasedChannel;
            }
            const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild_id}`);
            const channelEmpty = Util.isVoiceEmpty(queue.channel!);
            if (!channelEmpty && emptyTimeout) {
                clearTimeout(emptyTimeout);
                queue.timeouts.delete(`empty_${oldState.guild_id}`);
                player.events.emit(GuildQueueEvent.channelPopulate, queue);
            } else {
                const timeout = setTimeout(() => {
                    if (queue.connection && !Util.isVoiceEmpty(queue.channel!)) return;
                    if (!player.nodes.has(queue.guild.id)) return;
                    if (queue.options.leaveOnEmpty) queue.delete();
                    player.events.emit(GuildQueueEvent.emptyChannel, queue);
                }, queue.options.leaveOnEmptyCooldown || 0).unref();
                queue.timeouts.set(`empty_${oldState.guild_id}`, timeout);
            }
        } else {
            if (newState.channel_id !== queue.channel.id) {
                const channelEmpty = Util.isVoiceEmpty(queue.channel!);
                if (!channelEmpty) return;
                if (queue.timeouts.has(`empty_${oldState.guild_id}`)) return;
                const timeout = setTimeout(() => {
                    if (!Util.isVoiceEmpty(queue.channel!)) return;
                    if (!player.nodes.has(queue.guild.id)) return;
                    if (queue.options.leaveOnEmpty) queue.delete();
                    player.events.emit(GuildQueueEvent.emptyChannel, queue);
                }, queue.options.leaveOnEmptyCooldown || 0).unref();
                queue.timeouts.set(`empty_${oldState.guild_id}`, timeout);
            } else {
                const emptyTimeout = queue.timeouts.get(`empty_${oldState.guild_id}`);
                const channelEmpty = Util.isVoiceEmpty(queue.channel!);
                if (!channelEmpty && emptyTimeout) {
                    clearTimeout(emptyTimeout);
                    queue.timeouts.delete(`empty_${oldState.guild_id}`);
                    player.events.emit(GuildQueueEvent.channelPopulate, queue);
                }
            }
        }
    }
}
