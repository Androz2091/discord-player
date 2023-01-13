import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { Collection, EventEmitter } from '@discord-player/utils';
import { WorkerEvents, WorkerOp } from '../utils/enums';

interface PlayerNodeConfig {
    max?: number | 'auto';
    respawn?: boolean;
}

interface BasicSubscription {
    guild_id: string;
    client_id: string;
}

type WorkerResolvable = number | Worker;

export interface PlayerNodeEvents {
    error: (worker: Worker, error: Error) => Awaited<void>;
    message: (worker: Worker, message: unknown) => Awaited<void>;
    spawn: (worker: Worker) => Awaited<void>;
    debug: (message: string) => Awaited<void>;
    voiceStateUpdate: (worker: Worker, payload: any) => Awaited<void>;
    subscriptionCreate: (worker: Worker, payload: BasicSubscription) => Awaited<void>;
    subscriptionDelete: (worker: Worker, payload: BasicSubscription) => Awaited<void>;
}

export interface ServicePayload<T = unknown> {
    op: keyof typeof WorkerOp;
    d: {
        guild_id: string;
        client_id: string;
    } & T;
}

export interface WorkerPayload<T = unknown> {
    t: keyof typeof WorkerEvents;
    d: T;
}

export class PlayerNodeManager extends EventEmitter<PlayerNodeEvents> {
    public workers = new Collection<number, Worker>();
    public constructor(public config: PlayerNodeConfig) {
        super();
    }

    #debug(message: string) {
        this.emit('debug', `[${this.constructor.name} | ${new Date().toLocaleString()}] ${message}`);
    }

    public get maxThreads() {
        const conf = this.config.max;
        if (conf === 'auto') return cpus().length;
        if (typeof conf !== 'number' || Number.isNaN(conf) || conf < 1 || !Number.isFinite(conf)) return 1;
        return conf;
    }

    public get spawnable() {
        return this.workers.size < this.maxThreads;
    }

    // TODO
    public getLeastBusy() {
        return;
    }

    public send(workerRes: WorkerResolvable, data: ServicePayload) {
        const worker = this.resolveWorker(workerRes);
        if (!worker) throw new Error('Worker does not exist');
        this.#debug(`Sending ${JSON.stringify(data)} to thread ${worker.threadId}`);
        worker.postMessage(data);
    }

    public spawn() {
        return new Promise<Worker>((resolve) => {
            if (!this.spawnable) return resolve(this.workers.random()!);

            const worker = new Worker(join(__dirname, '..', 'worker', 'worker.js'));
            this.#debug(`Spawned worker at thread ${worker.threadId}`);

            worker.on('online', () => {
                this.#debug(`worker ${worker.threadId} is online`);
                this.workers.set(worker.threadId, worker);
                this.emit('spawn', worker);
                return resolve(worker);
            });

            worker.on('message', (message: WorkerPayload) => {
                this.#debug(`Incoming message from worker ${worker.threadId}\n\n${JSON.stringify(message)}`);
                switch (message.t) {
                    case WorkerEvents.VOICE_STATE_UPDATE: {
                        return this.emit('voiceStateUpdate', worker, message.d);
                    }
                    case WorkerEvents.ERROR: {
                        return this.emit('error', worker, new Error((message.d as any).message));
                    }
                    case WorkerEvents.SUBSCRIPTION_CREATE: {
                        return this.emit('subscriptionCreate', worker, message.d as BasicSubscription);
                    }
                    case WorkerEvents.SUBSCRIPTION_DELETE: {
                        return this.emit('subscriptionDelete', worker, message.d as BasicSubscription);
                    }
                    default: {
                        return this.emit('message', worker, message);
                    }
                }
            });

            worker.on('exit', () => {
                this.#debug(`Worker terminated at thread ${worker.threadId}`);
                this.workers.delete(worker.threadId);
            });

            worker.on('error', (error) => {
                this.#debug(`Incoming error message from worker ${worker.threadId}\n\n${JSON.stringify(error)}`);
                this.emit('error', worker, error);
            });
        });
    }

    public resolveWorker(worker: WorkerResolvable) {
        if (typeof worker === 'number') return this.workers.get(worker);
        return this.workers.find((res) => res.threadId === worker.threadId);
    }

    public async terminate(worker?: WorkerResolvable) {
        if (worker) {
            const internalWorker = this.resolveWorker(worker);
            if (internalWorker) {
                this.#debug(`Terminating worker ${internalWorker.threadId}...`);
                await internalWorker.terminate();
                this.workers.delete(internalWorker.threadId);
            }
        } else {
            for (const [id, thread] of this.workers) {
                this.#debug(`Terminating worker ${thread.threadId}...`);
                await thread.terminate();
                this.workers.delete(id);
            }
        }
    }
}
