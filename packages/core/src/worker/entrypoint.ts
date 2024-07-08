import { isMainThread, parentPort } from 'node:worker_threads';
import { WorkerAckOp, WorkerOp } from '../common/constants';
import { AudioNodeManager } from './node/AudioNodeManager';
import { VoiceConnectionCreateOptions } from './node/AudioNode';

interface WorkerMessage<T> {
    op: WorkerOp;
    d: T;
}

interface WorkerMessageAck<T> {
    op: WorkerAckOp;
    d: T;
}

interface WorkerMessagePayload {
    [WorkerOp.OP_PING]: null;
    [WorkerOp.OP_JOIN_VOICE_CHANNEL]: VoiceConnectionCreateOptions;
}

export class WorkerListener {
    private readonly audioNodes: AudioNodeManager;

    public constructor() {
        if (!parentPort) throw new Error('This script must be run as a worker');

        this.audioNodes = new AudioNodeManager(this);

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
        switch (true) {
            case assertPayload(message, WorkerOp.OP_PING):
                return this.send({ op: WorkerAckOp.OP_ACK_PING, d: null });
            case assertPayload(message, WorkerOp.OP_JOIN_VOICE_CHANNEL):
                return this.audioNodes.connect(message.d);
        }
    }
}

const assertPayload = <Op extends WorkerOp>(
    message: WorkerMessage<unknown>,
    op: Op,
): message is WorkerMessage<WorkerMessagePayload[Op]> => {
    return message.op === op;
};

if (!isMainThread) {
    new WorkerListener();
}
