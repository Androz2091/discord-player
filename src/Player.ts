import { Client, Collection, Guild, Snowflake } from "discord.js";
import { TypedEmitter as EventEmitter } from "tiny-typed-emitter";
import { Queue } from "./Structures/Queue";
import { VoiceUtils } from "./VoiceInterface/VoiceUtils";
import { PlayerOptions } from "./types/types";

class DiscordPlayer extends EventEmitter {
    public readonly client: Client;
    public readonly queues = new Collection<Snowflake, Queue>();
    public readonly voiceUtils = new VoiceUtils();

    constructor(client: Client) {
        super();
        this.client = client;
    }

    createQueue(guild: Guild, queueInitOptions?: PlayerOptions) {
        if (this.queues.has(guild.id)) return this.queues.get(guild.id);
        const queue = new Queue(this, guild, queueInitOptions);
        this.queues.set(guild.id, queue);

        return queue;
    }

    getQueue(guild: Snowflake) {
        return this.queues.get(guild);
    }
}

export { DiscordPlayer as Player };
