import { EventEmitter } from 'events';
import { Client } from 'discord.js';
import Util from './utils/Util';

export class Player extends EventEmitter {
    public client: Client;

    constructor(client: Client) {
        super();

        Object.defineProperty(this, 'client', {
            value: client,
            enumerable: false
        });

        // check FFmpeg
        void Util.alertFFmpeg();
    }

    
}

export default Player;