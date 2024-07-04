import { isMainThread, parentPort } from 'node:worker_threads';
import { WorkerAckOp, WorkerOp } from '../common/constants';

interface WorkerMessage<T> {
    op: WorkerOp;
    d: T;
}

interface WorkerMessageAck<T> {
    op: WorkerAckOp;
    d: T;
}

class WorkerListener {
    public constructor() {
        if (!parentPort) throw new Error('This script must be run as a worker');

        parentPort.on('message', async (message) => {
            try {
                this.validate(message);
                await this.handleMessage(message);
            } catch {
                //
            }
        });
    }

    private validate(message: WorkerMessage<unknown>) {
        if (!('op' in message) || !('d' in message)) throw new Error('Invalid message format');
        if (!(message.op in WorkerOp)) throw new Error('Invalid operation code');

        return true;
    }

    private send<T>(message: WorkerMessageAck<T>) {
        parentPort!.postMessage(message);
    }

    private async handleMessage(message: WorkerMessage<unknown>) {
        switch (message.op) {
            case WorkerOp.OP_PING:
                return this.send({ op: WorkerAckOp.OP_ACK_PING, d: null });
        }
    }
}

if (!isMainThread) {
    new WorkerListener();
}
