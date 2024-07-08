import { WorkerAckOp, WorkerOp } from './constants';
import type { VoiceConnectionCreateOptions } from '../worker/node/AudioNode';
import type { GatewayVoiceStateUpdateDispatchData, GatewayVoiceServerUpdateDispatchData } from 'discord-api-types/v10';

export interface WorkerMessage<T> {
    op: WorkerOp;
    d: T;
}

export interface WorkerMessageAck<T> {
    t: WorkerAckOp;
    d: T;
}

export interface DebugEventDispatch {
    data: string;
}

export interface WorkerStatistics {
    memoryUsed: number;
    subscriptions: number;
}

export interface WorkerMessagePayloadAck {
    [WorkerAckOp.OP_EVT_DEBUG]: DebugEventDispatch;
    [WorkerAckOp.OP_ACK_PING]: null;
    [WorkerAckOp.OP_ACK_JOIN_VOICE_CHANNEL]: null;
    [WorkerAckOp.OP_EVT_GATEWAY_DISPATCH]: null;
    [WorkerAckOp.OP_EVT_STATS]: WorkerStatistics;
}

export interface WorkerMessagePayload {
    [WorkerOp.OP_PING]: null;
    [WorkerOp.OP_JOIN_VOICE_CHANNEL]: VoiceConnectionCreateOptions;
    [WorkerOp.OP_VOICE_SERVER_UPDATE]: GatewayVoiceServerUpdateDispatchData;
    [WorkerOp.OP_VOICE_STATE_UPDATE]: GatewayVoiceStateUpdateDispatchData;
}
