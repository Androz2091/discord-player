import { ServicePayload } from '../../classes/PlayerNodeManager';
import { WorkerEvents, WorkerOp } from '../../utils/enums';
import { SubscriptionClient } from '../SubscriptionClient';
import { BaseAction } from './base/BaseAction';

class CreateSubscription extends BaseAction {
    public actionName = WorkerOp.CREATE_SUBSCRIPTION;

    public handle(data: ServicePayload) {
        if (this.isSubscribed(data)) return;
        const client = new SubscriptionClient(data.d.client_id);
        this.setClient(data, client);
        this.notify({
            t: WorkerEvents.SUBSCRIPTION_CREATE,
            d: {
                client_id: data.d.client_id,
                guild_id: data.d.guild_id
            }
        });
    }
}

export default new CreateSubscription();
