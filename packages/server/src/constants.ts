export const WsCloseCodes = {
    Unauthorized: 4000,
} as const;

export type WsCloseCodes = (typeof WsCloseCodes)[keyof typeof WsCloseCodes];

export const WsOutgoingCodes = {
    Hello: 'HELLO',
} as const;

export type WsOutgoingCodes = (typeof WsOutgoingCodes)[keyof typeof WsOutgoingCodes];

export const WsIncomingCodes = {
    Identify: 'IDENTIFY',
    Request: 'REQUEST',
} as const;

export type WsIncomingCodes = (typeof WsIncomingCodes)[keyof typeof WsIncomingCodes];
