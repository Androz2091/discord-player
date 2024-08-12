import { Client as DiscordJsClient } from 'discord.js';
import { Client as ErisClient } from 'eris';
import { DiscordJsClientAdapter } from './DiscordJsClientAdapter';
import { IClientAdapter } from './IClientAdapter';
import { Util } from '../utils/Util';

enum ClientType {
    DiscordJs = 'DjsClient',
    Eris = 'ErisClient',
    Unknown = 'Unknown'
}

type SupportedClient = DiscordJsClient | ErisClient;

export class ClientAdapterFactory {
    static createClientAdapter(client: SupportedClient): IClientAdapter {
        try {
            const clientType = this.getClientType(client);

            switch (clientType) {
                case ClientType.DiscordJs:
                    return new DiscordJsClientAdapter((client as DiscordJsClient));
                case ClientType.Eris:
                    Util.warn(
                        `You are using an Eris client, some things may not work correctly. This is currently under experimental support and it is still recommended to use a discord.js client.`,
                        'ExperimentalClientInstance'
                    );
                    // return new ErisClientAdapter((client as ErisClient));
                    throw new Error('Eris client is not supported yet');
                default:
                    throw new Error('Unsupported client type');
            }
        } catch (error) {
            throw new Error(`Failed to create client adapter: ${error}`);
        }
    }

    private static getClientType(client: SupportedClient): ClientType {
        if (client instanceof DiscordJsClient) {
            return ClientType.DiscordJs;
        }

        if (client instanceof ErisClient) {
            return ClientType.Eris;
        }

        return ClientType.Unknown;
    }
}
