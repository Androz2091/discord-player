import { UserResolvable } from 'discord.js';
import { PassThrough, type Readable } from 'stream';
import { EndBehaviorType } from '@discordjs/voice';
import * as prism from 'prism-media';
import { StreamDispatcher } from '../VoiceInterface/StreamDispatcher';
import { Track } from './Track';
import { RawTrackData } from '../types/types';

export interface VoiceReceiverOptions {
    mode?: 'opus' | 'pcm';
    end?: EndBehaviorType;
    silenceDuration?: number;
    crc?: boolean;
}

export type RawTrackInit = Partial<Omit<RawTrackData, 'author' | 'playlist' | 'source' | 'engine' | 'raw' | 'queryType' | 'description' | 'views'>>;

export class VoiceReceiverNode {
    public constructor(public dispatcher: StreamDispatcher) {}

    public createRawTrack(stream: Readable, data: RawTrackInit = {}) {
        data.title ??= `Recording ${Date.now()}`;

        return new Track(this.dispatcher.queue.player, {
            author: 'Discord',
            description: data.title,
            title: data.title,
            duration: data.duration || '0:00',
            views: 0,
            requestedBy: data.requestedBy,
            thumbnail: data.thumbnail || 'https://cdn.discordapp.com/embed/avatars/0.png',
            url: data.url || 'https://discord.com',
            source: 'arbitrary',
            raw: {
                engine: stream,
                source: 'arbitrary'
            }
        });
    }

    /**
     * Merge multiple streams together
     * @param streams The array of streams to merge
     */
    public mergeRecordings(streams: Readable[]) {
        // TODO
        void streams;
        throw new Error('Not implemented');
    }

    /**
     * Record a user in voice channel
     * @param user The user to record
     * @param options Recording options
     */
    public recordUser(
        user: UserResolvable,
        options: VoiceReceiverOptions = {
            end: EndBehaviorType.AfterSilence,
            mode: 'pcm',
            silenceDuration: 1000
        }
    ) {
        const _user = this.dispatcher.queue.player.client.users.resolveId(user);

        const passThrough = new PassThrough();
        const receiver = this.dispatcher.voiceConnection.receiver;

        if (!receiver) throw new Error('Voice receiver is not available, maybe connect to a voice channel first?');

        receiver.speaking.on('start', (userId) => {
            if (userId === _user) {
                const receiveStream = receiver.subscribe(_user, {
                    end: {
                        behavior: options.end || EndBehaviorType.AfterSilence,
                        duration: options.silenceDuration ?? 1000
                    }
                });

                setImmediate(async () => {
                    if (options.mode === 'pcm') {
                        const pcm = receiveStream.pipe(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            new (prism.opus || (<any>prism).default.opus).Decoder({
                                channels: 2,
                                frameSize: 960,
                                rate: 48000
                            })
                        );
                        return pcm.pipe(passThrough);
                    } else {
                        return receiveStream.pipe(passThrough);
                    }
                }).unref();
            }
        });

        return passThrough as Readable;
    }
}
