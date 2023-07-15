import { AudioPlayer, JoinConfig, PlayerSubscription, VoiceConnection as DiscordVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { VoiceReceiver } from './VoiceReceiver';

export type PartialJoinConfig = Omit<JoinConfig, 'group' | 'guildId'>;

export class VoiceConnection {
    /**
     * The audio player subscription of this connection
     */
    public subscription: PlayerSubscription | null = null;

    /**
     * The receiver of this voice connection. You should join the voice channel with selfDeaf set to false for this feature to work properly.
     */
    public receiver: VoiceReceiver;

    public constructor(public readonly connection: DiscordVoiceConnection) {
        this.receiver = new VoiceReceiver(this.connection.receiver);
    }

    /**
     * The voice connection has either been severed or not established.
     */
    public isDisconnected() {
        return this.connection.state.status === VoiceConnectionStatus.Disconnected;
    }

    /**
     * The voice connection has been destroyed and untracked, it cannot be reused.
     */
    public isDestroyed() {
        return this.connection.state.status === VoiceConnectionStatus.Destroyed;
    }

    /**
     * The `VOICE_SERVER_UPDATE` and `VOICE_STATE_UPDATE` packets have been received, now attempting to establish a voice connection.
     */
    public isConnecting() {
        return this.connection.state.status === VoiceConnectionStatus.Connecting;
    }

    /**
     * The voice connection is established, and is ready to be used.
     */
    public isReady() {
        return this.connection.state.status === VoiceConnectionStatus.Ready;
    }

    /**
     * Sending a packet to the main Discord gateway to indicate we want to change our voice state.
     */
    public isSignalling() {
        return this.connection.state.status === VoiceConnectionStatus.Signalling;
    }

    /**
     * Subscribes to an audio player, allowing the player to play audio on this voice connection.
     * @param player The audio player to subscribe to
     * @returns The created subscription
     */
    public subscribe(player: AudioPlayer) {
        this.subscription = this.connection.subscribe(player) ?? null;
        return this.subscription;
    }

    /**
     * Unsubscribes the connection from the audio player, meaning that the audio player cannot stream audio to it until a new subscription is made.
     */
    public unsubscribe() {
        if (!this.subscription) return false;
        this.subscription.unsubscribe();
        return true;
    }

    /**
     * Disconnects the VoiceConnection, allowing the possibility of rejoining later on.
     * @returns `true` if the connection was successfully disconnected
     */
    public disconnect() {
        return this.connection.disconnect();
    }

    /**
     * Destroys the VoiceConnection, preventing it from connecting to voice again. This method should be called when you no longer require the VoiceConnection to prevent memory leaks.
     * @param adapterAvailable Whether the adapter can be used
     */
    public destroy(adapterAvailable?: boolean) {
        return this.connection.destroy(adapterAvailable);
    }

    /**
     * Re-attempt establishing the connection
     * @returns `true` if the rejoin attempt was successful
     */
    public rejoin(joinConfig?: PartialJoinConfig) {
        return this.connection.rejoin(joinConfig);
    }

    /**
     * The identifier for this connection
     */
    public get identifier() {
        const { channelId, group, guildId } = this.connection.joinConfig;
        return `${channelId}::${group}::${guildId}`;
    }
}
