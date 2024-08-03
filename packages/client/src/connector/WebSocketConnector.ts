import { WebSocket } from 'ws';
import { Connector } from './Connector';
import { decode } from './utils';
import { ClientMessage, WebsocketMessage, WsIncomingCodes, WsOutgoingCodes } from '@discord-player/server';

export class WebSocketConnector extends Connector {
    public ws: WebSocket | null = null;

    /**
     * Connects to the node.
     */
    public async connect(): Promise<void> {
        await this.disconnect();

        this.ws = new WebSocket(this.node.getWebSocketURL(), {
            headers: {
                Authorization: this.node.getConfig().password,
            },
        });

        this.ws.on('open', this.handleConnection.bind(this));
    }

    /**
     * Handles the connection event.
     */
    public handleConnection(socket: WebSocket): void {
        socket.on('message', (data) => {
            const message = decode<WebsocketMessage>(data);

            switch (message.op) {
                case WsOutgoingCodes.Hello: {
                    this.send({
                        op: WsIncomingCodes.Identify,
                        d: {
                            id: this.node.getConfig().clientId,
                        },
                    });
                }
            }
        });
    }

    /**
     * Disconnects from the node.
     */
    public async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Whether the node is connected.
     */
    public isConnected(): boolean {
        return this.ws != null && this.ws.readyState === this.ws.OPEN;
    }

    /**
     * Send a packet to the node.
     * @param data - The data to send
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async send(data: ClientMessage): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Node is not connected');
        }

        this.ws!.send(JSON.stringify(data));
    }
}
