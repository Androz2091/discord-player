import { EventEmitter } from "events";
import { Client } from "discord.js";
import { PlayerOptions } from "./types/Player";
import Util from "./Util";

export default class Player extends EventEmitter {
    public client!: Client;
    public options: PlayerOptions;

    constructor(client: Client, options?: PlayerOptions) {
        super();

        /**
         * The discord client that instantiated this player
         */
        Object.defineProperty(this, "client", {
            value: client,
            enumerable: false
        });

        /**
         * The player options
         */
        this.options = Object.assign({}, Util.DefaultPlayerOptions, options ?? {});

        // check FFmpeg
        void Util.alertFFmpeg();
    }

}