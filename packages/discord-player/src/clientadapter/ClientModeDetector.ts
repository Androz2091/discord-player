import { Util } from '../utils/Util';
import { type SupportedClient } from './ClientAdapterFactory';
import { ClientType } from './IClientAdapter';

export interface ValidPackagesStructure {
    name: ClientType;
    test: () => boolean;
    testClient: (client: SupportedClient) => boolean;
}

export const VALID_PACKAGES: ValidPackagesStructure[] = [
    {
        name: 'discord.js',
        test() {
            const { error } = Util.require('discord.js');

            if (error) return false;

            return true;
        },
        testClient(client: SupportedClient) {
            try {
                const { module } = Util.require('discord.js') as { module: typeof import('discord.js') };

                return client instanceof module.Client;
            } catch {
                return false;
            }
        }
    },
    {
        name: 'eris',
        test() {
            const { error } = Util.require('eris');

            if (error) return false;

            return true;
        },
        testClient(client) {
            try {
                const { module } = Util.require('eris') as { module: typeof import('eris') };

                return client instanceof module.Client;
            } catch {
                return false;
            }
        }
    }
];

export function detectClientMode(client: SupportedClient): ClientType {
    for (const pkg of VALID_PACKAGES) {
        const isValid = pkg.test();
        const isInstance = pkg.testClient(client);

        if (isValid && isInstance) return pkg.name;
    }

    return 'unknown';
}
