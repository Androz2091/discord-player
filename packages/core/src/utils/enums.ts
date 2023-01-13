import { keyMirror } from '@discord-player/utils';

// prettier-ignore
export const WorkerOp = keyMirror([
    "JOIN_VOICE_CHANNEL",
    "CREATE_SUBSCRIPTION",
    "DELETE_SUBSCRIPTION",
    "GATEWAY_PAYLOAD",
    "PLAY"
]);

// prettier-ignore
export const WorkerEvents = keyMirror([
    "SUBSCRIPTION_CREATE",
    "SUBSCRIPTION_DELETE",
    "VOICE_STATE_UPDATE",
    "ERROR",
    "CONNECTION_DESTROY"
]);
