import { EventEmitter } from '@discord-player/utils';
import type { PlayerNode } from '../PlayerNode';

export interface ConnectorEvents {
    ready: () => Awaited<unknown>;
    close: () => Awaited<unknown>;
    error: (error: Error) => Awaited<unknown>;
}

export abstract class Connector extends EventEmitter<ConnectorEvents> {
    /**
     * Creates a new connector.
     * @param node - The player node instance
     */
    public constructor(public readonly node: PlayerNode) {
        super();
    }

    /**
     * Connects to the node.
     */
    public abstract connect(): Promise<void>;
    /**
     * Disconnects from the node.
     */
    public abstract disconnect(): Promise<void>;
    /**
     * Whether the node is connected.
     */
    public abstract isConnected(): boolean;
    /**
     * Send a packet to the node.
     * @param data - The data to send
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public abstract send(data: any): Promise<void>;
}
