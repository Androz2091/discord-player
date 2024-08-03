import type { PlayerNodeLike } from '@discord-player/client';
import type { Adapter } from './Adapter';
import type { unsafe } from './common/types';
import { PlayerNodeManager } from './core/managers/PlayerNodeManager';
import { GuildQueueManager } from './core/managers/GuildQueueManager';
import { PluginsManager } from './core/managers/PluginsManager';

/**
 * Represents the options for the player manager.
 */
export interface PlayerOptions {
    /**
     * Whether to expose local player node (if available) to the network via the given port. Defaults to `false`.
     */
    exposeNode?: number | false;
}

export interface PlayerInitOptions extends PlayerOptions {
    /**
     * The remote nodes to use, if any. If not provided, the player will create a node locally. Defaults to `[]`.
     */
    nodes?: PlayerNodeLike[];
}

/**
 * Represents a player manager.
 */
export class Player {
    /**
     * The options for this player manager.
     */
    public readonly options: PlayerOptions;
    /**
     * The player node manager.
     */
    public readonly nodes: PlayerNodeManager;
    /**
     * The guild queue manager.
     */
    public readonly queue: GuildQueueManager;

    /**
     * The plugins manager.
     */
    public readonly plugins: PluginsManager;

    /**
     * Creates a new player manager.
     * @param adapter The adapter to use
     * @param options The options to use
     */
    public constructor(public readonly adapter: Adapter<unsafe>, options: PlayerInitOptions = {}) {
        const { nodes, ...rest } = options;

        this.adapter = adapter;
        this.adapter.setPlayer(this);
        this.options = rest;
        this.nodes = new PlayerNodeManager(this);

        if (nodes?.length) {
            for (const node of nodes) {
                this.nodes.create(node);
            }
        }

        this.queue = new GuildQueueManager(this);
        this.plugins = new PluginsManager(this);
    }

    /**
     * Connects to all player nodes.
     */
    public connect() {
        return this.nodes.connectAll();
    }

    /**
     * Disconnects from all player nodes.
     */
    public disconnect() {
        return this.nodes.deleteAll();
    }
}

/**
 * Creates a new player manager instance.
 * @param adapter The adapter to use
 * @param options The options to use
 * @returns The created player manager
 */
export function createPlayer(adapter: Adapter<unsafe>, options: PlayerOptions) {
    return new Player(adapter, options);
}
