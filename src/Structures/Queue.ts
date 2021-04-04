import Player from "../Player";

export default class Queue {
    public player!: Player;

    constructor(player: Player) {

        /**
         * The player that instantiated this Queue
         */
        Object.defineProperty(this, "player", { value: player, enumerable: false });
    }
}