import { ServicePayload } from '../../classes/PlayerNodeManager';
import { WorkerEvents, WorkerOp } from '../../utils/enums';
import { BaseAction } from './base/BaseAction';

class DeleteSubscription extends BaseAction {
    public actionName = WorkerOp.DELETE_SUBSCRIPTION;

    public handle(data: ServicePayload) {
        const client = this.getClient(data);
        if (client) {
            client.disconnectAll();
            this.deleteClient(data);
            this.notify({
                t: WorkerEvents.SUBSCRIPTION_DELETE,
                d: {
                    client_id: client.clientId,
                    guild_id: data.d.guild_id
                }
            });
        }
    }
}

export default new DeleteSubscription();
