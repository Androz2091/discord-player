import { EventEmitter } from 'events';
import { Client, Collection, Snowflake, Message } from 'discord.js';
import Util from './utils/Util';
import Queue from './Structures/Queue';
import { ExtractorModel } from './Structures/ExtractorModel';

export class Player extends EventEmitter {
    public client: Client;
    public queues = new Collection<Snowflake, Queue>();
    public Extractors = new Collection<string, ExtractorModel>();

    constructor(client: Client) {
        super();

        Object.defineProperty(this, 'client', {
            value: client,
            enumerable: false
        });

        Util.alertFFmpeg();
    }

    public createQueue(message: Message) {
        if (this.queues.has(message.guild.id)) return this.queues.get(message.guild.id);
        
        const queue = new Queue(this, message);
        void this.queues.set(message.guild.id, queue);
        return queue;
    }

    public getQueue(message: Message) {
        return this.queues.get(message.guild.id) ?? null;
    }

    
}

export default Player;