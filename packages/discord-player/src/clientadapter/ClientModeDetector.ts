import { ClientType } from "./IClientAdapter";

export interface ValidPackagesStructure {
    name: ClientType;
    test: () => Promise<boolean>;
    testClient: (client: unknown) => Promise<boolean>
}

export const VALID_PACKAGES: ValidPackagesStructure[] = [
    {
        name: ClientType.DiscordJS,
        async test() {
            try {
                await import("discord.js");
                return true;
            } catch {
                return false;
            }
        },
        async testClient(client: unknown) {
            try {
                const { Client } = await import("discord.js");

                return client instanceof Client;
            } catch {

                return false;
            }
        }
    },
    {
        name: ClientType.Eris,
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

export async function detectClientMode(client: unknown): Promise<ClientType> {
    for (const pkg of VALID_PACKAGES) {
        const isValid = await pkg.test();
        const isInstance = await pkg.testClient(client);

        if (isValid && isInstance) return pkg.name;
    }

    return "unknown";
}
