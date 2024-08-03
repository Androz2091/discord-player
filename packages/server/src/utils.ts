import type { RawData, WebSocket } from 'ws';

export function createClient(client: WebSocket, id: string) {
    Reflect.set(client, '__id', id);
    return client;
}

export function getClientId(client: WebSocket) {
    return Reflect.get(client, '__id');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createErrorSafe<T extends (...args: any[]) => any>(fn: T, onError?: (error: Error) => void) {
    return (...args: Parameters<T>) => {
        try {
            return fn(...args);
        } catch (error) {
            onError?.(error as Error);
        }
    };
}

export function decode<T>(data: RawData): T {
    const string = data.toString('utf-8');
    return JSON.parse(string) as T;
}
