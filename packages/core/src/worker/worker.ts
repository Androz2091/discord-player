import type { ServicePayload } from '../classes/PlayerNodeManager';
import { WorkerEvents } from '../utils/enums';
import type { BaseAction } from './actions/base/BaseAction';
import { notify } from './notifier';
import { parentPort } from 'node:worker_threads';

parentPort?.on('message', async (message: ServicePayload) => {
    const action = getAction(message.op);
    if (action) {
        try {
            return void (await action.handle(message));
        } catch (e) {
            return notify({
                t: WorkerEvents.ERROR,
                d: {
                    message: `${(e as any).stack || e}`
                }
            });
        }
    }
});

function getAction(op: string) {
    try {
        const action = require(`${__dirname}/actions/${op}`);
        return (action.default || action) as BaseAction;
    } catch {
        return null;
    }
}
