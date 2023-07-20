import { AudioPlayer, AudioPlayerStatus, AudioResource, entersState, VoiceConnectionDisconnectReason, VoiceConnectionStatus } from '@discordjs/voice';
import { audioPlayerRegistry } from './AudioPlayerRegistry';
import { VoiceConnection } from './VoiceConnection';
import { EventEmitter } from '@discord-player/utils';

export interface IDispatcherStatistics {
    playbackDuration: number;
}

export interface IAudioResourceMeta {
    id: string;
    url: string;
}

export interface DispatcherEvents {
    error: (error: Error) => unknown;
    playing: (resource: IAudioResourceMeta) => unknown;
}

export const DispatcherEvent = {
    Error: 'error',
    Playing: 'playing'
} as const;

export class Dispatcher extends EventEmitter<DispatcherEvents> {
    public audioResource: AudioResource<IAudioResourceMeta> | null = null;
    public audioPlayer: AudioPlayer;

    public constructor(public connection: VoiceConnection, audioPlayer: AudioPlayer) {
        super();
        audioPlayer ??= audioPlayerRegistry.resolve(this.connection.identifier);

        this.audioPlayer = audioPlayer;
        this.connection.subscribe(this.audioPlayer);

        this._attachListeners();
    }

    private _attachListeners() {
        const { connection } = this.connection;
        const connectionTimeout = this.connection.options.connectionTimeout ?? 120_000;

        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            if (newState.reason === VoiceConnectionDisconnectReason.Manual) return;

            try {
                // prettier-ignore
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, connectionTimeout),
                    entersState(connection, VoiceConnectionStatus.Connecting, connectionTimeout)
                ]);
            } catch {
                connection.destroy(this.connection.hasAdapter);
            }
        });

        this.audioPlayer.on(AudioPlayerStatus.Playing, (oldState, newState) => {
            this.emit(DispatcherEvent.Playing, newState.resource.metadata as IAudioResourceMeta);
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.audioPlayer.on(AudioPlayerStatus.Idle, (oldState, newState) => {
            if (oldState.status === AudioPlayerStatus.Playing) {
                this.emit(DispatcherEvent.Playing, oldState.resource.metadata as IAudioResourceMeta);
            }
        });
    }

    public play(resource: AudioResource<IAudioResourceMeta>) {
        this.audioResource = resource;
        this.audioPlayer.play(this.audioResource);
    }

    public snapshot(): IDispatcherStatistics {
        return { playbackDuration: this.audioResource?.playbackDuration ?? 0 };
    }
}
