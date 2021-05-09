import Player from "../Player";

export class Playlist {
    player: Player;

    constructor(player: Player, data: any) {
        Object.defineProperty(this, "player", { value: player });
    }

}

export default Playlist;