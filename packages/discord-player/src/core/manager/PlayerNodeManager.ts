import { PlayerNode, PlayerNodeLike } from '@discord-player/node';
import { Collection } from '@discord-player/utils';
import type { Player } from '../../Player';

export class PlayerNodeManager {
    /**
     * The store of player nodes.
     */
    public store: Collection<string, PlayerNode> = new Collection();

    /**
     * Creates a new player node manager.
     */
    public constructor(public readonly player: Player) {}

    /**
     * Creates a new player node.
     * @param node The node to create
     */
    public create(node: PlayerNodeLike) {
        const init = new PlayerNode(node, {
            send: (packet) => {
                return this.player.adapter.sendPacket(packet);
            }
        });

        this.store.set(init.id, init);

        return node;
    }

    /**
     * Deletes the given player node.
     * @param id The id of the player node to delete
     */
    public async delete(id: string) {
        const node = this.store.get(id);

        if (!node) return;

        await node.delete();

        this.store.delete(id);
    }

    /**
     * Deletes all player nodes.
     */
    public async deleteAll() {
        await Promise.all(this.store.map(async (node) => node.delete()));

        this.store.clear();
    }

    /**
     * Connects all player nodes.
     */
    public async connectAll() {
        if (!this.store.size) {
            throw new Error('No player nodes to connect to.');
        }

        const nodes = await Promise.all(
            this.store.map(async (node) => {
                await node.connect();
                return node;
            })
        );
        return nodes;
    }

    /**
     * Finds optimal player node.
     */
    public getOptimalNode() {
        // TODO: actually find the optimal node
        return this.store.random() ?? null;
    }
}
