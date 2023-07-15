import { AudioPlayer, AudioResource, createAudioResource, StreamType } from '@discordjs/voice';
import { audioPlayerRegistry } from './AudioPlayerRegistry';
import { VoiceConnection } from './VoiceConnection';

export interface IDispatcherStatistics {
    playbackDuration: number;
}

export interface IAudioResourceMeta {
    id: string;
    url: string;
}

export class Dispatcher {
    public audioResource: AudioResource<IAudioResourceMeta> | null = null;
    public audioPlayer: AudioPlayer;

    public constructor(public connection: VoiceConnection, audioPlayer: AudioPlayer) {
        audioPlayer ??= audioPlayerRegistry.resolve(this.connection.identifier);

        this.audioPlayer = audioPlayer;
        this.connection.subscribe(this.audioPlayer);

        this._attachListeners();
    }

    private _attachListeners() {
        // TODO
    }

    public play(track: IAudioResourceMeta) {
        const resource = createAudioResource<IAudioResourceMeta>(track.url, {
            inlineVolume: false,
            inputType: StreamType.Opus,
            silencePaddingFrames: 5,
            metadata: track
        });

        this.audioResource = resource;

        this.audioPlayer.play(this.audioResource);
    }

    public snapshot(): IDispatcherStatistics {
        return { playbackDuration: this.audioResource?.playbackDuration ?? 0 };
    }
}
