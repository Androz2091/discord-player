import { Worker } from 'node:worker_threads';
import { Collection, EventEmitter } from '@discord-player/utils';
import { WorkerMessage, WorkerMessageAck, WorkerMessagePayload, WorkerMessagePayloadAck } from './common/types';
import { WorkerAckOp, WorkerOp } from './common/constants';

export interface IWorkerMessage<T> {
    metadata: {
        clientId: string;
        channelId: string;
        guildId: string;
    };
    payload: T;
}

export interface IWorkerStats {
    memoryUsed: number;
    subscriptions: number;
}

export interface IClientInformation {
    clientId: string;
    guildId: string;
    channelId: string;
}

/**
 * A collection of clients. The root key is the client id, the second key is the channel id and the value is the client information.
 */
export type IClientCollection = Collection<string, Collection<string, IClientInformation>>;

export interface WorkerInfo {
    worker: Worker;
    lastAccess: number;
    clients: IClientCollection;
    stats: IWorkerStats;
}

export enum WorkerDistributionMode {
    Balanced = 'balanced',
    LeastLoad = 'least-load',
    Random = 'random',
}

export interface WorkerConfig {
    maxWorkers: number;
    distributionMode: WorkerDistributionMode;
    statsDispatchInterval?: number;
}

export interface WorkerEvents {
    error: (error: Error) => void;
    payload: (payload: WorkerMessageAck<WorkerMessagePayloadAck[WorkerAckOp.OP_EVT_GATEWAY_DISPATCH]>) => void;
    debug: (data: string) => void;
}

export type AnyWorkerPayload = IWorkerMessage<WorkerMessage<WorkerMessagePayload[keyof WorkerMessagePayload]>>;

const WorkerCreatable = new Set([WorkerOp.OP_JOIN_VOICE_CHANNEL]);
const STATS_DISPATCH_INTERVAL = 5000;

const assertPayload = <T extends WorkerAckOp>(
    message: WorkerMessageAck<unknown>,
    t: T,
): message is WorkerMessageAck<WorkerMessagePayloadAck[T]> => {
    return message.t === t;
};

export class WorkerManager extends EventEmitter<WorkerEvents> {
    /**
     * The workers collection.
     */
    private workers = new Collection<number, WorkerInfo>();

    /**
     * Creates a new worker manager.
     * @param config The worker configuration.
     */
    public constructor(public readonly config: WorkerConfig) {
        super();
    }

    /**
     * Write a debug message.
     * @param data The data to write.
     */
    public debug(data: string) {
        this.emit('debug', data);
    }

    /**
     * Returns The optimal worker.
     */
    public getOptimalWorker(): WorkerInfo | undefined {
        if (this.workers.size === 0) return undefined;

        switch (this.config.distributionMode) {
            case WorkerDistributionMode.LeastLoad:
                return this.workers.sort((a, b) => a.stats.memoryUsed - b.stats.memoryUsed).first();
            case WorkerDistributionMode.Balanced:
                return this.workers.sort((a, b) => a.clients.size - b.clients.size).first();
            case WorkerDistributionMode.Random:
                return this.workers.random();
        }
    }

    /**
     * Whether a new worker can be created.
     */
    public canCreateWorker(): boolean {
        return this.workers.size < this.config.maxWorkers;
    }

    /**
     * Create a new worker if needed.
     * @param [op] The operation to create the worker for.
     * @returns The worker info.
     */
    public create(op?: WorkerOp) {
        if (op != null && !WorkerCreatable.has(op)) return;
        if (!this.canCreateWorker()) return this.getOptimalWorker()!;

        const thread = new Worker('./worker/entrypoint.js', {
            workerData: {
                STATS_DISPATCH_INTERVAL: this.config.statsDispatchInterval ?? STATS_DISPATCH_INTERVAL,
                KEEP_ALIVE: true,
            },
        });

        thread.on('message', this.handleWorkerMessage.bind(this));

        thread.on('online', () => {
            this.debug(`Worker ${thread.threadId} is online`);
        });

        thread.on('error', (error) => {
            this.debug(`Worker ${thread.threadId} encountered an error: ${error.message}`);
        });

        thread.once('exit', () => {
            this.debug(`Worker ${thread.threadId} exited`);
            this.workers.delete(thread.threadId);
        });

        const workerInfo: WorkerInfo = {
            worker: thread,
            clients: new Collection(),
            stats: {
                memoryUsed: 0,
                subscriptions: 0,
            },
            lastAccess: Date.now(),
        };

        this.workers.set(thread.threadId, workerInfo);

        return workerInfo;
    }

    /**
     * Handle a message from the worker.
     * @param message The message to handle.
     */
    public handleWorkerMessage(message: WorkerMessageAck<WorkerMessagePayloadAck>) {
        switch (true) {
            case assertPayload(message, WorkerAckOp.OP_EVT_GATEWAY_DISPATCH):
                return this.emit('payload', message);
            case assertPayload(message, WorkerAckOp.OP_EVT_DEBUG):
                // eslint-disable-next-line no-console
                return console.log(message.d.data);
        }
    }

    /**
     * Find the worker associated with the client and channel.
     * @param clientId The client id.
     * @param channelId The channel id.
     * @returns The worker info.
     */
    public findAssociatedWorker(clientId: string, channelId: string): WorkerInfo | undefined {
        return this.workers.find((worker) => !!worker.clients.get(clientId)?.has(channelId));
    }

    /**
     * Send a message to the worker.
     * @param message The message to send.
     */
    public send<Op extends WorkerOp>(message: IWorkerMessage<WorkerMessage<WorkerMessagePayload[Op]>>) {
        const { metadata, payload } = message;

        const worker = this.findAssociatedWorker(metadata.clientId, metadata.channelId) || this.create(payload.op);

        if (!worker) return;

        worker.worker.postMessage(payload);
    }

    /**
     * Send a message to all workers.
     * @param message The message to send.
     */
    public broadcast<Op extends WorkerOp>(message: IWorkerMessage<WorkerMessage<WorkerMessagePayload[Op]>>) {
        const { payload } = message;

        for (const worker of this.workers.values()) {
            worker.worker.postMessage(payload);
        }
    }
}
