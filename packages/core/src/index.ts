import { type WorkerConfig, WorkerManager } from './workers';

export async function createWorker(config: WorkerConfig) {
    const manager = new WorkerManager(config);
    return manager;
}

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
