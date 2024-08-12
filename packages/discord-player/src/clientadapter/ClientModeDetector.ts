import { type SupportedClient } from "./ClientAdapterFactory";
import { ClientType } from "./IClientAdapter";

export interface ValidPackagesStructure {
    name: ClientType;
    test: () => Promise<boolean>;
    testClient: (client: SupportedClient) => Promise<boolean>
}

export const VALID_PACKAGES: ValidPackagesStructure[] = [
    {
        name: "discord.js",
        async test() {
            try {
                await import("discord.js");
                return true;
            } catch {
                return false;
            }
        },
        async testClient(client: SupportedClient) {
            try {
                const { Client } = await import("discord.js");

                return client instanceof Client;
            } catch {
                return false;
            }
        }
    },
    {
        name: "eris",
        async test() {
            try {
                await import("eris");
                return true;
            } catch {
                return false;
            }
        },
        async testClient(client) {
            try {
                const { Client } = await import("eris");

                return client instanceof Client;
            } catch {
                return false;
            }
        },
    }
];

export async function detectClientMode(client: SupportedClient): Promise<ClientType> {
    for (const pkg of VALID_PACKAGES) {
        const isValid = await pkg.test();
        const isInstance = await pkg.testClient(client);

        if (isValid && isInstance) return pkg.name;
    }

    return "unknown";
}
