import { Client, ClientEvents, User } from "discord.js";
import { ClientType, IClientAdapter } from "./IClientAdapter";

export class DiscordJsClientAdapter implements IClientAdapter {
    private client: Client;

    public clientType: ClientType = ClientType.DiscordJs;

    constructor(client: Client) {
        this.client = client;
    }

    getUserId(user: User): string | null {
        if (user instanceof User) {
            return user.id;
        }

        throw new Error('Provided user is not correct instance type');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addListener(event: keyof ClientEvents, listener: (...args: any[]) => void): void {
        this.client.on(event, listener);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeListener(event: keyof ClientEvents, listener: (...args: any[]) => void): void {
        this.client.off(event, listener);
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
