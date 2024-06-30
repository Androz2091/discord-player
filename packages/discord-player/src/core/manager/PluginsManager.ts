import { Collection } from '@discord-player/utils';
import type { Player } from '../../Player';
import { Plugin } from '../Plugin';

export class PluginsManager {
    /**
     * The store of guild queues.
     */
    public store: Collection<string, Plugin> = new Collection();

    /**
     * Creates a new guild queue manager.
     * @param player The player to create the manager for
     */
    public constructor(public readonly player: Player) {}

    /**
     * Loads a plugin.
     * @param plugin The plugin to load
     */
    public async load(plugin: Plugin) {
        await plugin.activate();
        this.store.set(plugin.name, plugin);
    }

    /**
     * Unloads a plugin.
     * @param plugin The plugin to unload
     */
    public async unload(plugin: Plugin) {
        await plugin.deactivate();
        this.store.delete(plugin.name);
    }
}
