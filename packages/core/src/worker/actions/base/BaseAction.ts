import { ServicePayload, WorkerPayload } from '../../../classes/PlayerNodeManager';
import { clients } from '../../../utils/clients';
import { WorkerOp } from '../../../utils/enums';
import { notify } from '../../notifier';
import { SubscriptionClient } from '../../SubscriptionClient';

export class BaseAction {
    public clients = clients;
    public actionName!: keyof typeof WorkerOp;

    public getClient(data: ServicePayload) {
        return this.clients.get(data.d.client_id);
    }

    public setClient(data: ServicePayload, client: SubscriptionClient) {
        return this.clients.set(data.d.client_id, client);
    }

    public deleteClient(data: ServicePayload) {
        return this.clients.delete(data.d.client_id);
    }

    public isSubscribed(data: ServicePayload) {
        return this.clients.has(data.d.client_id);
    }

    public handle(data: ServicePayload) {}

    public notify(data: WorkerPayload) {
        notify(data);
    }
}
