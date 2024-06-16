import { isIPv4 } from 'node:net';
import { createSocket, type Socket } from 'node:dgram';
import { EventEmitter } from '../common/EventEmitter';
import { MAX_COUNTER_VALUE, UDP_KEEPALIVE_INTERVAL } from './constants';

export interface RemoteAddress {
    address: string;
    port: number;
}

export interface VoipUdpOptions {
    address: string;
}

export const VoipUdpEvents = {
    Error: 'error',
    Close: 'close',
    Message: 'message'
} as const;

export type VoipUdpEvents = (typeof VoipUdpEvents)[keyof typeof VoipUdpEvents];

export interface VoipUdpEventsMap {
    [VoipUdpEvents.Error]: (error: Error) => void;
    [VoipUdpEvents.Close]: () => void;
    [VoipUdpEvents.Message]: (data: Buffer) => void;
}

export class VoipUdpSocket extends EventEmitter<VoipUdpEventsMap> {
    private readonly socket: Socket;
    private keepAliveBuffer: Buffer;
    private keepAliveInterval: NodeJS.Timeout;
    private keepAliveCounter = 0;

    public constructor(private readonly remoteAddress: RemoteAddress) {
        super();

        this.socket = createSocket('udp4');
        this.socket.on('error', this.#onError.bind(this));
        this.socket.on('message', this.#onMessage.bind(this));
        this.socket.on('close', this.#onClose.bind(this));

        this.keepAliveBuffer = Buffer.alloc(0);
        this.keepAliveInterval = setInterval(this.#keepAlive.bind(this), UDP_KEEPALIVE_INTERVAL);

        setImmediate(() => this.#keepAlive());
    }

    public destroy() {
        try {
            this.debug?.('Destroying the UDP socket');
            this.socket.close();
        } catch {
            //
        }

        clearInterval(this.keepAliveInterval);
    }

    public send(buffer: Buffer) {
        const { address, port } = this.remoteAddress;

        this.socket.send(buffer, port, address);
    }

    public performIPDiscovery(ssrc: number): Promise<RemoteAddress> {
        return new Promise<RemoteAddress>((resolve, reject) => {
            const listener = (message: Buffer) => {
                try {
                    if (message.readUInt16BE(0) !== 2) return;

                    const data = this.#parseLocalPacket(message);
                    this.socket.off('message', listener);
                    this.socket.off('close', rejectListener);
                    resolve(data);
                } catch {
                    //
                }
            };

            const rejectListener = () => reject(new Error('Socket closed before performing IP discovery'));

            this.socket.on('message', listener);
            this.socket.once('close', rejectListener);

            const buffer = Buffer.alloc(74);

            buffer.writeUInt16BE(1, 0);
            buffer.writeUInt16BE(70, 2);
            buffer.writeUInt32BE(ssrc, 4);

            this.send(buffer);
        });
    }

    #parseLocalPacket(buffer: Buffer): RemoteAddress {
        const msg = Buffer.from(buffer);

        const address = msg.subarray(8, msg.indexOf(0, 8)).toString('utf-8');

        if (!isIPv4(address)) {
            throw new Error('Invalid IP address received');
        }

        const port = msg.readUInt16BE(msg.length - 2);

        return {
            address,
            port
        } satisfies RemoteAddress;
    }

    #onError(error: Error) {
        this.emit(VoipUdpEvents.Error, error);
    }

    #onClose() {
        this.emit(VoipUdpEvents.Close);
    }

    #onMessage(data: Buffer) {
        this.emit(VoipUdpEvents.Message, data);
    }

    #keepAlive() {
        this.keepAliveBuffer.writeUInt32LE(this.keepAliveCounter, 0);
        this.send(this.keepAliveBuffer);
        this.keepAliveCounter++;

        if (this.keepAliveCounter > MAX_COUNTER_VALUE) {
            this.keepAliveCounter = 0;
        }
    }
}
