import { ServicePayload } from '../../classes/PlayerNodeManager';
import { WorkerOp } from '../../utils/enums';
import { BaseAction } from './base/BaseAction';
import { GatewayDispatchEvents } from 'discord-api-types/v10';

class JoinVoiceChannel extends BaseAction {
    public actionName = WorkerOp.GATEWAY_PAYLOAD;

    public async handle(data: ServicePayload<any>) {
        const client = this.getClient(data);
        if (!client) return;
        const adapter = client.adapters.get(data.d.payload.d.guild_id);
        if (!adapter) return;
        const message = data.d.payload;
        if (message.t === GatewayDispatchEvents.VoiceServerUpdate) {
            adapter.onVoiceServerUpdate(message.d);
        } else if (message.t === GatewayDispatchEvents.VoiceStateUpdate && message.d.session_id && message.d.user_id === client.clientId) {
            adapter.onVoiceStateUpdate(message.d);
        }
    }
}

export default new JoinVoiceChannel();
