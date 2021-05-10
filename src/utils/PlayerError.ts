import { Message } from "discord.js";

export default class PlayerError extends Error {
    discordMessage: Message;

    constructor(msg: string, name?: string, message?: Message) {
        super();
        this.name = name ?? 'PlayerError';
        this.message = msg;
        this.discordMessage = message;
        Error.captureStackTrace(this);
    }

    get code() {
        return this.name;
    }
}

export { PlayerError };
