import { AudioReceiveStream, AudioReceiveStreamOptions, VoiceReceiver as DiscordVoiceReceiver } from '@discordjs/voice';

export type ReceiverOptions = Partial<AudioReceiveStreamOptions>;

export class VoiceReceiver {
    public constructor(public receiver: DiscordVoiceReceiver) {}

    /**
     * The current audio subscriptions of this receiver.
     */
    public get subscriptions() {
        return this.receiver.subscriptions;
    }

    /**
     * The speaking map of this receiver.
     */
    public get speaking() {
        return this.receiver.speaking;
    }

    /**
     * Creates a subscription for the given user id.
     * @param target The id of the user to subscribe to
     * @returns A readable stream of Opus packets received from the target
     */
    public subscribe(userId: string, options?: ReceiverOptions) {
        return this.receiver.subscribe(userId, options);
    }

    /**
     * Removes a subscription for the given user id.
     * @param userId The id of the user to unsubscribe from
     * @returns `true` the subscription was successfully removed
     */
    public unsubscribe(userId: string) {
        const stream = this.receiver.subscriptions.get(userId);
        if (!stream) return false;

        stream.destroy();

        return true;
    }

    /**
     * Creates AudioReceiveStream for the given user id.
     * @param userId The id of the user to record
     * @returns The AudioReceiveStream
     */
    public createStream(userId: string, options?: ReceiverOptions) {
        return new Promise<AudioReceiveStream>((resolve) => {
            const listener = (user: string) => {
                if (user !== userId) return;

                this.receiver.speaking.off('start', listener);

                const stream = this.receiver.subscribe(userId, options);

                return resolve(stream);
            };

            this.receiver.speaking.on('start', listener);
        });
    }
}
