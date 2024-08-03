import { type WorkerConfig, WorkerManager } from './workers';

export async function bootstrap(config: WorkerConfig) {
    const manager = new WorkerManager(config);
    return manager;
}

export * from './workers';
export * from './common/constants';
export * from './common/types';
export * from './worker/node/AudioNode';
export * from './worker/node/AudioNodeManager';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
