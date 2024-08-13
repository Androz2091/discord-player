import { EndBehaviorType } from 'discord-voip';
import { PassThrough, type Readable } from 'node:stream';
import * as prism from 'prism-media';
import { StreamDispatcher } from '../VoiceInterface/StreamDispatcher';
import { User } from '../clientadapter/IClientAdapter';
import { Exceptions } from '../errors';
import { Track } from '../fabric/Track';
import { RawTrackData } from '../types/types';

export interface VoiceReceiverOptions {
    mode?: 'opus' | 'pcm';
    end?: EndBehaviorType;
    silenceDuration?: number;
    crc?: boolean;
}

export type RawTrackInit = Partial<Omit<RawTrackData, 'author' | 'playlist' | 'source' | 'engine' | 'raw' | 'queryType' | 'description' | 'views'>>;

export class VoiceReceiverNode {
    public constructor(public dispatcher: StreamDispatcher) { }

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
        throw Exceptions.ERR_NOT_IMPLEMENTED(`${this.constructor.name}.mergeRecordings()`);
    }

    /**
     * Record a user in voice channel
     * @param user The user to record
     * @param options Recording options
     */
    public recordUser(
        user: User,
        options: VoiceReceiverOptions = {
            end: EndBehaviorType.AfterSilence,
            mode: 'pcm',
            silenceDuration: 1000
        }
    ) {
        const recordedUserId = user.id;

        const passThrough = new PassThrough();
        const receiver = this.dispatcher.voiceConnection.receiver;

        if (!receiver) throw Exceptions.ERR_NO_RECEIVER();

        receiver.speaking.on('start', (userId) => {
            if (userId === recordedUserId) {
                const receiveStream = receiver.subscribe(recordedUserId, {
                    end: {
                        behavior: options.end || EndBehaviorType.AfterSilence,
                        duration: options.silenceDuration ?? 1000
                    }
                });

                setImmediate(async () => {
                    if (options.mode === 'pcm') {
                        const pcm = receiveStream.pipe(
                            // @ts-ignore
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            new (prism.opus || (<any>prism).default.opus).Decoder({
                                channels: 2,
                                frameSize: 960,
                                rate: 48000
                            })
                        );
                        // @ts-ignore
                        return pcm.pipe(passThrough);
                    } else {
                        // @ts-ignore
                        return receiveStream.pipe(passThrough);
                    }
                }).unref();
            }
        });

        return passThrough as Readable;
    }
}
