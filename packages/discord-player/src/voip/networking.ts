import { EventEmitter } from '../common/EventEmitter';
import { EncryptionMode, MAX_NONCE, NONCE } from './constants';
import { libsodium } from './libsodium';

export const VoipEvents = {} as const;

export type VoipEvents = (typeof VoipEvents)[keyof typeof VoipEvents];

export interface VoipEventsMap {}

export interface NetworkingOptions {}

export interface ConnectionData {
    encryptionMode: EncryptionMode;
    nonce: number;
    nonceBuffer: Buffer;
    packetsPlayed: number;
    secretKey: Uint8Array;
    sequence: number;
    speaking: boolean;
    ssrc: number;
    timestamp: number;
}

export class Networking extends EventEmitter<VoipEventsMap> {
    public constructor(public readonly options: NetworkingOptions) {
        super();
    }

    #createAudioPacket(opus: Buffer, data: ConnectionData) {
        const packetBuffer = Buffer.alloc(12);
        packetBuffer[0] = 0x80;
        packetBuffer[1] = 0x78;

        const { sequence, timestamp, ssrc } = data;

        packetBuffer.writeUIntBE(sequence, 2, 2);
        packetBuffer.writeUIntBE(timestamp, 4, 4);
        packetBuffer.writeUIntBE(ssrc, 8, 4);

        packetBuffer.copy(NONCE, 0, 0, 12);

        return Buffer.concat([packetBuffer, ...this.#encrypt(opus, data)]);
    }

    #encrypt(opus: Buffer, data: ConnectionData) {
        switch (data.encryptionMode) {
            case EncryptionMode.XSALSA20_POLY1305_LITE: {
                data.nonce++;
                if (data.nonce > MAX_NONCE) data.nonce = 0;
                data.nonceBuffer.writeUInt32BE(data.nonce, 0);

                return [libsodium.close(opus, data.nonceBuffer, data.secretKey)];
            }
            case EncryptionMode.XSALSA20_POLY1305_SUFFIX: {
                const random = libsodium.random(24, data.nonceBuffer);

                return [libsodium.close(opus, random, data.secretKey), random];
            }
            default: {
                return [libsodium.close(opus, data.nonceBuffer, data.secretKey)];
            }
        }
    }
}
