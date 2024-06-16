export const NONCE = Buffer.alloc(24);

export const OPUS_SAMPLE_RATE = 48000;

export const OPUS_CHANNELS = 2;

export const OPUS_FRAME_SIZE = 960;

export const OPUS_FRAME_DURATION = Math.floor(OPUS_FRAME_SIZE / OPUS_SAMPLE_RATE);

export const OPUS_SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

export const TIMESTAMP_INC = (OPUS_SAMPLE_RATE / 100) * OPUS_CHANNELS;

export const MAX_COUNTER_VALUE = 2 ** 32 - 1;

export const UDP_KEEPALIVE_INTERVAL = 5e3;

export const MAX_NONCE = 2 ** 32 - 1;

export const EncryptionMode = {
    XSALSA20_POLY1305_LITE: 'xsalsa20_poly1305_lite',
    XSALSA20_POLY1305_SUFFIX: 'xsalsa20_poly1305_suffix',
    XSALSA20_POLY1305: 'xsalsa20_poly1305'
} as const;

export type EncryptionMode = (typeof EncryptionMode)[keyof typeof EncryptionMode];

export const ENCRYPTION_MODES = new Set(['xsalsa20_poly1305_lite', 'xsalsa20_poly1305_suffix', 'xsalsa20_poly1305'] as const);
