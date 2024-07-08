import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { WorkerAckOp, WorkerOp } from '../common/constants';
import { AudioNodeManager } from './node/AudioNodeManager';
import { WorkerMessage, WorkerMessageAck, WorkerMessagePayload } from '../common/types';

const { STATS_DISPATCH_INTERVAL, KEEP_ALIVE } = workerData;

export class WorkerListener {
    private readonly audioNodes: AudioNodeManager;
    private statsClock: NodeJS.Timeout | null = null;

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

        this.createStatsClock();
    }

    private createStatsClock() {
        // ignore invalid cases
        if (typeof STATS_DISPATCH_INTERVAL !== 'number' || Number.isNaN(STATS_DISPATCH_INTERVAL)) return;

        if (this.statsClock) clearInterval(this.statsClock);

        this.statsClock = setInterval(() => {
            this.send({
                t: WorkerAckOp.OP_EVT_STATS,
                d: {
                    memoryUsed: process.memoryUsage().heapUsed,
                    subscriptions: this.audioNodes.nodes.size,
                },
            });
        }, STATS_DISPATCH_INTERVAL);

        if (KEEP_ALIVE !== true) {
            this.statsClock.unref();
        }
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
                return this.send({ t: WorkerAckOp.OP_ACK_PING, d: null });
            case assertPayload(message, WorkerOp.OP_JOIN_VOICE_CHANNEL):
                return this.audioNodes.connect(message.d);
            case assertPayload(message, WorkerOp.OP_VOICE_SERVER_UPDATE): {
                const adapter = this.audioNodes.transmitters.get(message.d.guild_id);
                if (!adapter) return;
                adapter.onVoiceServerUpdate(message.d);
                return;
            }
            case assertPayload(message, WorkerOp.OP_VOICE_STATE_UPDATE): {
                const adapter = this.audioNodes.transmitters.get(message.d.guild_id as string);
                if (!adapter) return;
                adapter.onVoiceStateUpdate(message.d);
                return;
            }
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
