import { Connector } from './Connector';

export class IPC extends Connector {
    public connect(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    public disconnect(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    public isConnected(): boolean {
        throw new Error('Method not implemented.');
    }

    public send(): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
