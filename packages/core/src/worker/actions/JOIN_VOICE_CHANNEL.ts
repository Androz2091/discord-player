import { ServicePayload } from '../../classes/PlayerNodeManager';
import { WorkerOp } from '../../utils/enums';
import { BaseAction } from './base/BaseAction';

export interface JoinPayload {
    channel_id: string;
    self_deaf?: boolean;
}

class JoinVoiceChannel extends BaseAction {
    public actionName = WorkerOp.JOIN_VOICE_CHANNEL;

    public async handle(data: ServicePayload<JoinPayload>) {
        const client = this.getClient(data);
        if (client)
            await client.connect({
                channelId: data.d.channel_id,
                guildId: data.d.guild_id,
                deafen: data.d.self_deaf
            });
    }
}

export default new JoinVoiceChannel();
