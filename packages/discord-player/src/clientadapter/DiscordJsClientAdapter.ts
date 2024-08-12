import { Client, Events, IntentsBitField, User, version } from "discord.js";
import { ClientType, IClientAdapter } from "./IClientAdapter";
import { Util } from "../utils/Util";

export class DiscordJsClientAdapter implements IClientAdapter {
    private client: Client;
    private name = 'discord.js';

    public clientType: ClientType = ClientType.DiscordJs;

    constructor(client: Client) {
        this.client = client;
    }

    getClientName(): string {
        return this.name;
    }

    getClientVersion(): string {
        return version;
    }

    validateIntents(): void {
        const intents: IntentsBitField = this.client.options.intents;
        if (!intents.has(IntentsBitField.Flags.GuildVoiceStates)) {
            Util.warn('Client is missing "GuildVoiceStates" intent', 'InvalidIntentsBitField');
        }
    }

    getUserId(user: User): string | null {
        if (user instanceof User) {
            return user.id;
        }

        throw new Error('Provided user is not correct instance type');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addVoiceStateUpdateListener(listener: (...args: any[]) => void): void {
        this.client.on(Events.VoiceStateUpdate, listener);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeVoiceStateUpdateListener(listener: (...args: any[]) => void): void {
        this.client.off(Events.VoiceStateUpdate, listener);
    }

    decrementMaxListeners(): void {
        // @ts-ignore private method
        this.client.decrementMaxListeners();
    }

    incrementMaxListeners(): void {
        // @ts-ignore private method
        this.client.incrementMaxListeners();
    }
}
