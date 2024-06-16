import WebSocket from 'ws';
import { EventEmitter } from '../common/EventEmitter';
import type { unsafe } from '../common/types';
import { VoiceOpcodes } from 'discord-api-types/voice/v4';

export interface VoipWebSocketOptions {
    address: string;
}

export const VoipWebSocketEvents = {
    Error: 'error',
    Open: 'open',
    Close: 'close',
    Packet: 'packet'
} as const;

export type VoipWebSocketEvents = (typeof VoipWebSocketEvents)[keyof typeof VoipWebSocketEvents];

export interface VoipWebSocketEventsMap {
    [VoipWebSocketEvents.Error]: (error: Error) => void;
    [VoipWebSocketEvents.Open]: (event: WebSocket.Event) => void;
    [VoipWebSocketEvents.Close]: (event: WebSocket.CloseEvent) => void;
    [VoipWebSocketEvents.Packet]: (data: unsafe) => void;
}

export class VoipWebSocket extends EventEmitter<VoipWebSocketEventsMap> {
    private readonly ws: WebSocket;
    private lastHeartbeatSent = 0;
    private missedHeartbeats = 0;
    private heartbeatInterval: NodeJS.Timeout | undefined;

    public constructor(private readonly options: VoipWebSocketOptions) {
        super();

        this.ws = new WebSocket(options.address);
        this.ws.onmessage = this.#onMessage.bind(this);
        this.ws.onerror = this.#onError.bind(this);
        this.ws.onopen = this.#onOpen.bind(this);
        this.ws.onclose = this.#onClose.bind(this);
    }

    public destroy() {
        try {
            this.debug?.('Destroying the WebSocket');
            this.setHeartbeat(0);
            this.ws.close(1000);
        } catch (error) {
            this.emit(VoipWebSocketEvents.Error, error as Error);
        }
    }

    public send(data: unsafe) {
        try {
            const payload = JSON.stringify(data);
            this.debug?.('Sending payload ${payload}');
            this.ws.send(payload);
        } catch (error) {
            this.emit(VoipWebSocketEvents.Error, error as Error);
        }
    }

    public setHeartbeat(interval: number) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (interval <= 0) return;

        this.heartbeatInterval = setInterval(() => {
            if (this.lastHeartbeatSent !== 0 && this.missedHeartbeats >= 3) {
                this.debug?.('Missed too many heartbeats');
                this.ws.close();
                this.setHeartbeat(0);
                return;
            }

            this.#heartbeat();
        }, interval);
    }

    #heartbeat() {
        this.lastHeartbeatSent = Date.now();
        this.missedHeartbeats++;

        this.send({
            op: VoiceOpcodes.Heartbeat,
            d: this.lastHeartbeatSent
        });
    }

    #onMessage(event: WebSocket.MessageEvent) {
        if (typeof event.data !== 'string') return;

        try {
            const data = JSON.parse(event.data);

            this.debug?.('Received payload ${event.data}');

            if (data.op === VoiceOpcodes.HeartbeatAck) {
                this.missedHeartbeats = 0;
            }

            this.emit(VoipWebSocketEvents.Packet, data);
        } catch (error) {
            this.emit(VoipWebSocketEvents.Error, error as Error);
        }
    }

    #onError(event: WebSocket.ErrorEvent | Error) {
        this.emit(VoipWebSocketEvents.Error, event instanceof Error ? event : event.error);
    }

    #onOpen(event: WebSocket.Event) {
        this.emit(VoipWebSocketEvents.Open, event);
    }

    #onClose(event: WebSocket.CloseEvent) {
        this.emit(VoipWebSocketEvents.Close, event);
    }
}
