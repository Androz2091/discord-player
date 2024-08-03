import { AnyWorkerPayload, WorkerConfig, WorkerManager, bootstrap } from '@discord-player/core';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { WsCloseCodes, WsIncomingCodes, WsOutgoingCodes } from './constants';
import { createClient, createErrorSafe, decode } from './utils';

export type ServerAuthenticationHandler = (token: string) => Promise<boolean>;

export interface WebsocketMessage<T extends Record<string, unknown> = Record<string, unknown>> {
    op: WsOutgoingCodes;
    d: T;
}

export interface ClientMessage<T extends Record<string, unknown> = Record<string, unknown>> {
    op: WsIncomingCodes;
    d: T;
}

export interface ServerOptions {
    worker: WorkerConfig;
    port: number;
    host?: string;
    authenticate?: ServerAuthenticationHandler;
}

export class Server {
    public websocket: WebSocketServer | null = null;
    public workerManager: WorkerManager | null = null;
    public clients: Map<string, WebSocket> = new Map();

    public constructor(private readonly options: ServerOptions) {}

    public getServerOrThrow() {
        if (!this.websocket) throw new Error('Server has not started');
        return this.websocket;
    }

    public getWorkerManagerOrThrow() {
        if (!this.workerManager) throw new Error('Worker manager has not started');
        return this.workerManager;
    }

    public async handleConnection(socket: WebSocket) {
        socket.on(
            'message',
            createErrorSafe((data: RawData) => {
                const message = decode<ClientMessage>(data);

                switch (message.op) {
                    case WsIncomingCodes.Identify: {
                        const { id } = message.d as { id: string };

                        this.clients.set(id, createClient(socket, id));
                        break;
                    }
                    default: {
                        const data = message.d as unknown as AnyWorkerPayload;

                        this.getWorkerManagerOrThrow().send(data);
                        break;
                    }
                }
            }),
        );

        this.send(socket, {
            op: WsOutgoingCodes.Hello,
            d: {},
        });
    }

    public async start() {
        const { port, host } = this.options;

        const server = new WebSocketServer({
            port,
            host,
            verifyClient: async (info, done) => {
                const { authenticate } = this.options;

                // do not allow unknown connections by default
                if (!authenticate) return done(false, WsCloseCodes.Unauthorized);

                const { authorization } = info.req.headers;

                if (!authorization) return done(false, WsCloseCodes.Unauthorized);

                const isValid = await authenticate(authorization).catch(() => false);

                if (!isValid) return done(false, WsCloseCodes.Unauthorized);

                done(true);
            },
        });

        this.websocket = server;

        server.on('connection', this.handleConnection.bind(this));

        this.workerManager = await bootstrap(this.options.worker);
    }

    public send(socket: WebSocket, data: WebsocketMessage) {
        socket.send(JSON.stringify(data));
    }
}
