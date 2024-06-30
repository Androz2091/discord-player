import { randomUUID } from 'node:crypto';
import type { Connector } from './connector/Connector';
import { IPC } from './connector/IPC';
import { TCP } from './connector/TCP';

/**
 * Represents a player node object.
 */
export interface PlayerNodeOptions {
    /**
     * The host of the node.
     */
    host: string;
    /**
     * The port of the node, if any.
     */
    port: number | null;
    /**
     * Whether the node uses a secure connection.
     */
    secure: boolean;
    /**
     * The client ID of this node.
     */
    clientId: string;
    /**
     * The password of this node.
     */
    password: string;
    /**
     * Whether this node is an IPC node.
     */
    ipc: boolean;
}

/**
 * Represents a player node string.
 *
 * Non secure - `discord-player://clientId:password@localhost:2333`
 *
 * Secure - `discord-player://clientId:password@localhost:2333?secure=true`
 */
export type PlayerNodeString = `discord-player://${string}`;

/**
 * Represents a player node type.
 */
export type PlayerNodeLike = PlayerNodeOptions | PlayerNodeString | URL;

export interface PlayerNodeInit {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send?: (packet: Record<string, any>) => Awaited<void>;
}

/**
 * The protocol for discord player nodes.
 */
export const DISCORD_PLAYER_PROTOCOL = 'discord-player:';

/**
 * The hostname for discord player IPC nodes.
 */
export const DISCORD_PLAYER_IPC_HOSTNAME = 'ipc.discord-player.js.org';

function validateNodeOptions(node: PlayerNodeOptions): PlayerNodeOptions {
    const required = ['host', 'clientId', 'password'] as const;

    for (const key of required) {
        if (typeof node[key] !== 'string') {
            throw new Error(`Expected key 'NodeOptions.${key}' to be a string.`);
        }
    }

    if ('port' in node && node.port !== null && typeof node.port !== 'number') {
        throw new Error("Expected key 'NodeOptions.port' to be a number.");
    }

    if ('secure' in node && typeof node.secure !== 'boolean') {
        throw new Error("Expected key 'NodeOptions.secure' to be a boolean.");
    }

    // defaults
    node.secure ??= false;

    return node;
}

export class PlayerNode {
    /**
     * The unique identifier for this player node.
     */
    public readonly id = randomUUID();

    /**
     * The resolved player node config.
     */
    private readonly node: PlayerNodeOptions;

    /**
     * Whether this player node uses IPC.
     */
    #isIPC = false;

    /**
     * The connector for this player node.
     */
    private readonly connector: Connector;

    /**
     * Creates a new player node.
     * @param node - The node config or node string to use
     * @param options - The player node options
     */
    public constructor(node: PlayerNodeLike, private readonly options: PlayerNodeInit) {
        if (typeof node === 'string' || node instanceof URL) {
            this.node = PlayerNode.parseNode(node);
        } else {
            this.node = validateNodeOptions(node);
        }

        this.#isIPC = this.node.ipc;
        this.connector = this.#isIPC ? new IPC(this) : new TCP(this);
    }

    /**
     * Whether this player node is an IPC node.
     */
    public get isIPCNode() {
        return this.#isIPC;
    }

    /**
     * Connects to this player node.
     */
    public async connect() {
        await this.connector.connect();
    }

    /**
     * Destroy this player node.
     */
    public async delete() {
        await this.connector.disconnect();
    }

    /**
     * Sends a packet to the player node.
     */
    public isSecure(): boolean {
        return this.node.secure;
    }

    /**
     * Sends a packet to the player node.
     * @param censorPassword - Whether to censor the password in the URL
     */
    public getURL(censorPassword = false): URL {
        const { host, port, secure, clientId, password } = this.node;

        const pwd = censorPassword ? password.replace(/./g, '*') : password;
        const url = new URL(`${DISCORD_PLAYER_PROTOCOL}//${clientId}:${pwd}@${host}:${port}`);

        if (secure) {
            url.searchParams.set('secure', 'true');
        }

        return url;
    }

    /**
     * JSON representation of the player node.
     */
    public toJSON() {
        return this.node;
    }

    /**
     * String representation of the player node.
     */
    public toString() {
        return this.getURL(true).toString();
    }

    /**
     * Parses a player node string into a player node options object.
     * @param node - The node string to parse
     * @returns The parsed player node options
     * @example const node = PlayerNode.parseNodeString('discord-player://clientId:password@localhost:2333?secure=true');
     * // => { host: 'localhost', port: 2333, secure: true, clientId: 'clientId', password: 'password' }
     */
    public static parseNode(node: PlayerNodeString | URL): PlayerNodeOptions {
        if (!(node instanceof URL) && !URL.canParse(node)) {
            throw new Error('Invalid node string.');
        }

        const url = node instanceof URL ? node : new URL(node);

        const { username, password, hostname, searchParams, port, protocol } = url;

        if (protocol !== DISCORD_PLAYER_PROTOCOL) {
            throw new Error('Unsupported protocol in node string.');
        }

        const isSecure = searchParams.get('secure') === 'true';
        const isIpc = hostname === DISCORD_PLAYER_IPC_HOSTNAME;

        return {
            host: hostname,
            port: port ? Number(port) : null,
            secure: isSecure,
            clientId: username,
            password,
            ipc: isIpc
        };
    }
}
