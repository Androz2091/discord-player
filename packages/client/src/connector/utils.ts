import type { RawData } from 'ws';

export function decode<T>(data: RawData): T {
    const string = data.toString('utf-8');
    return JSON.parse(string) as T;
}
