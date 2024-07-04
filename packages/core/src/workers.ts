import { Worker } from 'node:worker_threads';
import { Collection, EventEmitter } from '@discord-player/utils';

interface IWorkerStats {
    memoryUsed: number;
    subscriptions: number;
}

interface WorkerInfo {
    worker: Worker;
    lastAccess: number;
    estimatedClients: number;
    stats: IWorkerStats;
}

export enum WorkerDistributionMode {
    Balanced = 'balanced',
    LeastLoad = 'least-load',
    Random = 'random'
}

export interface WorkerConfig {
    maxWorkers: number;
    distributionMode: WorkerDistributionMode;
}

export interface WorkerEvents {
    error: (error: Error) => void;
    exit: () => void;
    ready: () => void;
}

export class WorkerManager extends EventEmitter<WorkerEvents> {
    private workers = new Collection<number, WorkerInfo>();

    public constructor(public readonly config: WorkerConfig) {
        super();
    }

    public getOptimalWorker(): WorkerInfo | undefined {
        if (this.workers.size === 0) return undefined;

        switch (this.config.distributionMode) {
            case WorkerDistributionMode.LeastLoad:
                return this.workers.sort((a, b) => a.stats.memoryUsed - b.stats.memoryUsed).first();
            case WorkerDistributionMode.Balanced:
                return this.workers.sort((a, b) => a.estimatedClients - b.estimatedClients).first();
            case WorkerDistributionMode.Random:
                return this.workers.random();
        }
    }

    public canCreateWorker(): boolean {
        return this.workers.size < this.config.maxWorkers;
    }

    public create() {
        if (!this.canCreateWorker()) return this.getOptimalWorker()!;

        const thread = new Worker('./worker/entrypoint.js');

        thread.on('online', () => {
            this.emit('ready');
        });

        thread.on('error', (error) => {
            void error;
        });

        thread.once('exit', () => {
            this.workers.delete(thread.threadId);
        });

        const workerInfo: WorkerInfo = {
            worker: thread,
            estimatedClients: 0,
            stats: {
                memoryUsed: 0,
                subscriptions: 0
            },
            lastAccess: Date.now()
        };

        this.workers.set(thread.threadId, workerInfo);

        return workerInfo;
    }
}
