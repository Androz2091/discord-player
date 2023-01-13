import { ServicePayload } from '../../classes/PlayerNodeManager';
import { WorkerOp } from '../../utils/enums';
import { BaseAction } from './base/BaseAction';

export interface PlayPayload {
    query: string;
    metadata: unknown;
    initial_volume?: number;
}

class Play extends BaseAction {
    public actionName = WorkerOp.PLAY;

    public async handle(data: ServicePayload<PlayPayload>) {
        const client = this.getClient(data);
        if (!client) return;
        const node = client.subscriptions.get(data.d.guild_id);
        if (node) {
            const { query, metadata, initial_volume } = data.d;
            node.play({ query, metadata, initialVolume: initial_volume });
        }
    }
}

export default new Play();
