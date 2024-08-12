import { type SupportedClient } from "./ClientAdapterFactory";
import { ClientType } from "./IClientAdapter";

export interface ValidPackagesStructure {
    name: ClientType;
    test: () => boolean;
    testClient: (client: SupportedClient) => boolean
}

export const VALID_PACKAGES: ValidPackagesStructure[] = [
    {
        name: "discord.js",
        test() {
            try {
                require("discord.js")
                return true
            } catch {
                return false
            }
        },
        testClient(client: SupportedClient) {
            try {
                const { Client } = require("discord.js")

                return client instanceof Client
            } catch {
                return false
            }
        }
    },
    {
        name: "eris",
        test() {
            try {
                require("eris")
                return true
            } catch {
                return false
            }
        },
        testClient(client) {
            try {
                const { Client } = require("eris")

                return client instanceof Client
            } catch {
                return false
            }
        },
    }
]

export function detectClientMode(client: SupportedClient): ClientType {
    for(const pkg of VALID_PACKAGES) {
        const isValid = pkg.test()
        const isInstance = pkg.testClient(client)

        if(isValid && isInstance) return pkg.name
    }

    return "unknown"
}