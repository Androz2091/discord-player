import { Client } from "discord.js";
import { IClientAdapter } from "./IClientAdapter";

export class DiscordJsClientAdapter implements IClientAdapter {
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }
}
