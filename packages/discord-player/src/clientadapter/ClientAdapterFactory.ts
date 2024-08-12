import type { Client as DiscordJsClient } from 'discord.js';
import type { Client as ErisClient } from 'eris';
import { DiscordJsClientAdapter } from './DiscordJsClientAdapter';
import { IClientAdapter } from './IClientAdapter';
import { Util } from '../utils/Util';
import { detectClientMode } from './ClientModeDetector';

export type SupportedClient = DiscordJsClient | ErisClient;

export class ClientAdapterFactory {
    // @ts-ignore
    static createClientAdapter(client: SupportedClient): IClientAdapter {
        const libType = detectClientMode(client);

        try {
            switch (libType) {
                case 'discord.js':
                    return new DiscordJsClientAdapter(client as DiscordJsClient);
                case 'eris': {
                    Util.warn(
                        `You are using an Eris client, some things may not work correctly. This is currently under experimental support and it is still recommended to use a discord.js client.`,
                        'ExperimentalClientInstance'
                    );
                    // return new ErisClientAdapter(client as ErisClient)
                    throw new Error('Eris client not supported yet');
                }
                default: {
                    throw new Error('Unsupported client');
                }
            }
        } catch (error) {
            throw new Error(`Failed to create client adapter\n\n${error}`);
        }
    }
}
