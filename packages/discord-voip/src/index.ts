// Copyright discord-player authors. All rights reserved. MIT License.
// Copyright discord.js authors. All rights reserved. Apache License 2.0

export * from './joinVoiceChannel';
export * from './audio/index';
export * from './util/index';

export {
    VoiceConnection,
    type VoiceConnectionState,
    VoiceConnectionStatus,
    type VoiceConnectionConnectingState,
    type VoiceConnectionDestroyedState,
    type VoiceConnectionDisconnectedState,
    type VoiceConnectionDisconnectedBaseState,
    type VoiceConnectionDisconnectedOtherState,
    type VoiceConnectionDisconnectedWebSocketState,
    VoiceConnectionDisconnectReason,
    type VoiceConnectionReadyState,
    type VoiceConnectionSignallingState,
} from './VoiceConnection';

export { type JoinConfig, getVoiceConnection, getVoiceConnections, getGroups } from './DataStore';

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
export const version: string = '[VI]{{inject}}[/VI]';
