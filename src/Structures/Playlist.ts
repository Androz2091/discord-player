import { Player } from "../Player";
import { Track } from "./Track";

class Playlist {
    public readonly player: Player;
    public tracks: Track[];

    constructor(player: Player, tracks: Track[]) {
        this.player = player;
        this.tracks = tracks ?? [];
    }
}

export { Playlist };
