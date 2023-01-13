import { parentPort } from 'node:worker_threads';
import { WorkerPayload } from '../classes/PlayerNodeManager';

export function notify(data: WorkerPayload) {
    parentPort?.postMessage(data);
}
